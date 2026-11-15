import React, { useEffect, useId, useState } from 'react';
import { api } from './api.js';
import './admin-dashboard.css';
import './admin-masthead.css';
import { delta } from './dashboard-metrics.jsx';
import { DashboardIcon } from './dashboard-hero.jsx';
import Spotlights from './spotlight.jsx';

const palette = ['#4059dc', '#126bce', '#24ba49', '#efb500', '#7714d9'];
const number = value => Number(value || 0).toLocaleString();
const ratio = (a,b) => b ? Math.round(a / b * 1000) / 10 : 0;
const sum = (rows,key) => rows.reduce((total,row) => total + (row[key] || 0),0);
const valid = row => ['Present','Late'].includes(row.status);
const day = date => date.toLocaleDateString('en-CA');
const shift = (date,n) => new Date(date.getFullYear(),date.getMonth(),date.getDate()+n);
const keys = ['classes','students','teachers','attendance','results','exams','payments','fees','admissions','library','loans','fleet','delivery','transport'];

function Card({ section, title, children, wide, footer }) {
  return <article className={'erp-card panel' + (wide ? ' erp-wide' : '')}><div className="erp-card-title"><small>{section}</small><h2>{title}</h2></div>
    <div className="erp-card-body">{children}</div>{footer && <div className="erp-footer">{footer}</div>}</article>;
}
function Stats({ items }) {
  return <div className="erp-stats">{items.map(([label,value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>;
}
function Bar({ label,value, meta,color = palette[0] }) {
  return <div className="erp-bar"><div><span>{label}</span><strong>{meta ?? value + '%'}</strong></div><span className="erp-track"><i style={{width: Math.min(100,value)+'%',background:color}}/></span></div>;
}
function Ring({ value,label,color=palette[0] }) {
  return <div className="erp-ring-wrap"><div className="ring" style={{background:'conic-gradient('+color+' '+Math.min(100,value)+'%,var(--line) 0)'}}><strong>{value}%</strong></div>{label && <small>{label}</small>}</div>;
}
function Plot({ labels, series, type = 'line', label }) {
  const id = useId();
  const [selected,setSelected] = useState(null);
  const color = index => type === 'bar' && index === 1 ? '#0ba77f' : palette[index];
  const scaleFor = index => type === 'bar' ? Math.max(1,...series[index].values) : max;
  const max = Math.max(1,...series.flatMap(s=>s.values));
  const curve = points => points.map(([px,py],i) => {
    if (!i) return 'M'+px+','+py;
    const [previousX,previousY]=points[i-1];
    const middle=(previousX+px)/2;
    return 'C'+middle+','+previousY+' '+middle+','+py+' '+px+','+py;
  }).join(' ');
  const width=620,height=200,left=44,right=16,top=14,bottom=34;
  const x=i=>left+(width-left-right)*(i+.5)/Math.max(labels.length,1);
  const y=(v,index=0)=>height-bottom-(height-bottom-top)*v/(type==='bar'?scaleFor(index):max);
  return <><div className="erp-legend">{series.map((s,i)=><span key={s.name}><i style={{background:color(i)}}/>{s.name}</span>)}</div>
    <svg viewBox="0 0 620 200" className="erp-plot" role="img" aria-label={label}>
    <defs>{series.map((s,i)=><linearGradient key={s.name} id={id+i} x2="0%" y2="100%"><stop stopColor={color(i)} stopOpacity=".56"/><stop offset="100%" stopColor={color(i)} stopOpacity=".03"/></linearGradient>)}</defs>
    {[0,.25,.5,.75,1].map(p=><g key={p}><line x1={left} x2={width-right} y1={y(p*max)} y2={y(p*max)}/><text x={left-5} y={y(p*max)+4} textAnchor="end">{number(Math.round(p*(type==='bar'?scaleFor(0):max)))}</text></g>)}
    {series.map((s,index)=>{ const points=s.values.map((v,i)=>[x(i),y(v,index)]); return <g key={s.name}>
      {type==='bar' && index===0 ? s.values.map((v,i)=><rect key={i} x={x(i)-19} y={y(v)} width="38" height={y(0)-y(v)} rx="3" fill={palette[index]}><title>{labels[i]}: {number(v)} {s.name}</title></rect>) : <>
        {type==='area' && points.length>0 && <path d={curve(points)+' L'+points.at(-1)[0]+','+y(0)+' L'+points[0][0]+','+y(0)+' Z'} fill={'url(#'+id+index+')'}/>}
        <path d={curve(points)} fill="none" stroke={color(index)} strokeWidth="3"/>
        {points.map(([px,py],i)=><circle key={i} cx={px} cy={py} r="4" fill={color(index)} stroke="var(--surface)" strokeWidth="1.4"><title>{labels[i]}: {number(s.values[i])} {s.name}</title></circle>)}</>}
    </g>})}
    {selected !== null && labels[selected] && <line x1={x(selected)} x2={x(selected)} y1={top} y2={y(0)} />}{labels.map((label,i)=><text key={i} x={x(i)} y={height-11} textAnchor="middle">{label}</text>)}</svg><div className="erp-plot-points">{labels.map((label,i)=><button key={i} onFocus={()=>setSelected(i)} onMouseEnter={()=>setSelected(i)} onClick={()=>setSelected(i)} aria-label={label}>{label}</button>)}</div>
    {selected!==null && labels[selected] && <div className="erp-chart-readout"><strong>{labels[selected]}</strong>{series.map(s=><span key={s.name}>{s.name}: {number(s.values[selected])}</span>)}</div>}</>;
}
function Scatter({ scores }) {
  return <svg viewBox="0 0 360 176" className="erp-plot" role="img" aria-label="Exam score versus attendance">
    {[0,25,50,75,100].map(p=><g key={p}><line x1="38" x2="345" y1={135-p*1.2} y2={135-p*1.2}/><text x="30" y={138-p*1.2} textAnchor="end">{p}</text>
      <text x={38+p*3.07} y="152" textAnchor="middle">{p}</text></g>)}
    {scores.filter(row=>row.records).map(row=><circle key={row.id} cx={38+row.attendance*3.07} cy={135-row.score*1.2} r="5.5" fill={row.score>=80?'#48b877':row.score>=60?'#e6a049':'#e65a68'}><title>{row.name}: {row.score}% score, {row.attendance}% attendance</title></circle>)}
    <text x="190" y="170" textAnchor="middle">Attendance %</text><text transform="translate(11 93) rotate(-90)">Avg score</text>
  </svg>;
}
function Polar({ values, months }) {
  const max=Math.max(1,...values), center=100;
  const point=(angle,r)=>[center+Math.cos(angle)*r,center+Math.sin(angle)*r].join(',');
  return <div className="erp-polar"><svg viewBox="0 0 200 200" role="img" aria-label="Books issued each month">
    {[22,44,66,88].map(r=><circle key={r} cx="100" cy="100" r={r} fill="none" stroke="var(--line)"/>)}
    {values.map((value,i)=>{ const a=(i/12-.25)*Math.PI*2,b=a+Math.PI/6,r=88*value/max;
      return <path key={i} d={'M100,100 L'+point(a,r)+' A'+r+','+r+' 0 0 1 '+point(b,r)+' Z'} fill={palette[0]} fillOpacity={.24+i*.055} stroke="var(--surface)"><title>{months[i]}: {value} loans</title></path>;
    })}</svg><div className="erp-legend vertical">{months.map((m,i)=><span key={m}><i style={{background:palette[0],opacity:.24+i*.055}}/>{m}</span>)}</div></div>;
}

export default function Dashboard({ user, counts, go, year, years, onYear, schoolName, refresh }) {
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [period,setPeriod]=useState('all');
  useEffect(()=>{
    let active=true;
    setError('');
    Promise.all([...keys.map(key=>[key,'records/'+key]),...['activity','messages','contacts'].map(key=>[key,'workspace/'+key])]
      .filter(([key])=>!keys.includes(key)||Object.hasOwn(counts,key))
      .map(async ([key,path])=>[key,await api(path)])).then(entries=>{if(active)setData(Object.fromEntries(entries));},err=>{if(active)setError(err.message);});
    return ()=>{active=false;};
  },[counts]);
  const today=new Date(), todayKey=day(today);
  const students=(data?.students??[]).filter(row=>!year||row.year===year);
  const studentIds=new Set(students.map(row=>row._id));
  const start=period==='week'?day(shift(today,-6)):period==='month'?day(new Date(today.getFullYear(),today.getMonth(),1)):period==='today'?todayKey:'';
  const inPeriod=(date)=>!start||(date>=start&&date<=todayKey);
  const attendance=(data?.attendance??[]).filter(row=>studentIds.has(row.studentId)&&inPeriod(row.date));
  const exams=data?.exams??[];
  const examsById=new Map(exams.map(row=>[row._id,row]));
  const scores=students.map(student=>{
    const marks=(data?.results??[]).filter(row=>row.studentId===student._id && inPeriod(examsById.get(row.examId)?.date) && examsById.get(row.examId)?.maximum);
    const records=attendance.filter(row=>row.studentId===student._id);
    return {id:student._id,name:student.name,score:ratio(sum(marks,'marks'),marks.reduce((total,row)=>total+examsById.get(row.examId).maximum,0)),count:marks.length,records:records.length,attendance:ratio(records.filter(valid).length,records.length)};
  }).filter(row=>row.count).sort((a,b)=>b.score-a.score);
  const fees=new Set((data?.fees??[]).filter(row=>studentIds.has(row.studentId)).map(row=>row._id));
  const payments=(data?.payments??[]).filter(row=>fees.has(row.feeId)&&inPeriod(row.date));
  const admissions=(data?.admissions??[]).filter(row=>inPeriod(row.date));
  const deliveries=(data?.delivery??[]).filter(row=>inPeriod(row.date));
  const fleet=(data?.fleet??[]).filter(row=>inPeriod(row.date));
  const books=data?.library??[];
  const allLoans=(data?.loans??[]).filter(row=>studentIds.has(row.studentId));
  const loans=allLoans.filter(row=>inPeriod(row.date));
  const classes=data?.classes??[];
  const groups=classes.map(row=>({...row,students:students.filter(student=>student.classId===row._id)}));
  const days=[...new Set(attendance.map(row=>row.date))].sort().slice(-6);
  const week=Array.from({length:7},(_,i)=>day(shift(today,i-6)));
  const months=Array.from({length:12},(_,i)=>new Date(today.getFullYear(),today.getMonth()+i-11,1));
  const monthLabels=months.map(date=>date.toLocaleDateString(undefined,{month:'short'}));
  const monthCount=(rows,key)=>months.map(date=>rows.filter(row=>row[key]?.startsWith(day(date).slice(0,7))).length);
  const channels=['SMS','Email','App Push','WhatsApp'];
  const delivered=sum(deliveries,'delivered'), failed=sum(deliveries,'failed');
  const inbox=(data?.messages??[]).filter(row=>row.to===user.id);
  const contacts=data?.contacts??[];
  const sender=row=>contacts.find(person=>person._id===row.from);
  const parents=contacts.filter(row=>row.role==='parent');
  const parentCounts=parents.map(row=>inbox.filter(message=>message.from===row._id).length);
  const activeParents=parentCounts.filter(count=>count>0).length;
  const categories=[...new Set(books.map(row=>row.category||'Other'))].map(name=>[name,sum(books.filter(row=>(row.category||'Other')===name),'copies')]).sort((a,b)=>b[1]-a[1]);
  const copies=sum(books,'copies'), issued=allLoans.filter(row=>row.status==='Issued').length, reserved=allLoans.filter(row=>row.status==='Reserved').length;
  const available=Math.max(0,copies-issued-reserved);
  const routes=new Map((data?.transport??[]).map(route=>[route._id,route]));
  const fleetDays=[...new Set(fleet.map(row=>row.date))].sort().slice(-7);
  const recentVehicles=[...new Map([...fleet].sort((a,b)=>a.date.localeCompare(b.date)).map(row=>[row.routeId,row])).values()];
  const previousDay=day(shift(today,-1));
  const dayAttendance=key=>(data?.attendance??[]).filter(row=>row.date===key&&studentIds.has(row.studentId));
  const todayAttendance=dayAttendance(todayKey);
  const yesterdayAttendance=dayAttendance(previousDay);
  const attendanceDelta=todayAttendance.length&&yesterdayAttendance.length
    ? Math.round(10*(ratio(todayAttendance.filter(valid).length,todayAttendance.length)-ratio(yesterdayAttendance.filter(valid).length,yesterdayAttendance.length)))/10 : null;
  const upcomingExams=exams.filter(row=>row.date>=todayKey).sort((a,b)=>a.date.localeCompare(b.date));
  const daysToExam=upcomingExams.length?Math.round((Date.parse(upcomingExams[0].date)-Date.parse(todayKey))/86400000):null;
  const feesToday=sum((data?.payments??[]).filter(row=>row.date===todayKey&&fees.has(row.feeId)),'amount');
  const newAdmissions=(data?.admissions??[]).filter(row=>row.date===todayKey).length;
  const priorAdmissions=(data?.admissions??[]).filter(row=>row.date===previousDay).length;
  const previousFees=sum((data?.payments??[]).filter(row=>row.date===previousDay&&fees.has(row.feeId)),'amount');
  const amountChange=previousFees ? delta(feesToday/previousFees*100,100,'Fees received compared with yesterday',{unit:'%'}) : null;
  const metrics=[
    ["Today's Attendance",todayAttendance.length?ratio(todayAttendance.filter(valid).length,todayAttendance.length)+'%':'—','attendance','check',delta(attendanceDelta,0,'Attendance compared with yesterday',{unit:'%'})],
    ['New Admissions',number(newAdmissions),'admissions','users',delta(newAdmissions,priorAdmissions,'Admissions today compared with yesterday')],
    ['Fees Today',Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:feesToday>=10000?'compact':'standard',maximumFractionDigits:feesToday>=10000?1:2,minimumFractionDigits:0}).format(feesToday),'payments','money',amountChange],
    ['Upcoming Exams',String(upcomingExams.length).padStart(2,'0'),'exams','certificate',daysToExam===null?null:{direction:'time',tone:'bad',text:daysToExam===0?'Today':daysToExam+'d',title:'Time until the next exam'}],
  ];
  const exportCSV=()=>{
    const blob=new Blob(['Metric,Value\r\n'+metrics.map(([label,value])=>label+',"'+value+'"').join('\r\n')],{type:'text/csv'});
    const url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url;link.download='admin-dashboard.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const action=(key,label)=> <button className="erp-link" onClick={()=>go(key)}>{label} <DashboardIcon name="forward" /></button>;
  return <div className="erp">
    <div className="erp-heading admin-masthead"><div><h1>Admin Dashboard</h1><p className="breadcrumbs">Dashboard / Admin Dashboard</p></div>
      <div className="actions"><select aria-label="Dashboard academic year" value={year} onChange={e=>onYear(e.target.value)}><option value="">All academic years</option>{years.map(y=><option key={y}>{y}</option>)}</select>
        <select value={period} aria-label="Report period" onChange={e=>setPeriod(e.target.value)}><option value="all">All time</option><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option></select>
        <details className="erp-menu"><summary><DashboardIcon name="download" /> Export</summary><div><button onClick={exportCSV}>Export CSV</button><button onClick={()=>window.print()}>Print / PDF</button></div></details>
        <button onClick={refresh} aria-label="Refresh dashboard"><DashboardIcon name="refresh" /></button><details className="erp-menu"><summary className="primary"><DashboardIcon name="plus" /> Quick Add</summary><div>{[['students','New Student'],['teachers','New Teacher'],['staff','New Staff'],['exams','Create Exam'],['payments','Collect Fee'],['invoices','New Invoice']].map(([k,l])=><button key={k} onClick={()=>go(k,true)}>{l}</button>)}</div></details>
      </div></div>
    {error && <p className="error" role="alert">{error}</p>}
    {!data ? <p role="status">{error?'Dashboard data unavailable.':'Loading dashboard…'}</p> : <>
    <section className="panel erp-overview admin-overview"><div><div className="erp-greeting"><i><DashboardIcon name="cap"/></i><div><h2>Good {today.getHours()<12?'Morning':today.getHours()<18?'Afternoon':'Evening'}, Administrator</h2><small><b>{schoolName}</b> · {today.toLocaleDateString(undefined,{dateStyle:'medium'})}{year&&' · '+year}</small></div></div>
      <div className="actions"><button className="primary" onClick={()=>go('admissions',true)}><DashboardIcon name="plus"/> New Admission</button><button onClick={()=>go('payments',true)}><DashboardIcon name="clipboard"/> Collect Fees</button><button onClick={exportCSV}><DashboardIcon name="file"/> Report</button></div></div>
      <div className="erp-metrics">{metrics.map(([label,value,key,icon,change])=><button className={'admin-kpi admin-kpi-'+key} type="button" key={key}
        onClick={()=>go(key,false,['attendance','payments','admissions'].includes(key)?{date:todayKey}:undefined)}>
        <span className="admin-kpi-head"><span className="admin-kpi-icon"><DashboardIcon name={icon}/></span>
          {change && change.direction!=='minus'&&<span className={'admin-kpi-trend '+change.tone}
            title={change.title} aria-label={change.title+': '+(change.direction==='up'?'+':change.direction==='down'?'−':'')+change.text}>
            <DashboardIcon name={change.direction==='time'?'time':change.direction==='down'?'trendDown':'arrow'}/>{change.text}
          </span>}
        </span>
        <strong>{value}</strong><small>{label}</small>
      </button>)}</div>
    </section>
    <div className="erp-grid">
      <Spotlights teachers={data.teachers ?? []} students={students} scores={scores} groups={groups} go={go} />
      <Card section="Capacity" title="Class-Wise Distribution" footer={action('classes','View classes')}><strong className="big-number">{number(students.length)}</strong><p className="muted">Total students enrolled</p>
        {groups.map((row,i)=><Bar key={row._id} label={row.name+' · '+row.section} value={ratio(row.students.length,students.length)} meta={number(row.students.length)+' · '+ratio(row.students.length,students.length)+'%'} color={palette[i%5]}/>)}
        <Stats items={[[ 'Sections',classes.length],['Avg. class size',classes.length?Math.round(students.length/classes.length):0]]}/></Card>
      <Card section="Heat" title="Performance Risk Matrix" footer={action('results','View results')}><strong className="big-number">{scores.length}</strong><p className="muted">Students assessed</p>
        <div className="risk-stack">{[scores.filter(row=>row.score>=80).length,scores.filter(row=>row.score>=60&&row.score<80).length,scores.filter(row=>row.score<60).length].map((v,i)=><span key={i} style={{flexGrow:v,background:['#18b833','#efb500','#e94060'][i]}}/>)}</div><Scatter scores={scores}/>
        <Stats items={[[ 'On track',scores.filter(row=>row.score>=80).length],['Review',scores.filter(row=>row.score>=60&&row.score<80).length],['Support',scores.filter(row=>row.score<60).length]]}/></Card>
      <Card section="Intelligence" title="Student Attendance Heatmap" wide footer={action('attendance','View attendance')}>
        {days.length ? <div className="erp-heat-scroll"><table className="erp-heat"><thead><tr><th>Class</th>{days.map(d=><th key={d}>{new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric'})}</th>)}</tr></thead>
          <tbody>{groups.map(row=><tr key={row._id}><th>{row.name} · {row.section}</th>{days.map(d=>{const entries=attendance.filter(a=>a.date===d&&row.students.some(s=>s._id===a.studentId));const pct=ratio(entries.filter(valid).length,entries.length);return <td key={d}><button onClick={()=>go('attendance',false,{date:d,classId:row._id})} title={entries.length?pct+'% present':'No entries'} style={{background:entries.length?['#dce3fa','#adb9f0','#8394e7','#4059dc'][pct>=95?3:pct>=90?2:pct>=85?1:0]:'var(--line)'}}>{entries.length?pct+'%':'—'}</button></td>;})}</tr>)}</tbody></table></div> : <p className="muted">No attendance for this period.</p>}
        <div className="erp-legend">{['Below 85%','85–89%','90–94%','95% and above'].map((l,i)=><span key={l}><i style={{background:['#dce3fa','#adb9f0','#8394e7','#4059dc'][i]}}/>{l}</span>)}</div></Card>
      <Card section="Attendance" title="Attendance Breakdown"><div className="erp-summary"><Ring value={ratio(attendance.filter(valid).length,attendance.length)} color="#18b833"/><div><strong className="big-number">{number(attendance.filter(valid).length)}</strong> / {number(attendance.length)}<p className="muted">Present or late</p></div></div>
        <Stats items={['Present','Absent','On leave','Late'].map(status=>[status,attendance.filter(row=>row.status===status).length])}/>
        <div className="erp-subhead">By class</div>{groups.map((group,i)=>{const entries=attendance.filter(row=>group.students.some(student=>student._id===row.studentId));return <Bar key={group._id} label={group.name} value={ratio(entries.filter(valid).length,entries.length)} color={palette[(i+2)%3]}/>;})}</Card>
      <Card section="Engagement" title="Weekly Communication Trend" wide footer={action('delivery','Delivery logs')}><strong className="big-number">{number(week.reduce((n,d)=>n+sum(deliveries.filter(row=>row.date===d),'delivered'),0))}</strong><p className="muted">Delivered in the last 7 days</p>
        <Plot type="area" label="Weekly communication trend" labels={week.map(d=>d.slice(5))} series={channels.map(name=>({name,values:week.map(d=>sum(deliveries.filter(row=>row.channel===name&&row.date===d),'delivered'))}))}/></Card>
      <Card section="Reach" title="Parent Engagement" footer={action('accounts','View accounts')}><Ring value={ratio(activeParents,parents.length)} label="Parents who sent a message"/>
        {[['Highly active',parentCounts.filter(n=>n>=3).length],['Active',parentCounts.filter(n=>n>0&&n<3).length],['No messages',parentCounts.filter(n=>n===0).length]].map(([l,n],i)=><Bar key={l} label={l} value={ratio(n,parents.length)} color={palette[i]}/>)}</Card>
      <Card section="Activity" title="Activity Timeline" footer={action('activity','View all activity')}>
        {(data.activity??[]).slice(0,6).map(row=><div className="erp-list-row" key={row._id}><i><DashboardIcon name="bell" /></i><div><strong>{row.title}</strong><small>{new Date(row.createdAt).toLocaleString()}</small></div><span className="pill">{row.kind}</span></div>)}
        {!data.activity?.length&&<p className="muted">New record activity will appear here.</p>}</Card>
      <Card section="Inbox" title="Recent Parent Messages" footer={action('messages','View all messages')}>
        {inbox.filter(row=>sender(row)?.role==='parent').slice(0,3).map(row=><div className="erp-list-row" key={row._id}><i><DashboardIcon name="mail" /></i><div><strong>{sender(row).name}</strong><p className="erp-snippet">{row.body}</p><button onClick={()=>go('messages',false,{to:row.from})}>Reply</button></div></div>)}
        {!inbox.some(row=>sender(row)?.role==='parent')&&<p className="muted">No parent messages yet.</p>}</Card>
      <Card section="Delivery" title="Delivery Success" footer={action('delivery','Manage delivery logs')}><Ring value={ratio(delivered,delivered+failed)} label="Overall success rate" color="#18b833"/>
        {channels.map((name,i)=>{const rows=deliveries.filter(row=>row.channel===name);return <Bar key={name} label={name} value={ratio(sum(rows,'delivered'),sum(rows,'delivered')+sum(rows,'failed'))} color={palette[i]}/>;})}
        <Stats items={[[ 'Failed',number(failed)],['Pending',number(sum(deliveries,'pending'))],['Queued',number(sum(deliveries,'queued'))]]}/></Card>
      <Card section="Insights" title="Enrollment & Growth Trend" wide footer={action('students','View students')}><Stats items={[[ 'Total students',students.length],['New admissions',admissions.length]]}/>
        <Plot label="Enrollment and growth trend" labels={monthLabels} series={[{name:'Enrollments',values:monthCount(students,'joined')},{name:'Applications',values:monthCount(admissions,'date')}]}/></Card>
      <Card section="Demographics" title="Gender Distribution">{groups.map(group=><div className="erp-bar" key={group._id}><div><span>{group.name} · {group.section}</span><strong>{group.students.length}</strong></div><div className="risk-stack">{['Male','Female','Other','Unspecified'].map((g,i)=><span key={g} title={g+': '+group.students.filter(s=>(s.gender||'Unspecified')===g).length} style={{flexGrow:group.students.filter(s=>(s.gender||'Unspecified')===g).length,background:['#516ddd','#ec5b9d','#45b988','#a8adc0'][i]}}/>)}</div></div>)}
        <div className="erp-legend">{['Male','Female','Other','Unspecified'].map((g,i)=><span key={g}><i style={{background:['#516ddd','#ec5b9d','#45b988','#a8adc0'][i]}}/>{g}</span>)}</div></Card>
      <Card section="Resources" title="Books Issued Trend" wide footer={action('loans','Book loans')}><Stats items={[[ 'Loans',loans.filter(row=>row.status!=='Reserved').length],['Returned',loans.filter(row=>row.status==='Returned').length],['Overdue',loans.filter(row=>row.status==='Issued'&&row.due<todayKey).length]]}/>
        <Polar values={monthCount(loans.filter(row=>row.status!=='Reserved'),'date')} months={monthLabels}/></Card>
      <Card section="Inventory" title="Book Availability" footer={action('library','Library catalogue')}><Ring value={ratio(available,copies)} label={number(available)+' of '+number(copies)+' copies available'}/>
        <Stats items={[[ 'Issued',issued],['Reserved',reserved],['Low stock titles',books.filter(b=>b.copies-allLoans.filter(l=>l.bookId===b._id&&l.status!=='Returned').length<=2).length]]}/>
        {categories.map(([name,total],i)=>{const ids=new Set(books.filter(row=>(row.category||'Other')===name).map(row=>row._id));return <Bar key={name} label={name} value={ratio(Math.max(0,total-allLoans.filter(row=>ids.has(row.bookId)&&row.status!=='Returned').length),total)} color={palette[i%5]}/>;})}</Card>
      <Card section="Trending" title="Most Borrowed Books" wide footer={action('loans','Full report')}><div>{books.map(book=>({...book,issues:loans.filter(row=>row.bookId===book._id&&row.status!=='Reserved').length})).filter(book=>book.issues).sort((a,b)=>b.issues-a.issues).slice(0,5).map((book,i)=><div className="erp-list-row" key={book._id}><span className="erp-rank">{i+1}</span><i className="erp-book-icon" style={{"--book":palette[i%5]}}><DashboardIcon name="book" /></i><div><strong>{book.name}</strong><small>{book.category||'Other'} · {book.author}</small></div><div className="erp-issue-count"><strong>{book.issues}</strong> issues<span className="erp-track"><i style={{width:Math.min(book.issues*10,100)+"%",background:palette[i%5]}}/></span></div></div>)}</div></Card>
      <Card section="Categories" title="Popular Categories"><div className="erp-bubbles">{categories.slice(0,5).map(([name,total],i)=><span key={name} style={{background:palette[i],width:56-i*5}} title={name}><strong>{ratio(total,copies)}%</strong><small>{name}</small></span>)}</div>
        {categories.map(([name,total],i)=><Bar key={name} label={name} value={ratio(total,copies)} meta={number(total)+' copies'} color={palette[i%5]}/>)}
        <Stats items={[[ 'Active readers',new Set(loans.filter(l=>l.status!=='Reserved').map(l=>l.studentId)).size],['Total borrowed',loans.filter(l=>l.status!=='Reserved').length]]}/></Card>
      <Card section="Operations" title="Fuel Consumption Trend" wide footer={action('fleet','Fleet logs')}><Stats items={[[ 'Fuel',number(sum(fleet,'fuel'))+' L'],['Avg. per logged route',number(Math.round(sum(fleet,'fuel')/Math.max(1,new Set(fleet.map(r=>r.routeId)).size)))+' L'],['Cost',number(sum(fleet,'cost'))]]}/>
        <Plot type="bar" label="Fuel consumption trend" labels={fleetDays.map(d=>d.slice(5))} series={[{name:'Fuel (L)',values:fleetDays.map(d=>sum(fleet.filter(row=>row.date===d),'fuel'))},{name:'Efficiency (km/L)',values:fleetDays.map(d=>{const rows=fleet.filter(row=>row.date===d);return sum(rows,'fuel')?Math.round(sum(rows,'distance')/sum(rows,'fuel')*10)/10:0;})}]}/></Card>
      <Card section="Fleet" title="Fleet Utilization" footer={action('transport','View routes')}><Stats items={[[ 'Active routes',recentVehicles.filter(row=>row.status==='Active').length],['Trips',number(sum(fleet,'trips'))],['Distance',number(sum(fleet,'distance'))+' km']]}/>
        <div className="erp-ring-row"><Ring value={ratio(recentVehicles.filter(r=>r.status==='Active').length,recentVehicles.length)} label="Active" color="#18b833"/><Ring value={ratio(sum(fleet,'riders'),sum(fleet,'seats'))} label="Occupancy"/><Ring value={ratio(sum(fleet,'onTime'),sum(fleet,'trips'))} label="On-time" color={palette[1]}/></div>
        {['Active','Idle','Service','Offline'].map((status,i)=><Bar key={status} label={status} value={ratio(recentVehicles.filter(r=>r.status===status).length,recentVehicles.length)} color={palette[i]}/>)}</Card>
      <Card section="Operations" title="Route Status" footer={action('fleet','Open fleet logs')}>{recentVehicles.length ? recentVehicles.map((row,i)=><article className="erp-route" key={row.routeId} style={{'--route':palette[(i+2)%5]}}>
        <div className="erp-route-heading"><strong>{routes.get(row.routeId)?.name ?? 'Route'}</strong><span className="pill">{row.status}</span></div>
        <p className="muted">{routes.get(row.routeId)?.driver ?? 'Driver unassigned'} · {row.date}</p>
        <Stats items={[[ 'Onboard',row.riders],['Trips',row.trips],['Distance',number(row.distance)+' km']]}/>
      </article>) : <p className="muted">No route logs in this period.</p>}</Card>
      <Card section="Schedule" title="Maintenance Timeline" footer={action('fleet','Fleet logs')}>{fleet.filter(row=>row.status==='Service').length ?
        fleet.filter(row=>row.status==='Service').slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(row=><div className="erp-list-row" key={row._id}><i><DashboardIcon name="settings" /></i><div><strong>{routes.get(row.routeId)?.vehicle ?? 'Vehicle'}</strong><small>Service log</small></div><strong>{row.date}</strong></div>)
        : <p className="muted">No maintenance logs in this period.</p>}</Card>
      <Card section="Tracking" title="Fleet Route Directory" footer={action('transport','Manage routes')}>
        {[...routes.values()].map(route=><div className="erp-list-row" key={route._id}><i><DashboardIcon name="map" /></i><div><strong>{route.name}</strong><small>{route.stops}</small></div><span className="pill">{route.vehicle}</span></div>)}
        {!routes.size && <p className="muted">No routes added.</p>}
      </Card>
    </div></>}
  </div>;
}
