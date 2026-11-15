import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import WorkspaceCall from './workspace-call.jsx';
import { Dialog, Icon, IconButton, PageTitle, Person, shortTime, usePreferences } from './workspace-ui.jsx';

const folderIcons = { Inbox: 'download', Important: 'star', 'Sent Mail': 'send', Drafts: 'file', Trash: 'trash' };
const messagePath = 'workspace/messages';

export function CommunicationApp({ mode, user, target, go, onChange }) {
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  async function refresh() {
    const request = ++sequence.current;
    try {
      const [rows, people] = await Promise.all([api(messagePath), api('workspace/contacts')]);
      if (request !== sequence.current) return;
      setMessages(rows); setContacts(people); setError('');
    } catch (err) { if (request === sequence.current) setError(err.message); }
    finally { if (request === sequence.current) setLoading(false); }
  }
  useEffect(() => {
    if (mode === 'contacts') {
      void api('workspace/contacts').then(setContacts, err => setError(err.message));
      return;
    }
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => { ++sequence.current; clearInterval(timer); };
  }, [mode]);

  async function send(fields) {
    const row = await api(messagePath, 'POST', fields);
    ++sequence.current;
    setMessages(rows => [row, ...rows.filter(item => item._id !== row._id)]);
    onChange();
  }

  async function mark(fields) {
    await api(messagePath + '/read', 'POST', fields);
    ++sequence.current;
    setMessages(rows => rows.map(row => row.to === user.id &&
      (fields.id ? row._id === fields.id : row.from === fields.from && row.channel !== 'mail') ? { ...row, read: true } : row));
    onChange();
  }

  return <div className={'wa-app wa-' + mode}>
    {error && <p className="error" role="alert">{error}</p>}
    {mode === 'contacts' ? <WorkspaceCall {...{ user, contacts, target, go }} /> :
      mode === 'email' ? <Mail {...{ user, contacts, target, send, mark, refresh, loading }} messages={messages.filter(row => row.channel === 'mail')} /> :
      <Chat {...{ user, contacts, target, go, send, mark, loading }} messages={messages.filter(row => row.channel !== 'mail')} />}
  </div>;
}

