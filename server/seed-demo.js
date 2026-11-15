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
  const iso = date => [date.getFullYear(), date.getMonth()+1, date.getDate()].map(value => String(value).padStart(2,'0')).join('-');
  const now = new Date();
  const after = days => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate()+days));
  const academicToday = after(0);
  const owner = await User.findOne({ email: process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase(), role: 'admin' });
  if (owner) {
    await add('calendar',owner.id+'/faculty-meeting', {ownerId: owner._id,name:'Faculty Planning Meeting',date:after(1),start:'15:00',notes:'Conference hall · upcoming assessments'});
    await add('achievements',owner.id+'/professional-learning', {ownerId: owner._id,name:'Classroom assessment workshop',category:'Courses',date:academicToday,notes:'Demo workshop participation.'});
    await add('tickets', owner.id + '/projector', { ownerId: owner._id, name: 'Classroom projector check', body: 'Check the projector before the open day.', status: 'Open' });
    await add('files', owner.id + '/calendar', { ownerId: owner._id, name: 'School calendar reference', link: 'https://example.com/', notes: 'Replace with your published school document.' });
    const ownerId = owner._id;
    for (const [key,name,days,start,notes] of [
      ['annual-function','Annual Function',2,'11:30','School auditorium · awards and performances'],
      ['teacher-meeting','Teacher Meeting',4,'14:00','Conference room · faculty planning'],
      ['training','Teaching Workshop',7,'09:30','Staff training · computer lab'],
      ['parent-meeting','Parent–Teacher Meeting',9,'16:00','Meet families in the main hall'],
    ]) await add('calendar', owner.id + '/' + key, { ownerId, name, date:after(days), start, notes });
    for (const [key,name,days,status,priority,notes] of [
      ['briefing','Prepare teaching team briefing',0,'Pending','High','Share the agenda before the afternoon meeting.'],
      ['room-bookings','Confirm room bookings',-1,'Pending','Medium','Confirm the auditorium and science lab bookings.'],
      ['new-intake','Update new student register',-2,'Done','Low','Review the admission records with the registrar.'],
    ]) await add('todos', owner.id + '/' + key, { ownerId, name, due:after(days), status, priority, notes });
    for (const [key,name,priority,body] of [
      ['open-day-notes','Open day checklist','High','Confirm tour groups, classroom signs and parent welcome desks.'],
      ['reading-club','Reading club ideas','Medium','Create a rotating book list and invite students to share reviews.'],
      ['training-notes','Staff workshop notes','Low','Collect feedback and send the next session agenda.'],
    ]) await add('notes', owner.id + '/' + key, { ownerId, name, body, priority });
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
    for (const day of ['Tuesday','Wednesday','Thursday','Friday','Saturday']) {
      await add('timetable', key+'/'+day, {name: group.subject+' lesson',classId,subjectId,teacherId,day,start:'09:00',end:'09:45',room:group.room});
    }
    const homeworkId = await add('homework', key, { name: group.homework, classId, subjectId,
      due: '2026-11-23', instructions: 'Complete the assignment and bring it to the next lesson.' });
    await add('exams',key+'/upcoming', {name:group.subject+' Assessment',classId,subjectId,date:after(5),maximum:100});
    const examId = await add('exams', key, { name: group.subject + ' Midterm', classId, subjectId,
      date: '2026-11-06', maximum: 100 });
    for (const [index, name] of group.students.entries()) {
      const admission = 'DEMO-' + key + '0' + (index + 1);
      const studentId = await add('students', admission, { name, admission, classId, status: 'Active', gender: 'Unspecified',
        guardian: 'Guardian of ' + name, phone: '202-555-01' + key + index, joined: '2026-08-17', year: '2026/2027' }, { admission });
      for (const [day, date] of ['2026-11-11', '2026-11-12', '2026-11-13'].entries()) {
        const status = index === 1 && day === 1 ? 'Late' : index === 3 && day === 2 ? 'Absent' : 'Present';
        await add('attendance', admission + '/' + date, { studentId, date, status, notes: 'Demo attendance.' }, { studentId, date });
      }
      await add('results', admission, { studentId, examId, marks: 91 - index * 7, notes: 'Demo midterm result.' }, { studentId, examId });
      if (index < 3) await add('submissions',admission,{homeworkId,studentId,date:academicToday,status:index===0?'Graded':'Submitted',notes:'Demo submission.'});
      if (index === 1) await add('leaves',admission,{studentId,date:after(3),status:'Pending',reason:'Medical appointment'});
      await add('attendance',admission+'/'+academicToday,{studentId,date:academicToday,status:index===3?'Absent':'Present',notes:'Demo attendance.'},{studentId,date:academicToday});
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
      { name: 'Charlotte’s Web', author: 'E. B. White', isbn: '9780064400558', copies: 12, category: 'Literature' },
      { name: 'The Secret Garden', author: 'Frances Hodgson Burnett', isbn: '9780141321066', copies: 8, category: 'Literature' },
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
  const today = new Date();
  const sampleBooks = [
    ['A Brief History of Time','Stephen Hawking','9780553380163','Science',10],
    ['Introduction to Algorithms','Thomas H. Cormen','9780262046305','Programming',9],
    ['Calculus Made Easy','Silvanus P. Thompson','9780312185480','Mathematics',7],
    ['The Story of the World','Susan Wise Bauer','9781933339009','History',6],
    ['The Great Gatsby','F. Scott Fitzgerald','9780743273565','Literature',8],
  ];
  const students = await models.students.find({ schoolId: null, admission: /^DEMO-[678]0[1-4]$/ }).sort('admission');
  for (const [index, student] of students.entries()) {
    if (!student.gender) await models.students.updateOne({ _id: student._id, gender: { $exists: false } },
      { $set: { gender: [0,2,4,7,8,10].includes(index) ? 'Female' : 'Male' } });
  }
  for (const [name,author,isbn,category,copies] of sampleBooks) {
    const bookId = await add('library',name,{name,author,isbn,category,copies});
    for (let month=0;month<12;month++) {
      const issued = new Date(today.getFullYear(),today.getMonth()-month,1).toLocaleDateString('en-CA');
      const due = new Date(today.getFullYear(),today.getMonth()-month,21).toLocaleDateString('en-CA');
      for (const student of students.slice(0,1+((month+copies)%4))) {
        await add('loans',isbn+'/'+issued+'/'+student.admission,{bookId,studentId:student._id,date:issued,due,
          status: month===0 && student===students[0] ? 'Issued' : 'Returned'});
      }
    }
  }
  const routes = await models.transport.find({ schoolId: null, name: { $in: ['North Campus Route','East Campus Route'] } });
  for (let offset=0;offset<7;offset++) {
    const date = new Date(today.getFullYear(),today.getMonth(),today.getDate()-offset).toLocaleDateString('en-CA');
    for (const [index,channel] of ['SMS','Email','App Push','WhatsApp'].entries()) {
      await add('delivery',channel+'/'+date,{name:'Demo school update',date,channel,
        delivered:40+index*12+offset*5+(offset%2)*16,failed:index+2,pending:index,queued:1});
    }
    for (const [index,route] of routes.entries()) {
      await add('fleet',route.id+'/'+date,{routeId:route._id,date,fuel:24+offset+index*6,distance:98+offset*4+index*12,
        cost:6800+offset*150,trips:8,seats:120,riders:100+index*4,onTime:offset%2?8:7,status:'Active'});
    }
  }
}

try {
  await connect();
  await seed();
  console.log(Object.keys(created).length ? 'Demo records added: ' + JSON.stringify(created) : 'Demo records already exist.');
} finally {
  await mongoose.disconnect();
}
