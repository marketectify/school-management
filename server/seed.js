import mongoose from 'mongoose';
import { connect, User } from './db.js';
import { hashPassword } from './auth.js';

const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12 || password.length > 128) {
  throw new Error('Set a valid SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (12 to 128 characters).');
}

await connect();
try {
  await User.init();
  const result = await User.updateOne({ email }, {
    $setOnInsert: { name: 'School Administrator', role: 'admin', email, passwordHash: await hashPassword(password) },
  }, { upsert: true });
  console.log(result.upsertedCount ? 'Administrator created.' : 'An account with that email already exists.');
} finally {
  await mongoose.disconnect();
}
