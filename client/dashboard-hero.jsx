import React from 'react';
import { previewPortraits } from './dashboard-preview-portraits.js';
import './dashboard-hero.css';

const paths = {
  cap:'m2 9 10-5 10 5-10 5L2 9Zm4 2v5c4 3 8 3 12 0v-5m4-2v6',
  calendar:'M4 6h16v14H4zM4 10h16M8 3v5m8-5v5m-8 6h3',
  time:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  check:'M20 11v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10m-6 8 3 3 8-8',
  clipboard:'M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3M9 3h6v5H9zM8 14l3 3 5-5',
  users:'M15 20v-2c0-2-2-4-4-4H7c-2 0-4 2-4 4v2m9-13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm7 6v7m-3-3h6',
  money:'M12 2v20m5-16H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7',
  wallet:'M3 6h16v12H3zM19 9h3v6h-6a3 3 0 0 1 0-6h3m-3 3h.1',
  book:'M12 5v15M3 5c3-2 6-1 9 1 3-2 6-3 9-1v13c-3-2-6-1-9 1-3-2-6-3-9-1z',
  file:'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',
  grid:'M3 3h18v18H3zM3 9h18M9 9v12',
  medal:'M17 9a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-8 4-2 7 5-2 5 2-2-7',
  flag:'M4 22V3m0 1h14l-3 4 3 4H4',
  badge:'M3 6h18v13H3zM8 3v6m8-6v6m-8 4h2m3 0h4',
  house:'m3 11 9-8 9 8m-15-2v11h12V9m-8 11v-5h4v5',
  sparkle:'m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',
  arrow:'M3 17l6-6 4 4 8-8m-5 0h5v5',
  play:'m7 4 14 8-14 8z',
  chat:'M3 5h18v12H10l-5 4v-4H3zM7 9h10m-10 4h7',
  bell:'M4 17h16l-2-3V9a6 6 0 0 0-12 0v5zm6 3h4',
  bus:'M4 5h16a1 1 0 0 1 1 1v11H3V6a1 1 0 0 1 1-1zm-1 6h18M7 17v3m10-3v3m-10-6h1m8 0h1',
  megaphone:'m3 10 16-5v14L3 15zm4 6 2 5m13-12v5',
  up:'M12 20V4m-6 6 6-6 6 6',
  down:'M12 4v16m-6-6 6 6 6-6',
  minus:'M5 12h14',
  trophy:'M8 16h8m-4-4v4m-4-9H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M8 4h8v4a4 4 0 0 1-8 0V4Zm0 16h8',
  trendDown:'m3 7 6 6 4-4 8 8m-5 0h5v-5',
  certificate:'M12 3h3l5 5v13h-9m4-18v6h5M13 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-5 2-1 6 3-2 3 2-1-6',
  plus:'M12 6v12m-6-6h12M3 3h18v18H3z',
};

export function DashboardIcon({name}) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] ?? paths.file}/></svg>;
}

export function HeroAvatar({name, kind, demo, online}) {
  return <span className={'dashboard-avatar dashboard-avatar-'+kind}>
    {demo ? <img src={previewPortraits[kind]} alt=""/> : <span>{name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('')}</span>}
    {online && <i aria-hidden="true"/>}
  </span>;
}

export function HeroTag({icon,children,tone}) {
  return <span className={'dashboard-tag'+(tone?' td-'+tone:'')}><DashboardIcon name={icon}/>{children}</span>;
}

export function HeroClock({now,status}) {
  return <div className="td-time dashboard-clock">
    <strong>{now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</strong>
    <small>{now.toLocaleDateString('en-GB',{dateStyle:'full'})}</small>
    {status&&<span className={'td-badge td-'+(status==='Absent'?'red':'green')}><DashboardIcon name="check"/>{status} Today</span>}
  </div>;
}

export function HeroMetric({name,value,icon,tone,run,progress,description}) {
  const format=typeof progress==='number';
  const content=<>{format?<span className="dashboard-mini-ring" style={{'--percent':progress+'%'}}><span>{progress}%</span></span>:
    <span className={'td-icon td-'+tone}><DashboardIcon name={icon}/></span>}<div><strong>{format?'Profile':value}</strong><small>{format?'Completion':description??name}</small></div></>;
  return run?<button type="button" className="td-metric" onClick={run}>{content}</button>:<div className="td-metric">{content}</div>;
}
