import React from 'react';
import { Icon } from './icons.jsx';
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

function Spotlight({ card, kind, onOpen }) {
  const teacher = kind === 'teacher';
  return <article className={'spotlight-card spotlight-' + kind}>
    <div className="spotlight-top">
      <span className="spotlight-label"><Icon name={teacher ? 'trophy' : 'medal'} />{card.title}</span>
      {card.stars && <span className="spotlight-stars" role="img" aria-label={card.stars + ' out of 5 stars'}>
        <span className="spotlight-stars-outline" aria-hidden="true">{Array.from({ length: 5 }, (_, star) => <Icon key={star} name="star" />)}</span>
        <span className="spotlight-stars-fill" aria-hidden="true" style={{ width: card.stars * 20 + '%' }}>{Array.from({ length: 5 }, (_, star) => <Icon key={star} name="star" />)}</span>
      </span>}
    </div>
    <h2><button type="button" onClick={onOpen}>{card.name}</button></h2>
    {card.detail && <p className="spotlight-detail"><Icon name={teacher ? 'atom' : 'cap'} />{card.detail}</p>}
    {card.award && <p className="spotlight-award"><Icon name="medal" />{card.award}</p>}
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
