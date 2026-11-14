import express from 'express';
import mongoose from 'mongoose';

const { Schema } = mongoose;
const objectId = Schema.Types.ObjectId;
export const School = mongoose.model('School', new Schema({
  name: { type: String, required: true, maxlength: 120, unique: true },
  campus: { type: String, required: true, maxlength: 120 },
}));
const Message = mongoose.model('Message', new Schema({
  from: { type: objectId, required: true, index: true },
  to: { type: objectId, required: true, index: true },
  body: { type: String, required: true, maxlength: 3000 },
  read: { type: Boolean, default: false },
}, { timestamps: true }));
const Activity = mongoose.model('WorkspaceActivity', new Schema({
  owner: { type: objectId, required: true, index: true },
  title: { type: String, required: true },
  kind: { type: String, default: 'Update' },
  read: { type: Boolean, default: false },
}, { timestamps: true }));

export function recordActivity(owner, title, kind) {
  return Activity.create({ owner, title, kind });
}

export function workspaceRoutes(User) {
  const router = express.Router();
  router.get('/schools', async (req, res) => res.json(req.user.role === 'admin' ? await School.find().sort('name') : []));
  router.post('/schools', async (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    const { name, campus } = req.body ?? {};
    if (![name, campus].every(value => typeof value === 'string' && value.trim() && value.length <= 120)) {
      return res.status(400).json({ message: 'Enter a school and campus name.' });
    }
    res.status(201).json(await School.create({ name: name.trim(), campus: campus.trim() }));
  });
  router.get('/contacts', async (req, res) => {
    res.json(await User.find({ _id: { $ne: req.user._id }, ...(req.user.role === 'admin' ? {} : { role: { $in: ['admin', 'teacher'] } }) })
      .select('name role').sort('name').limit(200));
  });
  router.get('/messages', async (req, res) => {
    res.json(await Message.find({ $or: [{ from: req.user._id }, { to: req.user._id }] })
      .sort({ createdAt: -1 }).limit(200));
  });
  router.post('/messages', async (req, res) => {
    const { to, body } = req.body ?? {};
    if (typeof to !== 'string' || !mongoose.isObjectIdOrHexString(to) || req.user._id.equals(to) ||
        typeof body !== 'string' || !body.trim() || body.length > 3000) {
      return res.status(400).json({ message: 'Choose a recipient and enter a message.' });
    }
    const recipient = await User.findOne({ _id: to, ...(req.user.role === 'admin' ? {} : { role: { $in: ['admin', 'teacher'] } }) });
    if (!recipient) return res.status(404).json({ message: 'Recipient unavailable.' });
    res.status(201).json(await Message.create({ from: req.user._id, to, body: body.trim() }));
  });
  router.post('/messages/read', async (req, res) => {
    await Message.updateMany({ to: req.user._id, read: false }, { read: true });
    res.sendStatus(204);
  });
  router.get('/activity', async (req, res) => {
    res.json(await Activity.find({ owner: req.user._id }).sort({ createdAt: -1 }).limit(100));
  });
  router.post('/activity/read', async (req, res) => {
    await Activity.updateMany({ owner: req.user._id, read: false }, { read: true });
    res.sendStatus(204);
  });
  return router;
}
