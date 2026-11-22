import {
  createHash,
  randomBytes,
  scrypt as derive,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { Session, User } from "./db.js";
import { AdminRole } from "./admin-models.js";
import { systemRoles } from "../administration.js";

const scrypt = promisify(derive);
const duration = 8 * 60 * 60 * 1000;
const cookie = "school_session";
const options = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
};
const digest = (token) => createHash("sha256").update(token).digest("hex");
const readToken = (req) =>
  req.headers.cookie?.match(
    /(?:^|;\s*)school_session=([a-f0-9]{64})(?:;|$)/,
  )?.[1];

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + (await scrypt(password, salt, 64)).toString("hex");
}

export async function verifyPassword(password, hash) {
  const [salt, value] = hash.split(":");
  return timingSafeEqual(
    await scrypt(password, salt, 64),
    Buffer.from(value, "hex"),
  );
}

const fallbackHash = "0".repeat(32) + ":" + "0".repeat(128);
export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  username: user.username,
  emailVerified: !!user.emailVerifiedAt,
  role: user.role,
  roleId: user.roleId,
  status: user.status || "Active",
  studentIds: user.studentIds,
  access: user.access,
});
export async function loadAccess(user) {
  if (!user || (user.status && user.status !== "Active")) return false;
  if (!user.roleId) return true;
  const profile =
    systemRoles.find((role) => role._id === user.roleId) ||
    (/^[a-f0-9]{24}$/i.test(user.roleId)
      ? await AdminRole.findById(user.roleId)
      : null);
  if (!profile || profile.status !== "Active" || profile.baseRole !== user.role)
    return false;
  user.access = [...profile.permissions];
  return true;
}

export function createLogin({
  Users = User,
  Sessions = Session,
  session = establishSession,
} = {}) {
  return async function login(req, res) {
    const { password } = req.body ?? {};
    const identifier = req.body?.identifier ?? req.body?.email;
    if (
      typeof identifier !== "string" ||
      !identifier.trim() ||
      identifier.length > 254 ||
      typeof password !== "string" ||
      password.length > 128
    ) {
      return res
        .status(400)
        .json({ message: "Enter your email or username and password." });
    }
    const value = identifier.trim().toLowerCase();
    const user = await Users.findOne(
      value.includes("@") ? { email: value } : { username: value },
    ).select("+passwordHash");
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? fallbackHash,
    );
    if (!user || !valid)
      return res
        .status(401)
        .json({ message: "Email, username or password is incorrect." });
    if (!(await loadAccess(user)))
      return res.status(403).json({
        message: "This account is not active. Contact your administrator.",
      });
    await session(req, res, user, { Users, Sessions });
    res.json(publicUser(user));
  };
}
export const login = createLogin();
export async function establishSession(
  req,
  res,
  user,
  { Users = User, Sessions = Session } = {},
) {
  const previous = readToken(req);
  if (previous) await Sessions.deleteOne({ digest: digest(previous) });
  const token = randomBytes(32).toString("hex");
  await Sessions.create({
    digest: digest(token),
    userId: user.id || user._id,
    version: user.sessionVersion || 0,
    expiresAt: new Date(Date.now() + duration),
  });
  await Users.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
  res.cookie(cookie, token, { ...options, maxAge: duration });
}

export function createRequireUser({ Users = User, Sessions = Session } = {}) {
  return async function requireUser(req, res, next) {
    const token = readToken(req);
    const session =
      token &&
      (await Sessions.findOne({
        digest: digest(token),
        expiresAt: { $gt: new Date() },
      }));
    req.user = session && (await Users.findById(session.userId));
    if (req.user && (session.version || 0) !== (req.user.sessionVersion || 0))
      req.user = null;
    if (!(await loadAccess(req.user)))
      return res
        .status(401)
        .json({ message: "Please sign in with an active account." });
    next();
  };
}
export const requireUser = createRequireUser();
export async function logout(req, res) {
  const token = readToken(req);
  if (token) await Session.deleteOne({ digest: digest(token) });
  res.clearCookie(cookie, options).sendStatus(204);
}
