import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { catalog, roles } from '../catalog.js';
import './style.css';

async function api(path, method = 'GET', body) {
  const response = await fetch('/api/' + path, {
    method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw Object.assign(new Error(data?.message || 'Request failed.'), { status: response.status });
  return data;
}

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
  return <div className="brand"><span aria-hidden="true">S</span> School Management</div>;
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

function Editor({ definition, values, references, close, save }) {
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
        const props = { name: key, defaultValue: values?.[key] ?? '', required: !['notes', 'reference'].includes(key) };
        return <label key={key}>{label}{type === 'select' || type === 'ref' ? <select {...props}>
          <option value="">Select {label.toLowerCase()}</option>
          {type === 'select' ? options.map(value => <option key={value}>{value}</option>)
            : (references[options[0]] ?? []).map(row => <option key={row._id} value={row._id}>{recordLabel(row)}</option>)}
        </select> : type === 'textarea' ? <textarea {...props} maxLength={4000} />
          : <input {...props} type={type} min={type === 'number' ? 0 : undefined}
              step={type === 'number' ? 'any' : undefined} maxLength={200} />}</label>;
      })}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions"><button type="button" onClick={close} disabled={busy}>Cancel</button>
        <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button></div>
    </form>
  </section></div>;
}

function Records({ module, user }) {
  const definition = catalog[module];
  const { data, error, loading, reload } = useData('records/' + module);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('recent');
  const [grid, setGrid] = useState(module === 'students');
  const [editing, setEditing] = useState(null);
  const [references, setReferences] = useState({});
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState('');
  const writable = user.role === 'admin' || (user.role === 'teacher' && definition.teacherWrite);
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
  const rows = (data ?? []).filter(row => (!status || row.status === status) &&
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
    try { await api('records/' + module + '/' + row._id, 'DELETE'); reload(); }
    catch (err) { setActionError(err.message); }
    finally { setDeleting(''); }
  }
  const controls = row => writable && <div className="actions"><button onClick={() => setEditing(row)}>Edit</button>
    <button className="danger" disabled={deleting === row._id} onClick={() => remove(row)}>Delete</button></div>;
  return <>
    <div className="title"><div><p className="section-name">{definition.group}</p><h1>{definition.label}</h1></div>
      <div className="actions"><button disabled={!rows.length} onClick={() => exportRows(definition, rows, display)}>Export CSV</button>
      {writable && <button className="primary" onClick={() => setEditing({})}>Add record</button>}</div></div>
    <div className="toolbar">
      <input aria-label="Search records" placeholder="Search records" value={query} onChange={event => setQuery(event.target.value)} />
      {statuses && <select aria-label="Status" value={status} onChange={event => setStatus(event.target.value)}>
        <option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}
      </select>}
      {definition.fields.some(field => field.key === 'name') && <select aria-label="Sort records" value={sort} onChange={event => setSort(event.target.value)}>
        <option value="recent">Recently added</option><option value="name">Name (A–Z)</option>
      </select>}
      {module === 'students' && <button onClick={() => setGrid(!grid)}>{grid ? 'Table view' : 'Card view'}</button>}
    </div>
    {(error || actionError) && <p className="error" role="alert">{error || actionError}</p>}
    {loading ? <p role="status">Loading records…</p> : !error && <>
      <p className="muted">{rows.length} of {data?.length ?? 0} records</p>
      {!rows.length ? <div className="panel">No matching records.</div> : grid ? <div className="grid">{rows.map(row =>
        <article className="panel" key={row._id}><span className="pill">{row.status}</span><h2>{row.name}</h2>
          <dl>{definition.fields.filter(field => !['status', 'name'].includes(field.key)).map(field =>
            <div key={field.key}><dt>{field.label}</dt><dd>{display(row, field)}</dd></div>)}</dl>{controls(row)}</article>)}</div>
        : <div className="table-wrap"><table><thead><tr>{definition.fields.map(field =>
          <th key={field.key}>{field.label}</th>)}{writable && <th>Actions</th>}</tr></thead><tbody>{rows.map(row =>
          <tr key={row._id}>{definition.fields.map(field => <td key={field.key}>{display(row, field)}</td>)}
          {writable && <td>{controls(row)}</td>}</tr>)}</tbody></table></div>}
    </>}
    {editing && <Editor definition={definition} values={editing} references={references} save={save} close={() => setEditing(null)} />}
  </>;
}

function Accounts() {
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
  return <><h1>User accounts</h1><div className="account-layout">
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
      <ul className="accounts">{data?.map(item => <li key={item._id}><strong>{item.name}</strong>
        <span>{item.email}</span><span className="pill">{item.role}</span></li>)}</ul>
    </section></div></>;
}

function Workspace({ user, onLogout }) {
  const dashboard = useData('dashboard');
  const [page, setPage] = useState('dashboard');
  const [nav, setNav] = useState(false);
  const [error, setError] = useState('');
  const modules = Object.keys(dashboard.data ?? {});
  const groups = [...new Set(modules.map(key => catalog[key].group))];
  function go(key) { setPage(key); setNav(false); if (key === 'dashboard') dashboard.reload(); }
  return <div className="layout">
    <aside className={nav ? 'open' : ''}><Brand /><nav aria-label="School modules">
      <button aria-current={page === 'dashboard' ? 'page' : undefined} onClick={() => go('dashboard')}>Dashboard</button>
      {groups.map(group => <section key={group}><h2>{group}</h2>{modules.filter(key => catalog[key].group === group)
        .map(key => <button key={key} aria-current={page === key ? 'page' : undefined} onClick={() => go(key)}>{catalog[key].label}</button>)}</section>)}
      {user.role === 'admin' && <section><h2>Administration</h2>
        <button aria-current={page === 'accounts' ? 'page' : undefined} onClick={() => go('accounts')}>User accounts</button></section>}
    </nav></aside>
    <div className="workspace">
      <header><button className="mobile-menu" aria-expanded={nav} onClick={() => setNav(!nav)}>Menu</button>
        <div className="identity"><strong>{user.name}</strong><span>{user.role}</span></div>
        <button onClick={async () => { try { await api('auth/logout', 'POST', {}); onLogout(); }
          catch (err) { setError(err.message); } }}>Sign out</button></header>
      <main className="content">{error && <p className="error" role="alert">{error}</p>}
        {page === 'dashboard' ? <>
          <p className="section-name">School overview</p><h1 className="capitalize">{user.role} dashboard</h1>
          {dashboard.loading && <p role="status">Loading dashboard…</p>}
          {dashboard.error && <p className="error" role="alert">{dashboard.error}</p>}
          <div className="grid stats">{modules.map(key => <button className="panel stat" key={key} onClick={() => go(key)}>
            <span>{catalog[key].label}</span><strong>{dashboard.data[key]}</strong></button>)}</div>
        </> : page === 'accounts' ? <Accounts /> : <Records key={page} module={page} user={user} />}
      </main>
    </div>
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
