import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import './teacher-dashboard.css';
import { DashboardMetrics, delta } from './dashboard-metrics.jsx';
import { DashboardIcon, HeroAvatar, HeroClock, HeroMetric, HeroTag } from './dashboard-hero.jsx';

const modules = ['teachers','classes','subjects','students','timetable','attendance','homework','submissions','exams','results','leaves','sessions','calendar','announcements','achievements'];
const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const dateKey = date => [date.getFullYear(), date.getMonth()+1, date.getDate()].map(value => String(value).padStart(2,'0')).join('-');
const minutes = time => Number(time.slice(0,2))*60 + Number(time.slice(3));
const span = value => Math.floor(value/60)+'h '+value%60+'m';
const pct = (value,total) => total ? Math.round(value*100/total) : null;
const percent = value => value === null ? '—' : value+'%';
const present = row => ['Present','Late'].includes(row.status);
const dateLabel = value => value ? new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '';
const timestamp = value => value ? new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '';
const colors = ['blue','green','red','gold','sky','purple','pink','cyan'];

const dashboardIcons = {
  attendance: 'clipboard', class: 'cap', assignment: 'file', results: 'certificate', meeting: 'calendarPlus',
  announcement: 'megaphone', messages: 'mail', insights: 'sparkle', students: 'group', award: 'trophy', activity: 'chartLine',
};
function Icon({name,tone='blue'}) {
  return <span aria-hidden="true" className={'td-icon td-'+tone}><DashboardIcon name={dashboardIcons[name] ?? name} /></span>;
}
function Panel({title,icon,action,children,className=''}) {
  return <section className={'td-panel panel '+className}><div className="td-panel-heading"><h2><DashboardIcon name={dashboardIcons[icon] ?? icon} /> {title}</h2>{action}</div>{children}</section>;
}
function Row({title,detail,icon,tone,action}) {
  return <article className="td-row"><Icon name={icon} tone={tone}/><div><strong>{title}</strong>{detail && <small>{detail}</small>}</div>{action}</article>;
}
function Badge({children,tone='blue'}) {
  return <span className={'td-badge td-'+tone}>{children}</span>;
}
function Metrics({items,compact=false}) {
  return <div className={'td-metrics '+(compact?'td-compact':'')}>{items.map(([label,value,icon,tone,action])=>{
    const children=<><Icon name={icon} tone={tone}/><div><strong>{value}</strong><small>{label}</small></div></>;
    return action ? <button className="td-metric" type="button" key={label} onClick={action}>{children}</button> : <div className="td-metric" key={label}>{children}</div>;
  })}</div>;
}
function Empty({children}) { return <p className="muted td-empty">{children}</p>; }
function Meter({value}) { return <div className="td-meter"><i style={{width:(value ?? 0)+'%'}} /></div>; }

