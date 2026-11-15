import React from 'react';
import { previewPortraits } from './dashboard-preview-portraits.js';
import './dashboard-hero.css';

import { Icon as DashboardIcon } from './icons.jsx';
export { DashboardIcon };

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
