import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import './teacher-dashboard.css';
import './student-dashboard.css';
import { DashboardIcon, HeroAvatar, HeroClock, HeroMetric, HeroTag } from './dashboard-hero.jsx';

const tones=['blue','green','gold','sky','purple','cyan','red','pink'];
const keys=['students','classes','subjects','teachers','timetable','sessions','homework','submissions','exams','results','attendance','fees','payments','loans','library','calendar','announcements','achievements','goals','study','studentTransport','transport','leaves','libraryRequests'];
const iso=date=>[date.getFullYear(),date.getMonth()+1,date.getDate()].map(v=>String(v).padStart(2,'0')).join('-');
const shifted=(date,days)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+days);
const short=value=>value?new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
const percent=(n,d)=>d?Math.round(100*n/d):null;
const label=v=>v==null?'—':v+'%';
const money=v=>Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
const total=(items,key)=>items.reduce((n,r)=>n+Number(r[key]??0),0);
const attended=row=>['Present','Late'].includes(row.status);
const grade=v=>v>=90?'A+':v>=80?'A':v>=70?'B':v>=60?'C':v>=50?'D':'F';
const weekday=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const duration=row=>{const min=time=>Number(time.slice(0,2))*60+Number(time.slice(3));return Math.max(0,min(row.end)-min(row.start));};
const csv=(name,columns,rows)=>{
  const escape=value=>{const s=String(value??'');return '"'+(/^[\t\r\n]|^\s*[=+@-]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';};
  const url=URL.createObjectURL(new Blob([[columns,...rows].map(row=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv'}));
  const link=document.createElement('a');link.href=url;link.download=name+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

function Panel({title,icon,action,children,extra=''}) {
  return <section className={'panel td-panel sd-panel '+extra}><div className="td-panel-heading"><h2><span aria-hidden="true">{icon}</span>{title}</h2>{action}</div>{children}</section>;
}
function Row({title,detail,icon='▤',tone='blue',action}) {
  return <article className="td-row sd-row"><span className={'td-icon td-'+tone} aria-hidden="true">{icon}</span><div><strong>{title}</strong>{detail&&<small>{detail}</small>}</div>{action}</article>;
}
function Metrics({items,compact=false}) {
  return <div className={'td-metrics '+(compact?'td-compact':'')}>{items.map(([name,value,icon,action],i)=>{
    const children=<><span className={'td-icon td-'+tones[i%tones.length]} aria-hidden="true">{icon}</span><div><strong>{value}</strong><small>{name}</small></div></>;
    return action?<button key={name} className="td-metric" onClick={action}>{children}</button>:<div key={name} className="td-metric">{children}</div>;
  })}</div>;
}
function Meter({name,value,text,color='#4059e4'}) {
  return <div className="sd-meter"><div><span>{name}</span><strong>{text??label(value)}</strong></div><div className="td-meter"><i style={{width:Math.max(0,Math.min(100,value??0))+'%',background:color}}/></div></div>;
}
function Ring({value,text,caption,color='#4059e4'}) {
  return <div className="sd-ring" style={{'--sd-ring-color':color,'--sd-ring-value':Math.max(0,Math.min(100,value??0))+'%'}}><div><strong>{text??label(value)}</strong><small>{caption}</small></div></div>;
}
const empty=text=><p className="muted td-empty">{text}</p>;

function StudentUpdates({events,attendance,submissions,marks,payments,future,pending,alerts,today,weekStart,todayRecord,due,named,openCalendar,openNotifications,openFees,openExams,openAssignments,openAttendance}) {
  const timeline = [
    ...submissions.map(row=>({id:row._id,title:row.status==='Graded'?'Assignment graded':'Assignment submitted',date:row.date,detail:named('homework',row.homeworkId)?.name,icon:'clipboard',tone:'green'})),
    ...attendance.map(row=>({id:row._id,title:'Attendance marked',date:row.date,detail:row.status,icon:'calendar',tone:'sky'})),
    ...marks.map(row=>({id:row._id,title:'Exam result published',date:row.exam.date,detail:row.exam.name+' · Grade '+grade(row.score),icon:'medal',tone:'blue'})),
    ...payments.map(row=>({id:row._id,title:'Fee payment',date:row.date,detail:money(row.amount)+' · '+(named('fees',row.feeId)?.name??'Payment'),icon:'wallet',tone:'gold'})),
  ].filter(row=>row.date>=weekStart&&row.date<=today).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  const notifications = [
    future[0]&&['Exam Alert',future[0].name+' · '+short(future[0].date),'cap',openExams],
    pending[0]&&['Assignment Reminder',pending[0].name+' · '+short(pending[0].due),'file',openAssignments],
    due>0&&['Fee Due Alert',money(due)+' outstanding','wallet',openFees,'urgent'],
    todayRecord&&['Attendance Alert','Marked '+todayRecord.status.toLowerCase()+' today','calendar',openAttendance],
    ...alerts.slice(0,2).map(row=>[row.name,row.body,'megaphone',openNotifications]),
  ].filter(Boolean);
  return <div className="td-grid td-three sd-updates">
    <Panel title="Calendar" icon={<DashboardIcon name="calendar"/>} action={<button className="sd-update-link" onClick={openCalendar}>Open ›</button>}>
      <ol className="sd-calendar-list">{events.slice(0,6).map(row=>{
        const date=new Date(row.date+'T12:00:00');
        return <li key={row._id}><time className="sd-date-tile" dateTime={row.date}><strong>{date.getDate()}</strong><small>{date.toLocaleString(undefined,{month:'short'})}</small></time>
          <div><strong>{row.name}</strong><small>{[row.start,row.notes].filter(Boolean).join(' · ')}</small></div>
          {row.date===today&&<span className="td-badge td-gold">Today</span>}
        </li>;
      })}</ol>{!events.length&&empty('No upcoming events.')}
    </Panel>
    <Panel title="Activity Timeline" icon={<DashboardIcon name="arrow"/>} action={<span className="td-badge td-sky">Last 7 Days</span>}>
      <ol className="sd-timeline">{timeline.map(row=><li key={row.id}>
        <span className={'td-icon td-'+row.tone}><DashboardIcon name={row.icon}/></span>
        <div><strong>{row.title}</strong><small>{row.detail}</small></div>
        <time dateTime={row.date}>{row.date===today?'Today':short(row.date)}</time>
      </li>)}</ol>{!timeline.length&&empty('No activity recorded in the last 7 days.')}
    </Panel>
    <Panel title="Notifications" icon={<DashboardIcon name="bell"/>} action={<button className="sd-update-link" onClick={openNotifications}>View all</button>}>
      <div className="sd-notice-list">{notifications.map(([title,detail,icon,run,kind],i)=><button className={kind??''} key={title+i} onClick={run}>
        <span className={'td-icon '+(kind?'td-red':'td-sky')}><DashboardIcon name={icon}/></span><span><strong>{title}</strong><small>{detail}</small></span>
      </button>)}</div>{!notifications.length&&empty('No notifications.')}
    </Panel>
  </div>;
}

export default function StudentDashboard({user,year,go,openNotifications}) {
  const [data,setData]=useState(null), [error,setError]=useState(''), [notice,setNotice]=useState('');
  const [revision,reload]=useState(0), [selected,setSelected]=useState(''), [tab,setTab]=useState('Pending');
  const [dialog,setDialog]=useState(null), [busy,setBusy]=useState(false), [now,setNow]=useState(()=>new Date());
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    let active=true;
    const routes=[...keys.map(key=>[key,'records/'+key]),...['messages','contacts'].map(key=>[key,'workspace/'+key]), ...(user.role==='student'?[['teacherContacts','workspace/teacher-contacts']]:[])];
    Promise.all(routes.map(async ([key,path])=>[key,await api(path)])).then(rows=>{if(active){setData(Object.fromEntries(rows));setError('');}},e=>{if(active)setError(e.message);});
    return()=>{active=false;};
  },[revision,user.role]);
  async function upload(event) {
    event.preventDefault();
    if(busy)return;
    const file=new FormData(event.currentTarget).get('file');
    if(!file?.size||file.size>2097152){setError('Choose a PDF up to 2 MB.');return;}
    setBusy(true);setError('');setNotice('');
    try {
      const bytes=new Uint8Array(await file.arrayBuffer());
      let binary='';
      for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      await api('workspace/assignment-file','POST',{homeworkId:dialog.task._id,filename:file.name,content:btoa(binary)});
      setDialog(null);setNotice('Assignment submitted.');reload(value=>value+1);
    } catch(e){setError(e.message);} finally{setBusy(false);}
  }
  const primary=user.role==='student';
  const d=data??{}, today=iso(now), minNow=now.toTimeString().slice(0,5);
  const roster=(d.students??[]).filter(row=>!year||row.year===year);
  const student=roster.find(row=>row._id===selected)??roster[0];
  const id=student?._id;
  const own=key=>(d[key]??[]).filter(row=>row.studentId===id);
  const classRows=key=>(d[key]??[]).filter(row=>row.classId===student?.classId);
  const schoolClass=(d.classes??[]).find(row=>row._id===student?.classId);
  const className=schoolClass?[schoolClass.name,schoolClass.section].filter(Boolean).join(' · '):'';
  const named=(key,id)=>d[key]?.find(row=>row._id===id);
  const schedule=classRows('timetable').filter(row=>row.day===weekday[now.getDay()]).sort((a,b)=>a.start.localeCompare(b.start));
  const session=period=>d.sessions?.find(row=>row.periodId===period._id&&row.date===today);
  const completed=schedule.filter(row=>session(row)?.status==='Done').length;
  const live=schedule.filter(row=>session(row)?.status==='Live').length;
  const upcoming=schedule.filter(row=>!session(row)&&row.start>=minNow);
  const attendance=own('attendance');
  const attendanceRate=rows=>percent(rows.filter(attended).length,rows.length);
  const range=(rows,days)=>rows.filter(row=>row.date>=iso(shifted(now,1-days))&&row.date<=today);
  const rate=attendanceRate(attendance), todayRecord=attendance.find(row=>row.date===today);
  const tasks=classRows('homework').sort((a,b)=>a.due.localeCompare(b.due));
  const submissions=own('submissions');
  const submission=task=>submissions.find(row=>row.homeworkId===task._id);
  const pending=tasks.filter(row=>!submission(row));
  const completion=percent(tasks.length-pending.length,tasks.length);
  const exams=classRows('exams').sort((a,b)=>a.date.localeCompare(b.date));
  const future=exams.filter(row=>row.date>=today);
  const marks=own('results').flatMap(row=>{
    const exam=exams.find(item=>item._id===row.examId);
    return exam?.maximum?[{...row,exam,score:percent(row.marks,exam.maximum)}]:[];
  }).sort((a,b)=>b.exam.date.localeCompare(a.exam.date));
  const average=rows=>rows.length?Math.round(total(rows,'score')/rows.length):null;
  const averageMarks=average(marks);
  const subjectScores=[...new Set(marks.map(row=>row.exam.subjectId))].map(id=>({
    id,name:named('subjects',id)?.name??'Subject',score:average(marks.filter(row=>row.exam.subjectId===id)),
  })).sort((a,b)=>b.score-a.score);
  const months=[...new Set(marks.map(row=>row.exam.date.slice(0,7)))].sort().slice(-6).map(month=>({
    name:new Date(month+'-01T12:00:00').toLocaleDateString(undefined,{month:'short'}),score:average(marks.filter(row=>row.exam.date.startsWith(month))),
  }));
  const fees=own('fees').sort((a,b)=>a.due.localeCompare(b.due));
  const paid=fee=>total((d.payments??[]).filter(row=>row.feeId===fee._id),'amount');
  const balance=fee=>Math.max(0,fee.amount-paid(fee));
  const due=fees.reduce((n,row)=>n+balance(row),0);
  const collected=fees.reduce((n,row)=>n+Math.min(row.amount,paid(row)),0);
  const overdue=fees.filter(row=>row.due<today).reduce((n,row)=>n+balance(row),0);
  const loans=own('loans'), issued=loans.filter(row=>row.status==='Issued'), returned=loans.filter(row=>row.status==='Returned');
  const teacherIds=[...new Set(classRows('timetable').map(row=>row.teacherId))];
  const teachers=(d.teachers??[]).filter(row=>teacherIds.includes(row._id));
  const awards=primary?d.achievements??[]:[];
  const history=primary?d.study??[]:[];
  const hours=Math.round(total(range(history,7),'minutes')/6)/10;
  const goals=primary?d.goals??[]:[];
  const targetMetric={Attendance:rate,Marks:averageMarks,'Study hours':hours,'Assignment completion':completion,'Books read':returned.length};
  const contacts=d.contacts??[];
  const messages=primary?(d.messages??[]).filter(row=>row.to===user.id):[];
  const alerts=(d.announcements??[]).filter(row=>row.date<=today);
  const assignments=tasks.filter(task=>tab==='Pending'?!submission(task)&&task.due>=today:tab==='Submitted'?submission(task)?.status==='Submitted':tab==='Graded'?submission(task)?.status==='Graded':tab==='Overdue'?!submission(task)&&task.due<today:task.due>=today);
  const transport=own('studentTransport')[0], route=named('transport',transport?.routeId);
  const schoolEvents=[...(primary?d.calendar??[]:[]),...future.map(row=>({...row,notes:'Exam'})),...pending.map(row=>({...row,date:row.due,notes:'Assignment deadline'}))].filter(row=>row.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const action=(key,add=false,target)=>()=>go(key,add,target);
  const scroll=id=>()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
  const uploadFor=task=>()=>{setError('');setDialog({kind:'upload',task});};
  const feeDetails=()=>setDialog({kind:'fees'});
  const report=()=>csv('academic-report',['Exam','Date','Marks','Maximum','Grade'],marks.map(row=>[row.exam.name,row.exam.date,row.marks,row.exam.maximum,grade(row.score)]));
  const wins=subjectScores[0], weakest=subjectScores.at(-1);
  const readTarget=goals.find(row=>row.metric==='Books read')?.target??12;
  const dateCount=days=>[...Array(days)].map((_,i)=>iso(shifted(now,i-days+1)));
  if(!data)return error?<><p className="error">{error}</p><button onClick={()=>reload(v=>v+1)}>Retry</button></>:empty('Loading student dashboard…');

  return <div className="td-root sd-root">
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="td-confirm" role="status">{notice}</p>}
    <section className="panel td-hero dashboard-person-hero student-person-hero">
      <div className="td-hero-head"><div className="td-person">
        <HeroAvatar kind="student" name={student?.name??user.name} online={todayRecord&&attended(todayRecord)} demo={/^DEMO-[678]0[1-4]$/.test(student?.admission??'')}/>
        <div><small className="td-greeting">Welcome back 👋</small><h2>{student?.name??user.name}</h2>
          <div className="td-person-tags">
            {[[student?.admission,'badge'],[className,'cap'],[student?.rollNo&&'Roll '+student.rollNo,'grid'],[student?.house,'flag'],[student?.year,'calendar']].filter(([name])=>name).map(([name,icon])=><HeroTag key={icon} icon={icon}>{name}</HeroTag>)}
          </div>
          <div className="td-person-tags dashboard-extra-tags">
            {student?.scholarship&&<HeroTag tone="gold" icon="medal">{student.scholarship}</HeroTag>}
            {transport&&<HeroTag tone="sky" icon="bus">Transport · {route?.name??'Assigned'}</HeroTag>}
            {student?.hostel&&<HeroTag tone="purple" icon="house">Hostel · {student.hostel}</HeroTag>}
          </div>
        </div></div><HeroClock now={now} status={todayRecord?.status}/></div>
      {!primary&&<label className="dashboard-preview-picker">Preview student<select value={id??''} onChange={event=>setSelected(event.target.value)}>{roster.map(row=><option key={row._id} value={row._id}>{row.name}</option>)}</select></label>}
      {!student&&empty('No linked student record for this academic year.')}
      <div className="td-metrics td-compact dashboard-hero-metrics">
        <HeroMetric name="Attendance" value={label(rate)} icon="calendar" tone="green"/>
        <HeroMetric name="Average Marks" value={label(averageMarks)} icon="medal" tone="blue"/>
        <HeroMetric name="Learning Progress" value={label(completion)} icon="sparkle" tone="purple"/>
        <HeroMetric name="Profile Completion" progress={student?percent(['name','admission','classId','guardian','phone','year'].filter(key=>student[key]).length,6):null} value="—" icon="badge" tone="cyan" run={action('students',false,student?{id,name:student.name}:undefined)}/>
        <HeroMetric name="Subjects Passed" value={subjectScores.filter(row=>row.score>=50).length+' / '+subjectScores.length} icon="medal" tone="gold"/>
        <HeroMetric name="Library Books" value={issued.length} icon="book" tone="sky"/>
      </div>
      <div className="td-quick dashboard-quick"><small>ϟ Quick actions:</small>{[
        ['View Timetable','grid',action('timetable')],['Assignments','file',scroll('sd-assignments')],['Homework','book',action('homework')],
        ['Exam Results','badge',action('results')],['Library','book',scroll('sd-library')],['Fee Details','wallet',feeDetails],
        ['Message Teacher','chat',action('messages')],['Request Leave','calendar',()=>setDialog({kind:'leave'})],
      ].filter(([name])=>primary||name!=='Request Leave').map(([name,icon,run],i)=><button className={i===0?'primary':''} key={name} onClick={run}><DashboardIcon name={icon}/>{name}</button>)}</div>
    </section>
    <Metrics items={[[ 'Average Marks',label(averageMarks),'☆',action('results')],['Attendance',label(rate),'✓',action('attendance')],['Assignments Pending',pending.length,'▧',scroll('sd-assignments')],
      ['Homework Due',pending.filter(row=>row.due>=today).length,'▤',action('homework')],['Upcoming Exams',future.length,'◇',action('exams')],
      ['Library Books',issued.length,'▤',scroll('sd-library')],['Fee Due',money(due),'◈',feeDetails],['Achievements',awards.length,'☆',scroll('sd-awards')],['Subjects Passed',subjectScores.filter(row=>row.score>=50).length,'▥',action('results')],['Learning Progress',label(completion),'↗',scroll('sd-learning')]]}/>
    <div className="td-grid td-wide">
      <Panel title="Today's Schedule" icon="▦" action={<button onClick={action('timetable')}>Full Timetable</button>}>
        <Metrics compact items={[[ 'Completed',completed,'✓'],['In Progress',live,'▶'],['Upcoming',upcoming.length,'◷'],['Class Time',total(schedule.map(row=>({minutes:duration(row)})),'minutes')+' min','▦']]}/>
        <div className="sd-periods">{schedule.map((row,i)=><article className={'td-period td-'+(session(row)?.status==='Live'?'red':session(row)?.status==='Done'?'green':tones[(i+2)%tones.length])} key={row._id}><div><strong>{row.start}</strong><small>{duration(row)} min</small></div><div><strong>{named('subjects',row.subjectId)?.name??row.name}</strong><small>{[named('teachers',row.teacherId)?.name,row.room].filter(Boolean).join(' · ')}</small></div><div className="actions"><span className="td-badge">{session(row)?.status??(row===upcoming[0]?'Next':row.start)}</span><button onClick={()=>setDialog({kind:'class',row})}>Details</button></div></article>)}</div>
        {!schedule.length&&empty('No classes scheduled today.')}
      </Panel>
      <Panel title="Learning Insights" icon="✧" extra="td-insights sd-learning-insights" action={<span className="td-badge td-purple">Classroom data</span>}>
        <div className="td-insight-summary"><Ring value={averageMarks} caption="Avg. marks" color="#5708ec"/><div><strong>{averageMarks==null?'Learning summary':averageMarks>=80?'Strong performance':'Room to improve'}</strong><small>Based on published exam results</small></div></div>
        <div className="sd-insight-list"><Row title="Attendance" detail={rate==null?'No attendance recorded':label(rate)+(rate<90?' · below 90%':' · on track')} icon="✓" tone="green"/>
        <Row title="Strongest subject" detail={wins?wins.name+' · '+label(wins.score):'Awaiting results'} icon="☆"/>
        <Row title="Subject to review" detail={weakest?weakest.name+' · '+label(weakest.score):'Awaiting results'} tone="red" icon="◎"/>
        <Row title="Study suggestion" detail={weakest?'Revise '+weakest.name+' and review your latest results.':'Log your study time to monitor progress.'} tone="gold" icon="✧"/>
        <Row title="Upcoming assessments" detail={future[0]?future[0].name+' · '+short(future[0].date):'No exams scheduled'} tone="cyan" icon="▦"/></div>
      </Panel>
    </div>
    <Panel title="Academic Performance" icon="▥" action={<button onClick={report} disabled={!marks.length}>Full Report</button>}>
      <div className="sd-academic"><div className="sd-academic-summary"><Ring value={averageMarks} caption="Average Marks"/><Metrics compact items={[[ 'Subjects',subjectScores.length,'▤'],['Passed',subjectScores.filter(row=>row.score>=50).length,'✓']]}/>
      <h3>Grade Spread</h3>{['A+','A','B','C','D','F'].map(item=><span className="td-badge td-blue sd-grade" key={item}>{item} · {subjectScores.filter(row=>grade(row.score)===item).length}</span>)}</div>
      <div><h3>Subject Performance</h3>{subjectScores.map((row,i)=><div className={'sd-subject td-'+tones[i%tones.length]} key={row.id}><Meter name={row.name} value={row.score} color="var(--td-tone)"/><span className="td-badge">{grade(row.score)}</span></div>)}
        {!subjectScores.length&&empty('No results published yet.')}{weakest&&<p className="sd-study-tip">✧ Review <b>{weakest.name}</b>. Current average {label(weakest.score)}.</p>}</div>
      <div><h3>Monthly Progress</h3>{months.length?<><div className="sd-columns" aria-label="Average marks by month">{months.map(row=><div key={row.name}><strong>{row.score}</strong><span><i style={{height:row.score+'%'}}/></span><small>{row.name}</small></div>)}</div>
        <Row title="Best month" detail={months.reduce((a,b)=>a.score>b.score?a:b).name} icon="↗" tone="green"/></>:empty('Progress appears after results are published.')}</div></div>
    </Panel>
    <div className="td-grid td-wide" id="sd-assignments">
      <Panel title="Assignments & Homework" icon="▧" action={primary&&<button className="primary" disabled={!pending.length} onClick={()=>setDialog({kind:'selectUpload'})}>↑ Upload Assignment</button>}>
        <div className="td-tabs">{['Pending','Submitted','Overdue','Graded','Deadlines'].map(key=><button key={key} aria-pressed={tab===key} onClick={()=>setTab(key)}>{key}{key==='Pending'?' '+pending.filter(row=>row.due>=today).length:''}</button>)}</div>
        {assignments.map(row=><Row key={row._id} title={row.name} detail={[named('subjects',row.subjectId)?.name,'Due '+short(row.due)].filter(Boolean).join(' · ')} tone="sky" action={primary&&submission(row)?.status!=='Graded'?<button onClick={uploadFor(row)}>Upload</button>:<small>{submission(row)?.status??'Pending'}</small>}/>)}
        {!assignments.length&&empty('No assignments in this view.')}
      </Panel>
      <Panel title="Exam Center" icon="▥" action={<button onClick={action('results')}>Results</button>}>
        {future[0]&&<div className="sd-next"><Row title={future[0].name} detail={'Next exam · '+short(future[0].date)} icon="◷"/></div>}
        <h3>Upcoming Exams</h3>{future.slice(0,4).map(row=><Row key={row._id} title={row.name} detail={short(row.date)} tone="gold"/>)}
        {!future.length&&empty('No upcoming exams.')}
        <h3>Latest Results</h3>{marks.slice(0,3).map(row=><Row key={row._id} title={row.exam.name} detail={row.marks+' / '+row.exam.maximum+' · Grade '+grade(row.score)} icon="☆" action={<button aria-label={'Download '+row.exam.name+' result'} onClick={()=>csv('exam-result',['Exam','Marks','Maximum'],[[row.exam.name,row.marks,row.exam.maximum]])}>↓</button>}/>)}
        <button className="td-full" onClick={action('exams')}>Full Exam Schedule</button>
      </Panel>
    </div>
    <div className="td-grid td-two">
      <Panel title="Attendance Center" icon="✓" action={<button onClick={action('attendance')}>View Records</button>}>
        <Metrics compact items={[[ 'Today',label(attendanceRate(range(attendance,1))),'✓'],['This Week',label(attendanceRate(range(attendance,7))),'▦'],['This Month',label(attendanceRate(attendance.filter(row=>row.date.startsWith(today.slice(0,7))&&row.date<=today))),'▦']]}/>
        <h3>30-Day Heatmap</h3><div className="sd-heat">{dateCount(30).map(date=>{const row=attendance.find(item=>item.date===date);return <span key={date} className={row?(attended(row)?'present':'absent'):''} title={date+' · '+(row?.status??'No record')} aria-label={date+' '+(row?.status??'No record')}/>;})}</div>
        <Row title={range(attendance,30).filter(row=>row.status==='Late').length+' Late'} detail="Arrivals in the last 30 days" icon="◷"/>
        <Row title={own('leaves').filter(row=>row.status==='Approved').length+' Approved Leaves'} detail="Recorded leave requests" icon="▦"/>
      </Panel>
      <Panel title="Fee Summary" icon="◈" action={<button className="primary" onClick={feeDetails}>View Balance</button>}>
        <div className="sd-fee-top"><Ring value={percent(collected,total(fees,'amount'))} caption="Paid" color="#18b833"/><dl>{[['Total Fees',total(fees,'amount')],['Paid',collected],['Pending',due-overdue],['Overdue',overdue]].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{money(value)}</dd></div>)}</dl></div>
        {fees.find(row=>balance(row)>0)&&<Row title={'Next Installment · '+money(balance(fees.find(row=>balance(row)>0)))} detail={fees.find(row=>balance(row)>0).name} icon="▦" action={<button onClick={feeDetails}>Details</button>}/>}
        <h3>Payment History</h3>{(d.payments??[]).filter(row=>fees.some(fee=>fee._id===row.feeId)).slice(0,4).map(row=><Row key={row._id} title={named('fees',row.feeId)?.name??'Payment'} detail={money(row.amount)+' · '+short(row.date)} icon="✓" action={<button aria-label="Download payment receipt" onClick={()=>csv('payment-receipt',['Fee','Amount','Date'],[[named('fees',row.feeId)?.name,row.amount,row.date]])}>↓</button>}/>)}
      </Panel>
    </div>
    <div className="td-grid td-two" id="sd-learning">
      <Panel title="Learning Progress" icon="↗" action={primary&&<button onClick={action('study',true,{defaults:{date:today}})}>Log Study</button>}>
        <Meter name="Assignment Completion" value={completion}/><Meter name="Reading Progress" value={percent(returned.length,readTarget)} text={returned.length+' / '+readTarget+' books'} color="#00a8bb"/>
        <Meter name="Weekly Study Hours" value={percent(hours,goals.find(row=>row.metric==='Study hours')?.target??15)} text={hours+'h'} color="#efa900"/>
        <Meter name="Average Marks" value={averageMarks} color="#5708ec"/>
        <h3>Study Activity (last 14 days)</h3><div className="sd-heat">{dateCount(14).map(date=><span key={date} className={history.some(row=>row.date===date&&row.minutes>0)?'present':''} title={date}/>)}</div>
        <Metrics compact items={[[ 'This Week',hours+'h','◷'],['Total Study',Math.round(total(history,'minutes')/6)/10+'h','☆'],['Sessions',history.length,'▦']]}/>
      </Panel>
      <Panel title="Goals & Targets" icon="◎" action={primary&&<button onClick={action('goals',true)}>＋ Set Goal</button>}>
        <div className="sd-goals">{[['Attendance',rate],['Academic',averageMarks],['Assignments',completion],['Reading',percent(returned.length,readTarget)]].map(([name,value],i)=><article key={name}><Ring value={value} color={['#18b833','#4059e4','#1464cc','#00a8bb'][i]}/><strong>{name}</strong></article>)}</div>
        <h3>Active Targets</h3>{goals.map(row=><Row key={row._id} title={row.name} detail={row.metric+' · target '+row.target} icon="◎" action={<span className={'td-badge td-'+((targetMetric[row.metric]??-1)>=row.target?'green':'gold')}>{(targetMetric[row.metric]??-1)>=row.target?'Reached':'In progress'}</span>}/>)}
        {!goals.length&&empty('No saved goals yet.')}
      </Panel>
    </div>
    <div className="td-grid td-wide" id="sd-awards">
      <Panel title="Achievements" icon="☆" action={primary&&<button onClick={action('achievements')}>View All</button>}>
        <div className="sd-awards">{awards.slice(0,6).map((row,i)=><article key={row._id}><span className={'td-icon td-'+tones[(i+2)%tones.length]} aria-hidden="true">☆</span><strong>{row.name}</strong><small>{row.category}</small></article>)}</div>
        {awards.length?<><h3>Recent Achievement Timeline</h3>{awards.slice(0,5).map(row=><Row key={row._id} title={row.name} detail={row.category+' · '+short(row.date)} icon="☆" tone="gold"/>)}</>:empty('No achievements recorded.')}
      </Panel>
      <Panel title="My Teachers" icon="♙">{teachers.map((row,i)=><Row key={row._id} title={row.name} detail={row.department} icon={row.name[0]} tone={tones[i%tones.length]} action={<button aria-label={'Message '+row.name} onClick={action('messages',false,{to:d.teacherContacts?.find(contact=>contact.teacherId===row._id)?.userId})}>✉</button>}/>)}
        {!teachers.length&&empty('Teachers appear after the class timetable is assigned.')}</Panel>
    </div>
    <div className="td-grid td-three">
      <Panel title="Communication" icon="✉" action={<button onClick={action('messages')}>Inbox {messages.filter(row=>!row.read).length||''}</button>}>
        {messages.slice(0,5).map(row=><Row key={row._id} title={contacts.find(person=>person._id===row.from)?.name??'School message'} detail={row.body} icon="✉"/>)}
        {alerts.slice(0,3).map(row=><Row key={row._id} title={row.name} detail={row.body} icon="◈" tone="cyan"/>)}
        {!messages.length&&!alerts.length&&empty('No messages or announcements yet.')}<button className="primary td-full" onClick={action('messages')}>New Message</button>
      </Panel>
      <div id="sd-library"><Panel title="Library" icon="▤" action={<button onClick={action('library')}>View</button>}>
        <Metrics compact items={[[ 'Issued',issued.length,'▤'],['Due Soon',issued.filter(row=>row.due>=today&&row.due<=iso(shifted(now,7))).length,'◷'],['Overdue',issued.filter(row=>row.due<today).length,'!']]}/>
        <div className="sd-periods">{loans.slice(0,5).map(row=><Row key={row._id} title={named('library',row.bookId)?.name??'Book loan'} detail={row.status+' · '+short(row.due)} action={primary&&row.status==='Issued'&&<button onClick={action('libraryRequests',true,{defaults:{name:named('library',row.bookId)?.name??'Book',requestType:'Renew',date:today}})}>Renew Request</button>}/>)}</div>
        <Meter name="Reading Challenge" value={percent(returned.length,readTarget)} text={returned.length+' / '+readTarget}/>
        {primary&&<button className="td-full" onClick={action('libraryRequests',true,{defaults:{requestType:'Reserve',date:today}})}>Request Reservation</button>}
      </Panel></div>
      <Panel title="Transport" icon="▦" action={transport&&<span className="td-badge td-blue">Assigned</span>}>
        {transport?<><Metrics compact items={[[ 'Bus',route?.vehicle??'—','▦'],['Route',route?.name??'—','↗'],['Pickup',transport.pickup,'◷'],['Drop-off',transport.drop,'◷'],['Driver',route?.driver??'—','♙'],['Seat',transport.seat,'◇']]}/>
          <h3>Route Stops</h3><Row title={transport.name} detail={route?.stops} icon="↗"/></>:empty('No transport assignment on record.')}
      </Panel>
    </div>
    <StudentUpdates events={schoolEvents} attendance={attendance} submissions={submissions} marks={marks}
      payments={(d.payments??[]).filter(row=>fees.some(fee=>fee._id===row.feeId))} future={future} pending={pending} alerts={alerts}
      today={today} weekStart={iso(shifted(now,-6))} todayRecord={todayRecord} due={due}
      named={named} openCalendar={action('calendar')} openNotifications={openNotifications} openFees={feeDetails}
      openExams={action('exams')} openAssignments={scroll('sd-assignments')} openAttendance={action('attendance')}/>
    {dialog&&<div className="overlay"><section className="modal td-report" role="dialog" aria-modal="true" aria-label="Student dashboard details">
      {dialog.kind==='upload'?<form onSubmit={upload}><h2>{dialog.task.name}</h2><p className="muted">{dialog.task.instructions}</p><label>Assignment PDF (up to 2 MB)<input type="file" name="file" accept="application/pdf,.pdf" required/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Uploading…':'Submit Assignment'}</button></form>:
        dialog.kind==='selectUpload'?<><h2>Choose Assignment</h2>{pending.map(row=><Row key={row._id} title={row.name} detail={short(row.due)} action={<button onClick={uploadFor(row)}>Select</button>}/>)}</>:
        dialog.kind==='fees'?<><h2>Fee Details</h2>{fees.map(row=><Row key={row._id} title={row.name} detail={'Due '+short(row.due)+' · '+money(balance(row))+' outstanding'}/>)}<p className="muted">Contact the school office to arrange payment.</p></>:
        dialog.kind==='leave'?<><h2>Request Leave</h2><form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{await api('workspace/student-leave','POST',Object.fromEntries(new FormData(event.currentTarget)));setDialog(null);setNotice('Leave request submitted.');reload(v=>v+1);}catch(e){setError(e.message);}finally{setBusy(false);}}}><label>Leave date<input name="date" type="date" min={today} defaultValue={today} required/></label><label>Reason<input name="reason" maxLength={200} required/></label>{error&&<p className="error">{error}</p>}<button className="primary" disabled={busy||!student}>Send Request</button></form></>:
        <><h2>{named('subjects',dialog.row.subjectId)?.name??dialog.row.name}</h2><p>{[dialog.row.start+'–'+dialog.row.end,dialog.row.room,named('teachers',dialog.row.teacherId)?.name].filter(Boolean).join(' · ')}</p><p>{session(dialog.row)?.status??'Scheduled'}</p></>}
      <div className="actions"><button disabled={busy} onClick={()=>{setDialog(null);setError('');}}>Close</button></div>
    </section></div>}
  </div>;
}
