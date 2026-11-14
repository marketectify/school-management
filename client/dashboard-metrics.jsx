import React from 'react';
import { DashboardIcon } from './dashboard-hero.jsx';

export function delta(current, previous, title, {unit = '', lower = false} = {}) {
  if (current == null || previous == null) return null;
  const value = Math.round((current - previous) * 10) / 10;
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'minus';
  const tone = !value ? 'neutral' : (value > 0) !== lower ? 'good' : 'bad';
  return { direction, tone, text: Math.abs(value) + unit, title };
}

export function MetricBadge({change}) {
  if (!change) return <span className="metric-badge metric-neutral" title="Comparison data unavailable" aria-label="Comparison data unavailable"><DashboardIcon name="minus"/> —</span>;
  return <span className={'metric-badge metric-'+change.tone} title={change.title}
    aria-label={change.title + ': ' + (change.direction==='up'?'+':change.direction==='down'?'−':'') + change.text}>
    <DashboardIcon name={change.direction}/>{change.text}</span>;
}

export function DashboardMetrics({items}) {
  return <div className="dashboard-kpi-grid">{items.map(({name,value,icon,tone,change,run,suffix}) =>
    <button type="button" className="dashboard-kpi panel" key={name} onClick={run}>
      <span className="dashboard-kpi-head"><span className={'td-icon td-'+tone}><DashboardIcon name={icon}/></span><MetricBadge change={change}/></span>
      <strong>{value}{suffix&&<small>{suffix}</small>}</strong>
      <span className="dashboard-kpi-label">{name}</span>
    </button>)}</div>;
}
