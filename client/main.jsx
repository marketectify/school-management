import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { catalog, roles } from '../catalog.js';
import './style.css';
import './upgrade.css';
import Dashboard from './dashboard.jsx';
import TopBar from './topbar.jsx';
import { SidebarMenu, ModuleInfo } from './sidebar.jsx';
import ParentDashboard from './parent-dashboard.jsx';
import { ActivityPage, RoleDashboard } from './portal.jsx';
import StudentDashboard from './student-dashboard.jsx';
import TeacherDashboard from './teacher-dashboard.jsx';
import './topbar.css';
import { Avatar, Profile } from './application.jsx';
import { api } from './api.js';
import { CommunicationApp } from './workspace-communication.jsx';
import { CalendarApp, PersonalApp } from './workspace-tools.jsx';
import './workspace-apps.css';


function Login({ onLogin }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api('auth/login', 'POST', Object.fromEntries(new FormData(event.currentTarget))));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="login"><form onSubmit={submit}>
    <Brand /><h1>Sign in</h1>
    <label>Email<input name="email" type="email" autoComplete="username" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
    {error && <p role="alert" className="error">{error}</p>}
    <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
  </form></main>;
}

function Brand() {
  return <div className="brand"><span aria-hidden="true">S</span><span className="brand-name">School Management</span></div>;
}

function useData(path) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ loading: true, data: null, error: '' });
    api(path).then(data => {
      if (active) setState({ loading: false, data, error: '' });
    }, err => {
      if (active) setState({ loading: false, data: null, error: err.message });
    });
    return () => { active = false; };
  }, [path, revision]);
  return { ...state, reload: () => setRevision(value => value + 1) };
}

function recordLabel(record) {
  return record.name ? [record.name, record.section].filter(Boolean).join(' · ') : record._id;
}

function exportRows(definition, rows, display) {
  const cell = value => {
    const text = String(value ?? '');
    return '"' + (/^[\t\r\n]|^\s*[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
  };
  const csv = [definition.fields.map(field => field.label), ...rows.map(row =>
    definition.fields.map(field => display(row, field)))].map(row => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = definition.label.toLowerCase().replaceAll(' ', '-') + '.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Editor({ definition, values, references, close, save, onDelete }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(definition.fields.map(({ key, type }) => [
      key, type === 'number' ? Number(form.get(key)) : form.get(key),
    ]));
    setBusy(true);
    setError('');
    try { await save(data); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
    <h2 id="editor-title">{values?._id ? 'Edit record' : 'Add record'}</h2>
    <form onSubmit={submit}>
      {definition.fields.map(({ key, label, type, options }) => {
        const props = { name: key, defaultValue: values?.[key] ?? ({ gender: 'Unspecified', category: 'Other' }[key] ?? ''), required: !['notes', 'reference'].includes(key) };
        return <label key={key}>{label}{type === 'select' || type === 'ref' ? <select {...props}>
          <option value="">Select {label.toLowerCase()}</option>
          {type === 'select' ? options.map(value => <option key={value}>{value}</option>)
            : (references[options[0]] ?? []).map(row => <option key={row._id} value={row._id}>{recordLabel(row)}</option>)}
        </select> : type === 'textarea' ? <textarea {...props} maxLength={4000} />
          : <input {...props} type={type} min={type === 'number' ? 0 : undefined}
              step={type === 'number' ? 'any' : undefined} maxLength={200} />}</label>;
      })}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">{onDelete && <button type="button" className="danger" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await onDelete(); }
        finally { setBusy(false); }
      }}>Delete event</button>}<button type="button" onClick={close} disabled={busy}>Cancel</button>
        <button className="primary" disabled={busy}>{busy ? 'Working…' : 'Save record'}</button></div>
    </form>
  </section></div>;
}

