import { DashboardIcon } from './dashboard-hero.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Icon, IconButton, Person, shortTime, showDate } from './workspace-ui.jsx';

const actions = [
  ['New Student','students','cap','Admit & assign to a class'], ['New Teacher','teachers','users','Add faculty & subjects'],
  ['New Staff','staff','profile','Onboard a staff member'], ['Create Exam','exams','certificate','Schedule a new examination'],
  ['Collect Fee','payments','wallet','Record a fee payment'], ['New Invoice','invoices','file','Generate a billing invoice'],
];
const apps = [
  ['Calendar','calendar','calendar'], ['Email','email','mail'], ['Chat','messages','chat'], ['To Do','todos','clipboard'],
  ['Files','files','folder'], ['Notes','notes','book'], ['Call','contacts','phone'], ['Invoices','invoices','file'], ['Tickets','tickets','badge'],
];
const profileLinks = [
  ['My Profile','profile','profile'], ['Settings','theme','settings'], ['Activity','activity','arrow'],
  ['Billing','fees','wallet'], ['Privacy & Security','profile','shield'], ['Help Center','tickets','help'],
];
const accents = ['blue','green','cyan','gold','red','indigo','purple','teal','pink'];

const regions = [['🇺🇸','United States','en-US'],['🇵🇰','Pakistan','en-PK'],['🇬🇧','United Kingdom','en-GB'],['🇫🇷','France','fr-FR'],['🇪🇸','Spain','es-ES'],['🇩🇪','Germany','de-DE']];

