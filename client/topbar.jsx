import { DashboardIcon } from './dashboard-hero.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const actions = [['New Student','students','♙'],['New Teacher','teachers','♧'],['New Staff','staff','♟'],['Create Exam','exams','▤'],['Collect Fee','payments','◈'],['New Invoice','invoices','▧']];
const apps = [['Calendar','calendar','▦'],['Email','messages','✉'],['Chat','messages','♧'],['To Do','todos','✓'],['Files','files','▱'],['Notes','notes','▤'],['Call','contacts','☎'],['Invoices','invoices','▧'],['Tickets','tickets','◇']];
const regions = [['🇺🇸','United States','en-US'],['🇵🇰','Pakistan','en-PK'],['🇬🇧','United Kingdom','en-GB'],['🇫🇷','France','fr-FR'],['🇪🇸','Spain','es-ES'],['🇩🇪','Germany','de-DE']];
const date = (value, locale) => new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

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
    function load() {
      Promise.all(['activity','messages','contacts'].map(key => api('workspace/' + key))).then(([a,m,c]) => {
        if (live) { setActivity(a); setMessages(m); setContacts(c); }
      }).catch(err => { if (live) setError(err.message); });
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
  const unread = messages.filter(row => row.to === user.id && !row.read).length;
  const unreadActivity = activity.filter(row => !row.read).length;
  const displayName = id => id === user.id ? user.name : contacts.find(row => row._id === id)?.name ?? 'School account';
  function toggle(key) { setError(''); setMenu(menu === key ? '' : key); }
  function open(key, add = false, extras) { setMenu(''); setQuery(''); go(key, add, extras); }
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
      {control('country','Country and region',regions.find(item => item[2] === locale)?.[0] ?? '🌐')}
      {user.role === 'admin' && control('add','Add New',<DashboardIcon name="plus"/>)}
      {control('theme','Theme and layout',<DashboardIcon name={layout === 'dark' ? 'sun' : 'moon'}/>)}
      {control('activity','Notifications',<DashboardIcon name="bell"/>,unreadActivity)}
      {control('messages','Messages',<DashboardIcon name="chat"/>,unread)}
      {control('apps','Apps',<DashboardIcon name="apps"/>)}
      {control('profile','Profile',<span className="top-avatar">{user.name[0]}</span>)}
      {menu && menu !== 'search' && <section className={'top-pop pop-' + menu}>
        <div className="pop-title"><h3>{{year:'Academic Year',country:'Country and region',add:'Add New',theme:'Theme and layout',activity:'Notifications',messages:'Messages',apps:'Apps',profile:'Profile'}[menu]}</h3>
          {menu === 'activity' && <small>{unreadActivity} unread updates</small>}
          {menu === 'messages' && <small>{unread} unread messages</small>}
          {menu === 'apps' && <small>Jump to a workspace app</small>}
          {menu === 'add' && <small>Quickly create a record</small>}
        </div>
        {menu === 'year' && ['',...years].map(value => <button className="pop-row" key={value} onClick={() => { setYear(value); setMenu(''); }}>{value || 'All academic years'} {value === year && '✓'}</button>)}
        {menu === 'country' && regions.map(([flag,name,value]) => <button className="pop-row" key={value} onClick={() => { setLocale(value); localStorage.setItem('school-region',value); setMenu(''); }}>{flag} {name} {value === locale && '✓'}</button>)}
        {menu === 'add' && actions.map(([label,key,icon]) => <button className="pop-row" key={key} onClick={() => open(key,true)}><i>{icon}</i>{label}</button>)}
        {menu === 'theme' && [['default','Default'],['mini','Mini'],['rtl','RTL'],['boxed','Boxed'],['dark','Dark']].map(([value,label]) =>
          <button className="pop-row" key={value} onClick={() => { setLayout(value); setMenu(''); }}>{label} {layout === value && '✓'}</button>)}
        {menu === 'activity' && <><div className="pop-tabs">{['All','Unread','Alerts'].map(label => <button key={label} aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}</div>
          <div className="pop-list">{activity.filter(row => filter === 'All' || (filter === 'Unread' ? !row.read : row.kind === 'Alert')).map(row =>
            <div className={'pop-item ' + (!row.read ? 'unread' : '')} key={row._id}>{row.title}<small>{date(row.createdAt,locale)}</small></div>)}
          {!activity.some(row => filter === 'All' || (filter === 'Unread' ? !row.read : row.kind === 'Alert')) && <p className="muted">No matching notifications.</p>}</div>
          <button className="pop-footer" onClick={() => mark('activity')}>Mark all as read</button></>}
        {menu === 'messages' && <><input className="message-search" placeholder="Search messages…" value={messageQuery} onChange={event => setMessageQuery(event.target.value)} />
          <div className="pop-list">{messages.filter(row => (displayName(row.from) + ' ' + row.body).toLowerCase().includes(messageQuery.toLowerCase())).slice(0,8).map(row =>
            <button className="pop-row" key={row._id} onClick={() => open('messages')}><span><strong>{displayName(row.from)}</strong><small>{row.body}</small></span></button>)}
          {!messages.length && <p className="muted">No messages yet.</p>}</div>
          <button className="pop-footer" onClick={() => open('messages')}>Open Inbox →</button></>}
        {menu === 'apps' && <div className="app-links">{apps.filter(([,key]) => ['messages','contacts'].includes(key) || modules.includes(key)).map(([label,key,icon]) =>
          <button key={label} onClick={() => open(key)}><i>{icon}</i>{label}</button>)}</div>}
        {menu === 'profile' && <><div className="pop-item"><strong>{user.name}</strong><small>{user.email}</small><small>{user.role}</small></div>
          <button className="pop-row" onClick={() => open('profile')}>My Profile</button>
          <button className="pop-row" onClick={() => setMenu('theme')}>Appearance settings</button>
          <button className="pop-row danger" onClick={logout}>Sign out</button></>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>}
    </div>
  </header>;
}
