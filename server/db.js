import mongoose from 'mongoose';
import { catalog, roles } from '../catalog.js';

export async function connect() {
  await mongoose.connect(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/school_management', {
    serverSelectionTimeoutMS: 5000,
  });
}

export const User = mongoose.model('User', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: roles, required: true },
  studentIds: [mongoose.Schema.Types.ObjectId],
}, { timestamps: true }));

export const Session = mongoose.model('Session', new mongoose.Schema({
  digest: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}));

export const models = Object.fromEntries(Object.entries(catalog).map(([key, definition]) => {
  const fields = Object.fromEntries(definition.fields.map(({ key: name, type, options }) => [
    name, type === 'number' ? { type: Number, min: 0, required: true }
      : type === 'ref' ? { type: mongoose.Schema.Types.ObjectId, required: true }
      : { type: String, trim: true, maxlength: type === 'textarea' ? 4000 : 200,
          required: !['notes', 'reference'].includes(name),
          ...(type === 'select' ? { enum: options } : {}) },
  ]));
  const schema = new mongoose.Schema(fields, { timestamps: true, versionKey: false });
  if (definition.unique) {
    schema.index(Object.fromEntries(definition.unique.map(name => [name, 1])), { unique: true });
  }
  return [key, mongoose.model(key, schema, key)];
}));
