import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
export { Icon };

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
