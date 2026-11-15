import express from 'express';
import mongoose from 'mongoose';
import { models } from './db.js';

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
  subject: { type: String, maxlength: 160, default: '' },
  channel: { type: String, enum: ['chat', 'mail'], default: 'chat' },
  read: { type: Boolean, default: false },
}, { timestamps: true }));
const WorkspaceCall = mongoose.model('WorkspaceCall', new Schema({
  from: { type: objectId, required: true, index: true },
  to: { type: objectId, required: true, index: true },
  offer: { type: String, required: true }, answer: String, ended: Boolean,
  expires: { type: Date, required: true, expires: 0 },
}, { timestamps: true }));

const PersonalFile = mongoose.model('PersonalFile', new Schema({
  owner: { type: objectId, required: true, index: true },
  name: { type: String, required: true, maxlength: 160 },
  type: { type: String, required: true },
  bytes: { type: Buffer, required: true, select: false },
}, { timestamps: true }));

const AssignmentFile = mongoose.model('AssignmentFile', new Schema({
  submissionId: { type: objectId, required: true, unique: true },
  filename: { type: String, required: true },
  bytes: { type: Buffer, required: true },
}));
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

  async function contactScope(user) {
    if (user.role === 'admin') return {};
    const staff = { role: { $in: ['admin', 'teacher'] } };
    if (user.role !== 'teacher') return staff;
    const teacher = await models.teachers.findOne({ schoolId: null, email: user.email });
    if (!teacher) return staff;
    const classes = await models.timetable.distinct('classId', { schoolId: null, teacherId: teacher._id });
    const students = await models.students.distinct('_id', { schoolId: null, classId: { $in: classes } });
    return { $or: [staff, { role: 'parent', studentIds: { $in: students } }] };
  }
  router.post('/student-leave', async (req,res) => {
    if (!['student','parent'].includes(req.user.role)) return res.sendStatus(403);
    const studentId = req.user.role === 'parent' ? req.body?.studentId : req.user.studentIds[0];
    if (!mongoose.isObjectIdOrHexString(studentId)) return res.sendStatus(403);
    if (!req.user.studentIds.some(id => id.equals(studentId))) return res.sendStatus(403);
    const { date, reason } = req.body ?? {};
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0,10) !== date || typeof reason !== 'string' || !reason.trim() || reason.length > 200) {
      return res.status(400).json({ message: 'Enter a valid leave date and reason.' });
    }
    const student = await models.students.findOne({ _id: studentId, schoolId: null });
    if (!student) return res.sendStatus(404);
    const existing = await models.leaves.exists({ studentId: student._id, date, status: { $in: ['Pending','Approved'] } });
    if (existing) return res.status(409).json({ message: 'You already have a leave request for that date.' });
    await models.leaves.create({ studentId:student._id, schoolId:null, date, reason:reason.trim(), status:'Pending' });
    res.sendStatus(204);
  });
  router.get('/teacher-contacts', async (req,res) => {
    if (!['student','parent'].includes(req.user.role)) return res.sendStatus(403);
    const classes = await models.students.distinct('classId',{_id:{$in:req.user.studentIds},schoolId:null});
    const ids = await models.timetable.distinct('teacherId',{classId:{$in:classes},schoolId:null});
    const teachers = await models.teachers.find({_id:{$in:ids},schoolId:null}).select('email');
    const accounts = await User.find({role:'teacher',email:{$in:teachers.map(row=>row.email.toLowerCase())}}).select('email');
    res.json(teachers.flatMap(row=>{const account=accounts.find(item=>item.email===row.email.toLowerCase());return account?[{teacherId:row.id,userId:account.id}]:[];}));
  });
  router.post('/assignment-file', async (req,res) => {
    if (req.user.role !== 'student' || req.user.studentIds.length !== 1) return res.sendStatus(403);
    const { homeworkId, filename, content } = req.body ?? {};
    if (typeof homeworkId !== 'string' || !mongoose.isObjectIdOrHexString(homeworkId) ||
        typeof filename !== 'string' || !/^[\w .()-]{1,120}\.pdf$/i.test(filename) ||
        typeof content !== 'string' || content.length > 2796204 || !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) {
      return res.status(400).json({ message: 'Choose a PDF up to 2 MB with a simple file name.' });
    }
    const bytes = Buffer.from(content,'base64');
    if (bytes.length > 2097152 || bytes.subarray(0,5).toString() !== '%PDF-') return res.status(400).json({ message: 'Choose a valid PDF up to 2 MB.' });
    const student = await models.students.findOne({ _id: req.user.studentIds[0], schoolId: null });
    if (!student || !await models.homework.exists({ _id: homeworkId, classId: student.classId, schoolId: null })) return res.sendStatus(404);
    const now = new Date();
    const date = now.toISOString().slice(0,10);
    const submission = await models.submissions.findOneAndUpdate(
      { homeworkId, studentId: student._id },
      { $setOnInsert: { homeworkId, studentId: student._id, schoolId: null, date, status: 'Submitted', notes: 'Student PDF submission' } },
      { upsert:true,new:true,timestamps:false });
    if (submission.status === 'Graded') return res.status(409).json({ message:'This assignment has already been graded.' });
    await AssignmentFile.updateOne({ submissionId: submission._id }, { $set: { filename, bytes } }, { upsert:true });
    res.status(201).json({ id: submission.id });
  });
  router.get('/assignment-file/:id', async (req,res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.sendStatus(404);
    const submission = await models.submissions.findById(req.params.id);
    if (!submission) return res.sendStatus(404);
    const linked = req.user.studentIds.some(id => id.equals(submission.studentId));
    const teacher = req.user.role === 'teacher' && await models.teachers.findOne({ email: req.user.email, schoolId: null });
    const homework = teacher && await models.homework.findById(submission.homeworkId);
    const assigned = homework && await models.timetable.exists({ schoolId: null, teacherId: teacher._id, classId: homework.classId, subjectId: homework.subjectId });
    if (req.user.role !== 'admin' && !linked && !assigned) return res.sendStatus(403);
    const file = await AssignmentFile.findOne({ submissionId: submission._id });
    if (!file) return res.sendStatus(404);
    res.attachment(file.filename).type('application/pdf').send(file.bytes);
  });
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
    res.json(await User.find({ _id: { $ne: req.user._id }, ...await contactScope(req.user) })
      .select('name role').sort('name').limit(200));
  });
  const describeCall = ({ id, from, to, offer, answer, ended, createdAt }) =>
    ({ id, from, to, offer, answer, ended, createdAt });
  const callScope = user => ({ $or: [{ from: user._id }, { to: user._id }], expires: { $gt: new Date() } });
  const validSdp = value => typeof value === 'string' && value.startsWith('v=0') && value.length < 24000;
  router.get('/calls', async (req, res) => {
    const calls = await WorkspaceCall.find({ ...callScope(req.user), to: req.user._id, answer: null, ended: null,
      createdAt: { $gt: new Date(Date.now() - 120000) } }).sort({ createdAt: -1 }).limit(10);
    res.json(calls.map(({ id, from, createdAt }) => ({ id, from, createdAt })));
  });
  router.post('/calls', async (req, res) => {
    const { to, offer } = req.body ?? {};
    if (!mongoose.isObjectIdOrHexString(to) || req.user._id.equals(to) || !validSdp(offer)) return res.sendStatus(400);
    if (!await User.exists({ _id: to, ...await contactScope(req.user) })) return res.sendStatus(404);
    const call = await WorkspaceCall.create({ from: req.user._id, to, offer, expires: new Date(Date.now() + 7200000) });
    res.status(201).json(describeCall(call));
  });
  router.get('/calls/:id', async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.sendStatus(404);
    const call = await WorkspaceCall.findOne({ ...callScope(req.user), _id: req.params.id });
    if (!call) return res.sendStatus(404);
    res.json(describeCall(call));
  });
  router.post('/calls/:id/answer', async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id) || !validSdp(req.body?.answer)) return res.sendStatus(400);
    const call = await WorkspaceCall.findOneAndUpdate(
      { ...callScope(req.user), _id: req.params.id, to: req.user._id, answer: null, ended: null },
      { $set: { answer: req.body.answer } }, { new: true });
    if (!call) return res.sendStatus(409);
    res.json(describeCall(call));
  });
  router.post('/calls/:id/end', async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.sendStatus(404);
    await WorkspaceCall.updateOne({ ...callScope(req.user), _id: req.params.id }, { $set: { ended: true } });
    res.sendStatus(204);
  });
  router.get('/files', async (req, res) => {
    const rows = await PersonalFile.aggregate([
      { $match: { owner: req.user._id } },
      { $sort: { updatedAt: -1 } },
      { $project: { name: 1, type: 1, updatedAt: 1, size: { $binarySize: '$bytes' } } },
    ]);
    res.json(rows);
  });
  router.post('/files', async (req, res) => {
    const { name, type, content } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || name.length > 160 || /[\\/\x00-\x1f\x7f]/.test(name) ||
        typeof content !== 'string' || content.length > 2796204 || !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) {
      return res.status(400).json({ message: 'Choose a named file up to 2 MB.' });
    }
    const bytes = Buffer.from(content, 'base64');
    if (!bytes.length || bytes.length > 2097152) return res.status(400).json({ message: 'Choose a named file up to 2 MB.' });
    const mediaTypes = ['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm','audio/mpeg','audio/wav','application/pdf'];
    const file = await PersonalFile.create({
      owner: req.user._id, name: name.trim(), type: mediaTypes.includes(type) ? type : 'application/octet-stream', bytes,
    });
    res.status(201).json({ _id: file.id, name: file.name, type: file.type, size: bytes.length, updatedAt: file.updatedAt });
  });
  router.get('/files/:id', async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.sendStatus(404);
    const file = await PersonalFile.findOne({ _id: req.params.id, owner: req.user._id }).select('+bytes');
    if (!file) return res.sendStatus(404);
    res.type(file.type);
    if (req.query.preview !== '1' || file.type === 'application/octet-stream') res.attachment(file.name);
    res.send(file.bytes);
  });
  router.delete('/files/:id', async (req, res) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.sendStatus(404);
    const result = await PersonalFile.deleteOne({ _id: req.params.id, owner: req.user._id });
    res.sendStatus(result.deletedCount ? 204 : 404);
  });
  router.get('/messages', async (req, res) => {
    res.json(await Message.find({ $or: [{ from: req.user._id }, { to: req.user._id }] })
      .sort({ createdAt: -1 }).limit(200));
  });
  router.post('/messages', async (req, res) => {
    const { to, body, channel = 'chat', subject = '' } = req.body ?? {};
    if (typeof to !== 'string' || !mongoose.isObjectIdOrHexString(to) || req.user._id.equals(to) ||
        !['chat', 'mail'].includes(channel) || typeof subject !== 'string' || subject.length > 160 ||
        (channel === 'mail' && !subject.trim()) || typeof body !== 'string' || !body.trim() || body.length > 3000) {
      return res.status(400).json({ message: 'Choose a recipient and enter a message.' });
    }
    const recipient = await User.findOne({ _id: to, ...await contactScope(req.user) });
    if (!recipient) return res.status(404).json({ message: 'Recipient unavailable.' });
    res.status(201).json(await Message.create({ from: req.user._id, to, body: body.trim(), channel, subject: channel === 'mail' ? subject.trim() : '' }));
  });
  router.post('/messages/read', async (req, res) => {
    const { id, from } = req.body ?? {};
    if (id && from) return res.sendStatus(400);
    if ([id, from].some(value => value !== undefined && !mongoose.isObjectIdOrHexString(value))) return res.sendStatus(400);
    const scope = { to: req.user._id, read: false };
    if (id) scope._id = id;
    if (from) { scope.from = from; scope.channel = { $ne: 'mail' }; }
    await Message.updateMany(scope, { read: true });
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
