import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { Icon } from './icons.jsx';

export function Inbox({ user, onRead, recipient }) {
  const [rows, setRows] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function load() {
    try {
      const [messages, people] = await Promise.all([api('workspace/messages'), api('workspace/contacts')]);
      setRows(messages); setContacts(people);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('workspace/messages','POST',Object.fromEntries(new FormData(form)));
      form.reset(); setNotice('Message sent.'); await load(); onRead();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const label = id => id === user.id ? 'You' : contacts.find(row => row._id === id)?.name ?? 'School account';
  return <><h1>Messages</h1><div className="account-layout"><form className="panel" onSubmit={submit}>
    <h2>Compose message</h2><label>Recipient<select name="to" defaultValue={recipient ?? ""} required><option value="">Choose a recipient</option>
      {contacts.map(row => <option key={row._id} value={row._id}>{row.name} · {row.role}</option>)}</select></label>
    <label>Message<textarea name="body" required maxLength={3000}/></label><button className="primary" disabled={busy || !contacts.length}>Send message</button>
    {notice && <p role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}</form>
    <section className="panel"><div className="title"><h2>Inbox</h2><div className="actions"><button onClick={load}>Refresh</button>
      <button onClick={async () => { try { await api('workspace/messages/read','POST',{}); await load(); onRead(); } catch (err) { setError(err.message); } }}>Mark read</button></div></div>
      {rows.length ? rows.map(row => <article className={'pop-item ' + (row.to === user.id && !row.read ? 'unread' : '')} key={row._id}>
        <strong>{label(row.from)} <Icon name="forward" /> {label(row.to)}</strong><p className="note-body">{row.body}</p><small>{new Date(row.createdAt).toLocaleString()}</small>
      </article>) : <p className="muted">No messages yet.</p>}</section></div></>;
}

export function RoleDashboard({ role, year, go }) {
  const [data, setData] = useState({});
  const [selected, setSelected] = useState('');
  const [error,setError] = useState('');
  useEffect(() => {
    let live = true;
    const keys = role === 'teacher' ? ['timetable','homework','attendance','results'] : ['students','timetable','homework','attendance','results','fees'];
    Promise.all(keys.map(async key => [key, await api('records/' + key)])).then(entries => {
      if (live) setData(Object.fromEntries(entries));
    }).catch(err=>{if(live)setError(err.message)});
    return () => { live = false; };
  }, [role,year]);
  const students = (data.students ?? []).filter(row => !year || row.year === year);
  const child = students.find(row => row._id === selected) ?? students[0];
  const stats = Object.entries(data).filter(([key]) => key !== 'students').map(([key,rows]) => [
    key, rows.filter(row => role === 'teacher' || (child && (!row.studentId || row.studentId === child._id) && (!row.classId || row.classId === child.classId))),
  ]);
  const labels = { timetable:'Timetable',homework:'Homework',attendance:'Attendance',results:'Exam results',fees:'Fees' };
  return <><section className="panel overview"><div><h2>{role === 'teacher' ? 'Teaching workspace' : child?.name ?? 'Student overview'}</h2>
    <p className="muted">{child ? child.admission + ' · ' + child.year : year || 'All academic years'}</p>
    {role === 'parent' && students.length > 0 && <label>Viewing student<select value={child._id} onChange={event => setSelected(event.target.value)}>
      {students.map(row => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>}</div>
    <div className="metrics">{stats.map(([key, rows]) => <button className="metric" key={key} onClick={() => go(key)}><strong>{rows.length}</strong><small>{labels[key]}</small></button>)}</div></section>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="dashboard-grid">{stats.map(([key,rows]) => <article className="panel" key={key}><h2>{labels[key]}</h2>
      {rows.length ? rows.slice(0,5).map(row => <div className="bar-row" key={row._id}>
        <span>{row.name ?? row.status ?? 'Recorded marks'}</span><strong>{row.day ?? row.date ?? row.due ?? row.marks}</strong></div>) : <p className="muted">No records yet.</p>}
      </article>)}</div></>;
}

export function ActivityPage() {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api('workspace/activity').then(setEntries, err => setError(err.message));
  }, []);
  return <><h1>Activity Timeline</h1><section className="panel">
    {error && <p className="error" role="alert">{error}</p>}
    {entries.map(row => <article className="pop-item" key={row._id}><strong>{row.title}</strong>
      <small>{row.kind} · {new Date(row.createdAt).toLocaleString()}</small></article>)}
    {!entries.length && !error && <p className="muted">No activity yet.</p>}
  </section></>;
}
