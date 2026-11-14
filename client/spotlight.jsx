import React from 'react';
import { teacherPortrait, studentPortrait } from './spotlight-portraits.js';
import './spotlight.css';

const demoTeacher = {
  title: 'Best Teacher',
  name: 'Sarah Mitchell',
  detail: 'Physics Department',
  award: 'Teacher of the Year 2024',
  stars: 4.5,
  stats: [['4.9', 'Rating'], ['98%', 'Pass'], ['320', 'Students']],
  portrait: teacherPortrait,
};
const demoStudent = {
  title: 'Top Student',
  name: 'Emily Carter',
  detail: 'Grade XII-A · Science',
  award: 'National Olympiad Gold',
  stars: 5,
  stats: [['3.98', 'GPA'], ['#1', 'Rank'], ['99%', 'Attendance']],
  portrait: studentPortrait,
};

function Icon({ type }) {
  const paths = {
    trophy: 'M8 15h8m-4-4v4m-4-9H5v2a3 3 0 0 0 3 3m8-5h3v2a3 3 0 0 1-3 3M8 4h8v4a4 4 0 0 1-8 0V4Zm0 13h8',
    honor: 'M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-3-1-2 6 3-1 2 2 1-6m2-1 2 6-3-1',
    atom: 'M12 12h.01M4.5 4.5c1.3-1.3 5.5.7 9.4 4.6s5.9 8.1 4.6 9.4-5.5-.7-9.4-4.6S3.2 5.8 4.5 4.5Zm14 0c1.3 1.3-.7 5.5-4.6 9.4s-8.1 5.9-9.4 4.6.7-5.5 4.6-9.4 8.1-5.9 9.4-4.6Z',
    cap: 'm3 8 9-4 9 4-9 4-9-4Zm4 2v5c3 2 7 2 10 0v-5m4-2v6',
  };
  return <svg className="spotlight-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d={paths[type]} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function Spotlight({ card, kind, onOpen }) {
  const teacher = kind === 'teacher';
  return <article className={'spotlight-card spotlight-' + kind}>
    <div className="spotlight-top">
      <span className="spotlight-label"><Icon type={teacher ? 'trophy' : 'honor'} />{card.title}</span>
      {card.stars && <span className="spotlight-stars" aria-label={card.stars + ' out of 5 stars'}>
        <span className="spotlight-stars-outline" aria-hidden="true">★★★★★</span>
        <span className="spotlight-stars-fill" aria-hidden="true" style={{ width: card.stars * 20 + '%' }}>★★★★★</span>
      </span>}
    </div>
    <h2><button type="button" onClick={onOpen}>{card.name}</button></h2>
    {card.detail && <p className="spotlight-detail"><Icon type={teacher ? 'atom' : 'cap'} />{card.detail}</p>}
    {card.award && <p className="spotlight-award"><Icon type="honor" />{card.award}</p>}
    {card.portrait && <img className="spotlight-portrait" src={card.portrait} alt="" />}
    <dl className="spotlight-stats">{card.stats.map(([value,label]) =>
      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </article>;
}

export default function Spotlights({ teachers, students, scores, groups, go }) {
  const teacher = teachers.find(row => !/^demo\.teacher\d+@example\.com$/.test(row.email ?? '')) ?? teachers[0];
  const score = scores[0];
  const student = students.find(row => row._id === score?.id);
  const group = groups.find(row => row._id === student?.classId);
  const isDemoRoster = students.length > 0 && students.every(row => /^DEMO-[678]0[1-4]$/.test(row.admission));
  const showDemoTeacher = isDemoRoster && /^demo\.teacher\d+@example\.com$/.test(teacher?.email ?? '');
  const showDemoStudent = isDemoRoster && Boolean(student);

  const teacherCard = showDemoTeacher ? demoTeacher : {
    title: 'Faculty Spotlight', name: teacher?.name ?? 'Teachers', detail: teacher?.department,
    stats: [[teachers.length, 'Teachers']],
  };
  const studentCard = showDemoStudent ? demoStudent : {
    title: score ? 'Top Student' : 'Student Spotlight', name: student?.name ?? 'Students',
    detail: group && group.name + ' · ' + group.section,
    stats: score ? [[score.score + '%', 'Avg. score'], ['#1', 'Rank'], [score.records ? score.attendance + '%' : '—', 'Attendance']] : [[students.length, 'Students']],
  };

  return <section className="erp-spotlights" aria-label="Teacher and student spotlights" data-demo={showDemoTeacher || showDemoStudent || undefined}>
    <Spotlight card={teacherCard} kind="teacher" onOpen={() => go('teachers', false, !showDemoTeacher && teacher ? { name: teacher.name } : undefined)} />
    <Spotlight card={studentCard} kind="student" onOpen={() => go('students', false, !showDemoStudent && student ? { id: student._id, name: student.name } : undefined)} />
  </section>;
}
