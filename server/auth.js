import { createHash, randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Session, User } from './db.js';

const scrypt = promisify(derive);
const duration = 8 * 60 * 60 * 1000;
const cookie = 'school_session';
const options = { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', path: '/' };
const digest = token => createHash('sha256').update(token).digest('hex');
const readToken = req => req.headers.cookie?.match(/(?:^|;\s*)school_session=([a-f0-9]{64})(?:;|$)/)?.[1];

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await scrypt(password, salt, 64)).toString('hex');
}

export async function verifyPassword(password, hash) {
  const [salt, value] = hash.split(':');
  return timingSafeEqual(await scrypt(password, salt, 64), Buffer.from(value, 'hex'));
}

const fallbackHash = '0'.repeat(32) + ':' + '0'.repeat(128);
export const publicUser = user => ({ name: user.name, email: user.email, role: user.role });

export async function login(req, res) {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 128) {
    return res.status(400).json({ message: 'Enter an email and password.' });
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  const valid = await verifyPassword(password, user?.passwordHash ?? fallbackHash);
  if (!user || !valid) return res.status(401).json({ message: 'Email or password is incorrect.' });
  const previous = readToken(req);
  if (previous) await Session.deleteOne({ digest: digest(previous) });
  const token = randomBytes(32).toString('hex');
  await Session.create({ digest: digest(token), userId: user.id, expiresAt: new Date(Date.now() + duration) });
  res.cookie(cookie, token, { ...options, maxAge: duration }).json(publicUser(user));
}

export async function requireUser(req, res, next) {
  const token = readToken(req);
  const session = token && await Session.findOne({ digest: digest(token), expiresAt: { $gt: new Date() } });
  req.user = session && await User.findById(session.userId);
  if (!req.user) return res.status(401).json({ message: 'Please sign in.' });
  next();
}

export async function logout(req, res) {
  const token = readToken(req);
  if (token) await Session.deleteOne({ digest: digest(token) });
  res.clearCookie(cookie, options).sendStatus(204);
}
