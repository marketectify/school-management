import React, { useEffect, useState } from 'react';
import { api } from './api.js';

export function Avatar({ name }) {
  return <span className="avatar" aria-hidden="true">{name.split(' ').slice(0, 2).map(word => word[0]).join('')}</span>;
}

export function Profile({ student, group, close, edit }) {
  const [tab, setTab] = useState('Overview');
  const [data, setData] = useState({});
  useEffect(() => {
    let active = true;
    Promise.all(['attendance', 'results', 'fees', 'payments', 'exams'].map(async key => {
      try { return [key, await api('records/' + key)]; } catch { return [key, []]; }
    })).then(entries => { if (active) setData(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [student._id]);
  const list = key => (data[key] ?? []).filter(row => row.studentId === student._id);
  const fees = list('fees');
  const payments = (data.payments ?? []).filter(row => fees.some(fee => fee._id === row.feeId));
  const rows = {
    Overview: [['Admission number', student.admission], ['Class', group], ['Guardian', student.guardian], ['Phone', student.phone], ['Enrollment date', student.joined], ['Academic year', student.year]],
    Attendance: list('attendance').map(row => [row.date, row.status]),
    Results: list('results').map(row => [(data.exams ?? []).find(exam => exam._id === row.examId)?.name ?? 'Exam', row.marks]),
    Fees: [...fees.map(row => [row.name + ' · ' + row.due, row.amount.toLocaleString()]), ...payments.map(row => ['Paid · ' + row.date, row.amount.toLocaleString()])],
  };
  return <>
    <div className="title"><h1>Student Profile</h1><div className="actions"><button onClick={close}>Back to students</button>
      <button onClick={() => window.print()}>Print</button>{edit && <button className="primary" onClick={edit}>Edit Student</button>}</div></div>
    <section className="panel profile-title"><div className="student-name"><Avatar name={student.name} />
      <div><h2>{student.name} <span className="pill">{student.status}</span></h2>
        <p className="muted">{student.admission} · {group} · {student.year}</p></div></div></section>
    <div className="student-metrics">{[['Attendance entries', list('attendance').length], ['Exam results', list('results').length],
      ['Fees assigned', fees.length], ['Payments', payments.length]].map(([label, value]) =>
      <article className="panel" key={label}><span className="muted">{label}</span><strong>{value}</strong></article>)}</div>
    <div className="tabs">{Object.keys(rows).map(label => <button key={label} aria-pressed={tab === label} onClick={() => setTab(label)}>{label}</button>)}</div>
    <section className="panel"><h2>{tab}</h2>{rows[tab].length ? <dl>{rows[tab].map(([label, value], i) =>
      <div key={i}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="muted">No {tab.toLowerCase()} records.</p>}</section>
  </>;
}

export function Calendar({ rows, open, create }) {
  const sampleDate = rows[0]?.date;
  const [offset, setOffset] = useState(0);
  const base = sampleDate ? new Date(sampleDate + 'T12:00:00') : new Date();
  const date = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = date.getFullYear();
  const month = date.getMonth();
  const length = new Date(year, month + 1, 0).getDate();
  const start = (date.getDay() + 6) % 7;
  const key = day => year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  return <section className="panel"><div className="title"><h2>{date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
    <div className="actions"><button onClick={() => setOffset(offset - 1)}>Previous</button><button onClick={() => setOffset(offset + 1)}>Next</button></div></div>
    <div className="calendar">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div className="weekday" key={day}>{day}</div>)}
      {Array.from({ length: Math.ceil((start + length) / 7) * 7 }, (_, i) => {
        const day = i - start + 1;
        return <div key={i}>{day > 0 && day <= length && <>
          <button aria-label={'Add event on ' + key(day)} onClick={() => create(key(day))}>{day}</button>
          {rows.filter(row => row.date === key(day)).sort((a, b) => a.start.localeCompare(b.start)).map(row =>
            <button className="pill" key={row._id} onClick={() => open(row)}>{row.start} {row.name}</button>)}
        </>}</div>;
      })}</div>
  </section>;
}
