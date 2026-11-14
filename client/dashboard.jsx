import React, { useEffect, useState } from 'react';
import { api } from './api.js';

const colors = ['#4d5be4', '#2689ef', '#39b85e', '#ffb83d'];
const percent = (n, d) => d ? Math.round(100 * n / d) : null;
const rate = (n, d) => percent(n, d) === null ? '—' : percent(n, d) + '%';

export default function Dashboard({ user, counts, go, year }) {
  const [data, setData] = useState({});
  useEffect(() => {
    let active = true;
    const keys = ['classes', 'students', 'teachers', 'attendance', 'results', 'exams', 'fees', 'payments'];
    Promise.all(keys.filter(key => Object.hasOwn(counts, key)).map(async key => {
      try { return [key, await api('records/' + key)]; } catch { return [key, []]; }
    })).then(entries => { if (active) setData(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [counts]);

  const { classes = [], students: allStudents = [], teachers = [], attendance: allAttendance = [], results: allResults = [], exams = [], fees: allFees = [], payments: allPayments = [] } = data;
  const students = allStudents.filter(row => !year || row.year === year);
  const ids = new Set(students.map(row => row._id));
  const attendance = allAttendance.filter(row => !year || ids.has(row.studentId));
  const results = allResults.filter(row => !year || ids.has(row.studentId));
  const fees = allFees.filter(row => !year || ids.has(row.studentId));
  const feeIds = new Set(fees.map(row => row._id));
  const payments = allPayments.filter(row => !year || feeIds.has(row.feeId));
  const paid = payments.reduce((total, row) => total + row.amount, 0);
  const due = fees.reduce((total, row) => total + row.amount, 0);
  const present = attendance.filter(row => ['Present', 'Late'].includes(row.status)).length;
  const days = [...new Set(attendance.map(row => row.date))].sort().slice(-6);
  const scoreRows = results.map(row => ({ ...row, score: percent(row.marks, exams.find(exam => exam._id === row.examId)?.maximum) }))
    .filter(row => row.score !== null).sort((a, b) => b.score - a.score);
  const highest = scoreRows[0];
  const student = students.find(row => row._id === highest?.studentId);
  const buckets = ['On track', 'Needs review', 'Needs support'].map((label, index) => ({
    label, count: scoreRows.filter(row => (row.score >= 80 ? 0 : row.score >= 60 ? 1 : 2) === index).length,
  }));
  const metrics = [
    ['Attendance rate', rate(present, attendance.length), 'attendance', '✓'],
    ['Students enrolled', (year ? students.length : counts.students ?? 0), 'students', '♙'],
    ['Fees collected', paid.toLocaleString(), 'payments', '◈'],
    ['Exams', counts.exams ?? 0, 'exams', '▤'],
  ];
  return <>
    <section className="overview panel">
      <div><h2>Welcome, {user.name}</h2><p className="muted">School overview</p>
        <div className="actions">{user.role === 'admin' && <>
          <button className="primary" onClick={() => go('admissions', true)}>New admission</button>
          <button onClick={() => go('payments', true)}>Collect fees</button></>}
          <button onClick={() => window.print()}>Print dashboard</button>
        </div>
      </div>
      <div className="metrics">{metrics.filter(([, , key]) => Object.hasOwn(counts, key)).map(([label, value, key, icon]) =>
        <button className="metric" key={key} onClick={() => go(key)}><span className="metric-icon">{icon}</span>
          <strong>{value}</strong><small>{label}</small></button>)}</div>
    </section>
    <div className="dashboard-grid">
      {Object.hasOwn(counts, 'students') && <div className="spotlights">
        {Object.hasOwn(counts, 'teachers') && <article className="spotlight green"><span>Faculty spotlight</span>
          <h2>{teachers[0]?.name ?? 'Faculty'}</h2><p>{teachers[0]?.department ?? 'Teaching staff'}</p>
          <button onClick={() => go('teachers')}>View teachers</button></article>}
        <article className="spotlight blue"><span>{student ? 'Top student' : 'Student directory'}</span>
          <h2>{student?.name ?? 'Students'}</h2><p>{highest ? highest.score + '% highest recorded exam score' : counts.students + ' enrolled'}</p>
          <button onClick={() => go('students')}>View students</button></article>
      </div>}
      {Object.hasOwn(counts, 'classes') && <article className="panel analytics"><h2>Class-wise distribution</h2>
        <strong className="big-number">{students.length}</strong><p className="muted">Students enrolled</p>
        {classes.map((group, i) => {
          const count = students.filter(row => row.classId === group._id).length;
          return <div className="bar-row" key={group._id}><span>{group.name} · {group.section}</span><strong>{count}</strong>
            <div className="track"><div style={{ width: (percent(count, students.length) ?? 0) + '%', background: colors[i % colors.length] }} /></div></div>;
        })}
      </article>}
      {Object.hasOwn(counts, 'results') && <article className="panel analytics"><h2>Performance risk matrix</h2>
        <strong className="big-number">{scoreRows.length}</strong><p className="muted">Recorded exam results</p>
        <div className="risk-stack">{buckets.map(({ label, count }, i) => <span title={label + ': ' + count}
          key={label} style={{ flexGrow: count, background: ['#48c650', '#ffb93b', '#ef6671'][i] }} />)}</div>
        {buckets.map(({ label, count }) => <div className="bar-row" key={label}><span>{label}</span><strong>{count}</strong></div>)}
        <button onClick={() => go('results')}>View results</button>
      </article>}
      {Object.hasOwn(counts, 'attendance') && <><article className="panel analytics heat"><h2>Student attendance heatmap</h2>
        {days.length ? <div className="table-wrap"><table className="heat-table">
          <thead><tr><th>Class</th>{days.map(day => <th key={day}>{day.slice(5)}</th>)}</tr></thead>
          <tbody>{classes.map(group => <tr key={group._id}><th>{group.name} · {group.section}</th>
            {days.map(day => {
              const records = attendance.filter(row => row.date === day && students.some(student => student._id === row.studentId && student.classId === group._id));
              const value = percent(records.filter(row => row.status === 'Present' || row.status === 'Late').length, records.length);
              return <td key={day}><span style={{ background: value === null ? 'var(--line)' : 'rgba(67, 79, 219, ' + (.25 + value * .0075) + ')' }}>{value === null ? '—' : value + '%'}</span></td>;
            })}</tr>)}</tbody></table></div> : <p className="muted">Attendance will appear once recorded.</p>}
      </article><article className="panel analytics"><h2>Attendance breakdown</h2>
        <div className="ring" style={{ '--value': (percent(present, attendance.length) ?? 0) + '%' }}><strong>{rate(present, attendance.length)}</strong></div>
        {['Present', 'Absent', 'Late', 'On leave'].map(status => <div className="bar-row" key={status}>
          <span>{status}</span><strong>{attendance.filter(row => row.status === status).length}</strong></div>)}
      </article></>}
      {Object.hasOwn(counts, 'fees') && <article className="panel analytics"><h2>Fee collection</h2>
        <strong className="big-number">{paid.toLocaleString()}</strong><p className="muted">Payments recorded</p>
        <div className="bar-row"><span>Total billed</span><strong>{due.toLocaleString()}</strong></div>
        <div className="bar-row"><span>Outstanding</span><strong>{Math.max(0, due - paid).toLocaleString()}</strong></div>
      </article>}
    </div>
  </>;
}
