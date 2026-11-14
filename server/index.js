import express from 'express';
import { School, workspaceRoutes, recordActivity } from './workspace.js';
import { acceptsOrigin } from './origin.js';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { catalog, roles } from '../catalog.js';
import { connect, models, Session, User } from './db.js';
import { hashPassword, login, logout, publicUser, requireUser } from './auth.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
app.use('/api', express.json({ limit: '32kb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (!acceptsOrigin(origin, req.get('host'), req.get('sec-fetch-site'), process.env.SCHOOL_DEV_MODE === '1')) {
      return res.status(403).json({ message: 'Invalid request origin.' });
    }
    if (req.method !== 'DELETE' && !req.is('application/json')) {
      return res.status(415).json({ message: 'Use JSON for this request.' });
    }
  }
  next();
});

app.get('/api/health', (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready });
});
app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: 20, message: { message: 'Too many attempts. Try again later.' } }), login);
app.post('/api/auth/logout', logout);
app.use('/api', requireUser);
app.use('/api/workspace', workspaceRoutes(User));
app.use('/api', async (req, res, next) => {
  const school = req.get('x-school-id');
  if (!school) return next();
  if (req.user.role !== 'admin' || !mongoose.isObjectIdOrHexString(school) || !await School.exists({ _id: school })) {
    return res.status(403).json({ message: 'School unavailable.' });
  }
  req.schoolId = new mongoose.Types.ObjectId(school);
  next();
});
app.get('/api/auth/me', (req, res) => res.json(publicUser(req.user)));

const adminOnly = (req, res, next) => req.user.role === 'admin'
  ? next() : res.status(403).json({ message: 'Administrator access required.' });

app.get('/api/users', adminOnly, async (_req, res) => res.json(await User.find().sort({ name: 1 })));
app.post('/api/users', adminOnly, async (req, res) => {
  const { name, email, password, role, studentIds = [] } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || name.length > 120 ||
      typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== 'string' || password.length < 12 || password.length > 128 || !roles.includes(role) ||
      !Array.isArray(studentIds) || studentIds.some(id => !mongoose.isObjectIdOrHexString(id))) {
    return res.status(400).json({ message: 'Enter valid account details and a password of 12 to 128 characters.' });
  }
  const ids = [...new Set(studentIds)];
  if ((role === 'student' && ids.length !== 1) || (role === 'parent' && !ids.length) ||
      (['admin', 'teacher'].includes(role) && ids.length) ||
      await models.students.countDocuments({ _id: { $in: ids } }) !== ids.length) {
    return res.status(400).json({ message: 'Select the student records appropriate for this role.' });
  }
  const user = await User.create({ name: name.trim(), email: email.toLowerCase(), role, studentIds: ids, passwordHash: await hashPassword(password) });
  res.status(201).json(publicUser(user));
});

export async function readScope(user, key) {
  if (catalog[key].personal) return { ownerId: user._id };
  if (user.role === 'admin') return {};
  if (user.role === 'teacher') {
    return ['students', 'classes', 'subjects', 'teachers', 'timetable', 'homework', 'attendance', 'exams', 'results', 'announcements'].includes(key) ? {} : null;
  }
  if (key === 'announcements' || key === 'library') return {};
  const studentIds = user.studentIds;
  if (key === 'students') return { _id: { $in: studentIds } };
  if (['attendance', 'results', 'fees'].includes(key)) return { studentId: { $in: studentIds } };
  if (key === 'payments') {
    const fees = await models.fees.distinct('_id', { studentId: { $in: studentIds } });
    return { feeId: { $in: fees } };
  }
  if (['classes', 'subjects', 'timetable', 'exams', 'homework'].includes(key)) {
    const classes = await models.students.distinct('classId', { _id: { $in: studentIds } });
    return { [key === 'classes' ? '_id' : 'classId']: { $in: classes } };
  }
  return null;
}

async function scopedRecords(req, key) {
  const scope = await readScope(req.user, key);
  return scope === null || catalog[key].personal ? scope : { ...scope, schoolId: req.schoolId ?? null };
}

app.get('/api/dashboard', async (req, res) => {
  const entries = await Promise.all(Object.entries(models).map(async ([key, model]) => {
    const scope = await scopedRecords(req, key);
    return scope === null ? null : [key, await model.countDocuments(scope)];
  }));
  res.json(Object.fromEntries(entries.filter(Boolean)));
});

