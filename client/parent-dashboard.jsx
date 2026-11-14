import React, {useEffect,useState} from 'react';
import {api} from './api.js';
import {DashboardIcon,HeroAvatar} from './dashboard-hero.jsx';
import './parent-dashboard.css';

const modules=['students','classes','subjects','teachers','timetable','attendance','homework','submissions','exams','results','fees','payments','studentTransport','transport','loans','calendar','announcements','leaves'];
const dateKey=(date=new Date())=>[date.getFullYear(),date.getMonth()+1,date.getDate()].map(v=>String(v).padStart(2,'0')).join('-');
const dayLabel=value=>value?new Date(value+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'}):'';
const yesterday=date=>{const copy=new Date(date+'T12:00:00');copy.setDate(copy.getDate()-1);return dateKey(copy);};
const shortTime=stamp=>stamp?new Date(stamp).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}):'';
function subjectTheme(name,score){
  if (/math|algebra|geometry/i.test(name)) return ['math','green'];
  if (/science|physics|chemistry|biology/i.test(name)) return ['science','green'];
  if (/computer|coding/i.test(name)) return ['code','purple'];
  if (/english|language|literature/i.test(name)) return ['book',score!=null&&score<75?'gold':'blue'];
  return ['book','sky'];
}
const within=(a,b)=>Math.round((Date.parse(a)-Date.parse(b))/86400000);
const sum=(rows,key)=>rows.reduce((n,row)=>n+(Number(row[key])||0),0);
const percent=(n,d)=>d?Math.round(n/d*100):null;
const show=value=>value==null?'—':value+'%';
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2,minimumFractionDigits:0}).format(value);
const grade=value=>value>=90?'A+':value>=80?'A':value>=70?'B':value>=60?'C':value>=50?'D':'F';
const present=row=>row.status==='Present'||row.status==='Late';
const tones=['green','gold','blue','purple','sky','pink'];
const demo=row=>/^DEMO-[678]0[1-4]$/.test(row?.admission??'');
function Icon({name,tone='blue'}){return <span className={'pd-icon pd-'+tone}><DashboardIcon name={name}/></span>;}
function Action({icon,children,onClick,primary=false}){return <button className={primary?'primary':''} type="button" onClick={onClick}><DashboardIcon name={icon}/>{children}</button>;}
function Section({caption,title,icon,action,children}){return <section className="pd-section"><div className="pd-section-head"><div><small><DashboardIcon name={icon}/>{caption}</small><h2>{title}</h2></div>{action}</div>{children}</section>;}
function Empty({children}){return <p className="pd-empty">{children}</p>;}
function Row({icon,tone,title,detail,end}){return <div className="pd-row"><Icon name={icon} tone={tone}/><div><strong>{title}</strong><small>{detail}</small></div>{end}</div>;}
function Meter({value}){return <span className="pd-meter"><i style={{width:Math.min(100,Math.max(0,value??0))+'%'}}/></span>;}
function download(name, rows) {
  const cell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv'}));
  const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function ParentDashboard({user,year,go}) {
  const [data,setData]=useState(null),[selected,select]=useState(''),[error,setError]=useState(''),[revision,reload]=useState(0);
  const [dialog,setDialog]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),60000);return ()=>clearInterval(timer);},[]);
  const [dismissed,setDismissed]=useState(()=>{try{return JSON.parse(localStorage.getItem('parent-read:'+user.id)??'[]');}catch{return [];}});
  const parent=user.role==='parent';
  useEffect(()=>{
    let active=true;
    const shared=['messages','contacts','activity'].map(key=>[key,'workspace/'+key]);
    const requests=[...modules.map(key=>[key,'records/'+key]),...shared,...(parent?[['teacherContacts','workspace/teacher-contacts']]:[])];
    Promise.all(requests.map(async ([key,path])=>[key,await api(path)])).then(rows=>{
      if(active){setData(Object.fromEntries(rows));setError('');}
    },err=>{if(active)setError(err.message);});
    return ()=>{active=false;};
  },[revision,parent]);

  const d=data??{}, today=dateKey();
  const children=(d.students??[]).filter(row=>!year||row.year===year);
  const child=children.find(row=>row._id===selected)??children[0];
  const find=(key,id)=>d[key]?.find(row=>row._id===id);
  const own=(key,student)=>student?(d[key]??[]).filter(row=>row.studentId===student._id):[];
  const classData=(key,student)=>student?(d[key]??[]).filter(row=>row.classId===student.classId):[];
  const className=student=>{const item=find('classes',student?.classId);return item?[item.name,item.section].filter(Boolean).join(' · '):'';};
  function overview(student){
    const attendance=own('attendance',student);
    const exams=classData('exams',student).sort((a,b)=>a.date.localeCompare(b.date));
    const marks=own('results',student).flatMap(row=>{const exam=exams.find(item=>item._id===row.examId);return exam?.maximum?[{...row,exam,score:percent(row.marks,exam.maximum)}]:[];});
    const homework=classData('homework',student).sort((a,b)=>a.due.localeCompare(b.due));
    const submissions=own('submissions',student);
    const pending=homework.filter(row=>!submissions.some(item=>item.homeworkId===row._id));
    return {attendance,marks,exams,homework,submissions,pending,rate:percent(attendance.filter(present).length,attendance.length),
      average:marks.length?Math.round(sum(marks,'score')/marks.length):null, todayRecord:attendance.find(row=>row.date===today),
      next:exams.find(row=>row.date>=today)};
  }
  const o=overview(child);
  const examMinutes=o.next?Math.max(0,Math.ceil((Date.parse(o.next.date+'T'+(/^\d\d:\d\d$/.test(o.next.start??'')?o.next.start:'00:00'))-clock)/60000)):0;
  const schedule=classData('timetable',child), first=child?.name?.split(' ')[0]??'Student';
  const teacher=find('teachers',schedule[0]?.teacherId);
  const teacherContact=d.teacherContacts?.find(row=>row.teacherId===teacher?._id)?.userId;
  const transport=own('studentTransport',child)[0], route=find('transport',transport?.routeId);
  const stops=route?.stops?.split(/→|,|\n/).map(s=>s.trim()).filter(Boolean)??[];
  const fees=own('fees',child).sort((a,b)=>a.due.localeCompare(b.due));
  const payments=(d.payments??[]).filter(row=>fees.some(fee=>fee._id===row.feeId));
  const paidFor=fee=>sum(payments.filter(row=>row.feeId===fee._id),'amount');
  const balance=fee=>Math.max(0,fee.amount-paidFor(fee));
  const due=fees.reduce((amount,row)=>amount+balance(row),0);
  const paid=fees.reduce((amount,row)=>amount+Math.min(row.amount,paidFor(row)),0);
  const subjects=[...new Set([...schedule.map(row=>row.subjectId),...o.marks.map(row=>row.exam.subjectId)])].map(id=>{
    const rows=o.marks.filter(row=>row.exam.subjectId===id).sort((a,b)=>a.exam.date.localeCompare(b.exam.date));
    return {id,name:find('subjects',id)?.name??'Subject',rows,score:rows.length?Math.round(sum(rows,'score')/rows.length):null};
  });
  const unread=(d.messages??[]).filter(row=>row.to===user.id&&!row.read);
  const incoming=(d.messages??[]).filter(row=>row.to===user.id);
  const upcoming=(d.calendar??[]).filter(row=>row.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const agenda=[...upcoming,...o.exams.filter(row=>row.date>=today).map(row=>({...row,notes:'Exam'})),...o.pending.filter(row=>row.due>=today).map(row=>({...row,date:row.due,notes:'Assignment deadline'}))].sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8);
  const announcements=(d.announcements??[]).filter(row=>row.date<=today);
  const timeline=[
    ...o.attendance.map(row=>({id:row._id,date:row.date,title:'Attendance marked',detail:row.status})),
    ...o.submissions.map(row=>({id:row._id,date:row.date,title:row.status==='Graded'?'Assignment reviewed':'Assignment submitted',detail:find('homework',row.homeworkId)?.name})),
    ...o.marks.map(row=>({id:row._id,date:row.exam.date,title:'Exam result published',detail:row.exam.name+' · '+grade(row.score)})),
    ...payments.map(row=>({id:row._id,date:row.date,title:'Fee payment recorded',detail:money(row.amount)})),
  ].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  const notices=[...(d.activity??[]).map(row=>({id:row._id,title:row.title,date:row.createdAt?.slice(0,10),time:shortTime(row.createdAt),detail:row.kind,icon:'bell',read:row.read})),
    ...unread.map(row=>({id:row._id,title:'New school message',date:row.createdAt?.slice(0,10),time:shortTime(row.createdAt),detail:row.body,icon:'chat'})),
    ...announcements.map(row=>({id:row._id,title:row.name,date:row.date,detail:row.body,icon:'megaphone'}))].filter(row=>!row.read&&!dismissed.includes(row.id)).sort((a,b)=>(b.date??'').localeCompare(a.date??'')).slice(0,8);
  const open=(key,add=false,target)=>()=>go(key,add,target);
  const jump=id=>()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
  const message=open('messages',false,teacherContact?{to:teacherContact}:undefined);
  const profile=student=>()=>go('students',false,{id:student._id,name:student.name});
  const report=()=>download('report-card',[['Student','Exam','Date','Marks','Maximum'],...o.marks.map(row=>[child.name,row.exam.name,row.exam.date,row.marks,row.exam.maximum])]);
  const requestLeave=async event=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{await api('workspace/student-leave','POST',{...Object.fromEntries(new FormData(event.currentTarget)),studentId:child._id});setNotice('Leave request submitted.');setDialog('');reload(v=>v+1);}
    catch(err){setError(err.message);}finally{setBusy(false);}
  };
  const markAll=async()=>{
    try{await Promise.all(['activity','messages'].map(key=>api('workspace/'+key+'/read','POST',{})));const read=[...new Set([...dismissed,...notices.map(row=>row.id)])].slice(-200);localStorage.setItem('parent-read:'+user.id,JSON.stringify(read));setDismissed(read);reload(v=>v+1);}
    catch(err){setError(err.message);}
  };
  if(!data)return <div>{error?<><p className="error" role="alert">{error}</p><button onClick={()=>reload(v=>v+1)}>Retry</button></>:<Empty>Loading parent dashboard…</Empty>}</div>;

  return <div className="pd-root">
    <header className="pd-heading"><div><h1>Parent Dashboard</h1><p className="breadcrumbs">Dashboard / Parent Dashboard</p></div>
      {children.length>0&&<div className="pd-viewing"><span><DashboardIcon name="users"/> Viewing</span><div>
        {children.map(row=><button type="button" key={row._id} aria-pressed={row._id===child?._id} onClick={()=>select(row._id)}>
          <HeroAvatar kind="student" name={row.name} demo={demo(row)}/><span><strong>{row.name}</strong><small>{className(row)}</small></span>
          {row._id===child?._id&&<DashboardIcon name="check"/>}</button>)}</div></div>}
    </header>
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="td-confirm" role="status">{notice}</p>}
    {!child?<section className="pd-panel"><Empty>No student is linked for this academic year.</Empty></section>:<>
    <div className="pd-top">
      <section className="pd-panel pd-command">
        <div className="pd-person"><HeroAvatar kind="teacher" name={user.name}/><div><small>Parent Command Center</small><h2>{user.name}</h2>
          <div className="pd-tags">{child.year&&<span><DashboardIcon name="calendar"/>{child.year}</span>}<span><DashboardIcon name="check"/>{parent?'Portal Active':'Admin Preview'}</span></div></div></div>
        <div className="pd-child-focus"><div className="pd-person"><HeroAvatar kind="student" name={child.name} demo={demo(child)} online={o.todayRecord&&present(o.todayRecord)}/><div><span>Viewing <strong>{child.name}</strong></span><small>{[className(child),child.rollNo&&'Roll '+child.rollNo,child.admission].filter(Boolean).join(' · ')}</small></div></div>
          <div className="pd-focus-facts">
            <Row icon="users" title={teacher?.name??'Class teacher'} detail={teacher?'Class teacher':'No teacher assigned'}/>
            <Row icon="check" tone="green" title={o.todayRecord?.status??'Attendance pending'} detail="Today’s attendance"/>
            <Row icon="bus" tone="sky" title={route?.name??'Transport'} detail={transport?'Seat '+transport.seat:'No route assigned'}/>
          </div>
        </div>
        <div className="pd-actions"><Action primary icon="wallet" onClick={()=>setDialog('fees')}>Fee Details</Action><Action icon="chat" onClick={message}>Message Teacher</Action>
          <Action icon="file" onClick={report}>Report Card</Action><Action icon="bus" onClick={jump('pd-transport')}>Bus Details</Action>
          <Action icon="grid" onClick={()=>setDialog('timetable')}>Timetable</Action><Action icon="calendar" onClick={open('calendar',true)}>Meeting</Action>
          {parent&&<Action icon="clipboard" onClick={()=>setDialog('leave')}>Request Leave</Action>}</div>
      </section>
      <div className="pd-side">
        <div className="pd-summary-grid">
          {[
            ['Attendance',o.todayRecord?.status??'—','check',()=>setDialog('attendance')],['Homework',o.pending.length+' due','book',jump('pd-assignments')],
            ['Fees',money(due)+' due','wallet',()=>setDialog('fees')],['Next Exam',o.next?within(o.next.date,today)+' days':'—','cap',jump('pd-exams')],
            ['Event',upcoming[0]?.name??'—','calendar',jump('pd-agenda')],['Messages',unread.length+' new','chat',open('messages')],
          ].map(([label,value,icon,run],i)=><button type="button" className="pd-summary-card" key={label} onClick={run}>
            <Icon name={icon} tone={['green','gold','green','purple','sky','pink'][i]}/><small>{label}</small><strong>{value}</strong></button>)}
        </div>
        <section className="pd-panel pd-daily"><h3><Icon name="sparkle" tone="purple"/> Daily Summary</h3><p><b>{first}</b> {o.todayRecord?'was marked '+o.todayRecord.status.toLowerCase()+' today.':'has no attendance recorded today.'} {o.pending.length} assignment{o.pending.length===1?'':'s'} pending. {o.next?'Next exam: '+o.next.name+' on '+dayLabel(o.next.date)+'.':'No upcoming exam.'} <b>{money(due)}</b> outstanding. <b>{unread.length}</b> unread messages.</p></section>
      </div>
    </div>
    <Section caption="Family" title="My Children" icon="users" action={<Action icon="arrow" onClick={profile(child)}>Open profile</Action>}>
      <div className="pd-two">{children.map((row,i)=>{const info=overview(row);return <article className="pd-panel pd-child" key={row._id}>
        <div className="pd-child-header"><div className="pd-attendance-avatar" style={{'--pd-ring':(info.rate??0)+'%','--pd-color':i%2?'#1368d1':'#16b827'}}><HeroAvatar kind="student" name={row.name} demo={demo(row)}/><b>{show(info.rate)}</b></div>
          <div><h3>{row.name}</h3><small>{className(row)}</small>{info.todayRecord&&<span className={'pd-chip pd-'+(present(info.todayRecord)?'green':'red')}>{info.todayRecord.status} today</span>}</div><span className={'pd-chip pd-'+(info.pending.length?'gold':'green')}>{info.pending.length?info.pending.length+' HW':'No HW'}</span></div>
        <div className="pd-child-metrics">{[['Avg Marks',show(info.average)],['Attendance',show(info.rate)],['Assignments',info.pending.length],['Next Exam',info.next?within(info.next.date,today)+'d':'—']].map(([name,value])=><div key={name}><small>{name}</small><strong>{value}</strong></div>)}</div>
        <div className="pd-child-foot"><Action icon="grid" onClick={()=>{select(row._id);setDialog('timetable');}}>Timetable</Action><Action icon="arrow" onClick={profile(row)}>Details ›</Action></div>
      </article>;})}</div>
    </Section>
    <Section caption={first+' · Academic Health'} title="Subject Vitals" icon="arrow" action={<span className="pd-hint">Select More for results</span>}>
      <div className="pd-vitals">{subjects.map(row=>{
        const [icon,tone]=subjectTheme(row.name,row.score);
        const latest=row.rows.at(-1), previous=row.rows.at(-2);
        const change=latest&&previous?latest.score-previous.score:null;
        return <article key={row.id} className={'pd-panel pd-vital pd-'+tone}>
          <div className="pd-vital-body"><Icon name={icon} tone={tone}/><h3>{row.name}</h3><div className="pd-vital-score"><b>{row.score==null?'—':grade(row.score)}</b>
            {row.rows.length>1&&<svg role="img" aria-label="Recent exam scores" viewBox="0 0 72 28"><polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={row.rows.slice(-5).map((item,j,list)=>[2+j*68/(list.length-1),26-item.score*.24].join(',')).join(' ')}/></svg>}</div>
          <small className="pd-vital-trend">{change!=null?<><DashboardIcon name={change<0?'trendDown':change>0?'arrow':'minus'}/>{change>0?'+':''}{change} pp vs last exam</>:row.score==null?'Awaiting results':row.score<75?'Needs focus':show(row.score)+' average'}</small></div>
          <details><summary>More <DashboardIcon name="chevron"/></summary>
            {row.rows.slice(-4).reverse().map(item=><p key={item._id}>{item.exam.name} <strong>{show(item.score)}</strong></p>)}
            {!row.rows.length&&<Empty>No results published.</Empty>}</details>
        </article>;
      })}</div>{!subjects.length&&<div className="pd-panel"><Empty>No subjects assigned.</Empty></div>}
    </Section>
    <div className="pd-split">
      <Section caption="Student Activity" title={first+"'s Timeline"} icon="arrow"><div className="pd-panel pd-timeline">
        {timeline.map((row,i)=><article key={row.id} className={'pd-'+tones[i%tones.length]}><time dateTime={row.date}>{dayLabel(row.date)}</time><div><strong>{row.title}</strong><small>{row.detail}</small></div></article>)}
        {!timeline.length&&<Empty>No recent activity.</Empty>}</div></Section>
      <Section caption="Classroom Data" title="Parent Insights" icon="sparkle"><div className="pd-insights">
        {[
          ['Attendance Gaps',o.rate==null?null:100-o.rate,'calendar',o.rate==null?'Awaiting attendance records':show(o.rate)+' attendance recorded.'],
          ['Performance',o.average,'arrow','Average across published results.'],
          ['Reading Progress',null,'book',own('loans',child).filter(row=>row.status==='Returned').length+' books returned.'],
          ['Homework',percent(o.submissions.length,o.homework.length),'clipboard',o.pending.length+' assignments pending.'],
          ['Recent Exam Scores',o.average,'cap',o.next?'Review for '+o.next.name+'.':'No upcoming assessments.'],
          ['Course Activity',percent(subjects.filter(row=>row.rows.length>0).length,subjects.length),'users','Subjects with published results.'],
        ].map(([label,value,icon,description],i)=><article className={'pd-panel pd-'+tones[i]} key={label}><h3><Icon name={icon} tone={tones[i]}/>{label}</h3>
          <div className="pd-progress"><Meter value={value}/><strong>{show(value)}</strong></div><small>{description}</small></article>)}
      </div></Section>
    </div>
    <div className="pd-two">
      <Section caption="Inbox" title="Communication Hub" icon="chat" action={<Action icon="chat" onClick={open('messages')}>Inbox · {unread.length} unread</Action>}>
        <div className="pd-panel">{incoming.slice(0,4).map(row=><Row key={row._id} icon="chat" tone="pink" title={find('contacts',row.from)?.name??'School message'} detail={row.body} end={<button className="pd-inbox-time" aria-label="Open message and reply" onClick={open('messages',false,{to:row.from})}>{!row.read&&<i/>}{shortTime(row.createdAt)}</button>}/>)}
          {announcements.slice(0,3).map(row=><Row key={row._id} icon="megaphone" title={row.name} detail={row.body}/>)}
          {!incoming.length&&!announcements.length&&<Empty>No messages or announcements.</Empty>}</div>
      </Section>
      <div id="pd-transport"><Section caption="Transport" title="School Bus" icon="bus" action={transport&&<span className="pd-transport-status"><i/>Assigned</span>}><div className="pd-panel">
        {transport?<><div className="pd-stops">{stops.map((stop,i)=><span key={i} className={stop===transport.name?'pd-selected-stop':undefined}>{stop===transport.name&&<DashboardIcon name="bus"/>}{stop}</span>)}</div>
          <p className="pd-pickup">Pickup at <b>{transport.name}</b> · <strong>{transport.pickup}</strong></p><div className="pd-two pd-transport-facts"><Row icon="bus" title={[route?.vehicle,route?.name].filter(Boolean).join(' · ')||'Assigned bus'} detail={transport.name}/>
          <Row icon="users" tone="sky" title={route?.driver??'Driver'} detail={'Seat '+transport.seat}/><Row icon="time" tone="green" title={transport.pickup} detail="Pickup time"/>
          <Row icon="time" tone="gold" title={transport.drop} detail="Drop time"/></div></>:<Empty>No transport assignment on record.</Empty>}</div></Section></div>
    </div>
    <div id="pd-assignments"><Section caption={first+' · Homework'} title="Assignment Board" icon="grid" action={<Action icon="arrow" onClick={open('homework')}>Open homework</Action>}>
      <div className="pd-panel pd-board">{['To Do','In Progress','Submitted','Reviewed'].map((name,i)=>{
        const rows=o.homework.filter(row=>{const item=o.submissions.find(entry=>entry.homeworkId===row._id);return name===(item?.status==='Graded'?'Reviewed':item?.status==='Submitted'?'Submitted':item?'In Progress':'To Do');});
        return <div className={'pd-lane pd-'+['gold','blue','sky','green'][i]} key={name}><h3><i/>{name}<small>{rows.length}</small></h3>
          {rows.map(row=><article key={row._id}><span className="pd-chip"><DashboardIcon name={subjectTheme(find('subjects',row.subjectId)?.name??'')[0]}/>{find('subjects',row.subjectId)?.name??'Homework'}</span>
            <h4>{row.name}</h4><div className="pd-lane-meta">
              <small><DashboardIcon name={name==='Submitted'?'check':name==='Reviewed'?'chat':'users'}/>{name==='Reviewed'?'Reviewed':name==='Submitted'?'Submitted':find('teachers',schedule.find(item=>item.subjectId===row.subjectId)?.teacherId)?.name??'Class assignment'}</small>
              <small><DashboardIcon name="time"/>{dayLabel(name==='Submitted'?o.submissions.find(item=>item.homeworkId===row._id)?.date:row.due)}</small>
            </div>{name==='Reviewed'&&o.submissions.find(item=>item.homeworkId===row._id)?.notes&&<details><summary>Feedback</summary><small>{o.submissions.find(item=>item.homeworkId===row._id).notes}</small></details>}</article>)}
          {!rows.length&&<Empty>No assignments</Empty>}</div>;
      })}</div>
    </Section></div>
    <div className="pd-split pd-finance">
      <Section caption="Finance" title="Fee Timeline" icon="wallet" action={<Action primary icon="wallet" onClick={()=>setDialog('fees')}>View Balance</Action>}>
        <div className="pd-panel"><div className="pd-fee-banner"><small>Paid this year</small><strong>{money(paid)} <small>/ {money(sum(fees,'amount'))}</small></strong><div className="pd-fee-segments" aria-label="Fee balance distribution">{[paid,due-fees.filter(row=>row.due<today).reduce((n,row)=>n+balance(row),0),fees.filter(row=>row.due<today).reduce((n,row)=>n+balance(row),0)].map((amount,i)=>amount>0&&<i key={i} style={{flexGrow:amount,background:['#10a24c','#dd8200','#ea2451'][i]}}/>)}</div></div>
          {fees.filter(row=>balance(row)>0).slice(0,4).map(row=><Row key={row._id} icon="calendar" tone={row.due<today?'red':'gold'} title={row.name} detail={'Due '+dayLabel(row.due)} end={<span className="pd-fee-value"><b>{money(balance(row))}</b><span className={'pd-chip pd-'+(row.due<today?'red':'gold')}>{row.due<today?'Overdue':'Due'}</span></span>}/>)}
          {payments.slice(0,4).map(row=><Row key={row._id} icon="check" tone="green" title={find('fees',row.feeId)?.name??'Payment'} detail={'Paid '+dayLabel(row.date)+' · '+money(row.amount)} end={<span className="pd-fee-value"><b>{money(row.amount)}</b><Action icon="download" onClick={()=>download('receipt',[['Date','Amount','Fee'],[row.date,row.amount,find('fees',row.feeId)?.name]])}>Receipt</Action></span>}/>)}</div>
      </Section>
      <div id="pd-exams"><Section caption="Exams" title="Exam Hub" icon="cap" action={<Action icon="calendar" onClick={()=>setDialog('exams')}>Schedule</Action>}>
        <div className="pd-panel">{o.next?<div className="pd-exam-banner"><div className="pd-countdown">{[[Math.floor(examMinutes/1440),'Days'],[Math.floor(examMinutes/60)%24,'Hrs'],[examMinutes%60,'Min']].map(([n,unit])=><div key={unit}><strong>{String(n).padStart(2,'0')}</strong><small>{unit}</small></div>)}</div><div><b>{o.next.name}</b><small>{[dayLabel(o.next.date),o.next.room,o.next.start].filter(Boolean).join(' · ')}</small></div></div>:<Empty>No upcoming exam.</Empty>}
          <h3 className="pd-subheading">Subject Readiness</h3>{subjects.map(row=><div className="pd-ready pd-purple" key={row.id}><span>{row.name}</span><span className="pd-ready-dots" aria-hidden="true">{Array.from({length:5},(_,i)=><i key={i} className={i<Math.round((row.score??0)/20)?'filled':undefined}/>)}</span><strong>{show(row.score)}</strong></div>)}</div>
      </Section></div>
    </div>
    <Section caption="Recognition" title="Achievement Gallery" icon="medal"><div className="pd-panel pd-gallery">
      {[
        ['Academic Excellence','medal',o.average!=null&&o.average>=90?'90% average achieved':'Target · 90% average'],
        ['Attendance Star','calendar',o.rate===100?'Full recorded attendance':'Target · full attendance'],
        ['Assignment Finisher','clipboard',o.homework.length&&!o.pending.length?'All assignments submitted':'Target · submit all work'],
        ['Bookworm','book',own('loans',child).some(row=>row.status==='Returned')?'Returned a library book':'Target · return a book'],
        ['Top Subject','cap',subjects.filter(row=>row.score!=null).sort((a,b)=>b.score-a.score)[0]?.name??'Awaiting marks'],
        ['Exam Milestone','flag',o.marks.length+' results published'],
      ].map(([label,icon,detail],i)=><article key={label} tabIndex={0}><Icon name={icon} tone={["gold","green","purple","sky","blue","pink"][i]}/><strong>{label}</strong><small>{detail}</small></article>)}
    </div></Section>
    <div className="pd-two">
      <div id="pd-agenda"><Section caption="Agenda" title="What's Coming Up" icon="calendar" action={<Action icon="calendar" onClick={open('calendar')}>Calendar</Action>}>
        <div className="pd-panel">{['Today','This Week','Upcoming'].map((section,i)=>{
          const rows=agenda.filter(row=>i===0?row.date===today:i===1?row.date>today&&within(row.date,today)<=7:within(row.date,today)>7);
          return rows.length>0&&<div key={section}><h3 className="pd-subheading">{section}</h3>{rows.map(row=><article className={'pd-agenda-row pd-'+tones[(i+rows.indexOf(row))%tones.length]} key={row._id}><time dateTime={row.date}>{row.date===today&&row.start?row.start:dayLabel(row.date)}</time><div><strong>{row.name}</strong><small>{row.notes||'School event'}</small></div></article>)}</div>;
        })}{!agenda.length&&<Empty>No upcoming events.</Empty>}</div>
      </Section></div>
      <Section caption="Feed" title="Smart Notifications" icon="bell" action={<Action icon="check" onClick={markAll}>Mark all read</Action>}>
        <div className="pd-panel pd-feed">{['Today','Yesterday','Earlier'].map((group,i)=>{
          const prior=yesterday(today);
          const rows=notices.filter(row=>i===0?row.date===today:i===1?row.date===prior:row.date!==today&&row.date!==prior);
          return rows.length>0&&<section key={group}><h3 className="pd-subheading">{group}</h3>{rows.map(row=><Row key={row.id} icon={row.icon}
            tone={row.icon==='chat'?'pink':row.icon==='bell'?'red':'sky'} title={row.title} detail={row.detail} end={<small>{row.time||dayLabel(row.date)}</small>}/>)}</section>;
        })}{!notices.length&&<Empty>No new notifications.</Empty>}</div>
      </Section>
    </div>
    </>}
    {dialog&&child&&<div className="overlay"><section className="modal pd-dialog" role="dialog" aria-modal="true" aria-label="Parent dashboard details">
      {dialog==='leave'?<form onSubmit={requestLeave}><h2>Request Leave</h2><p>{child.name}</p><label>Leave date<input name="date" type="date" min={today} defaultValue={today} required/></label><label>Reason<input name="reason" required maxLength={200}/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>Send Request</button></form>:
        <><h2>{{fees:'Fee Balance',timetable:'Timetable',attendance:'Attendance',exams:'Exam Schedule'}[dialog]}</h2>
          {dialog==='fees'?<>{fees.map(row=><Row key={row._id} icon="wallet" title={row.name} detail={'Due '+dayLabel(row.due)+' · '+money(balance(row))}/>)}
          <p className="muted">Contact the school office to arrange payment.</p></>:
          dialog==='timetable'?schedule.map(row=><Row key={row._id} icon="calendar" title={find('subjects',row.subjectId)?.name??row.name} detail={[row.day,row.start,row.room].filter(Boolean).join(' · ')}/>):
          dialog==='attendance'?[...o.attendance].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(row=><Row key={row._id} icon="check" title={row.status} detail={dayLabel(row.date)}/>):
          o.exams.filter(row=>row.date>=today).map(row=><Row key={row._id} icon="cap" title={row.name} detail={dayLabel(row.date)}/>)}</>}
      <button type="button" disabled={busy} onClick={()=>{setDialog('');setError('');}}>Close</button>
    </section></div>}
  </div>;
}
