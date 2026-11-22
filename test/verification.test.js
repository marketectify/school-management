import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createHash } from "node:crypto";
import express from "express";
import { verificationRoutes } from "../server/verification.js";
import {
  createLogin,
  hashPassword,
  verifyPassword,
  establishSession,
  createRequireUser,
} from "../server/auth.js";
import { googleProvider, applicationOrigin } from "../server/google-auth.js";

const match = (row, query) =>
  Object.entries(query).every(([key, value]) => {
    if (key === "$or") return value.some((q) => match(row, q));
    if (value && typeof value === "object" && !(value instanceof Date))
      return Object.entries(value).every(([op, v]) =>
        op === "$gt"
          ? row[key] > v
          : op === "$lte"
            ? row[key] <= v
            : op === "$lt"
              ? row[key] < v
              : op === "$exists"
                ? (row[key] !== undefined) === v
                : op === "$in"
                  ? v.includes(row[key])
                  : false,
      );
    return String(row[key]) === String(value);
  });
async function fixture(
  run,
  { mail = true, google = true, mailFail = false } = {},
) {
  let now = new Date("2026-11-22T10:00:00Z"),
    serial = 0;
  const people = [],
    challenges = [],
    flows = [],
    sent = [],
    sessions = [],
    revoked = [],
    providerCalls = [];
  const User = {
    exists: async (q) => people.some((p) => match(p, q)),
    findOne: (q) => {
      const promise = Promise.resolve(people.find((p) => match(p, q)) || null);
      promise.select = () => promise;
      return promise;
    },
    create: async (value) => {
      if (
        people.some(
          (p) =>
            p.email === value.email ||
            (p.username && p.username === value.username) ||
            (p.googleSub && p.googleSub === value.googleSub),
        )
      )
        throw Object.assign(Error("duplicate"), { code: 11000 });
      const row = {
        _id: String(++serial).padStart(24, "0"),
        sessionVersion: 0,
        ...value,
      };
      row.id = row._id;
      people.push(row);
      return row;
    },
    updateOne: async (q, update) => {
      const row = people.find((p) => match(p, q));
      if (!row) return { matchedCount: 0 };
      Object.assign(row, update.$set);
      for (const [key, value] of Object.entries(update.$inc || {}))
        row[key] = (row[key] || 0) + value;
      return { matchedCount: 1 };
    },
    findOneAndUpdate: async (q, update) => {
      const row = people.find((p) => match(p, q));
      if (!row) return null;
      Object.assign(row, update.$set);
      for (const [key, value] of Object.entries(update.$inc || {}))
        row[key] = (row[key] || 0) + value;
      return row;
    },
  };
  const Challenge = {
    init: async () => {},
    findOne: async (q) => challenges.find((r) => match(r, q)) || null,
    deleteOne: async (q) => {
      const i = challenges.findIndex((r) => match(r, q));
      if (i >= 0) challenges.splice(i, 1);
    },
    findOneAndUpdate: async (q, update, options) => {
      let row = challenges.find((r) => match(r, q));
      if (!row && options?.upsert) {
        if (
          challenges.some((r) => r.email === q.email && r.purpose === q.purpose)
        )
          throw Object.assign(Error("duplicate"), { code: 11000 });
        row = { _id: "c" + ++serial };
        challenges.push(row);
      }
      if (!row) return null;
      Object.assign(row, update.$set);
      for (const [key, value] of Object.entries(update.$inc || {}))
        row[key] = (row[key] || 0) + value;
      return structuredClone(row);
    },
    findOneAndDelete: async (q) => {
      const i = challenges.findIndex((r) => match(r, q));
      if (i < 0) return null;
      return challenges.splice(i, 1)[0];
    },
  };
  const Flow = {
    init: async () => {},
    create: async (row) => flows.push(row),
    findOneAndDelete: async (q) => {
      const i = flows.findIndex((r) => match(r, q));
      return i < 0 ? null : flows.splice(i, 1)[0];
    },
  };
  const Session = {
    create: async (value) => sessions.push(value),
    deleteOne: async () => {},
    deleteMany: async (value) => revoked.push(value),
  };
  const session = async (_req, res, user) => {
    sessions.push({ userId: user._id, version: user.sessionVersion || 0 });
    res.cookie("test-session", "created");
  };
  const provider = {
    authorizationUrl: (input) => {
      providerCalls.push(input);
      return (
        "https://accounts.google.com/o/oauth2/v2/auth?state=" + input.state
      );
    },
    verify: async (input) => {
      assert.notEqual(input.nonce, "bad-nonce");
      providerCalls.push(input);
      return {
        sub: "google-subject-123",
        email: "google@example.com",
        name: "Google Example",
      };
    },
  };
  const app = express();
  app.use(express.json());
  app.post(
    "/auth/login",
    createLogin({ Users: User, Sessions: Session, session }),
  );
  app.use(
    "/auth",
    verificationRoutes({
      User,
      Session,
      Challenge,
      Flow,
      sendEmail: async (value) => {
        if (mailFail)
          throw Object.assign(Error("Delivery unavailable"), { status: 503 });
        sent.push(value);
      },
      emailReady: () => mail,
      googleReady: () => google,
      secret: () => "s".repeat(48),
      clock: () => now,
      generateCode: () => "012345",
      provider,
      session,
    }),
  );
  app.use((error, _req, res, _next) =>
    res.status(error.status || 500).json({ message: error.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const call = async (path, body, options = {}) => {
    const response = await fetch(
      "http://127.0.0.1:" + server.address().port + "/auth" + path,
      {
        method: options.method || (body ? "POST" : "GET"),
        redirect: "manual",
        headers: {
          "Content-Type": "application/json",
          ...(options.cookie ? { cookie: options.cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    return {
      status: response.status,
      headers: response.headers,
      data: response.headers.get("content-type")?.includes("json")
        ? await response.json()
        : null,
    };
  };
  try {
    await run({
      call,
      User,
      Session,
      people,
      challenges,
      flows,
      sent,
      sessions,
      revoked,
      providerCalls,
      advance: (ms) => {
        now = new Date(+now + ms);
      },
    });
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
const signup = {
  name: "Demo User",
  email: "demo@example.com",
  username: "demo.user",
  password: "My-unique-password-123",
};
test("signup requires email and creates no user until a single-use code is verified", async () =>
  fixture(async ({ call, people, challenges, sent }) => {
    assert.equal(
      (await call("/signup/start", { ...signup, email: "" })).status,
      400,
    );
    assert.equal(
      (await call("/signup/start", { ...signup, username: "bad@name" })).status,
      400,
    );
    const start = await call("/signup/start", {
      ...signup,
      role: "admin",
      status: "Active",
    });
    assert.equal(start.status, 202);
    assert.equal(people.length, 0);
    assert.equal(sent[0].to, signup.email);
    assert.equal(start.data.code, undefined);
    assert.notEqual(challenges[0].codeDigest, sent[0].code);
    assert.notEqual(challenges[0].payload.passwordHash, signup.password);
    const verify = await call("/signup/verify", {
      token: start.data.token,
      code: "012345",
    });
    assert.equal(verify.status, 201);
    assert.equal(verify.data.pending, true);
    assert.equal(people[0].status, "Pending");
    assert.equal(people[0].role, "parent");
    assert.equal(people[0].email, signup.email);
    assert.ok(people[0].emailVerifiedAt);
    assert.equal(
      (
        await call("/signup/verify", {
          token: start.data.token,
          code: "012345",
        })
      ).status,
      400,
    );
    assert.equal(people.length, 1);
  }));
test("codes expire, limit attempts, and cannot be reused across purposes", async () =>
  fixture(async ({ call, advance }) => {
    let start = await call("/signup/start", signup);
    assert.equal(
      (
        await call("/reset/complete", {
          token: start.data.token,
          code: "012345",
          password: "Different-password-123",
        })
      ).status,
      400,
    );
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await call("/signup/verify", {
            token: start.data.token,
            code: "111111",
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await call("/signup/verify", {
          token: start.data.token,
          code: "012345",
        })
      ).status,
      400,
    );
    advance(61000);
    start = await call("/signup/start", signup);
    advance(601000);
    assert.equal(
      (
        await call("/signup/verify", {
          token: start.data.token,
          code: "012345",
        })
      ).status,
      400,
    );
  }));
test("resending enforces cooldown and invalidates the previous challenge token", async () =>
  fixture(async ({ call, advance, sent }) => {
    const first = await call("/signup/start", signup);
    assert.equal(
      (await call("/code/resend", { token: first.data.token })).status,
      429,
    );
    advance(61000);
    const next = await call("/code/resend", { token: first.data.token });
    assert.equal(next.status, 202);
    assert.notEqual(next.data.token, first.data.token);
    assert.equal(sent.length, 2);
    assert.equal(
      (
        await call("/signup/verify", {
          token: first.data.token,
          code: "012345",
        })
      ).status,
      400,
    );
    assert.equal(
      (await call("/signup/verify", { token: next.data.token, code: "012345" }))
        .status,
      201,
    );
  }));
test("password reset delivers to stored email, requires code, and revokes earlier sessions", async () =>
  fixture(async ({ call, User, sent, revoked, people }) => {
    await User.create({
      ...signup,
      status: "Active",
      role: "teacher",
      passwordHash: await hashPassword(signup.password),
    });
    const start = await call("/reset/start", { identifier: "DEMO.USER" });
    assert.equal(start.status, 202);
    assert.equal(sent[0].to, signup.email);
    assert.equal(
      (
        await call("/reset/complete", {
          token: start.data.token,
          code: "111111",
          password: "Another-unique-password",
        })
      ).status,
      400,
    );
    assert.equal(revoked.length, 0);
    const result = await call("/reset/complete", {
      token: start.data.token,
      code: "012345",
      password: "Another-unique-password",
    });
    assert.equal(result.status, 200);
    assert.equal(
      await verifyPassword("Another-unique-password", people[0].passwordHash),
      true,
    );
    assert.equal(people[0].sessionVersion, 1);
    assert.equal(revoked.length, 1);
    assert.equal(
      (
        await call("/reset/complete", {
          token: start.data.token,
          code: "012345",
          password: "Yet-another-password",
        })
      ).status,
      400,
    );
  }));
test("email and username login work while pending accounts stay blocked", async () =>
  fixture(async ({ call, User, people }) => {
    await User.create({
      ...signup,
      role: "teacher",
      status: "Active",
      passwordHash: await hashPassword(signup.password),
    });
    for (const identifier of ["DEMO.USER", "DEMO@EXAMPLE.COM"])
      assert.equal(
        (await call("/login", { identifier, password: signup.password }))
          .status,
        200,
      );
    assert.equal(
      (
        await call("/login", {
          identifier: "unknown",
          password: signup.password,
        })
      ).status,
      401,
    );
    people[0].status = "Pending";
    assert.equal(
      (
        await call("/login", {
          identifier: signup.username,
          password: signup.password,
        })
      ).status,
      403,
    );
  }));
test("unknown reset identifiers return the same response shape without sending mail", async () =>
  fixture(async ({ call, sent }) => {
    const result = await call("/reset/start", { identifier: "missing" });
    assert.equal(result.status, 202);
    assert.equal(result.data.token.length, 64);
    assert.equal(sent.length, 0);
  }));
test("unconfigured email fails closed and Google is disabled without credentials", async () =>
  fixture(
    async ({ call, people, sent }) => {
      assert.equal((await call("/signup/start", signup)).status, 503);
      assert.equal(
        (await call("/reset/start", { identifier: signup.email })).status,
        503,
      );
      assert.equal(people.length, 0);
      assert.equal(sent.length, 0);
      assert.equal(
        (await call("/google/start")).headers.get("location"),
        "/?auth_error=google_unavailable",
      );
    },
    { mail: false, google: false },
  ));
test("Google flow uses PKCE, nonce, state cookie and verified email before new account creation", async () =>
  fixture(async ({ call, people, sent, flows, providerCalls }) => {
    const start = await call("/google/start"),
      state = new URL(start.headers.get("location")).searchParams.get("state"),
      cookie = start.headers.get("set-cookie").split(";")[0];
    assert.equal(state.length, 64);
    assert.ok(start.headers.get("set-cookie").includes("HttpOnly"));
    assert.equal(
      providerCalls[0].challenge,
      createHash("sha256").update(flows[0].verifier).digest("base64url"),
    );
    const wrong = await call(
      "/google/callback?state=" + state + "&code=code",
      undefined,
    );
    assert.equal(wrong.headers.get("location"), "/?auth_error=google_failed");
    assert.equal(sent.length, 0);
    const callback = await call(
      "/google/callback?state=" + state + "&code=code",
      undefined,
      { cookie },
    );
    const location = new URL(callback.headers.get("location"), "http://local");
    assert.equal(location.searchParams.get("auth_kind"), "google-signup");
    assert.equal(people.length, 0);
    assert.equal(sent[0].to, "google@example.com");
    assert.equal(
      (
        await call("/google/verify", {
          token: location.searchParams.get("auth_flow"),
          code: "012345",
          username: "google.demo",
        })
      ).status,
      201,
    );
    assert.equal(people[0].googleSub, "google-subject-123");
    assert.equal(people[0].status, "Pending");
  }));
test("existing local Google linking needs email code and preserves the school role", async () =>
  fixture(async ({ call, User, people, sessions }) => {
    await User.create({
      name: "School Owner",
      email: "google@example.com",
      username: "owner.demo",
      role: "admin",
      status: "Active",
      passwordHash: await hashPassword(signup.password),
    });
    const start = await call("/google/start"),
      state = new URL(start.headers.get("location")).searchParams.get("state"),
      cookie = start.headers.get("set-cookie").split(";")[0];
    const response = await call(
      "/google/callback?state=" + state + "&code=code",
      undefined,
      { cookie },
    );
    const target = new URL(response.headers.get("location"), "http://local");
    assert.equal(target.searchParams.get("auth_kind"), "google-link");
    assert.equal(people[0].googleSub, undefined);
    const result = await call("/google/verify", {
      token: target.searchParams.get("auth_flow"),
      code: "012345",
    });
    assert.equal(result.status, 200);
    assert.equal(result.data.user.role, "admin");
    assert.equal(people[0].googleSub, "google-subject-123");
    assert.equal(sessions.length, 1);
  }));
test("sessions record the credential version used to authenticate", async () => {
  const recorded = [];
  let cookieValue;
  await establishSession(
    { headers: {} },
    {
      cookie: (_name, value) => {
        cookieValue = value;
      },
    },
    { _id: "user", id: "user", sessionVersion: 4 },
    {
      Users: { updateOne: async () => {} },
      Sessions: { create: async (v) => recorded.push(v) },
    },
  );
  assert.equal(recorded[0].version, 4);
  assert.equal(cookieValue.length, 64);
});
test("password version change rejects a session even if its deletion raced with login", async () => {
  const person = {
    _id: "user",
    role: "teacher",
    status: "Active",
    sessionVersion: 2,
  };
  let next = false,
    status;
  const guard = createRequireUser({
    Users: { findById: async () => person },
    Sessions: { findOne: async () => ({ userId: "user", version: 1 }) },
  });
  await guard(
    { headers: { cookie: "school_session=" + "a".repeat(64) } },
    {
      status: (code) => {
        status = code;
        return { json: () => {} };
      },
    },
    () => {
      next = true;
    },
  );
  assert.equal(status, 401);
  assert.equal(next, false);
});
test("failed mail delivery cannot leave a usable code or create an account", async () =>
  fixture(
    async ({ call, people, challenges }) => {
      const result = await call("/signup/start", signup);
      assert.equal(result.status, 503);
      assert.equal(people.length, 0);
      assert.equal(challenges.length, 0);
    },
    { mailFail: true },
  ));
test("Google authorization URL uses the configured callback, state, nonce and PKCE", () => {
  const previous = Object.fromEntries(
    ["APP_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].map((key) => [
      key,
      process.env[key],
    ]),
  );
  try {
    process.env.APP_URL = "https://school.example.com";
    process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "test-only-not-a-real-secret";
    const url = new URL(
      googleProvider.authorizationUrl({
        state: "test-state",
        nonce: "test-nonce",
        challenge: "test-challenge",
      }),
    );
    assert.equal(url.origin, "https://accounts.google.com");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "https://school.example.com/api/auth/google/callback",
    );
    assert.equal(url.searchParams.get("state"), "test-state");
    assert.equal(url.searchParams.get("nonce"), "test-nonce");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("code_challenge"), "test-challenge");
    assert.throws(() =>
      applicationOrigin({ APP_URL: "http://untrusted.example.com" }),
    );
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