export default function TopBar({ user, go, modules, year, setYear, years, layout, setLayout, nav, setNav, logout, school, refresh, menuRequest }) {
  const [menu, setMenu] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState([]);
  const [filter, setFilter] = useState('All');
  const [messageQuery, setMessageQuery] = useState('');
  const [locale, setLocale] = useState(() => localStorage.getItem('school-region') || 'en-US');
  const [activity, setActivity] = useState([]);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [error, setError] = useState('');
  const root = useRef(null);
  useEffect(() => { if (menuRequest) setMenu(menuRequest.key); }, [menuRequest]);
  const search = useRef(null);
  useEffect(() => {
    function click(event) { if (!root.current?.contains(event.target)) setMenu(''); }
    function key(event) {
      if (event.key === 'Escape') setMenu('');
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search.current?.focus(); }
    }
    document.addEventListener('pointerdown', click);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', click); document.removeEventListener('keydown', key); };
  }, []);
  useEffect(() => {
    let live = true;
    let pending = false;
    function load() {
      if (pending) return;
      pending = true;
      Promise.all(['activity','messages','contacts'].map(key => api('workspace/' + key))).then(([a,m,c]) => {
        if (live) { setActivity(a); setMessages(m); setContacts(c); }
      }).catch(err => { if (live) setError(err.message); }).finally(() => { pending = false; });
    }
    load();
    const timer = setInterval(load, 15000);
    return () => { live = false; clearInterval(timer); };
  }, [refresh]);
  useEffect(() => {
    let live = true;
    setHits([]);
    const term = query.trim().toLowerCase();
    if (term.length < 2) return;
    const timer = setTimeout(async () => {
      const keys = ['students','teachers','staff','invoices'].filter(key => modules.includes(key));
      const matches = await Promise.all(keys.map(async key => {
        const rows = await api('records/' + key).catch(() => []);
        return rows.filter(row => (key !== 'students' || !year || row.year === year) &&
          [row.name, row.admission, row.email].some(value => value?.toLowerCase().includes(term)))
          .slice(0, 4).map(row => ({ key, id: row._id, name: row.name }));
      }));
      if (live) setHits(matches.flat());
    }, 220);
    return () => { live = false; clearTimeout(timer); };
  }, [query, modules.join(','), year, school]);
  const threads = new Map();
  for (const row of messages) {
    const peer = row.from === user.id ? row.to : row.from;
    const key = peer + '/' + (row.channel ?? 'chat');
    if (!threads.has(key)) threads.set(key, { key, peer, row, unread: 0 });
    if (row.to === user.id && !row.read) {
      const thread = threads.get(key);
      if (!thread.unread) thread.row = row;
      thread.unread += 1;
    }
  }
  const unread = [...threads.values()].filter(thread => thread.unread).length;
  const visibleThreads = [...threads.values()].filter(({peer,row}) =>
    (displayName(peer) + ' ' + row.body + ' ' + (row.subject ?? '')).toLowerCase().includes(messageQuery.trim().toLowerCase())).slice(0,5);
  const unreadActivity = activity.filter(row => !row.read).length;
  function displayName(id) { return id === user.id ? user.name : contacts.find(row => row._id === id)?.name ?? 'School account'; }
  function toggle(key) { setError(''); setMessageQuery(''); setMenu(menu === key ? '' : key); }
  function open(key, add = false, extras) { setMenu(''); setQuery(''); go(key, add, extras); }
  const availableApps = apps.filter(([,key]) => ['messages','email','contacts'].includes(key) || modules.includes(key));
  const activityRows = activity.filter(row => filter === 'All' || (filter === 'Unread' ? !row.read : row.kind === 'Alert'));
  const allowedProfile = profileLinks.filter(([,key]) => !['fees','tickets'].includes(key) || modules.includes(key));
  const [allApps,setAllApps] = useState(false);
  const [allActions,setAllActions] = useState(false);
  const [responding,setResponding] = useState('');
  async function respond(id,decision) {
    setResponding(id); setError('');
    try {
      const updated = await api('workspace/appointments/' + id + '/respond','POST',{ decision });
      setActivity(rows => rows.map(row => row._id === id ? updated : row));
    } catch (err) { setError(err.message); }
    finally { setResponding(''); }
  }
  async function mark(key) {
    try {
      await api('workspace/' + key + '/read', 'POST', {});
      if (key === 'messages') setMessages(rows => rows.map(row => row.to === user.id ? { ...row, read: true } : row));
      else setActivity(rows => rows.map(row => ({ ...row, read: true })));
    } catch (err) { setError(err.message); }
  }
  const control = (key, title, icon, badge) => <button className="top-control" aria-label={title} title={title} aria-expanded={menu === key} onClick={() => toggle(key)}>{icon}{badge > 0 && <b>{badge}</b>}</button>;
  return <header ref={root} className="preschool-top">
    <button className="mobile-menu" aria-expanded={nav} onClick={() => setNav(!nav)}>Menu</button>
    <div className="top-search"><span className="top-search-icon"><DashboardIcon name="search"/></span><input ref={search} aria-label="Global search" placeholder="Search students, staff, invoices…" value={query} onFocus={() => setMenu('search')} onChange={event => { setQuery(event.target.value); setMenu('search'); }} />
      <span className="top-keys" aria-hidden="true"><kbd>{/Mac|iPhone|iPad/.test(navigator.platform)?'⌘':'Ctrl'}</kbd><kbd>K</kbd></span>
      {menu === 'search' && query.trim() && <section className="top-pop search-pop"><h3>Search results</h3>
        {hits.length ? hits.map(row => <button className="pop-row" key={row.id} onClick={() => open(row.key, false, { id: row.id, name: row.name })}>{row.name}<small>{row.key}</small></button>) : <p className="muted">No matching records.</p>}</section>}
    </div>
    <div className="top-tools">
      {control('year','Academic year',<><span className="top-year-icon"><DashboardIcon name="calendar"/></span><span className="year-text">Academic Year : {year ? year.replace(/\s*\/\s*/,' / ') : 'All'}</span><DashboardIcon name="chevron"/></>)}
      {control('country','Country and region',locale === 'en-US' ? <span className="top-us-flag" aria-hidden="true" /> : regions.find(item => item[2] === locale)?.[0] ?? '🌐')}
      {user.role === 'admin' && control('add','Add New',<DashboardIcon name="plus"/>)}
      {control('theme','Theme and layout',<DashboardIcon name={layout === 'dark' ? 'sun' : 'moon'}/>)}
      {control('activity','Notifications',<DashboardIcon name="bell"/>,unreadActivity)}
      {control('messages','Messages',<DashboardIcon name="chat"/>,unread)}
      {control('apps','Apps',<DashboardIcon name="apps"/>)}
      {control('profile','Profile',<Person name={user.name} presence size="topbar-person" />)}
      {menu && menu !== 'search' && <section aria-label={menu === 'activity' ? 'Notifications' : menu}
        className={'top-pop top-reference pop-' + menu}>
        {menu !== 'profile' && <div className="pop-title">
          <div><h3>{{year:'Academic Year',country:'Country and region',add:'Add New',theme:'Theme and layout',activity:'Notifications',messages:'Messages',apps:'Apps'}[menu]}</h3>
            {menu === 'activity' && <small>You have {unreadActivity} unread {unreadActivity === 1 ? 'notification' : 'notifications'}</small>}
            {menu === 'messages' && <small>{unread} unread {unread === 1 ? 'conversation' : 'conversations'}</small>}
            {menu === 'apps' && <small>Jump to a workspace app</small>}
            {menu === 'add' && <small>Quickly create a record</small>}
          </div>
          {menu === 'activity' && <IconButton icon="check" label="Mark all as read" className="pop-soft-icon" disabled={!unreadActivity} onClick={() => mark('activity')} />}
          {menu === 'messages' && <IconButton icon="edit" label="Compose email" className="primary" onClick={() => open('email', false, { compose:true })} />}
          {menu === 'apps' && <IconButton icon="settings" label="Workspace appearance" className="pop-soft-icon" onClick={() => setMenu('theme')} />}
          {menu === 'add' && <span className="pop-soft-icon"><Icon name="bolt" /></span>}
        </div>}
        {menu === 'year' && ['',...years].map(value => <button className="pop-row" key={value} onClick={() => { setYear(value); setMenu(''); }}><Icon name="calendar" />{value || 'All academic years'}{value === year && <span className="pop-end">✓</span>}</button>)}
        {menu === 'country' && regions.map(([flag,name,value]) => <button className="pop-row" key={value} onClick={() => { setLocale(value); localStorage.setItem('school-region',value); setMenu(''); }}>{flag} {name}{value === locale && <span className="pop-end">✓</span>}</button>)}
        {menu === 'add' && <><div className="pop-list">{actions.filter(([,key]) => modules.includes(key)).map(([label,key,icon,description], index) =>
          <button className="pop-row pop-add-row" key={key} onClick={() => open(key,true)}><span className={'pop-app-icon wa-' + ['blue','green','gold','purple','cyan','pink'][index]}><Icon name={icon} /></span><span><strong>{label}</strong><small>{description}</small></span></button>)}
          {allActions && [['New admission','admissions'],['Add class','classes'],['Add book','library'],['Create event','calendar']].filter(([,key]) => modules.includes(key)).map(([label,key]) =>
            <button className="pop-row" key={key} onClick={() => open(key,true)}><Icon name="plus" />{label}</button>)}</div>
          <button className="pop-footer" onClick={() => setAllActions(!allActions)}>{allActions ? 'Show quick options' : 'View all options →'}</button></>}
        {menu === 'theme' && [['default','Default','grid'],['mini','Mini','apps'],['rtl','RTL','arrow'],['boxed','Boxed','square'],['dark','Dark','moon']].map(([value,label,icon]) =>
          <button className="pop-row" key={value} onClick={() => { setLayout(value); setMenu(''); }}><Icon name={icon} />{label}{layout === value && <span className="pop-end">✓</span>}</button>)}
        {menu === 'activity' && <><div className="pop-tabs">{['All','Unread','Alerts'].map(label => <button key={label} aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}{label === 'Unread' && <span>{unreadActivity}</span>}</button>)}</div>
          <div className="pop-list">{activityRows.map(row => <div className={'pop-item pop-notice ' + (!row.read ? 'unread' : '')} key={row._id}>
            <span className={'pop-notice-icon ' + (row.kind === 'Alert' ? 'wa-red' : 'wa-blue')}><Icon name={row.kind === 'Alert' ? 'bell' : 'calendar'} /></span>
            <div className="pop-notice-copy"><strong>{row.title}</strong><small><Icon name="time" />{shortTime(row.createdAt)}</small>
              {row.appointment && <div className="pop-appointment">
                <span>{showDate(row.appointment.date)} · {row.appointment.time} · {row.appointment.reason}</span>
                {row.appointment.status === 'Pending' && !row.appointment.outgoing ? <div className="wa-actions">
                  <button type="button" disabled={Boolean(responding)} onClick={() => respond(row._id,'Denied')}>Deny</button>
                  <button type="button" className="primary" disabled={Boolean(responding)} onClick={() => respond(row._id,'Approved')}>Approve</button>
                </div> : <small>{row.appointment.status}</small>}
              </div>}
            </div>
            {!row.read && <span className="wa-dot wa-blue pop-end" />}</div>)}
          {!activityRows.length && <p className="wa-empty">No matching notifications.</p>}</div>
          <button className="pop-footer" onClick={() => open('activity')}>View all notifications →</button></>}
        {menu === 'messages' && <><label className="message-search"><Icon name="search" /><input aria-label="Search messages" placeholder="Search messages…" value={messageQuery} onChange={event => setMessageQuery(event.target.value)} /></label>
          <div className="pop-list">{visibleThreads.map(({key,peer,row,unread:count}) =>
            <button className={'pop-row pop-message ' + (count ? 'unread' : '')} key={key} onClick={() => open(row.channel === 'mail' ? 'email' : 'messages',false,
              row.channel === 'mail' ? { message:row._id, sent:row.from === user.id } : { to:peer })}>
              <Person name={displayName(peer)} /><span className="pop-message-copy"><strong>{displayName(peer)}</strong><small>{row.subject || row.body}</small></span>
              <span className="pop-message-time"><small>{shortTime(row.createdAt)}</small>{count > 0 && <b>{count}</b>}</span></button>)}
          {!visibleThreads.length && <p className="wa-empty">{messages.length ? 'No matching messages.' : 'No messages yet.'}</p>}</div>
          <div className="pop-inbox-wrap"><button className="primary" onClick={() => open('email')}>Open Inbox</button></div></>}
        {menu === 'apps' && <><div className="app-links">{availableApps.map(([label,key,icon],index) =>
          <button key={label} onClick={() => open(key)}><span className={'pop-app-icon wa-' + accents[index]}><Icon name={icon} /></span>{label}</button>)}</div>
          {allApps && <div className="pop-list">{availableApps.map(([label,key,icon]) => <button className="pop-row" key={key} onClick={() => open(key)}><Icon name={icon} />{label}</button>)}</div>}
          <button className="pop-footer" onClick={() => setAllApps(!allApps)}>{allApps ? 'Hide app directory' : 'Browse all apps →'}</button></>}
        {menu === 'profile' && <><div className="pop-profile-identity"><Person name={user.name} presence />
          <span><strong>{user.name}</strong><small>{user.email}</small></span><b>{user.role}</b></div>
          <div className="pop-profile-links">{allowedProfile.map(([label,key,icon]) => <button key={label} className="pop-row"
            onClick={() => key === 'theme' ? setMenu(key) : open(key,false,label === 'Privacy & Security' ? { security:true } : undefined)}><Icon name={icon} />{label}
            {key === 'activity' && unreadActivity > 0 && <b className="pop-end">{unreadActivity}</b>}</button>)}
          <button className="pop-row danger" onClick={logout}><Icon name="logout" />Logout</button></div></>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>}
    </div>
  </header>;
}
