import React, { useEffect, useRef, useState } from 'react';
import { sections } from './sidebar-menu.js';
import { Icon } from './icons.jsx';
import { layoutOptions } from './workspace-layout.js';
import { allowed } from '../administration.js';
import './sidebar.css';

const applicationLabels = {
  messages: 'Chat', email: 'Email', contacts: 'Call', calendar: 'Calendar',
  todos: 'To Do', notes: 'Notes', files: 'File Manager',
};
const applicationIcons = {
  messages: 'chat', email: 'mail', contacts: 'phone', calendar: 'calendar',
  todos: 'clipboard', notes: 'file', files: 'folder',
};
const layoutIcons = Object.fromEntries(layoutOptions.map(({ id, icon }) => [id, icon]));
const layoutBranch = 'Main/Layouts';

export function SidebarMenu({ user, modules, view, go, layout, setDisplay, openSchools, openTopMenu }) {
  const [expanded, setExpanded] = useState({});
  const [flyout, setFlyout] = useState(null);
  const [desktop, setDesktop] = useState(() => matchMedia('(min-width: 751px)').matches);
  const nav = useRef(null);
  const flyoutPanel = useRef(null);
  const compact = layout === 'mini' && desktop;
  const admin = user.role === 'admin';
  const dashboardLabel = (admin ? 'Admin' : user.role[0].toUpperCase() + user.role.slice(1)) + ' Dashboard';
  const dashboardView = view.key === 'dashboard' || view.key.startsWith('preview-');

  useEffect(() => {
    const query = matchMedia('(min-width: 751px)');
    const change = () => setDesktop(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);

  useEffect(() => { setFlyout(null); }, [layout, view.revision, desktop]);

  useEffect(() => {
    if (!flyout || !compact) return;
    function dismiss(event) {
      if (!nav.current?.contains(event.target) && !flyoutPanel.current?.contains(event.target)) setFlyout(null);
    }
    function escape(event) {
      if (event.key !== 'Escape') return;
      setFlyout(null);
      flyout.trigger?.focus();
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    flyoutPanel.current?.querySelector('button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [flyout, compact]);

  function destination(to, label) {
    if (!to) return admin ? { key: 'module-info', label } : null;
    if (to.startsWith('!')) return { layout: to.slice(1) };
    if (to.startsWith('#')) return admin ? { action: to.slice(1) } : null;
    const [route, status] = to.split('~');
    const add = route.endsWith('+');
    const key = route.replace(/\+$/, '');
    if (['accounts','roles','deletion-requests'].includes(key) && (!admin || !allowed(user,{accounts:'users',roles:'roles','deletion-requests':'deletionRequests'}[key]))) return null;
    if (add && !admin && !(user.role === 'teacher' && key === 'results')) return null;
    if (key === 'dashboard' && !admin) return null;
    if (key === 'preview-' + user.role && !admin) return { key: 'dashboard', label };
    if (!(modules.includes(key) || ['dashboard','messages','email','contacts','profile'].includes(key) || admin)) return null;
    return { key, add, status, label };
  }

  function available([label, to]) {
    return Array.isArray(to) ? to.some(available) : Boolean(destination(to, label));
  }

  function showLayouts(trigger) {
    if (compact) {
      const entry = sections[0][1].find(([label]) => label === 'Layouts');
      setFlyout({ id: layoutBranch, label: entry[0], children: entry[1], trigger });
      return;
    }
    setExpanded(previous => ({ ...previous, [layoutBranch]: true }));
    document.getElementById('nav-' + encodeURIComponent(layoutBranch))?.scrollIntoView({ block: 'nearest' });
  }

  function render(entry, path, depth = 0) {
    if (!available(entry)) return null;
    const [label, to, icon] = entry;
    const id = path + '/' + label;
    const children = Array.isArray(to);
    const dest = children ? null : destination(to, label);
    const topCompact = compact && depth === 0;
    const current = dest?.key === view.key && (view.target?.navId ? view.target.navId === id :
      label === (view.key === 'dashboard' ? dashboardLabel : applicationLabels[view.key] ?? view.key) || view.key === 'preview-' + label.split(' ')[0].toLowerCase());
    const selectedLayout = dest?.layout === layout;
    const activeBranch = children && (view.target?.navId?.startsWith(id + '/') ||
      (id === 'Main/Dashboard' && dashboardView) || (id === 'Main/Application' && Boolean(applicationLabels[view.key])));
    const open = children && (topCompact ? flyout?.id === id : expanded[id] ?? Boolean(activeBranch));
    const panelId = 'nav-' + encodeURIComponent(id);
    const symbol = icon ?? (dest?.layout ? layoutIcons[dest.layout] : path === 'Main/Application' ? applicationIcons[dest?.key] : undefined);

    function activate(event) {
      if (children) {
        if (topCompact) setFlyout(open ? null : { id, label, children: to, trigger: event.currentTarget });
        else setExpanded(previous => ({ ...previous, [id]: !open }));
        return;
      }
      if (dest.layout) { setDisplay(dest.layout); setFlyout(null); return; }
      if (dest.action === 'layouts') { showLayouts(event.currentTarget); return; }
      if (dest.action === 'schools') { setFlyout(null); openSchools(); return; }
      if (dest.action === 'year') { setFlyout(null); openTopMenu('year'); return; }
      setFlyout(null);
      go(dest.key, dest.add, { navId: id, label: dest.label, status: dest.status });
    }

    return <div className={'nav-node depth-' + depth} key={id}>
      <button type="button" title={label} aria-label={topCompact ? label : undefined}
        className={'nav-entry' + (children ? ' nav-branch' : '') + (open ? ' nav-expanded' : '') + (activeBranch ? ' nav-active-branch' : '')}
        aria-current={current ? 'page' : undefined} aria-pressed={dest?.layout ? selectedLayout : undefined}
        aria-expanded={children ? open : undefined} aria-controls={children && (!topCompact || open) ? panelId : undefined} onClick={activate}>
        {symbol && <span className="sidebar-tile"><Icon name={symbol} /></span>}
        <span className="sidebar-label">{label}</span>
        {children && <span className="sidebar-toggle"><Icon name={open ? 'minus' : 'plusSmall'} /></span>}
        {selectedLayout && <span className="sidebar-selection"><Icon name="tick" /></span>}
      </button>
      {children && !topCompact && <div className="sidebar-children" id={panelId} hidden={!open}>{open && to.map(child => render(child, id, depth + 1))}</div>}
    </div>;
  }

  return <>
    <nav className="preskool-menu" aria-label="School modules" ref={nav}>{sections.map(([title, entries]) => entries.some(available) &&
      <section key={title}><h2>{title}</h2>{entries.map(entry => render(entry, title))}</section>)}</nav>
    {compact && flyout && <nav className="preskool-flyout" aria-label={flyout.label} ref={flyoutPanel} id={'nav-' + encodeURIComponent(flyout.id)}>
      <div className="preskool-flyout-title"><strong>{flyout.label}</strong>
        <button type="button" aria-label="Close menu" onClick={() => { setFlyout(null); flyout.trigger?.focus(); }}><Icon name="close" /></button></div>
      <div className="sidebar-children">{flyout.children.map(child => render(child, flyout.id, 1))}</div>
    </nav>}
  </>;
}

export function ModuleInfo({title}) {
  return <><p className="breadcrumbs">Dashboard / {title}</p><h1>{title}</h1>
    <section className="panel"><p className="muted">This menu item is available in the sidebar. Its workflow is pending.</p></section></>;
}