function Records({ module, user, initialAdd, year, target }) {
  const definition = catalog[module];
  const { data, error, loading, reload } = useData('records/' + module);
  const [drilldown,setDrilldown] = useState(target);
  const [query, setQuery] = useState(target?.name ?? '');
  const [status, setStatus] = useState(target?.status ?? '');
  const [sort, setSort] = useState('recent');
  const [grid, setGrid] = useState(module === 'students');
  const [editing, setEditing] = useState(initialAdd ? (target?.defaults ?? (module === "students" && year ? { year } : {})) : null);
  const [profile, setProfile] = useState(module === 'students' ? target?.id ?? '' : '');
  const [classFilter, setClassFilter] = useState('');
  const [references, setReferences] = useState({});
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState('');
  const writable = definition.personal || user.role === 'admin' || (user.role === 'teacher' && definition.teacherWrite);
  const statuses = definition.fields.find(field => field.key === 'status')?.options;
  useEffect(() => {
    let active = true;
    const keys = [...new Set(definition.fields.filter(field => field.type === 'ref').map(field => field.options[0]))];
    Promise.all(keys.map(async key => {
      try { return [key, await api('records/' + key)]; }
      catch { return [key, []]; }
    })).then(entries => { if (active) setReferences(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [definition]);
  const display = (row, field) => {
    if (field.type !== 'ref') return row[field.key] ?? '';
    const ref = references[field.options[0]]?.find(item => item._id === row[field.key]);
    return ref ? recordLabel(ref) : row[field.key];
  };
  const rows = (data ?? []).filter(row => (!drilldown?.date || row.date === drilldown.date) && (!drilldown?.classId || references.students?.some(student => student._id === row.studentId && student.classId === drilldown.classId)) && (!drilldown?.group || row.classId === drilldown.group) && (!drilldown?.homeworkId || row.homeworkId === drilldown.homeworkId) && (!drilldown?.category || row.category === drilldown.category) && (module !== "students" || !year || row.year === year) && (!status || row.status === status) && (!classFilter || row.classId === classFilter) &&
    definition.fields.some(field => String(display(row, field)).toLowerCase().includes(query.trim().toLowerCase())));
  if (sort === 'name') rows.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? '')));
  async function save(fields) {
    await api('records/' + module + (editing._id ? '/' + editing._id : ''), editing._id ? 'PUT' : 'POST', fields);
    setEditing(null);
    reload();
  }
  async function remove(row) {
    if (!window.confirm('Delete this record?')) return;
    setDeleting(row._id);
    setActionError('');
    try { await api('records/' + module + '/' + row._id, 'DELETE'); reload(); return true; }
    catch (err) { setActionError(err.message); return false; }
    finally { setDeleting(''); }
  }
  const controls = row => writable && <div className="actions">{module === 'submissions' && row.notes === 'Student PDF submission' && <a href={'/api/workspace/assignment-file/' + row._id}>Download PDF</a>}<button onClick={() => setEditing(row)}>Edit</button>
    <button className="danger" disabled={deleting === row._id} onClick={() => remove(row)}>Delete</button></div>;
  const selected = (data ?? []).find(row => row._id === profile);
  const classField = definition.fields.find(field => field.key === 'classId');
  const editor = editing && <Editor definition={definition} values={editing} references={initialAdd && target?.classId && references.students ? { ...references, students: references.students.filter(row => row.classId === target.classId) } : references} save={save} close={() => setEditing(null)}
    onDelete={module === 'calendar' && editing._id ? async () => { if (await remove(editing)) setEditing(null); } : undefined} />;
  if (module === 'students' && selected) return <>
    <Profile student={selected} group={display(selected, classField)} close={() => setProfile('')}
      edit={writable ? () => setEditing(selected) : undefined} />{editor}
  </>;
  if (['calendar', 'todos', 'notes', 'files'].includes(module)) {
    const report = () => exportRows(definition, rows, display);
    const componentProps = { user, rows, loading, error: actionError || error, reload, edit: setEditing, report,
      remove, update: async (row, fields) => {
        await api('records/' + module + '/' + row._id, 'PUT', Object.fromEntries(
          definition.fields.map(({ key }) => [key, fields[key] ?? row[key] ?? ''])));
        reload();
      },
    };
    return <>{module === 'calendar' ? <CalendarApp {...componentProps} requestMeeting={target?.meeting} /> : <PersonalApp {...componentProps} module={module} />}{editor}</>;
  }
  return <>
    <div className="title"><div><p className="breadcrumbs">Dashboard / {definition.group}</p><h1>{target?.label ?? definition.label}</h1></div>
      <div className="actions"><button disabled={!rows.length} onClick={() => exportRows(definition, rows, display)}>Export CSV</button>
      {writable && <button className="primary" onClick={() => setEditing(target?.defaults ?? (module === "students" && year ? { year } : {}))}>{module === 'students' ? 'Add Student' : module === 'calendar' ? 'Create Event' : 'Add record'}</button>}</div></div>
    {module === 'students' && <div className="student-metrics">
      {[['Total students', data?.length ?? 0], ...['Active', 'Inactive', 'Graduated'].map(label => [label, (data ?? []).filter(row => row.status === label).length])]
        .map(([label, value]) => <article className="panel" key={label}><span className="muted">{label}</span><strong>{value}</strong></article>)}
    </div>}
    <div className="toolbar">{(drilldown?.date || drilldown?.classId || drilldown?.group || drilldown?.homeworkId || drilldown?.category) && <button onClick={() => setDrilldown(null)}>Clear dashboard filter</button>}
      <input aria-label="Search records" placeholder={module === 'students' ? 'Search name, admission no, class…' : 'Search records'} value={query} onChange={event => setQuery(event.target.value)} />
      {statuses && <select aria-label="Status" value={status} onChange={event => setStatus(event.target.value)}>
        <option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}
      </select>}
      {module === 'students' && <select aria-label="Class" value={classFilter} onChange={event => setClassFilter(event.target.value)}>
        <option value="">All classes</option>{references.classes?.map(row => <option key={row._id} value={row._id}>{recordLabel(row)}</option>)}
      </select>}
      {definition.fields.some(field => field.key === 'name') && <select aria-label="Sort records" value={sort} onChange={event => setSort(event.target.value)}>
        <option value="recent">Recently added</option><option value="name">Name (A–Z)</option>
      </select>}
      {module === 'students' && <button onClick={() => setGrid(!grid)}>{grid ? 'Table view' : 'Card view'}</button>}
    </div>
    {(error || actionError) && <p className="error" role="alert">{error || actionError}</p>}
    {loading ? <p role="status">Loading records…</p> : !error && <>
      <p className="muted">{rows.length} of {data?.length ?? 0} records</p>
      {module === 'calendar' ? <div className="grid application-grid" style={{ marginTop: 12 }}>
        {rows.map(row => <article className="panel" key={row._id}><h2>{row.name}</h2><p>{row.date} · {row.start}</p>{controls(row)}</article>)}
      </div> : !rows.length ? <div className="panel">No matching records.</div> : grid ? <div className="grid">{rows.map(row =>
        <article className="panel student-card" key={row._id}>
          <div className="student-card-top"><span className="muted">{row.admission}</span><span className="pill">{row.status}</span></div>
          <div className="student-name"><Avatar name={row.name} /><div><h2>{row.name}</h2><span className="muted">{display(row, classField)} · {row.year}</span></div></div>
          <dl><div><dt>Guardian</dt><dd>{row.guardian}</dd></div><div><dt>Phone</dt><dd>{row.phone}</dd></div></dl>
          <div className="actions"><button onClick={() => setProfile(row._id)}>View profile</button>
            {writable && <button onClick={() => setEditing(row)}>Edit</button>}</div>
        </article>)}</div>
        : module === 'notes' ? <div className="grid application-grid">{rows.map(row =>
          <article className="panel" key={row._id}><span className="pill">{row.priority}</span><h2>{row.name}</h2>
            <p className="note-body">{row.body}</p>{controls(row)}</article>)}</div>
        : <div className="table-wrap"><table><thead><tr>{definition.fields.map(field =>
          <th key={field.key}>{field.label}</th>)}{(writable || module === 'students') && <th>Actions</th>}</tr></thead><tbody>{rows.map(row =>
          <tr key={row._id}>{definition.fields.map(field => <td key={field.key}>{display(row, field)}</td>)}
          {(writable || module === 'students') && <td>{module === 'students' && <button onClick={() => setProfile(row._id)}>View profile</button>}{controls(row)}</td>}</tr>)}</tbody></table></div>}
    </>}
    {editor}
  </>;
}

