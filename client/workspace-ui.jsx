import React, { useEffect, useRef, useState } from 'react';
import { DashboardIcon } from './dashboard-hero.jsx';

const paths = {
  mail:'M3 5h18v14H3zM3 6l9 7 9-7',
  phone:'M7 3h3l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v3c0 2-1 4-3 4A17 17 0 0 1 3 6c0-2 2-3 4-3z',
  end:'M3 16v-4c5-5 13-5 18 0v4h-5v-3H8v3z',
  video:'M3 6h13v12H3zm13 4 5-3v10l-5-3',
  mic:'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zm-3 6a6 6 0 0 0 12 0m-6 6v4m-3 0h6',
  folder:'M3 5h7l2 2h9v12H3z',
  star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
  edit:'m4 16 12-12 4 4L8 20H4zm10-10 4 4',
  send:'m22 2-7 20-4-9-9-4zm0 0L11 13',
  trash:'M4 6h16M6 6l1 14h10l1-14M9 6V3h6v3m-5 4v6m4-6v6',
  more:'M12 5h.01M12 12h.01M12 19h.01',
  back:'m15 5-7 7 7 7', next:'m9 5 7 7-7 7',
  refresh:'M20 10a8 8 0 1 0-1 7m1-12v5h-5',
  print:'M7 8V3h10v5m-10 8H3V8h18v8h-4M7 13h10v8H7zm11-2h.01',
  pin:'m9 3 9 9-3 1-4 4-1-4-4-4zm1 10-6 7',
  profile:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-5 6v-1a4 4 0 0 0-8 0v1m7-8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  shield:'m12 3 8 3v6c0 4-3 7-8 9-5-2-8-5-8-9V6zm0 6v6',
  settings:'M10 3h4l1 3 3 1 3-1 1 4-2 2v3l2 2-2 3-3-1-3 1-1 2h-3l-1-3-3-1-3 1-2-4 2-2v-3L1 8l2-3 3 1 3-1zm5 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  help:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-12-3a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01',
  logout:'M10 4H4v16h6m4-12 4 4-4 4m4-4H8',
  bolt:'m13 2-9 12h7l-1 8 10-12h-7z',
  image:'M3 4h18v16H3zm0 12 6-5 4 3 3-2 5 5M15 8h.01',
  audio:'M10 17V4l9-1v12m-9 2a3 2 0 1 1-6 0 3 2 0 0 1 6 0Zm9-2a3 2 0 1 1-6 0 3 2 0 0 1 6 0Z',
  close:'m6 6 12 12M18 6 6 18',
};

export function Icon({ name }) {
  return paths[name] ? <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg> : <DashboardIcon name={name} />;
}

export function IconButton({ icon, label, children, className = '', ...props }) {
  return <button type="button" title={label} aria-label={label} className={'wa-button ' + (children ? '' : 'wa-icon-button ') + className} {...props}><Icon name={icon} />{children}</button>;
}

export function Person({ name = '', image, presence = false, size = '' }) {
  const hue = [...name].reduce((sum, letter) => sum + letter.charCodeAt(0) * 11, 0) % 360;
  return <span className={'wa-person ' + size} style={{ '--person-hue': hue }} aria-hidden="true">
    {image ? <img alt="" src={image} /> : name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('')}
    {presence && <i />}
  </span>;
}

export function PageTitle({ title, children }) {
  return <div className="wa-title"><div><h1>{title}</h1><p><span>Dashboard</span><span>Application</span>{title}</p></div>{children && <div className="wa-actions">{children}</div>}</div>;
}

export function Dialog({ title, close, children }) {
  const box = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const node = box.current;
    node.focus();
    function key(event) {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab') return;
      const items = [...node.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')];
      if (!items.length) return;
      if ((event.shiftKey && [node, items[0]].includes(document.activeElement)) || (!event.shiftKey && document.activeElement === items.at(-1))) {
        event.preventDefault();
        (event.shiftKey ? items.at(-1) : items[0]).focus();
      }
    }
    node.addEventListener('keydown', key);
    return () => { node.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="overlay wa-overlay" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={box} tabIndex={-1} className="modal wa-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="wa-dialog-head"><h2>{title}</h2><IconButton icon="close" label="Close" onClick={close} /></div>{children}
    </section>
  </div>;
}

export function usePreferences(user, key, initial = {}) {
  const storageKey = 'school-workspace:' + user.id + ':' + key;
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) ?? initial; }
    catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch {} }, [storageKey, value]);
  return [value, setValue];
}

export function localDay(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function showDate(value) {
  if (!value) return '—';
  return new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function shortTime(value) {
  if (!value) return '';
  const stamp = new Date(value);
  return localDay(stamp) === localDay() ? stamp.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : showDate(value);
}

export function csvDownload(filename, rows) {
  const csv = rows.map(row => row.map(cell => {
    const value = String(cell ?? '');
    return '"' + (/^\s*[=+@-]|^[\t\r\n]/.test(value) ? "'" : '') + value.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