app.use('/api/records/:collection', async (req, res, next) => {
  const key = req.params.collection;
  if (!Object.hasOwn(models, key)) return res.status(404).json({ message: 'Module not found.' });
  const scope = await scopedRecords(req, key);
  if (scope === null || (req.method !== 'GET' && req.user.role !== 'admin' &&
      !catalog[key].personal && !(req.user.role === 'teacher' && catalog[key].teacherWrite))) {
    return res.status(403).json({ message: 'You do not have access to this module or action.' });
  }
  req.record = { key, model: models[key], definition: catalog[key], scope };
  next();
});

app.get('/api/records/:collection', async (req, res) => {
  const { model, scope } = req.record;
  res.json(await model.find(scope).sort({ createdAt: -1 }));
});

async function validatedFields(req) {
  const result = {};
  for (const { key, label, type, options } of req.record.definition.fields) {
    const value = req.body?.[key];
    const valid = type === 'number' ? typeof value === 'number' && Number.isFinite(value) && value >= 0
      : typeof value === 'string' && value.length <= (type === 'textarea' ? 4000 : 200) &&
        (['notes', 'reference'].includes(key) || Boolean(value.trim()));
    if (!valid || (type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) ||
        (type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) ||
        (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) ||
        (type === 'ref' && (!mongoose.isObjectIdOrHexString(value) || !await models[options[0]].exists({ _id: value, schoolId: req.schoolId ?? null })))) {
      throw Object.assign(new Error('Enter a valid value for ' + label + '.'), { status: 400 });
    }
    result[key] = typeof value === 'string' ? value.trim() : value;
  }
  if (result.examId) {
    const [exam, student] = await Promise.all([models.exams.findById(result.examId), models.students.findById(result.studentId)]);
    if (result.marks > exam.maximum || !exam.classId.equals(student.classId)) {
      throw Object.assign(new Error('Marks must be within the exam maximum and match the student class.'), { status: 400 });
    }
  }
  if (result.start && result.end && result.end <= result.start) throw Object.assign(new Error('End time must follow start time.'), { status: 400 });
  return result;
}

app.post('/api/records/:collection', async (req, res) => {
  const record = await req.record.model.create({ ...await validatedFields(req), ...req.record.scope });
  await recordActivity(req.user._id, req.record.definition.label + ': ' + (record.name ?? 'new record')).catch(error => console.error(error.name));
  res.status(201).json(record);
});
app.put('/api/records/:collection/:id', async (req, res) => {
  const doc = await req.record.model.findOneAndUpdate(
    { ...req.record.scope, _id: req.params.id }, { $set: await validatedFields(req) },
    { new: true, runValidators: true },
  );
  if (!doc) return res.status(404).json({ message: 'Record not found.' });
  res.json(doc);
});
app.delete('/api/records/:collection/:id', async (req, res) => {
  const { key, model, scope } = req.record;
  const id = req.params.id;
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ message: 'Invalid record identifier.' });
  const links = Object.entries(catalog).flatMap(([collection, definition]) =>
    definition.fields.filter(field => field.type === 'ref' && field.options[0] === key)
      .map(field => models[collection].exists({ [field.key]: id })));
  if (key === 'students') links.push(User.exists({ studentIds: id }));
  if ((await Promise.all(links)).some(Boolean)) {
    return res.status(409).json({ message: 'This record is in use. Remove related records first.' });
  }
  const result = await model.deleteOne({ ...scope, _id: id });
  if (!result.deletedCount) return res.status(404).json({ message: 'Record not found.' });
  res.sendStatus(204);
});

app.use('/api', (_req, res) => res.status(404).json({ message: 'Endpoint not found.' }));
const dist = resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
}
app.use((err, _req, res, _next) => {
  if (err.code === 11000) return res.status(409).json({ message: 'A matching record already exists.' });
  if (['ValidationError', 'CastError'].includes(err.name)) {
    return res.status(400).json({ message: err.message });
  }
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ message: err.status === 400 && err.type ? 'Invalid JSON request.' : err.message });
  }
  console.error(err.name);
  res.status(500).json({ message: 'Something went wrong. Try again.' });
});

try {
  await connect();
} catch (error) {
  console.error('Could not connect to MongoDB (' + error.name + '). Check MONGODB_URI, database credentials and network access.');
  process.exit(1);
}
await Promise.all([User.init(), Session.init(), ...Object.values(models).map(model => model.init())]);
const port = process.env.PORT ?? 4000;
app.listen(port, () => console.log('School management API listening on port ' + port));
