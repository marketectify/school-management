import React,{useState} from 'react';
import {sections} from './sidebar-menu.js';
import './sidebar.css';

export function SidebarMenu({user, modules, view, go, layout, setDisplay, openSchools, openTopMenu}) {
  const [expanded,setExpanded]=useState({});
  const admin=user.role==='admin';
  const ownDashboard=user.role[0].toUpperCase()+user.role.slice(1)+' Dashboard';
  function destination(to,label) {
    if (!to) return admin ? {key:'module-info',label} : null;
    if (to.startsWith('!')) return {layout:to.slice(1)};
    if (to.startsWith('#')) return admin ? {action:to.slice(1)} : null;
    const [route,status]=to.split('~');
    const add=route.endsWith('+');
    const key=route.replace(/\+$/,'');
    if (add&&!admin&&!(user.role==='teacher'&&key==='results')) return null;
    if (key==='dashboard'&&!admin) return null;
    if (key==='preview-'+user.role&&!admin) return {key:'dashboard',label};
    if (!(modules.includes(key)||['dashboard','messages','email','contacts','profile'].includes(key)||admin)) return null;
    return {key,add,status,label};
  }
  function available(entry) {
    const [label,to]=entry;
    return Array.isArray(to)?to.some(available):Boolean(destination(to,label));
  }
  function render(entry,path,depth=0) {
    const [label,to,icon]=entry;
    if (!available(entry)) return null;
    const id=path+'/'+label;
    const children=Array.isArray(to);
    const dest=children?null:destination(to,label);
    const current=dest&&(dest.layout?layout===dest.layout:dest.key===view.key&&(view.target?.navId?view.target.navId===id:label===(view.key==='dashboard'?(admin?'Admin Dashboard':ownDashboard):({messages:'Chat',email:'Email',contacts:'Call',calendar:'Calendar',todos:'To Do',notes:'Notes',files:'File Manager'}[view.key] ?? view.key))));
    const open=expanded[id]??((label==='Dashboard' && (view.key==='dashboard'||view.key.startsWith('preview-')))||(label==='Application' && ['messages','email','contacts','calendar','todos','notes','files'].includes(view.key)));
    const panelId='nav-'+encodeURIComponent(id);
    return <div className={'nav-node depth-'+depth} key={id}>
      <button type="button" title={label} className={'nav-entry'+(children?' nav-branch':'')+(open&&children?' nav-expanded':'')} aria-current={current?'page':undefined}
        aria-expanded={children?open:undefined} aria-controls={children?panelId:undefined} onClick={()=>{
          if(children){if(layout==='mini')setDisplay('default');setExpanded(previous=>({...previous,[id]:layout==='mini'||!open}));return;}
          if(dest.layout){setDisplay(dest.layout);return;}
          if(dest.action==='schools'){openSchools();return;}
          if(dest.action==='layouts'){setExpanded(previous=>({...previous,'Main/Layouts':true}));document.getElementById('nav-Main%2FLayouts')?.scrollIntoView({block:'nearest'});return;}
          if(dest.action==='year'){openTopMenu('year');return;}
          go(dest.key,dest.add,{navId:id,label:dest.label,status:dest.status});
        }}>
        {(icon||dest?.layout)&&<span aria-hidden="true" className="sidebar-tile">{icon??({default:'◫',mini:'◧',rtl:'¶',boxed:'◩',dark:'☾'}[dest.layout])}</span>}
        <span className="sidebar-label">{label}</span>{children&&<span aria-hidden="true" className="sidebar-toggle">{open?'−':'+'}</span>}
      </button>
      {children&&<div className="sidebar-children" id={panelId} hidden={!open}>{open&&to.map(child=>render(child,id,depth+1))}</div>}
    </div>;
  }
  return <nav className="preskool-menu" aria-label="School modules">{sections.map(([title,entries])=>entries.some(available)&&
    <section key={title}><h2>{title}</h2>{entries.map(entry=>render(entry,title))}</section>)}</nav>;
}

export function ModuleInfo({title}) {
  return <><p className="breadcrumbs">Dashboard / {title}</p><h1>{title}</h1>
    <section className="panel"><p className="muted">This menu item is available in the sidebar. Its workflow is pending.</p></section></>;
}
