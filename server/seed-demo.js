import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { connect, models, User } from './db.js';

const created = {};
async function add(module, key, fields, match) {
  const id = new mongoose.Types.ObjectId(createHash('sha256')
    .update('school-management/demo/v1/' + module + '/' + key).digest('hex').slice(0, 24));
  const model = models[module];
  const existing = await model.findOne(match ?? { _id: id });
  if (existing) return existing._id;
  const now = new Date();
  await new model(fields).validate();
  const result = await model.updateOne({ _id: id }, { $setOnInsert: { ...fields, createdAt: now, updatedAt: now } },
    { upsert: true, timestamps: false, runValidators: true });
  created[module] = (created[module] ?? 0) + result.upsertedCount;
  return id;
}

const groups = [
  { grade: 6, section: 'A', room: '201', subject: 'Mathematics', code: 'MATH6', teacher: 'Sara Ahmed',
    homework: 'Fractions practice', students: ['Amina Khan', 'Bilal Malik', 'Hania Noor', 'Ibrahim Ali'] },
  { grade: 7, section: 'B', room: '204', subject: 'Science', code: 'SCI7', teacher: 'Hamza Raza',
    homework: 'States of matter worksheet', students: ['Mariam Shah', 'Omar Hussain', 'Zain Abbas', 'Zoya Sheikh'] },
  { grade: 8, section: 'A', room: '208', subject: 'English', code: 'ENG8', teacher: 'Nadia Aslam',
    homework: 'Write a short story', students: ['Alina Rehman', 'Daniyal Iqbal', 'Fatima Saeed', 'Yusuf Mir'] },
];

async function seed() {
  const owner = await User.findOne({ email: process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase(), role: 'admin' });
  if (owner) {
    await add('tickets', owner.id + '/projector', { ownerId: owner._id, name: 'Classroom projector check', body: 'Check the projector before the open day.', status: 'Open' });
    await add('files', owner.id + '/calendar', { ownerId: owner._id, name: 'School calendar reference', link: 'https://example.com/', notes: 'Replace with your published school document.' });
    const ownerId = owner._id;
    await add('calendar', owner.id + '/open-day', { ownerId, name: 'School open day', date: '2026-11-24', start: '10:00', notes: 'Welcome families in the main hall.' });
    await add('todos', owner.id + '/reports', { ownerId, name: 'Review midterm reports', due: '2026-11-20', status: 'Pending', priority: 'High', notes: 'Review results with class teachers.' });
    await add('notes', owner.id + '/meeting', { ownerId, name: 'Academic planning meeting', body: 'Review lesson plans and confirm the next school event.', priority: 'Medium' });
  }
  for (const group of groups) {
    const key = String(group.grade);
    const classId = await add('classes', key, { name: 'Grade ' + key, section: group.section, room: group.room });
    const teacherId = await add('teachers', key, {
      name: group.teacher, email: 'demo.teacher' + key + '@example.com', department: group.subject, phone: '202-555-010' + key,
    });
    const subjectId = await add('subjects', key, { name: group.subject, code: group.code, classId });
    await add('timetable', key, { name: 'Period ' + (group.grade - 5), classId, subjectId, teacherId,
      day: 'Monday', start: '09:00', end: '09:45', room: group.room });
    await add('homework', key, { name: group.homework, classId, subjectId,
      due: '2026-11-23', instructions: 'Complete the assignment and bring it to the next lesson.' });
    const examId = await add('exams', key, { name: group.subject + ' Midterm', classId, subjectId,
      date: '2026-11-06', maximum: 100 });
    for (const [index, name] of group.students.entries()) {
      const admission = 'DEMO-' + key + '0' + (index + 1);
      const studentId = await add('students', admission, { name, admission, classId, status: 'Active',
        guardian: 'Guardian of ' + name, phone: '202-555-01' + key + index, joined: '2026-08-17', year: '2026/2027' }, { admission });
      for (const [day, date] of ['2026-11-11', '2026-11-12', '2026-11-13'].entries()) {
        const status = index === 1 && day === 1 ? 'Late' : index === 3 && day === 2 ? 'Absent' : 'Present';
        await add('attendance', admission + '/' + date, { studentId, date, status, notes: 'Demo attendance.' }, { studentId, date });
      }
      await add('results', admission, { studentId, examId, marks: 91 - index * 7, notes: 'Demo midterm result.' }, { studentId, examId });
      const feeId = await add('fees', admission, { name: 'November tuition', studentId, amount: 5000, due: '2026-11-25' });
      await add('invoices', admission, { name: 'November tuition invoice', studentId, amount: 5000,
        due: '2026-11-25', status: index < 2 ? 'Paid' : 'Issued' });
      if (index < 3) await add('payments', admission, { feeId, amount: index === 2 ? 2500 : 5000,
        date: '2026-11-10', method: index === 0 ? 'Cash' : 'Bank transfer', reference: 'DEMO-PAY-' + admission, notes: 'Demo payment.' });
    }
  }

  for (const [key, name, status] of [['6', 'Noor Tariq', 'Pending'], ['7', 'Ali Kamran', 'Accepted'], ['8', 'Mina Javed', 'Declined']]) {
    const group = groups.find(item => String(item.grade) === key);
    const classId = await add('classes', key, { name: 'Grade ' + key, section: group.section, room: group.room });
    await add('admissions', key, { name, classId, guardian: 'Guardian of ' + name, status, date: '2026-11-12', notes: 'Demo application.' });
  }

  const campus = {
    staff: [
      { name: 'Mehwish Akram', department: 'Administration', position: 'Admissions Officer', phone: '202-555-0111' },
      { name: 'Farhan Aziz', department: 'Library', position: 'Librarian', phone: '202-555-0112' },
    ],
    library: [
      { name: 'Charlotte’s Web', author: 'E. B. White', isbn: '9780064400558', copies: 12 },
      { name: 'The Secret Garden', author: 'Frances Hodgson Burnett', isbn: '9780141321066', copies: 8 },
    ],
    transport: [
      { name: 'North Campus Route', vehicle: 'Bus 01', driver: 'Asad Karim', stops: 'Central Park → Town Square → School' },
      { name: 'East Campus Route', vehicle: 'Bus 02', driver: 'Kamran Riaz', stops: 'Market Road → Library Junction → School' },
    ],
    hostel: [
      { name: 'A-101', building: 'Iqbal House', beds: 4, warden: 'Kiran Mahmood' },
      { name: 'B-202', building: 'Jinnah House', beds: 6, warden: 'Imran Tariq' },
    ],
    announcements: [
      { name: 'Parent-teacher meetings', date: '2026-11-13', body: 'Meetings will take place Friday afternoon. Contact the office for an appointment.' },
      { name: 'Library reading week', date: '2026-11-12', body: 'Students can pick a book and share a short review with their class.' },
    ],
  };
  for (const [module, records] of Object.entries(campus)) {
    for (const record of records) await add(module, record.name, record);
  }
}

try {
  await connect();
  await seed();
  console.log(Object.keys(created).length ? 'Demo records added: ' + JSON.stringify(created) : 'Demo records already exist.');
} finally {
  await mongoose.disconnect();
}