function Accounts({ roleFilter }) {
  const { data, error, loading, reload } = useData('users');
  const students = useData('records/students');
  const [role, setRole] = useState('teacher');
  const [notice, setNotice] = useState('');
  const [errorText, setErrorText] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setErrorText('');
    setNotice('');
    try {
      await api('users', 'POST', { ...Object.fromEntries(fields), studentIds: fields.getAll('studentIds') });
      form.reset();
      setRole('teacher');
      setNotice('Account created.');
      reload();
    } catch (err) { setErrorText(err.message); }
    finally { setBusy(false); }
  }
  return <><h1>{roleFilter === "parent" ? "Parents" : "User accounts"}</h1><div className="account-layout">
    <form className="panel" onSubmit={submit}><h2>Create account</h2>
      <label>Name<input name="name" maxLength={120} required /></label>
      <label>Email<input name="email" type="email" maxLength={254} required /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
      <label>Role<select name="role" value={role} onChange={event => setRole(event.target.value)}>
        {roles.map(value => <option key={value}>{value}</option>)}
      </select></label>
      {['parent', 'student'].includes(role) && <label>Linked students<select key={role} name="studentIds" multiple={role === 'parent'} required defaultValue={role === 'parent' ? [] : ''}>
        {role === 'student' && <option value="">Choose a student</option>}
        {students.data?.map(row => <option key={row._id} value={row._id}>{row.name} · {row.admission}</option>)}
      </select></label>}
      {(errorText || students.error) && <p className="error" role="alert">{errorText || students.error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button className="primary" disabled={busy}>Create account</button>
    </form>
    <section className="panel"><h2>Account directory</h2>{loading && <p>Loading…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="accounts">{data?.filter(item => !roleFilter || item.role === roleFilter).map(item => <li key={item._id}><strong>{item.name}</strong>
        <span>{item.email}</span><span className="pill">{item.role}</span></li>)}</ul>
    </section></div></>;
}


function RolesPage() {
  const entries = [
    ['Admin', 'Manage school records, schools and user accounts.'],
    ['Teacher', 'Read academic records and manage homework, attendance and marks.'],
    ['Student', 'Read their own student, class and fee records.'],
    ['Parent', 'Read records for their linked students.'],
  ];
  return <><h1>Roles & Permissions</h1><div className="grid">{entries.map(([role,access]) =>
    <article className="panel" key={role}><h2>{role}</h2><p>{access}</p></article>)}</div></>;
}

function SchoolCrest() {
  return <span className="school-crest" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 28 28" fill="none"><path d="M14 3 22 6v7c0 5-4 8-8 10-4-2-8-5-8-10V6z" fill="#fff" stroke="#889bce"/><path d="m10 12 4-2 4 2-4 2-4-2Zm2 2v3l2 1 2-1v-3" stroke="#4059ba" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 6v2m-1-1h2" stroke="#e75a90" strokeLinecap="round"/><path d="M8 24h12" stroke="#4059ba" strokeWidth="1.2" strokeLinecap="round"/></svg></span>;
}

function Workspace({ user, onLogout }) {
  const dashboard = useData('dashboard');
  const [view, setView] = useState({ key: 'dashboard', revision: 0 });
  const [nav, setNav] = useState(false);
  const [error, setError] = useState('');
  const [layout, setLayout] = useState(() => localStorage.getItem('school-layout') || 'default');
  const [year,setYear] = useState(() => localStorage.getItem('school-year') ?? '');
  const [years,setYears] = useState([]);
  const [schools,setSchools] = useState([]);
  const [school,setSchool] = useState(() => localStorage.getItem('school-campus') || '');
  const [topRequest,setTopRequest] = useState(null);
  const [schoolOpen,setSchoolOpen] = useState(false);
  const [addingSchool,setAddingSchool] = useState(false);
  const [refresh,setRefresh] = useState(0);
  const modules = Object.keys(dashboard.data ?? {});
  const campus = schools.find(row => row._id === school);
  useEffect(() => {
    api('workspace/schools').then(setSchools, err => setError(err.message));
  }, []);
  useEffect(() => {
    let active = true;
    api('records/students').then(rows => {
      if (active) setYears([...new Set(rows.map(row => row.year))].sort().reverse());
    }, () => { if (active) setYears([]); });
    return () => { active = false; };
  }, [school,refresh]);
  function go(key, add = false, target) {
    setView(previous => ({ key, add, target, revision: previous.revision + 1 }));
    setNav(false);
    setRefresh(value => value + 1);
    if (key === 'dashboard') dashboard.reload();
  }
  function switchSchool(value) {
    if (value) localStorage.setItem('school-campus',value); else localStorage.removeItem('school-campus');
    localStorage.removeItem('school-year');
    setYear(''); setSchool(value); setSchoolOpen(false); go('dashboard');
  }
  async function addSchool(event) {
    event.preventDefault(); setError('');
    try {
      const row = await api('workspace/schools','POST',Object.fromEntries(new FormData(event.currentTarget)));
      setSchools(previous => [...previous,row]); setAddingSchool(false); switchSchool(row._id);
    } catch (err) { setError(err.message); }
  }
  function setDisplay(value) {
    localStorage.setItem('school-layout', value);
    setLayout(value);
  }
  async function logout() {
    try { await api('auth/logout','POST',{}); localStorage.removeItem('school-campus'); onLogout(); }
    catch (err) { setError(err.message); }
  }
  return <div className={'layout ' + layout} dir={layout === 'rtl' ? 'rtl' : 'ltr'}>
    <aside className={'preskool-sidebar' + (nav ? ' open' : '')}><div className="sidebar-brand"><Brand />
      <button aria-label="Toggle compact sidebar" onClick={() => setDisplay(layout === 'mini' ? 'default' : 'mini')}>☰</button></div>
      <div className="school-picker"><button className="school-name" aria-expanded={schoolOpen} onClick={() => setSchoolOpen(!schoolOpen)}>
        <SchoolCrest />
        <span className="school-card-copy"><strong>{campus?.name ?? 'Global International'}</strong><small>{campus?.campus ?? 'School Management'}</small></span>
        <svg className="school-card-chevron" viewBox="0 0 12 16" fill="none" aria-hidden="true"><path d="m3 6 3-3 3 3m-6 4 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        {schoolOpen && <div className="school-options"><h2>Switch school</h2>
          <button className="school-option" aria-pressed={school === ''} onClick={() => switchSchool('')}><SchoolCrest />
            <span><strong>Global International</strong><small>Primary campus</small></span>{school === '' && <span className="school-check" aria-hidden="true">✓</span>}</button>
          {schools.map((row,index) => <button className="school-option" aria-pressed={school === row._id} onClick={() => switchSchool(row._id)} key={row._id}>
            <span className={'school-monogram school-color-'+index%4} aria-hidden="true">{row.name.trim()[0]?.toUpperCase()}</span>
            <span><strong>{row.name}</strong><small>{row.campus}</small></span>{school === row._id && <span className="school-check" aria-hidden="true">✓</span>}</button>)}
          {user.role === 'admin' && <div className="school-add-wrap"><button className="school-option school-add" onClick={() => { setAddingSchool(true); setSchoolOpen(false); }}>
            <span className="school-monogram" aria-hidden="true">＋</span><strong>Add new school</strong></button></div>}
        </div>}
      </div>
      <SidebarMenu user={user} modules={modules} view={view} go={go} layout={layout} setDisplay={setDisplay}
        openSchools={() => setSchoolOpen(true)} openTopMenu={key => setTopRequest({key})} />
      <div className="sidebar-account"><button className="sidebar-profile" onClick={() => go('profile')}>
        <span className="top-avatar">{user.name[0]}</span><span>{user.name}<small>{user.role}</small></span></button></div>
    </aside>
    <div className="workspace">
      <TopBar user={user} go={go} modules={modules} year={year} setYear={value => { setYear(value); localStorage.setItem('school-year',value); }}
        years={years} layout={layout} setLayout={setDisplay} nav={nav} setNav={setNav} logout={logout} school={school} refresh={refresh} menuRequest={topRequest} />
      <main className="content">{error && <p className="error" role="alert">{error}</p>}
        {view.key === 'dashboard' || view.key.startsWith('preview-') ? <>
          <div hidden={(user.role === "admin" && view.key === "dashboard") || user.role === "parent" || view.key === "preview-parent"}><p className="breadcrumbs">Dashboard / {view.key.startsWith('preview-') ? view.key.slice(8) : user.role}</p>
          <div className="title dashboard-heading"><h1 className="capitalize">{view.key.startsWith('preview-') ? view.key.slice(8) : user.role} Dashboard</h1>
            <div className="actions" hidden={user.role === "admin" && view.key === "dashboard"}><button onClick={dashboard.reload}>Refresh</button><button onClick={() => window.print()}>Print / PDF</button>
            {user.role === 'admin' && <button className="primary" onClick={() => go('students',true)}>＋ Add Student</button>}</div></div>
          </div>{dashboard.loading && <p role="status">Loading dashboard…</p>}
          {dashboard.error && <p className="error" role="alert">{dashboard.error}</p>}
          {dashboard.data && (user.role === 'admin' && view.key === 'dashboard'
            ? <Dashboard user={user} counts={dashboard.data} go={go} year={year} years={years} schoolName={campus?.name ?? "Global International"} onYear={value => { setYear(value); localStorage.setItem("school-year", value); }} refresh={dashboard.reload} />
            : user.role === 'teacher' || view.key === 'preview-teacher' ? <TeacherDashboard key={school + view.key} user={user} year={year} go={go} openNotifications={() => setTopRequest({key:'activity'})} />
            : user.role === 'student' || view.key === 'preview-student' ? <StudentDashboard key={school + view.key} user={user} year={year} go={go} openNotifications={() => setTopRequest({key:'activity'})} />
            : user.role === 'parent' || view.key === 'preview-parent' ? <ParentDashboard key={school + view.key} user={user} year={year} go={go} />
            : <RoleDashboard key={school + view.key} role={view.key.startsWith('preview-') ? view.key.slice(8) : user.role} year={year} go={go} />)}
        </> : view.key === 'roles' ? <RolesPage /> : view.key === 'module-info' ? <ModuleInfo title={view.target.label} /> : view.key === 'accounts' ? <Accounts key={view.revision} roleFilter={view.target?.status} /> : ['messages','email','contacts'].includes(view.key) ? <CommunicationApp key={view.revision} mode={view.key}
          user={user} target={view.target} go={go} onChange={() => setRefresh(value => value + 1)} />
        : view.key === 'activity' ? <ActivityPage /> : view.key === 'profile' ? <><h1>My Profile</h1><section className="panel"><h2>{user.name}</h2><p>{user.email}</p><span className="pill">{user.role}</span></section>{view.target?.security && <section className="panel"><h2>Privacy &amp; Security</h2><p>Signed in as {user.email}.</p><button onClick={logout}>Sign out of this session</button></section>}</>
        : <Records key={view.revision} module={view.key} user={user} initialAdd={view.add} year={year} target={view.target} />}
      </main>
    </div>
    {addingSchool && <div className="overlay"><section className="modal" role="dialog" aria-modal="true" aria-label="Add new school">
      <h2>Add new school</h2><form onSubmit={addSchool}><label>School name<input name="name" maxLength={120} required /></label>
        <label>Campus name<input name="campus" maxLength={120} required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions"><button type="button" onClick={() => setAddingSchool(false)}>Cancel</button><button className="primary">Add school</button></div></form>
      </section></div>}
  </div>;
}

function App() {
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    api('auth/me').then(setUser, err => {
      if (err.status !== 401) setError(err.message);
      setUser(null);
    });
  }, []);
  if (user === undefined) return <main className="content" role="status">Opening school management…</main>;
  return user ? <Workspace user={user} onLogout={() => setUser(null)} /> : <>
    {error && <p className="startup-error error" role="alert">{error}</p>}
    <Login onLogin={account => { setError(''); setUser(account); }} />
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