export default function TeacherDashboard({user,year,go,openNotifications}) {
  const [now,setNow]=useState(()=>new Date());
  const [records,setRecords]=useState(null);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const [teacherId,setTeacherId]=useState('');
  const [tab,setTab]=useState('Pending Review');
  const [busy,setBusy]=useState(false);
  const [more,setMore]=useState(false);
  const [report,setReport]=useState(false);
  const [reply,setReply]=useState('');
  const [status,setStatus]=useState('');
  const reload=()=>setRevision(value=>value+1);

  useEffect(()=>{
    const timer=setInterval(()=>setNow(new Date()),30000);
    return ()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    let live=true;
    const requests = [...modules.map(key=>[key,'records/'+key]),...['activity','messages','contacts'].map(key=>[key,'workspace/'+key])];
    Promise.all(requests.map(async ([key,path])=>[key,await api(path)])).then(entries=>{
      if(live){setRecords(Object.fromEntries(entries));setError('');}
    }, err=>{if(live)setError(err.message);});
    return ()=>{live=false;};
  },[revision]);
  async function save(path,method,body,message) {
    setBusy(true);setError('');setStatus('');
    try {await api(path,method,body);setStatus(message);reload();return true;}
    catch(err){setError(err.message);return false;}
    finally{setBusy(false);}
  }

  const d=records ?? {};
  const teachers=d.teachers ?? [];
  const teacher=user.role==='admin' ? teachers.find(row=>row._id===teacherId) ?? teachers[0] : teachers.find(row=>row.email?.toLowerCase()===user.email?.toLowerCase());
  const timetable=(d.timetable ?? []).filter(row=>row.teacherId===teacher?._id);
  const classIds=new Set(timetable.map(row=>row.classId));
  const students=(d.students ?? []).filter(row=>classIds.has(row.classId)&&(!year||row.year===year));
  const studentsById=new Map(students.map(row=>[row._id,row]));
  const classes=(d.classes ?? []).filter(row=>classIds.has(row._id));
  const className=id=>{const row=classes.find(item=>item._id===id);return row ? [row.name,row.section].filter(Boolean).join(' · ') : 'Class';};
  const subject=id=>d.subjects?.find(row=>row._id===id)?.name;
  const today=dateKey(now);
  const currentMinutes=now.getHours()*60+now.getMinutes();
  const schedule=timetable.filter(row=>row.day===weekdays[now.getDay()]).sort((a,b)=>a.start.localeCompare(b.start));
  const todaySessions=(d.sessions ?? []).filter(row=>row.date===today);
  const sessionFor=id=>todaySessions.find(row=>row.periodId===id);
  const upcoming=schedule.filter(row=>!sessionFor(row._id)&&minutes(row.start)>currentMinutes);
  const scheduledMinutes=schedule.reduce((total,row)=>total+Math.max(0,minutes(row.end)-minutes(row.start)),0);
  const attendance=(d.attendance ?? []).filter(row=>studentsById.has(row.studentId));
  const todaysAttendance=attendance.filter(row=>row.date===today);
  const assignmentPairs=new Set(timetable.map(row=>row.classId+'/'+row.subjectId));
  const homework=(d.homework ?? []).filter(row=>assignmentPairs.has(row.classId+'/'+row.subjectId));
  const submissions=(d.submissions ?? []).filter(row=>studentsById.has(row.studentId)&&homework.some(task=>task._id===row.homeworkId));
  const exams=(d.exams ?? []).filter(row=>assignmentPairs.has(row.classId+'/'+row.subjectId));
  const futureExams=exams.filter(row=>row.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const results=(d.results ?? []).filter(row=>studentsById.has(row.studentId)&&exams.some(exam=>exam._id===row.examId));
  const leaves=(d.leaves ?? []).filter(row=>studentsById.has(row.studentId)&&row.status==='Pending');
  const parents=(d.contacts ?? []).filter(row=>row.role==='parent');
  const messages=(d.messages ?? []).filter(row=>row.to===user.id&&parents.some(parent=>parent._id===row.from));
  const average=rows=>{const values=rows.map(row=>pct(row.marks,exams.find(exam=>exam._id===row.examId)?.maximum)).filter(value=>value!==null);return values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : null;};
  const studentScore=student=>average(results.filter(row=>row.studentId===student._id));
  const studentAttendance=student=>{const rows=attendance.filter(row=>row.studentId===student._id);return pct(rows.filter(present).length,rows.length);};
  const top=[...students].filter(row=>studentScore(row)!==null).sort((a,b)=>studentScore(b)-studentScore(a));
  const low=students.filter(row=>studentAttendance(row)!==null&&studentAttendance(row)<85);
  const atRisk=top.filter(row=>studentScore(row)<60);
  const averageAttendance=pct(attendance.filter(present).length,attendance.length);
  const averageMarks=average(results);
  const expected=homework.reduce((total,row)=>total+students.filter(student=>student.classId===row.classId).length,0);
  const completion=pct(submissions.length,expected);
  const reviewed=submissions.filter(row=>row.status==='Graded');
  const pending=submissions.filter(row=>row.status==='Submitted');
  const activeSession=schedule.find(row=>sessionFor(row._id)?.status==='Live');
  const upcomingExamMarks=exams.filter(row=>row.date<=today).reduce((total,exam)=>total+students.filter(student=>student.classId===exam.classId&&!results.some(row=>row.examId===exam._id&&row.studentId===student._id)).length,0);
  const classCards=[...new Map(timetable.map(row=>[row.classId+'/'+row.subjectId,row])).values()];
  const classAverage=id=>average(results.filter(row=>studentsById.get(row.studentId)?.classId===id));
  const topClass=[...classes].filter(row=>classAverage(row._id)!==null).sort((a,b)=>classAverage(b._id)-classAverage(a._id))[0];
  const events=[...(d.calendar ?? []),...futureExams.map(row=>({...row,notes:className(row.classId)+' · Exam'}))].filter(row=>row.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const activity=d.activity ?? [];
  const notifications=[...activity.filter(row=>!row.read).map(row=>({title:row.title,detail:timestamp(row.createdAt),id:row._id})),
    ...(d.announcements ?? []).filter(row=>row.date<=today).map(row=>({title:row.name,detail:row.body,id:row._id}))];
  const profilePct=teacher ? pct(['name','email','department','phone'].filter(key=>teacher[key]).length,4) : null;
  const goTo=(key,add=false,target)=>()=>go(key,add,target);
  const addAttendance=(classId)=>go('attendance',true,{classId,defaults:{date:today}});
  const addAssignment=(row)=>go('homework',true,{defaults:row?{classId:row.classId,subjectId:row.subjectId}:undefined});
  const goStudent=student=>go('students',false,{id:student._id,name:student.name});
  const attendanceAction=()=>addAttendance(activeSession?.classId ?? upcoming[0]?.classId);
  const assignmentRows=homework.filter(task=>{
    const latest=submissions.filter(row=>row.homeworkId===task._id);
    if(tab==='Deadlines')return task.due>=today;
    if(tab==='Late')return task.due<today&&latest.length<students.filter(row=>row.classId===task.classId).length;
    if(tab==='Graded')return latest.some(row=>row.status==='Graded');
    if(tab==='Submitted')return latest.length>0;
    return latest.some(row=>row.status==='Submitted');
  }).sort((a,b)=>a.due.localeCompare(b.due));
  async function toggleClass(period) {
    if(!period)return;
    const session=sessionFor(period._id);
    if (!session && activeSession) { setError('Finish the current class before starting another.'); return; }
    if(session?.status==='Done')return;
    await save('records/sessions'+(session?'/'+session._id:''),session?'PUT':'POST',
      {periodId:period._id,date:today,status:session?'Done':'Live',notes:session?.notes ?? ''},session?'Class completed.':'Class started.');
  }
  async function replyParent(event) {
    event.preventDefault();
    const form=event.currentTarget;
    const body=Object.fromEntries(new FormData(form));
    if(await save('workspace/messages','POST',body,'Message sent.'))setReply('');
  }
  const suggestions=[
    ['Class Attendance',percent(averageAttendance),'Present and late records for assigned students.','attendance','green'],
    ['Average Marks',percent(averageMarks),'Recorded exams for assigned subjects.','results','blue'],
    ['Homework Completion',percent(completion),'Submissions against assigned student work.','assignment','gold'],
    ['Students needing attention',atRisk.length+ ' below 60%',low.length+' below 85% attendance.','alert','red'],
    ['Suggested action',atRisk.length?'Review low-scoring students':low.length?'Review attendance':'Review assignment submissions','Based on current classroom records.','insights','purple'],
  ];
  const quick=[
    ['Take Attendance','attendance',attendanceAction],['Start Class','class',()=>toggleClass(activeSession ?? upcoming[0] ?? schedule.find(row=>!sessionFor(row._id)))],
    ['Create Assignment','assignment',()=>addAssignment()],['Enter Marks','results',goTo('results',true)],['Schedule Meeting','meeting',goTo('calendar',true)],
    ['Send Announcement','announcement',goTo('announcements',true)],
  ];
  const badges=[['Top Rated','award','gold'],['Best Attendance','calendar','green'],['Recognition','award','purple'],['Courses','class','blue'],['Certificates','assignment','cyan'],['Performance','activity','pink']];
  const visibleWeek=Array.from({length:6},(_,i)=>{const start=new Date(now);start.setDate(start.getDate()-(5-i)*7-6);const end=new Date(start);end.setDate(start.getDate()+6);
    return average(results.filter(row=>{const date=exams.find(item=>item._id===row.examId)?.date;return date>=dateKey(start)&&date<=dateKey(end);}));
  });
  const trend=visibleWeek.map((value,i)=>value===null?null:[10+i*56,43-value*.34]).filter(Boolean);

  const offset=days=>new Date(now.getFullYear(),now.getMonth(),now.getDate()+days);
  const yesterdaySchedule=timetable.filter(row=>row.day===weekdays[offset(-1).getDay()]);
  const durationOf=rows=>rows.reduce((total,row)=>total+Math.max(0,minutes(row.end)-minutes(row.start)),0);
  const previousAttendance=attendance.filter(row=>row.date===dateKey(offset(-1)));
  const attendanceChange=status=>delta(todaysAttendance.length?todaysAttendance.filter(row=>row.status===status).length:null,
    previousAttendance.length?previousAttendance.filter(row=>row.status===status).length:null,'Recorded '+status.toLowerCase()+' count vs yesterday',{lower:status==='Absent'});
  const recordDay=row=>row.date??row.createdAt?.slice(0,10);
  const recent=rows=>rows.filter(row=>recordDay(row)>dateKey(offset(-7))&&recordDay(row)<=today);
  const prior=rows=>rows.filter(row=>recordDay(row)>dateKey(offset(-14))&&recordDay(row)<=dateKey(offset(-7)));
  if(!records)return <div className="td-root" aria-live="polite">{error?<><p className="error">{error}</p><button onClick={reload}>Retry</button></>:<Empty>Loading teacher dashboard…</Empty>}</div>;

  return <div className="td-root">
    {error&&<p className="error" role="alert">{error}</p>}
    {status&&<p className="td-confirm" role="status">{status}</p>}
    <section className="panel td-hero dashboard-person-hero teacher-person-hero">
      <div className="td-hero-head"><div className="td-person">
        <HeroAvatar kind="teacher" name={teacher?.name??user.name} demo={/^demo\.teacher\d+@example\.com$/i.test(teacher?.email??'')}/>
        <div><small className="td-greeting">Good {now.getHours()<12?'morning':now.getHours()<18?'afternoon':'evening'} 👋</small><h2>{teacher?.name??user.name}</h2>
          <div className="td-person-tags">
            {teacher?.employeeId&&<HeroTag icon="badge">{teacher.employeeId}</HeroTag>}
            {teacher?.department&&<HeroTag icon="house">{teacher.department}</HeroTag>}
            <HeroTag icon="medal">{teacher?.designation??'Teacher'}</HeroTag>
            {teacher?.homeroom?<HeroTag icon="cap">{teacher.homeroom}</HeroTag>:<HeroTag icon="cap">{classes.length} assigned classes</HeroTag>}
          </div>
        </div></div>
        <HeroClock now={now}/>
      </div>
      {user.role==='admin'&&<label className="dashboard-preview-picker">Preview teacher<select value={teacher?._id??''} onChange={event=>setTeacherId(event.target.value)}>{teachers.map(row=><option key={row._id} value={row._id}>{row.name}</option>)}</select></label>}
      {!teacher&&<Empty>Link this login to a teacher record using the same email, then assign timetable periods.</Empty>}
      <div className="td-metrics td-compact dashboard-hero-metrics">
        <HeroMetric name="Today's Schedule" value={schedule.length} icon="calendar" tone="blue"/>
        <HeroMetric name="Teaching Hours" value={span(scheduledMinutes)} icon="time" tone="sky"/>
        <HeroMetric name="Upcoming Classes" value={upcoming.length} icon="arrow" tone="gold"/>
        <HeroMetric name="Attendance Today" value={percent(pct(todaysAttendance.filter(present).length,todaysAttendance.length))} icon="users" tone="green"/>
        <HeroMetric name="Profile Completion" value={percent(profilePct)} progress={profilePct} icon="badge" tone="cyan" run={goTo('profile')}/>
        <HeroMetric name="Teaching Insights" value={percent(averageMarks)} icon="sparkle" tone="purple" run={()=>setReport(true)}/>
      </div>
      <div className="td-quick dashboard-quick"><small><DashboardIcon name="bolt" /> Quick actions:</small>{quick.map(([label,,run],i)=><button key={label} className={i===0?'primary':''}
        disabled={busy||(i===1&&!schedule.some(row=>sessionFor(row._id)?.status!=='Done'))} onClick={run}><DashboardIcon name={['clipboard','play','file','grid','calendar','megaphone'][i]}/> {label}</button>)}
        <button aria-expanded={more} onClick={()=>setMore(!more)}><DashboardIcon name="grid"/> More Actions</button>
        {more&&<div className="td-more">{[['Submissions','submissions'],['Leave Requests','leaves'],['Achievements','achievements'],['Study Materials','files'],['Class Sessions','sessions']].map(([label,key])=><button key={key} onClick={goTo(key)}>{label}</button>)}</div>}
      </div>
    </section>
    <DashboardMetrics items={[
      {name:"Today's Classes",value:schedule.length,icon:'book',tone:'blue',change:delta(schedule.length,yesterdaySchedule.length,'Scheduled classes vs yesterday'),run:goTo('timetable')},
      {name:'Students Present',value:todaysAttendance.filter(row=>row.status==='Present').length,icon:'users',tone:'green',change:attendanceChange('Present'),run:goTo('attendance')},
      {name:'Students Absent',value:todaysAttendance.filter(row=>row.status==='Absent').length,icon:'users',tone:'red',change:attendanceChange('Absent'),run:goTo('attendance')},
      {name:'Assignments Pending',value:pending.length,icon:'file',tone:'gold',change:delta(recent(pending).length,prior(pending).length,'Pending reviews received in last 7 days vs previous 7 days',{lower:true}),run:goTo('submissions')},
      {name:'Homework Submitted',value:submissions.length,icon:'clipboard',tone:'sky',change:delta(recent(submissions).length,prior(submissions).length,'Submissions received in last 7 days vs previous 7 days'),run:goTo('submissions')},
      {name:'Upcoming Exams',value:futureExams.length,icon:'cap',tone:'purple',change:delta(futureExams.filter(row=>row.date<dateKey(offset(7))).length,exams.filter(row=>row.date>=dateKey(offset(-7))&&row.date<today).length,'Exams in next 7 days vs previous 7 days'),run:goTo('exams')},
      {name:'Parent Messages',value:messages.filter(row=>!row.read).length,icon:'chat',tone:'pink',change:delta(recent(messages).length,prior(messages).length,'Parent messages received in last 7 days vs previous 7 days'),run:goTo('messages')},
      {name:'Leave Requests',value:leaves.length,icon:'calendar',tone:'gold',change:delta(recent(leaves).length,prior(leaves).length,'Pending leave requests by leave date in last 7 days vs previous 7 days'),run:goTo('leaves')},
      {name:'Avg Class Attendance',value:averageAttendance??'—',suffix:averageAttendance==null?null:'%',icon:'arrow',tone:'cyan',change:delta(pct(recent(attendance).filter(present).length,recent(attendance).length),pct(prior(attendance).filter(present).length,prior(attendance).length),'Last 7 days vs previous 7 days',{unit:' pp'}),run:goTo('attendance')},
      {name:'Teaching Hours',value:span(scheduledMinutes),icon:'time',tone:'sky',change:delta(scheduledMinutes,durationOf(yesterdaySchedule),'Scheduled teaching minutes vs yesterday',{unit:'m'}),run:goTo('timetable')},
    ]}/>
    <div className="td-grid td-wide">
      <Panel title="Today's Timetable" icon="calendar" action={<button onClick={goTo('timetable')}>View Full Schedule</button>}>
        {schedule.length?schedule.map((row,i)=>{const session=sessionFor(row._id);const tone=session?.status==='Done'?'green':session?.status==='Live'?'red':row===upcoming[0]?'gold':colors[(i+4)%colors.length];return <article className={'td-period td-'+tone} key={row._id}>
          <div><strong>{row.start}</strong><small>{Math.max(0,minutes(row.end)-minutes(row.start))} min</small></div>
          <div><strong>{subject(row.subjectId)??row.name}</strong><small>{className(row.classId)} · Room {row.room} · {students.filter(student=>student.classId===row.classId).length} students</small></div>
          <div className="actions"><Badge tone={tone}>{session?.status??(row===upcoming[0]?'Next':row.start)}</Badge>
            {session?.status!=='Done'&&<button disabled={busy} onClick={()=>toggleClass(row)}>{session ? 'Finish' : <><DashboardIcon name="play" /> Class</>}</button>}
            <button title="Take attendance" aria-label={'Take attendance for '+row.name} onClick={()=>addAttendance(row.classId)}><DashboardIcon name="clipboard" /></button></div>
        </article>;}):<Empty>No periods scheduled for {weekdays[now.getDay()]}. Open the full schedule to see all assigned periods.</Empty>}
      </Panel>
      <Panel title="Teaching Insights" icon="insights" className="td-insights" action={<Badge tone="purple">Classroom data</Badge>}>
        <div className="td-insight-summary"><span className="td-score">{percent(averageMarks)}</span><div><strong>Teaching effectiveness</strong><small>{results.length} recorded exam results</small></div></div>
        {suggestions.map(([label,value,detail,icon,tone])=><Row key={label} title={label+' · '+value} detail={detail} icon={icon} tone={tone}/>)}
        <button className="td-full" onClick={()=>setReport(true)}>View Full Teaching Report</button>
      </Panel>
    </div>
    <Panel title="Class Performance" icon="results" action={<button onClick={()=>setReport(true)}>View Details</button>}>
      <div className="td-grid td-three">
        {[['Average Attendance',averageAttendance,'students','green'],['Average Marks',averageMarks,'results','blue'],['Homework Completion',completion,'assignment','sky'],
          ['Student Engagement',pct(new Set(submissions.map(row=>row.studentId)).size,students.length),'activity','purple'],
          ['Assignments Reviewed',pct(reviewed.length,submissions.length),'attendance','cyan']].map(([label,value,icon,tone])=><article className="td-performance" key={label}>
          <Icon name={icon} tone={tone}/><strong>{percent(value)}</strong><small>{label}</small><Meter value={value}/>
        </article>)}
        <article className="td-performance"><Icon name="activity" tone="gold"/><svg viewBox="0 0 300 50" role="img" aria-label="Six-week average marks">
          {trend.length>0&&<><polygon points={[...trend,[trend.at(-1)[0],49],[trend[0][0],49]].map(value=>value.join(',')).join(' ')} fill="#415dea" opacity=".12"/><polyline points={trend.map(value=>value.join(',')).join(' ')} fill="none" stroke="#415dea" strokeWidth="2"/>{trend.map(([x,y])=><circle key={x} cx={x} cy={y} r="2" fill="#415dea"/>)}</>}
        </svg><small>Performance Trend (6 weeks)</small></article>
      </div>
    </Panel>
    <Panel title="My Classes" icon="class" action={<button onClick={goTo('timetable')}>View All <DashboardIcon name="next" /></button>}>
      {classCards.length?<div className="td-grid td-three">{classCards.map((row,i)=>{
        const roster=students.filter(student=>student.classId===row.classId);
        const records=attendance.filter(entry=>studentsById.get(entry.studentId)?.classId===row.classId);
        return <article className="td-class-card" key={row.classId+row.subjectId}>
          <div className={'td-class-title td-'+colors[i%colors.length]}><Icon name="class" tone={colors[i%colors.length]}/><div><strong>{className(row.classId)}</strong><small>{subject(row.subjectId)??row.name}</small></div></div>
          <div className="td-class-values">{[[roster.length,'Students'],[percent(pct(records.filter(present).length,records.length)),'Attendance'],[percent(classAverage(row.classId)),'Avg Marks']].map(([value,label])=><div key={label}><strong>{value}</strong><small>{label}</small></div>)}</div>
          <div className="td-class-actions"><button onClick={()=>addAttendance(row.classId)} title="Take attendance"><DashboardIcon name="clipboard" /></button>
            <button title="Class roster" onClick={goTo('students',false,{group:row.classId})}><DashboardIcon name="group" /></button><button title="Create assignment" onClick={()=>addAssignment(row)}><DashboardIcon name="file" /></button>
            <button title="Class timetable" onClick={goTo('timetable',false,{group:row.classId})}><DashboardIcon name="calendar" /></button></div>
        </article>;
      })}</div>:<Empty>No assigned classes yet.</Empty>}
    </Panel>
    <div className="td-grid td-wide">
      <Panel title="Assignments" icon="assignment" action={<button className="primary" onClick={()=>addAssignment()}><DashboardIcon name="plusSmall" /> Create Assignment</button>}>
        <div className="td-tabs">{['Pending Review','Submitted','Late','Deadlines','Graded'].map(label=><button key={label} aria-pressed={tab===label} onClick={()=>setTab(label)}>{label}{label==='Pending Review'?' '+pending.length:''}</button>)}</div>
        {assignmentRows.length?assignmentRows.map(task=><Row key={task._id} title={task.name} detail={className(task.classId)+' · '+submissions.filter(row=>row.homeworkId===task._id).length+' of '+students.filter(row=>row.classId===task.classId).length+' submitted'}
          icon="assignment" tone="gold" action={<button onClick={goTo('submissions',false,{homeworkId:task._id,defaults:{homeworkId:task._id}})}>{tab==='Pending Review'?'Review':dateLabel(task.due)} <DashboardIcon name="next" /></button>}/>):<Empty>No assignments in this view.</Empty>}
      </Panel>
      <Panel title="Exam & Grading" icon="results" action={<button onClick={goTo('results')}>Results <DashboardIcon name="next" /></button>}>
        <div className="td-exam-stats">{[[futureExams.length,'Upcoming Exams'],[upcomingExamMarks,'Marks Pending'],[percent(averageMarks),'Average Marks'],[topClass?className(topClass._id):'—','Top Class']].map(([v,l])=><article className="td-performance" key={l}><strong>{v}</strong><small>{l}</small></article>)}</div>
        <h3>Upcoming Exams</h3>{futureExams.slice(0,3).map(exam=><Row key={exam._id} title={exam.name} detail={className(exam.classId)} icon="results" tone="purple"
          action={<Badge tone="gold">{dateLabel(exam.date)}</Badge>}/>)}
        {!futureExams.length&&<Empty>No upcoming exams.</Empty>}
        <h3>Students Needing Attention</h3>{atRisk.slice(0,3).map(row=><Row key={row._id} title={row.name} detail={percent(studentScore(row))+' average marks'} icon="alert" tone="red" action={<button onClick={()=>goStudent(row)}>View</button>}/>)}
        {!atRisk.length&&<Empty>No students below the marks threshold.</Empty>}
      </Panel>
    </div>
    <div className="td-grid td-two">
      <Panel title="Attendance Center" icon="attendance" action={<button className="primary" onClick={attendanceAction}><DashboardIcon name="plusSmall" /> Quick Attendance</button>}>
        <div className="td-class-values">{['Present','Absent','Late','On leave'].map(label=><div key={label}><strong>{todaysAttendance.filter(row=>row.status===label).length}</strong><small>{label}</small></div>)}</div>
        <h3>Leave Requests</h3>{leaves.length?leaves.map(row=><Row key={row._id} title={studentsById.get(row.studentId).name} detail={row.reason+' · '+dateLabel(row.date)}
          icon="calendar" tone="gold" action={<div className="actions">{['Approved','Denied'].map(value=><button key={value} disabled={busy} onClick={()=>save('records/leaves/'+row._id,'PUT',{studentId:row.studentId,date:row.date,reason:row.reason,status:value},'Leave request '+value.toLowerCase()+'.')}>{value==='Approved'?'Approve':'Deny'}</button>)}</div>}/>):<Empty>No pending leave requests.</Empty>}
        <button onClick={goTo('leaves')}>View leave requests</button>
      </Panel>
      <Panel title="Parent Communication" icon="messages" action={<div className="actions"><button onClick={goTo('calendar',true)}>Schedule PTA</button><button onClick={goTo('messages')}>Inbox {messages.filter(row=>!row.read).length||''}</button></div>}>
        {messages.length?messages.slice(0,3).map(row=><Row key={row._id} title={parents.find(parent=>parent._id===row.from)?.name} detail={row.body} icon="messages" tone="pink"
          action={<button onClick={goTo('messages',false,{to:row.from})}>Reply</button>}/>):<Empty>No messages from linked parents.</Empty>}
        {(d.announcements??[]).slice(0,2).map(row=><Row key={row._id} title={row.name} detail={dateLabel(row.date)} icon="announcement" tone="gold"/>)}
        {parents.length>0&&<form className="td-reply" onSubmit={replyParent}><select name="to" required aria-label="Parent"><option value="">Select parent</option>
          {parents.map(row=><option key={row._id} value={row._id}>{row.name}</option>)}</select><input aria-label="Quick reply" name="body" required maxLength={3000} placeholder="Quick reply to parents…" value={reply} onChange={event=>setReply(event.target.value)}/><button className="primary" disabled={busy}>Send</button></form>}
      </Panel>
    </div>
    <div className="td-grid td-wide">
      <Panel title="Student Insights" icon="students" action={<button onClick={goTo('students')}>View All</button>}>
        <div className="td-grid td-two">
          <div><h3>Top Performers</h3>{top.slice(0,2).map((row,i)=><Row key={row._id} title={row.name} detail={className(row.classId)+' · '+percent(studentScore(row))}
            icon="award" tone="green" action={<button onClick={()=>goStudent(row)}>Rank {i+1}</button>}/>)}
            {!top.length&&<Empty>No marks recorded.</Empty>}
            <h3>Students at Risk</h3>{atRisk.slice(0,2).map(row=><Row key={row._id} title={row.name} detail={percent(studentScore(row))+' average marks'} icon="alert" tone="red" action={<button onClick={()=>goStudent(row)}>View</button>}/>)}
            {!atRisk.length&&<Empty>No flagged marks.</Empty>}</div>
          <div><h3>Low Attendance</h3>{low.slice(0,3).map(row=><Row key={row._id} title={row.name} detail={percent(studentAttendance(row))+' attendance'} icon="attendance" tone="gold" action={<button onClick={()=>goStudent(row)}>View</button>}/>)}
            {!low.length&&<Empty>No attendance below 85%.</Empty>}</div>
        </div>
      </Panel>
      <Panel title="Achievements" icon="award" action={<button onClick={goTo('achievements')}>Manage</button>}>
        <div className="td-grid td-three">{badges.map(([label,icon,tone])=><button className="td-award" key={label} onClick={goTo('achievements',false,{category:label})}><Icon name={icon} tone={tone}/><strong>{label}</strong>
          <small>{(d.achievements??[]).filter(row=>row.category===label).length} recorded</small></button>)}</div>
      </Panel>
    </div>
    <div className="td-grid td-three">
      <Panel title="Calendar" icon="calendar" action={<button onClick={goTo('calendar')}>View</button>}>
        {events.length?events.slice(0,6).map((row,i)=><Row key={row._id} title={row.name} detail={[dateLabel(row.date),row.start,row.notes].filter(Boolean).join(' · ')} icon="calendar" tone={colors[i%colors.length]}/>):<Empty>No upcoming calendar events.</Empty>}
      </Panel>
      <Panel title="Activity Timeline" icon="activity" action={<button onClick={goTo('activity')}>View All</button>}>
        {activity.length?activity.slice(0,8).map((row,i)=><Row key={row._id} title={row.title} detail={timestamp(row.createdAt)} icon="activity" tone={colors[i%colors.length]}/>):<Empty>Classroom changes will appear here.</Empty>}
      </Panel>
      <Panel title="Notifications" icon="alert" action={<button onClick={openNotifications}>View All {activity.filter(row=>!row.read).length||''}</button>}>
        {notifications.length?notifications.slice(0,6).map((row,i)=><Row key={row.id} title={row.title} detail={row.detail} icon="alert" tone={colors[(i+2)%colors.length]}/>):<Empty>No new notifications.</Empty>}
      </Panel>
    </div>
    {report&&<div className="overlay"><section className="modal td-report" role="dialog" aria-modal="true" aria-labelledby="td-report-title"><h2 id="td-report-title">Teaching Report</h2>
      {suggestions.map(([label,value,detail,icon,tone])=><Row key={label} title={label+' · '+value} detail={detail} icon={icon} tone={tone}/>)}
      <div className="actions"><button onClick={()=>setReport(false)}>Close</button><button className="primary" onClick={goTo('results')}>View exam results</button></div></section></div>}
  </div>;
}
