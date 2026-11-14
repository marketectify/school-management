export const roles = ['admin', 'teacher', 'student', 'parent'];
const field = (key, label, type = 'text', options = []) => ({ key, label, type, options });
const select = (key, label, ...options) => field(key, label, 'select', options);
const ref = (key, label, collection) => field(key, label, 'ref', [collection]);
const date = (key, label) => field(key, label, 'date');
const number = (key, label) => field(key, label, 'number');
const notes = field('notes', 'Notes', 'textarea');

export const catalog = {
  classes: { label: 'Classes & sections', group: 'Academics', fields: [
    field('name', 'Class name'), field('section', 'Section'), field('room', 'Classroom'),
  ] },
  subjects: { label: 'Subjects', group: 'Academics', fields: [
    field('name', 'Subject'), field('code', 'Code'), ref('classId', 'Class', 'classes'),
  ] },
  students: { label: 'Students', group: 'People', unique: ['admission'], fields: [
    field('name', 'Full name'), field('admission', 'Admission number'), ref('classId', 'Class', 'classes'),
    select('status', 'Status', 'Active', 'Inactive', 'Graduated', 'Transferred'),
    field('guardian', 'Guardian name'), field('phone', 'Contact number'),
    date('joined', 'Admission date'), field('year', 'Academic year'),
  ] },
  teachers: { label: 'Teachers', group: 'People', fields: [
    field('name', 'Full name'), field('email', 'Email', 'email'), field('department', 'Department'), field('phone', 'Phone'),
  ] },
  staff: { label: 'Staff', group: 'People', fields: [
    field('name', 'Full name'), field('department', 'Department'), field('position', 'Designation'), field('phone', 'Phone'),
  ] },
  admissions: { label: 'Admissions', group: 'People', fields: [
    field('name', 'Applicant'), ref('classId', 'Requested class', 'classes'), field('guardian', 'Guardian name'),
    select('status', 'Status', 'Pending', 'Accepted', 'Declined'), date('date', 'Application date'), notes,
  ] },
  timetable: { label: 'Timetable', group: 'Academics', fields: [
    field('name', 'Period'), ref('classId', 'Class', 'classes'), ref('subjectId', 'Subject', 'subjects'),
    ref('teacherId', 'Teacher', 'teachers'), select('day', 'Day', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
    field('start', 'Start time', 'time'), field('end', 'End time', 'time'), field('room', 'Room'),
  ] },
  homework: { label: 'Homework', group: 'Academics', teacherWrite: true, fields: [
    field('name', 'Assignment'), ref('classId', 'Class', 'classes'), ref('subjectId', 'Subject', 'subjects'),
    date('due', 'Due date'), field('instructions', 'Instructions', 'textarea'),
  ] },
  attendance: { label: 'Attendance', group: 'Academics', teacherWrite: true, unique: ['studentId', 'date'], fields: [
    ref('studentId', 'Student', 'students'), date('date', 'Date'),
    select('status', 'Status', 'Present', 'Absent', 'Late', 'On leave'), notes,
  ] },
  exams: { label: 'Exams', group: 'Academics', fields: [
    field('name', 'Exam name'), ref('classId', 'Class', 'classes'), ref('subjectId', 'Subject', 'subjects'),
    date('date', 'Exam date'), number('maximum', 'Maximum marks'),
  ] },
  results: { label: 'Marks & results', group: 'Academics', teacherWrite: true, unique: ['studentId', 'examId'], fields: [
    ref('studentId', 'Student', 'students'), ref('examId', 'Exam', 'exams'), number('marks', 'Marks'), notes,
  ] },
  fees: { label: 'Student fees', group: 'Finance', fields: [
    field('name', 'Fee description'), ref('studentId', 'Student', 'students'),
    number('amount', 'Amount'), date('due', 'Due date'),
  ] },
  payments: { label: 'Fee payments', group: 'Finance', fields: [
    ref('feeId', 'Fee', 'fees'), number('amount', 'Amount'), date('date', 'Payment date'),
    select('method', 'Method', 'Cash', 'Bank transfer', 'Card'), field('reference', 'Reference'), notes,
  ] },
  library: { label: 'Library books', group: 'Campus', fields: [
    field('name', 'Title'), field('author', 'Author'), field('isbn', 'ISBN'), number('copies', 'Copies'),
  ] },
  transport: { label: 'Transport routes', group: 'Campus', fields: [
    field('name', 'Route name'), field('vehicle', 'Vehicle'), field('driver', 'Driver'), field('stops', 'Stops', 'textarea'),
  ] },
  hostel: { label: 'Hostel rooms', group: 'Campus', fields: [
    field('name', 'Room'), field('building', 'Building'), number('beds', 'Beds'), field('warden', 'Warden'),
  ] },
  announcements: { label: 'Announcements', group: 'Communication', fields: [
    field('name', 'Title'), date('date', 'Publish date'), field('body', 'Announcement', 'textarea'),
  ] },
};