function Mail({ user, messages, contacts, target, send, mark, refresh, loading }) {
  const [prefs, setPrefs] = usePreferences(user, 'email', { starred: [], trash: [], draft: null });
  const [folder, setFolder] = useState(target?.sent ? 'Sent Mail' : 'Inbox');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(0);
  const [bulk, setBulk] = useState('');
  const [reading, setReading] = useState(null);
  const openedTarget = useRef(false);
  const [compose, setCompose] = useState(target?.compose ? { to: target.to } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const person = id => id === user.id ? user.name : contacts.find(row => row._id === id)?.name ?? 'School contact';
  const unread = messages.filter(row => row.to === user.id && !row.read && !prefs.trash.includes(row._id)).length;
  const matches = messages.filter(row => (folder === 'Trash' ? prefs.trash.includes(row._id) :
    !prefs.trash.includes(row._id) && (folder === 'Important' ? prefs.starred.includes(row._id) :
      folder === 'Sent Mail' ? row.from === user.id : folder === 'Inbox' && row.to === user.id)) &&
    [row.subject, row.body, person(row.from), person(row.to)].some(value => value?.toLowerCase().includes(query.trim().toLowerCase())));
  const maxPage = Math.max(0, Math.ceil(matches.length / 10) - 1);
  const visiblePage = Math.min(page, maxPage);
  const visible = matches.slice(visiblePage * 10, (visiblePage + 1) * 10);

  useEffect(() => {
    if (!target?.message || openedTarget.current) return;
    const row = messages.find(item => item._id === target.message);
    if (row) { openedTarget.current = true; open(row); }
  }, [messages, target?.message]);
  function toggle(field, id) {
    setPrefs(previous => ({ ...previous, [field]: previous[field].includes(id)
      ? previous[field].filter(item => item !== id) : [...previous[field], id] }));
  }
  function open(row) {
    setReading(row);
    if (row.to === user.id && !row.read) void mark({ id: row._id }).catch(err => setError(err.message));
  }
  async function applyBulk(action) {
    if (!action) return;
    setError('');
    try {
      if (action === 'read') await Promise.all(selected.map(id => mark({ id })));
      else {
        const field = action === 'star' ? 'starred' : 'trash';
        setPrefs(previous => ({ ...previous, [field]: action === 'restore'
          ? previous[field].filter(id => !selected.includes(id)) : [...new Set([...previous[field], ...selected])] }));
      }
      setSelected([]); setBulk('');
    } catch (err) { setError(err.message); }
  }
  async function submit(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    if (event.nativeEvent.submitter?.value === 'draft') {
      setPrefs(previous => ({ ...previous, draft: form }));
      setCompose(null);
      return;
    }
    setBusy(true);
    try {
      await send({ ...form, channel:'mail' });
      setPrefs(previous => ({ ...previous, draft: null }));
      setCompose(null);
      setFolder('Sent Mail');
      setPage(0); setSelected([]); setQuery('');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <>
    <PageTitle title="Inbox" />
    <div className="wa-split">
      <div className="wa-mail-side">
        <button type="button" className="primary wa-wide wa-compose" onClick={() => { setError(''); setCompose({}); }}>Compose</button>
        <nav className="wa-rail wa-mail-rail" aria-label="Mail folders">
          {Object.entries(folderIcons).map(([label, icon]) => <IconButton key={label} icon={icon} label={label}
            aria-pressed={folder === label} onClick={() => { setFolder(label); setPage(0); setSelected([]); setQuery(''); }}>
            {label}{label === 'Inbox' && unread ? ' (' + unread + ')' : ''}
          </IconButton>)}
        </nav>
      </div>
      <section className="wa-surface wa-mail-table">
        <div className="wa-toolbar">
          <select aria-label="Select messages" value="" onChange={event => setSelected(event.target.value === 'page' ? visible.map(row => row._id)
            : event.target.value === 'unread' ? visible.filter(row => row.to === user.id && !row.read).map(row => row._id) : [])}>
            <option value="" disabled>Select</option><option value="page">Current page</option><option value="unread">Unread on page</option><option value="none">None</option>
          </select>
          <select aria-label="Message actions" value={bulk} disabled={!selected.length}
            onChange={event => { const action = event.target.value; setBulk(action); void applyBulk(action); }}>
            <option value="">Actions</option><option value="read">Mark read</option><option value="star">Mark important</option>
            <option value={folder === 'Trash' ? 'restore' : 'trash'}>{folder === 'Trash' ? 'Restore' : 'Move to trash'}</option>
          </select>
          <input aria-label="Search mail" placeholder="Search Messages" value={query} onChange={event => { setQuery(event.target.value); setPage(0); setSelected([]); }} />
          <div className="wa-actions wa-toolbar-end">
            <IconButton icon="refresh" label="Refresh mail" onClick={refresh} />
            <IconButton icon="back" label="Previous page" disabled={!visiblePage} onClick={() => { setPage(visiblePage - 1); setSelected([]); }} />
            <IconButton icon="next" label="Next page" disabled={visiblePage >= maxPage} onClick={() => { setPage(visiblePage + 1); setSelected([]); }} />
          </div>
        </div>
        {error && !compose && <p className="error" role="alert">{error}</p>}
        {folder === 'Drafts' ? prefs.draft ? <div className="wa-draft"><button type="button" onClick={() => setCompose(prefs.draft)}>
          {prefs.draft.subject || 'Untitled draft'}
        </button><IconButton icon="trash" label="Delete draft" onClick={() => setPrefs(previous => ({ ...previous, draft: null }))} /></div>
          : <p className="wa-empty">No drafts.</p> : <>
          <p className="wa-mail-count">{matches.length ? `Showing ${visiblePage * 10 + 1}–${visiblePage * 10 + visible.length} of ${matches.length}` : 'Showing 0 messages'}</p>
          <div className="wa-table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Select current page" checked={visible.length > 0 && visible.every(row => selected.includes(row._id))}
            onChange={event => setSelected(event.target.checked ? visible.map(row => row._id) : [])} /></th><th aria-label="Important" /><th>Contact</th><th>Subject</th><th>Date</th></tr></thead>
            <tbody>{visible.map(row => <tr key={row._id} className={row.to === user.id && !row.read ? 'wa-mail-unread' : ''}>
              <td><input type="checkbox" aria-label={'Select ' + row.subject} checked={selected.includes(row._id)}
                onChange={event => setSelected(previous => event.target.checked ? [...previous, row._id] : previous.filter(id => id !== row._id))} /></td>
              <td><IconButton icon="star" label="Toggle important" aria-pressed={prefs.starred.includes(row._id)} className="wa-star" onClick={() => toggle('starred', row._id)} /></td>
              <td>{person(row.from === user.id ? row.to : row.from)}</td><td><button type="button" className="wa-text-button" onClick={() => open(row)}>{row.subject}</button></td>
              <td>{shortTime(row.createdAt)}</td>
            </tr>)}</tbody></table></div>
          {!visible.length && <p className="wa-empty">{loading ? 'Loading mail…' : 'No messages in this folder.'}</p>}
        </>}
      </section>
    </div>
    {reading && <Dialog title={reading.subject} close={() => setReading(null)}>
      <p className="muted">{person(reading.from)} <Icon name="forward" /> {person(reading.to)} · {shortTime(reading.createdAt)}</p>
      <p className="wa-mail-body">{reading.body}</p>
      {reading.to === user.id && <IconButton icon="send" label="Reply" className="primary" onClick={() => {
        setCompose({ to: reading.from, subject: (/^Re:/i.test(reading.subject) ? reading.subject : 'Re: ' + reading.subject).slice(0,160) });
        setReading(null);
      }}>Reply</IconButton>}
    </Dialog>}
    {compose && <Dialog title="Compose" close={() => { if (!busy) setCompose(null); }}>
      <form onSubmit={submit}>
        <label>To<select name="to" required defaultValue={compose.to ?? ''}><option value="">Choose a school contact</option>
          {contacts.map(row => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>
        <label>Subject<input name="subject" defaultValue={compose.subject ?? ''} maxLength={160} required /></label>
        <label>Message<textarea name="body" defaultValue={compose.body ?? ''} maxLength={3000} required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="wa-actions wa-toolbar-end"><button formNoValidate value="draft" disabled={busy}>Save draft</button>
          <button className="primary" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button></div>
      </form>
    </Dialog>}
  </>;
}

function Chat({ user, contacts, messages, target, go, send, mark, loading }) {
  const [pins, setPins] = usePreferences(user, 'chat-pins', []);
  const [active, setActive] = useState(target?.to ?? '');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(false);
  const [threadQuery, setThreadQuery] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const other = row => row.from === user.id ? row.to : row.from;
  const peers = new Map(contacts.map(person => [person._id, person]));
  for (const row of messages) if (!peers.has(other(row))) peers.set(other(row), { _id: other(row), name: 'School contact' });
  const latest = new Map();
  for (const row of messages) if (!latest.has(other(row))) latest.set(other(row), row);
  const people = [...peers.values()].sort((a, b) => (latest.get(b._id)?.createdAt ?? '').localeCompare(latest.get(a._id)?.createdAt ?? ''));
  const current = peers.get(active);
  const thread = messages.filter(row => other(row) === active).reverse();
  const unreads = new Map();
  for (const row of messages) if (row.to === user.id && !row.read) unreads.set(row.from, (unreads.get(row.from) ?? 0) + 1);
  const currentUnread = unreads.get(active) ?? 0;
  useEffect(() => { if (!active && people.length) setActive(people[0]._id); }, [active, people[0]?._id]);
  useEffect(() => { if (active && currentUnread) void mark({ from: active }).catch(err => setError(err.message)); }, [active, currentUnread]);
  useEffect(() => { if (end.current) end.current.parentElement.scrollTop = end.current.parentElement.scrollHeight; }, [active, thread.at(-1)?._id]);
  const filtered = people.filter(person => person.name.toLowerCase().includes(query.trim().toLowerCase()));
  function open(person) { setActive(person); setThreadQuery(''); setBody(''); setError(''); }
  function pin() { setPins(previous => previous.includes(active) ? previous.filter(id => id !== active) : [...previous, active]); }
  async function submit(event) {
    event.preventDefault();
    if (!body.trim() || busy || !active) return;
    const destination = active;
    const draft = body;
    setBusy(true); setError('');
    try { await send({ to: destination, body: draft }); setBody(previous => previous === draft ? '' : previous); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const contactRow = person => <button type="button" className="wa-chat-contact" key={person._id} aria-pressed={active === person._id} onClick={() => open(person._id)}>
    <Person name={person.name} /><span><strong>{person.name}</strong><small>{latest.get(person._id)?.body ?? person.role}</small></span>
    <span className="wa-chat-meta"><small>{shortTime(latest.get(person._id)?.createdAt)}</small>{unreads.has(person._id) && <b>{unreads.get(person._id)}</b>}</span></button>;
  return <section className="wa-chat-shell wa-surface" aria-label="Chat">
    <div className="wa-chat-left"><div className="wa-chat-head"><h2>All Chats</h2><IconButton icon="search" label="Search contacts" aria-expanded={search} onClick={() => setSearch(!search)} /></div>
      {search && <input aria-label="Search contacts" autoFocus placeholder="Find a contact…" value={query} onChange={event => setQuery(event.target.value)} />}
      <div className="wa-chat-directory">
        <h3>School Contacts</h3><div className="wa-chat-avatars">{filtered.slice(0, 5).map(person => <button key={person._id} title={person.name} aria-label={person.name}
          onClick={() => open(person._id)}><Person name={person.name} /></button>)}</div>
        {filtered.some(person => pins.includes(person._id)) && <><h3>Pinned Chat</h3>{filtered.filter(person => pins.includes(person._id)).map(contactRow)}</>}
        <h3>Recent Chat</h3>{filtered.filter(person => !pins.includes(person._id)).map(contactRow)}
        {!filtered.length && <p className="wa-empty">{loading ? 'Loading contacts…' : 'No matching contacts.'}</p>}
      </div></div>
    <div className="wa-chat-right">
      {current ? <>
        <div className="wa-chat-head"><Person name={current.name} /><div className="wa-chat-identity"><strong>{current.name}</strong><small>{current.role || 'School contact'}</small></div>
          <IconButton icon="search" label="Search conversation" onClick={() => setThreadQuery(value => value === '' ? ' ' : '')} />
          <IconButton icon="video" label="Video call" onClick={() => go('contacts', false, { to: active })} />
          <IconButton icon="phone" label="Audio call" onClick={() => go('contacts', false, { to: active })} />
          <IconButton icon="pin" label="Pin conversation" aria-pressed={pins.includes(active)} onClick={pin} /></div>
        {threadQuery !== '' && <input className="wa-thread-search" aria-label="Search conversation" placeholder="Search conversation…" autoFocus value={threadQuery.trimStart()} onChange={event => setThreadQuery(' ' + event.target.value)} />}
        <div className="wa-bubbles" aria-live="polite">
          {!thread.length && <p className="wa-empty">Start a conversation with {current.name}.</p>}
          {thread.filter(row => row.body.toLowerCase().includes(threadQuery.trim().toLowerCase())).map(row => {
            const self = row.from === user.id;
            const name = self ? user.name : current.name;
            return <div className={'wa-message' + (self ? ' self' : '')} key={row._id}><Person name={name} />
              <div><div className="wa-message-meta"><strong>{name}</strong><small>{shortTime(row.createdAt)}</small></div><p>{row.body}</p></div>
            </div>;
          })}<div ref={end} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <form className="wa-chat-compose" onSubmit={submit}>
          <input aria-label="Message" placeholder="Type your message here…" value={body} onChange={event => setBody(event.target.value)} maxLength={3000} />
          <button className="primary wa-icon-button" type="submit" aria-label="Send message" disabled={busy || !body.trim()}><Icon name="send" /></button></form>
      </> : <p className="wa-empty">Select a contact to open a conversation.</p>}
    </div>
  </section>;
}
