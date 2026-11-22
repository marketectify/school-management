import express from "express";
import { rateLimit } from "express-rate-limit";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { VerificationChallenge, GoogleFlow } from "./verification-models.js";
import { sendVerificationEmail, emailConfigured } from "./email.js";
import {
  applicationOrigin,
  googleConfigured,
  googleProvider,
} from "./google-auth.js";
import {
  hashPassword,
  establishSession,
  loadAccess,
  publicUser,
} from "./auth.js";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
export const validEmail = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validUsername = (value) =>
  typeof value === "string" &&
  /^[a-z0-9][a-z0-9._-]{2,29}$/.test(value) &&
  !["admin", "administrator", "root", "system", "support", "api"].includes(
    value,
  );
const passwordValid = (value) =>
  typeof value === "string" && value.length >= 12 && value.length <= 128;
const opaque = () => randomBytes(32).toString("hex");
export const codeDigest = (secret, email, purpose, tokenDigest, code) =>
  createHmac("sha256", secret)
    .update([email, purpose, tokenDigest, code].join("\0"))
    .digest("hex");

export function verificationRoutes({
  User,
  Session,
  Challenge = VerificationChallenge,
  Flow = GoogleFlow,
  sendEmail = sendVerificationEmail,
  emailReady = () => emailConfigured(),
  googleReady = () => googleConfigured(),
  provider = googleProvider,
  secret = () => process.env.AUTH_CODE_SECRET,
  clock = () => new Date(),
  generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
  session = establishSession,
} = {}) {
  const router = express.Router();
  const limited = (limit) =>
    rateLimit({
      windowMs: 15 * 60_000,
      limit,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: {
        message: "Too many requests. Please wait before trying again.",
      },
    });
  router.get("/config", (_req, res) =>
    res.json({
      email: emailReady(),
      google: googleReady(),
      signupApproval: true,
    }),
  );
  const ensureEmail = () => {
    if (!emailReady() || !secret() || secret().length < 32)
      fail(
        "Email verification is currently unavailable. Please contact your administrator.",
        503,
      );
  };
  async function issue(email, purpose, payload) {
    ensureEmail();
    await Challenge.init();
    const now = clock(),
      token = opaque(),
      hash = digest(token),
      code = generateCode();
    let row;
    try {
      row = await Challenge.findOneAndUpdate(
        {
          email,
          purpose,
          $or: [
            { nextSendAt: { $lte: now } },
            { nextSendAt: { $exists: false } },
          ],
        },
        {
          $set: {
            email,
            purpose,
            tokenDigest: hash,
            codeDigest: codeDigest(secret(), email, purpose, hash, code),
            payload,
            attempts: 0,
            expiresAt: new Date(+now + 10 * 60_000),
            nextSendAt: new Date(+now + 60_000),
          },
        },
        { upsert: true, new: true, runValidators: true },
      );
    } catch (error) {
      if (error.code === 11000)
        fail("Please wait 60 seconds before requesting another code.", 429);
      throw error;
    }
    try {
      await sendEmail({ to: email, code, purpose });
    } catch (error) {
      await Challenge.deleteOne({ _id: row._id, tokenDigest: hash });
      throw error;
    }
    return { token, expiresIn: 600, resendAfter: 60 };
  }
  async function consume(token, code, purposes) {
    ensureEmail();
    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token) ||
      typeof code !== "string" ||
      !/^\d{6}$/.test(code)
    )
      fail("Enter the six-digit code from your email.");
    const row = await Challenge.findOneAndUpdate(
      {
        tokenDigest: digest(token),
        purpose: { $in: purposes },
        expiresAt: { $gt: clock() },
        attempts: { $lt: 5 },
      },
      { $inc: { attempts: 1 } },
      { new: true },
    );
    if (!row)
      fail("The code is invalid, expired or already used. Request a new code.");
    const expected = codeDigest(
      secret(),
      row.email,
      row.purpose,
      row.tokenDigest,
      code,
    );
    if (
      !timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(row.codeDigest, "hex"),
      )
    )
      fail("The code is incorrect. Check your email and try again.");
    const consumed = await Challenge.findOneAndDelete({
      _id: row._id,
      tokenDigest: row.tokenDigest,
      codeDigest: row.codeDigest,
      attempts: row.attempts,
      expiresAt: { $gt: clock() },
    });
    if (!consumed) fail("This code has already been used. Request a new one.");
    return consumed;
  }
  async function usernameAvailable(username) {
    if (!validUsername(username))
      fail(
        "Use a username of 3–30 letters, numbers, dots, underscores or hyphens.",
      );
    if (await User.exists({ username }))
      fail("That username is already taken. Please choose another.", 409);
  }
  router.post("/signup/start", limited(8), async (req, res) => {
    const { name, password } = req.body || {},
      email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "",
      username =
        typeof req.body?.username === "string"
          ? req.body.username.trim().toLowerCase()
          : "";
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 120 ||
      !validEmail(email) ||
      !passwordValid(password)
    )
      fail(
        "Enter your name, a valid email and a password of at least 12 characters.",
      );
    ensureEmail();
    await usernameAvailable(username);
    if (await User.exists({ email }))
      fail(
        "An account with this email already exists. Sign in or reset your password.",
        409,
      );
    res.status(202).json({
      ...(await issue(email, "signup", {
        name: name.trim(),
        username,
        passwordHash: await hashPassword(password),
      })),
      message: "Check your email for a verification code.",
    });
  });
  router.post("/signup/verify", limited(30), async (req, res) => {
    const row = await consume(req.body?.token, req.body?.code, ["signup"]);
    await usernameAvailable(row.payload.username);
    await User.create({
      name: row.payload.name,
      email: row.email,
      username: row.payload.username,
      passwordHash: row.payload.passwordHash,
      emailVerifiedAt: clock(),
      role: "parent",
      status: "Pending",
      studentIds: [],
    });
    res.status(201).json({
      pending: true,
      message:
        "Email verified. Your account is awaiting administrator approval and role assignment.",
    });
  });
  router.post("/reset/start", limited(8), async (req, res) => {
    ensureEmail();
    const identifier = req.body?.identifier;
    if (
      typeof identifier !== "string" ||
      !identifier.trim() ||
      identifier.length > 254
    )
      fail("Enter your email or username.");
    const value = identifier.trim().toLowerCase(),
      user = await User.findOne(
        value.includes("@") ? { email: value } : { username: value },
      );
    const flow = user
      ? await issue(user.email, "reset", { userId: user._id })
      : { token: opaque(), expiresIn: 600, resendAfter: 60 };
    res.status(202).json({
      ...flow,
      message:
        "If this account exists, a code has been sent to its registered email.",
    });
  });
  router.post("/reset/complete", limited(30), async (req, res) => {
    if (!passwordValid(req.body?.password))
      fail("Use a password between 12 and 128 characters.");
    const row = await consume(req.body?.token, req.body?.code, ["reset"]);
    const result = await User.updateOne(
      { _id: row.payload.userId, email: row.email },
      {
        $set: {
          passwordHash: await hashPassword(req.body.password),
          emailVerifiedAt: clock(),
        },
        $inc: { sessionVersion: 1 },
      },
    );
    if (!result.matchedCount)
      fail("The account changed. Please request another reset code.", 409);
    await Session.deleteMany({ userId: row.payload.userId });
    res.json({
      message: "Password changed. Sign in again with your new password.",
    });
  });
  router.post("/code/resend", limited(8), async (req, res) => {
    ensureEmail();
    const token = req.body?.token;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      fail("Start verification again to request a code.");
    const row = await Challenge.findOne({
      tokenDigest: digest(token),
      expiresAt: { $gt: clock() },
    });
    if (!row)
      return res.status(202).json({
        token,
        expiresIn: 600,
        resendAfter: 60,
        message: "If this request is valid, a new code has been sent.",
      });
    const flow = await issue(row.email, row.purpose, row.payload);
    res
      .status(202)
      .json({ ...flow, message: "A new code has been sent to your email." });
  });
  const stateCookie = "school_google_state",
    cookieOptions = () => ({
      httpOnly: true,
      sameSite: "lax",
      secure: applicationOrigin().startsWith("https:"),
      path: "/api/auth/google",
      maxAge: 10 * 60_000,
    });
  router.get("/google/start", limited(20), async (_req, res) => {
    if (!googleReady()) return res.redirect("/?auth_error=google_unavailable");
    const state = opaque(),
      verifier = randomBytes(32).toString("base64url"),
      nonce = opaque();
    await Flow.init();
    await Flow.create({
      digest: digest(state),
      verifier,
      nonce,
      expiresAt: new Date(+clock() + 10 * 60_000),
    });
    res.cookie(stateCookie, state, cookieOptions()).redirect(
      provider.authorizationUrl({
        state,
        nonce,
        challenge: createHash("sha256").update(verifier).digest("base64url"),
      }),
    );
  });
  router.get("/google/callback", limited(30), async (req, res) => {
    const options = cookieOptions();
    delete options.maxAge;
    res.clearCookie(stateCookie, options);
    try {
      if (!googleReady()) throw new Error("Not configured");
      const state = req.query.state,
        cookieState = req.headers.cookie?.match(
          /(?:^|;\s*)school_google_state=([a-f0-9]{64})(?:;|$)/,
        )?.[1];
      if (
        typeof state !== "string" ||
        !/^[a-f0-9]{64}$/.test(state) ||
        !cookieState ||
        !timingSafeEqual(Buffer.from(state), Buffer.from(cookieState))
      )
        throw new Error("Invalid state");
      const flow = await Flow.findOneAndDelete({
        digest: digest(state),
        expiresAt: { $gt: clock() },
      });
      if (
        !flow ||
        req.query.error ||
        typeof req.query.code !== "string" ||
        req.query.code.length > 8192
      )
        throw new Error("Invalid Google response");
      const profile = await provider.verify({
        code: req.query.code,
        verifier: flow.verifier,
        nonce: flow.nonce,
      });
      if (
        !validEmail(profile.email) ||
        typeof profile.sub !== "string" ||
        !profile.sub ||
        profile.sub.length > 255
      )
        throw new Error("Invalid identity");
      const linked = await User.findOne({ googleSub: profile.sub });
      if (linked) {
        if (!(await loadAccess(linked)))
          return res.redirect(
            "/?auth_notice=" +
              (linked.status === "Pending" ? "pending" : "inactive"),
          );
        await session(req, res, linked, { Users: User, Sessions: Session });
        return res.redirect("/");
      }
      const existing = await User.findOne({ email: profile.email });
      if (existing && existing.googleSub)
        throw new Error("Different Google identity");
      const issued = await issue(
        profile.email,
        existing ? "google-link" : "google-signup",
        {
          googleSub: profile.sub,
          name: String(profile.name || "Google User").slice(0, 120),
          ...(existing ? { userId: existing._id } : {}),
        },
      );
      res.redirect(
        "/?auth_flow=" +
          issued.token +
          "&auth_kind=" +
          (existing ? "google-link" : "google-signup"),
      );
    } catch (error) {
      console.error("Google sign-in did not complete (" + error.name + ").");
      res.redirect("/?auth_error=google_failed");
    }
  });
  router.post("/google/verify", limited(30), async (req, res) => {
    const token = req.body?.token;
    const pending =
      typeof token === "string"
        ? await Challenge.findOne({
            tokenDigest: digest(token),
            purpose: "google-signup",
            expiresAt: { $gt: clock() },
          })
        : null;
    const username =
      typeof req.body?.username === "string"
        ? req.body.username.trim().toLowerCase()
        : "";
    if (pending) await usernameAvailable(username);
    const row = await consume(token, req.body?.code, [
      "google-signup",
      "google-link",
    ]);
    if (row.purpose === "google-signup") {
      await User.create({
        name: row.payload.name,
        email: row.email,
        username,
        googleSub: row.payload.googleSub,
        passwordHash: await hashPassword(opaque()),
        emailVerifiedAt: clock(),
        role: "parent",
        status: "Pending",
        studentIds: [],
      });
      return res.status(201).json({
        pending: true,
        message:
          "Email verified. Your Google account is awaiting administrator approval and role assignment.",
      });
    }
    const updated = await User.findOneAndUpdate(
      {
        _id: row.payload.userId,
        email: row.email,
        $or: [{ googleSub: { $exists: false } }, { googleSub: null }],
      },
      {
        $set: { googleSub: row.payload.googleSub, emailVerifiedAt: clock() },
        $inc: { sessionVersion: 1 },
      },
      { new: true, runValidators: true },
    );
    if (!updated)
      fail(
        "Account linking could not complete. Please start Google sign-in again.",
        409,
      );
    await Session.deleteMany({ userId: updated._id });
    if (!(await loadAccess(updated)))
      return res.json({
        pending: true,
        message:
          "Email verified. This account needs administrator approval before it can sign in.",
      });
    await session(req, res, updated, { Users: User, Sessions: Session });
    res.json({ user: publicUser(updated) });
  });
  return router;
}
