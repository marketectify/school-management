import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { Dialog, Icon, IconButton, PageTitle, Person, csvDownload, localDay, showDate, usePreferences } from './workspace-ui.jsx';

const tones = ['blue','green','red','gold','purple'];
const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const defaults = ['My Event One','My Event Two','My Event Three','My Event Four'];
function addDays(value, count) {
  const result = new Date(value);
  result.setDate(result.getDate() + count);
  return result;
}

export function CalendarApp({ user, rows, loading, error, edit }) {
  const [focus, setFocus] = useState(() => new Date());
  const [mode, setMode] = useState('Month');
  const [categories, setCategories] = usePreferences(user, 'calendar-categories', defaults);
  const [removeAfter, setRemoveAfter] = useState(false);
  const [add, setAdd] = useState(false);
  const [selected, setSelected] = useState('');
  const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const start = mode === 'Month' ? addDays(first, -first.getDay()) : mode === 'Week' ? addDays(focus, -focus.getDay()) : focus;
  const period = mode === 'Month' ? Math.ceil((first.getDay() + new Date(focus.getFullYear(),focus.getMonth() + 1,0).getDate()) / 7) * 7 : mode === 'Week' ? 7 : 1;
  const title = focus.toLocaleDateString(undefined, { month:'long', year:'numeric', ...(mode === 'Day' ? { day:'numeric' } : {}) });
  function step(delta) {
    setFocus(previous => mode === 'Month' ? new Date(previous.getFullYear(),previous.getMonth() + delta,1)
      : addDays(previous,mode === 'Week' ? delta * 7 : delta));
  }
  function create(day, name) {
    if (!name || !categories.includes(name)) return edit({ date:day, start:'09:00' });
    edit({ date:day, start:'09:00', name });
    if (removeAfter) setCategories(previous => previous.filter(item => item !== name));
    setSelected('');
  }
  return <div className="wa-app">
    <PageTitle title="Calendar"><IconButton icon="plus" label="Create Event" className="primary" onClick={() => edit({ date:localDay(focus), start:'09:00' })}>Create Event</IconButton></PageTitle>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="wa-split">
      <div className="wa-calendar-sidebar">
        <h2>Drag &amp; Drop Event</h2>
        {categories.map((name, index) => <button type="button" key={name} draggable aria-pressed={selected === name}
          onDragStart={event => event.dataTransfer.setData('text/plain', name)} onClick={() => setSelected(selected === name ? '' : name)}>
          <span className={'wa-dot wa-' + tones[index % tones.length]} />{name}
        </button>)}
        <label className="wa-checkbox"><input type="checkbox" checked={removeAfter} onChange={event => setRemoveAfter(event.target.checked)} />Remove after drop</label>
        <IconButton icon="plus" label="Add Category" className="primary wa-wide" onClick={() => setAdd(true)}>Add Category</IconButton>
      </div>
      <section className="wa-surface wa-calendar-panel" aria-label={mode + ' calendar'} aria-busy={loading}>
        <div className="wa-calendar-bar"><div className="wa-actions"><button type="button" className="primary" onClick={() => setFocus(new Date())}>Today</button>
          <IconButton icon="back" label="Previous period" onClick={() => step(-1)} /><IconButton icon="next" label="Next period" onClick={() => step(1)} /></div>
          <h2>{title}</h2><div className="wa-actions">{['Month','Week','Day'].map(view => <button key={view} type="button"
            aria-pressed={view === mode} onClick={() => setMode(view)}>{view}</button>)}</div></div>
        <div className="wa-calendar-scroll"><div className={'wa-calendar-grid' + (mode === 'Day' ? ' daily' : '')}>
          {(mode === 'Day' ? [weekdays[focus.getDay()]] : weekdays).map(day => <div className="wa-weekday" key={day}>{day}</div>)}
          {Array.from({ length:period }, (_, index) => {
            const date = addDays(start,index);
            const day = localDay(date);
            return <div className={'wa-day' + (day === localDay() ? ' today' : '') + (mode === 'Month' && date.getMonth() !== focus.getMonth() ? ' muted-day' : '')}
              key={day} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); create(day,event.dataTransfer.getData('text/plain')); }}>
              <button className="wa-date" type="button" aria-label={'Create event on ' + showDate(day)} onClick={() => create(day,selected)}>{date.getDate()}</button>
              {rows.filter(row => row.date === day).sort((a,b) => a.start.localeCompare(b.start)).map((row,i) =>
                <button type="button" key={row._id} title={row.start + ' · ' + row.name} className={'wa-event wa-' + tones[i % tones.length]}
                  onClick={() => edit(row)}>{row.start} {row.name}</button>)}
            </div>;
          })}
        </div></div>
      </section>
    </div>
    {add && <Dialog title="Add category" close={() => setAdd(false)}><form onSubmit={event => {
      event.preventDefault();
      const value = new FormData(event.currentTarget).get('name').trim();
      if (value) setCategories(previous => [...new Set([...previous,value])]);
      setAdd(false);
    }}><label>Event category<input name="name" required maxLength={120} /></label><button className="primary">Save category</button></form></Dialog>}
  </div>;
}

const labels = {
  todos: ['Todo','Add Task','Todo List','Inbox'],
  notes: ['Notes','Add Notes','Notes','All Notes'],
  files: ['File Manager','New','Files','My Files'],
};
const railIcons = { Done:'check', Important:'star', Trash:'trash', Favourites:'star', Archived:'shield', Deleted:'trash', Recent:'time' };
const fileKinds = [['Folders','folder','blue'],['PDF','file','red'],['Images','image','green'],['Videos','video','red'],['Audios','audio','blue']];
const fileURL = row => '/api/workspace/files/' + row._id;
const priorityTone = { High:'red', Medium:'gold', Low:'blue' };
const statusTone = { Pending:'blue', Done:'green', New:'purple', 'In Progress':'gold', 'On Hold':'red' };
const blankMeta = { important: false, folder: '', status: '' };
const byDate = row => row.due || row.updatedAt?.slice(0,10) || row.createdAt?.slice(0,10) || '';
const fileSize = bytes => bytes === undefined ? '—' : bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.ceil(bytes / 1024) + ' KB';
function getKind(row) {
  if (row.folder) return 'Folders';
  const value = (row.link || row.name).split(/[?#]/)[0];
  if (row.type === 'application/pdf' || /\.pdf$/i.test(value)) return 'PDF';
  if (row.type?.startsWith('image/') || /\.(png|gif|jpe?g|webp)$/i.test(value)) return 'Images';
  if (row.type?.startsWith('video/') || /\.(mp4|webm)$/i.test(value)) return 'Videos';
  if (row.type?.startsWith('audio/') || /\.(mp3|wav)$/i.test(value)) return 'Audios';
  return 'Documents';
}
function externalUrl(value) {
  try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}
function groupDate(value) {
  if (value === localDay()) return 'Today';
  if (value === localDay(addDays(new Date(), -1))) return 'Yesterday';
  return showDate(value);
}

export function PersonalApp({ module, user, rows, error, loading, reload, edit, update, remove }) {
  const [title, addLabel, railTitle, home] = labels[module];
  const isFiles = module === 'files';
  const isTasks = module === 'todos';
  const [prefs, setPrefs] = usePreferences(user, module, { metadata: {}, folders: [] });
  const [uploads, setUploads] = useState([]);
  const [folder, setFolder] = useState(home);
  const [kind, setKind] = useState('');
  const [priority, setPriority] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('recent');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState({ from:'', to:'' });
  const [selection, setSelection] = useState([]);
  const [bulk, setBulk] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [options, setOptions] = useState('');
  const [folded, setFolded] = useState({});
  const meta = id => prefs.metadata[id] ?? blankMeta;
  const status = row => row.status === 'Done' ? 'Done' : meta(row._id).status || row.status || 'New';
  const all = isFiles ? [...uploads.map(row => ({ ...row, uploaded:true })), ...rows, ...prefs.folders] : rows;
  const clear = () => { setSelection([]); setOptions(''); };
  const isTrash = folder === 'Trash' || folder === 'Deleted';
  const listed = all.filter(row => {
    const entry = meta(row._id);
    const inFolder = isTrash ? entry.folder === 'trash' : entry.folder !== 'trash' &&
      (folder === 'Archived' ? entry.folder === 'archive' : entry.folder !== 'archive') &&
      (!['Important','Favourites'].includes(folder) || entry.important) && (folder !== 'Done' || status(row) === 'Done') && (!isTasks || folder !== home || status(row) !== 'Done');
    return inFolder && (!kind || getKind(row) === kind) && (!priority || row.priority === priority) &&
      (!tag || status(row) === tag) && (!range.from || byDate(row) >= range.from) && (!range.to || byDate(row) <= range.to) &&
      row.name.toLowerCase().includes(query.trim().toLowerCase());
  }).sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name) : byDate(b).localeCompare(byDate(a)));
  const groups = new Map();
  if (isTasks) for (const row of listed) {
    const key = row.due;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  function patch(ids, fields) {
    setPrefs(previous => ({ ...previous, metadata: { ...previous.metadata,
      ...Object.fromEntries(ids.map(id => [id, { ...blankMeta, ...previous.metadata[id], ...fields }])) } }));
  }
  async function loadUploads() {
    try { setUploads(await api('workspace/files')); }
    catch (err) { setNotice(err.message); }
  }
  useEffect(() => { if (isFiles) void loadUploads(); }, [isFiles]);
  const refresh = () => { setNotice(''); reload(); if (isFiles) void loadUploads(); };
  async function action(name, ids) {
    setNotice('');
    setBusy(true);
    try {
      if (name === 'done' || name === 'pending') {
        for (const row of all.filter(item => ids.includes(item._id))) {
          await update(row, { status: name === 'done' ? 'Done' : 'Pending' });
          patch([row._id], { status:'' });
        }
      } else if (name === 'important') patch(ids, { important:true });
      else patch(ids, { folder:name === 'restore' ? '' : name });
      clear(); setBulk('');
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }
  const quick = row => <div className="wa-row-options">
    <IconButton icon="star" label="Toggle favourite" className="wa-star" aria-pressed={meta(row._id).important} onClick={() => patch([row._id],{ important:!meta(row._id).important })} />
    <IconButton icon="more" label={'Actions for ' + row.name} aria-expanded={options === row._id} onClick={() => setOptions(options === row._id ? '' : row._id)} />
    {options === row._id && <div className="wa-row-menu"><button type="button" onClick={() => { clear(); setDialog({ row }); }}>Details</button>
      {!row.uploaded && !row.folder && <button type="button" onClick={() => { clear(); edit(row); }}>Edit</button>}
      {isTasks && !isTrash && <><button type="button" onClick={() => action(status(row) === 'Done' ? 'pending' : 'done',[row._id])}>{status(row) === 'Done' ? 'Reopen' : 'Mark done'}</button>
        {['In Progress','On Hold'].map(label => <button type="button" key={label} onClick={async () => {
          try {
            if (status(row) === 'Done') await update(row, { status:'Pending' });
            patch([row._id], { status:label }); clear();
          } catch (err) { setNotice(err.message); }
        }}>{label}</button>)}</>}
      {isFiles && !isTrash && <button type="button" onClick={() => action(folder === 'Archived' ? 'restore' : 'archive',[row._id])}>{folder === 'Archived' ? 'Unarchive' : 'Archive'}</button>}
      <button type="button" onClick={() => action(isTrash ? 'restore' : 'trash',[row._id])}>{isTrash ? 'Restore' : 'Move to trash'}</button>
      {isTrash && <button type="button" className="danger" onClick={async () => {
        clear();
        try {
          if (row.uploaded) {
            if (!window.confirm('Permanently delete this file?')) return;
            await api('workspace/files/' + row._id, 'DELETE'); await loadUploads();
          } else if (row.folder) setPrefs(previous => ({ ...previous, folders:previous.folders.filter(item => item._id !== row._id) }));
          else await remove(row);
        } catch (err) { setNotice(err.message); }
      }}>Delete permanently</button>}
    </div>}
  </div>;
  const checkbox = row => <input type="checkbox" aria-label={'Select ' + row.name} checked={selection.includes(row._id)} onChange={event =>
    setSelection(previous => event.target.checked ? [...previous,row._id] : previous.filter(id => id !== row._id))} />;
  const rail = isFiles ? [home,'Recent','Favourites','Archived','Deleted'] : isTasks ? [home,'Done','Important','Trash'] : [home,'Important','Trash'];
  const download = () => csvDownload(title.toLowerCase().replaceAll(' ','-') + '.csv',
    [['Name','Date','Status','Priority','Details'], ...listed.map(row => [row.name,byDate(row),status(row),row.priority,row.notes || row.body || row.link])]);
  async function upload(event) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('file');
    if (!file?.size || file.size > 2097152) { setNotice('Choose a file up to 2 MB.'); return; }
    setBusy(true); setNotice('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i,i + 8192));
      await api('workspace/files','POST',{ name:file.name, type:file.type, content:btoa(binary) });
      setDialog(null); await loadUploads();
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }
  const contentCard = (row, icon) => <article className="wa-surface wa-record-card" key={row._id}>
    {row.uploaded && ['Videos','Images'].includes(getKind(row)) && <button className="wa-thumbnail" type="button" aria-label={'Preview ' + row.name} onClick={() => setDialog({ row })}>
      {getKind(row) === 'Videos' ? <><video muted preload="metadata" src={fileURL(row) + '?preview=1#t=0.2'} /><span><Icon name="play" /></span></> :
        <img alt="" src={fileURL(row) + '?preview=1'} />}
    </button>}
    <div className="wa-card-meta">{checkbox(row)}{row.priority && <span className={'wa-tag wa-' + priorityTone[row.priority]}>{row.priority}</span>}{quick(row)}</div>
    <button type="button" className="wa-text-button" onClick={() => setDialog({ row })}>{icon && <Icon name={icon} />}{row.name}</button>
    <small><Icon name="calendar" />{showDate(byDate(row))}</small>
    {row.body && <p>{row.body}</p>}
  </article>;
  return <div className={'wa-app wa-personal wa-' + module}>
    <PageTitle title={title}><IconButton icon="refresh" label="Refresh" onClick={refresh} /><IconButton icon="print" label="Print" onClick={() => window.print()} />
      <IconButton icon="download" label="Export CSV" onClick={download}>Export</IconButton>
      {!isFiles && <IconButton icon="plus" label={addLabel} className="primary" onClick={() => edit(isTasks ? { due:localDay(), status:'Pending', priority:'Medium' } : { priority:'Medium' })}>{addLabel}</IconButton>}
    </PageTitle>
    {(error || (notice && !dialog)) && <p className="error" role="alert">{error || notice}</p>}
    {!isFiles && !isTasks && <div className="wa-note-stats">{[
      ['Total Notes',all.filter(row => meta(row._id).folder !== 'trash').length,'blue','file'],
      ['Important',all.filter(row => meta(row._id).important && meta(row._id).folder !== 'trash').length,'green','star'],
      ['In Progress',all.filter(row => status(row) === 'In Progress' && meta(row._id).folder !== 'trash').length,'gold','time'],
      ['Trash',all.filter(row => meta(row._id).folder === 'trash').length,'purple','trash'],
    ].map(([label,count,tone,icon]) => <article key={label} className="wa-surface"><span className={'wa-tile wa-' + tone}><Icon name={icon} /></span>
      <span><strong>{count}</strong><small>{label}</small></span></article>)}</div>}
    <div className="wa-split">
      <div className="wa-surface wa-side-panel">
        <h2><Icon name={isFiles ? 'folder' : 'file'} />{railTitle}</h2>
        {isFiles && <IconButton icon="plus" label="New" className="primary wa-wide" onClick={() => { setNotice(''); setDialog({ create:'upload' }); }}>New</IconButton>}
        <nav className="wa-rail" aria-label={title + ' folders'}>{rail.map(label => <IconButton key={label} icon={railIcons[label] ?? 'download'} label={label} aria-pressed={folder === label}
          onClick={() => { setFolder(label); setKind(''); setTag(''); setPriority(''); clear(); }}>{label}</IconButton>)}</nav>
        {!isFiles && <>{[['Tags',['Pending','On Hold','In Progress','Done'],tag,setTag,statusTone],['Priority',['Medium','High','Low'],priority,setPriority,priorityTone]].map(([key,values,active,set,palette]) =>
          <div className="wa-side-group" key={key}><h3>{key}</h3>{values.map(value => <button type="button" aria-pressed={value === active} key={value}
            onClick={() => { set(value === active ? '' : value); clear(); }}><i className={'wa-dot wa-' + palette[value]} />{value}</button>)}</div>)}</>}
      </div>
      <div className="wa-work-list" aria-busy={loading || busy}>
        <div className="wa-toolbar wa-list-toolbar">
          <select aria-label="Bulk Actions" value={bulk} onChange={event => setBulk(event.target.value)}><option value="">Bulk Actions</option>
            {isTasks && <option value="done">Mark done</option>}<option value="important">Mark important</option>
            <option value={isTrash ? 'restore' : 'trash'}>{isTrash ? 'Restore' : 'Move to trash'}</option></select>
          <button type="button" disabled={!selection.length || !bulk || busy} onClick={() => action(bulk,selection)}>Apply</button>
          <input aria-label={'Search ' + title} placeholder={'Search ' + title.toLowerCase() + '…'} value={query} onChange={event => { setQuery(event.target.value); clear(); }} />
          <select className="wa-toolbar-end" aria-label="Sort" value={sort} onChange={event => setSort(event.target.value)}>
            <option value="recent">Recent</option><option value="name">Sort by A–Z</option>
          </select>
        </div>
        {isFiles && <>
          <h2 className="wa-section-heading">Overview</h2>
          <div className="wa-file-overview">{fileKinds.map(([name,icon,tone]) => <button type="button" key={name} aria-pressed={kind === name} onClick={() => { setKind(kind === name ? '' : name); clear(); }}>
            <span className={'wa-file-illustration wa-' + tone}><Icon name={icon} /></span>
            <span><strong>{name}</strong><small>{all.filter(row => getKind(row) === name && !meta(row._id).folder).length} {name === 'Folders' ? 'folders' : 'files'}</small></span>
          </button>)}</div>
          {['Folders','Documents','Videos'].map(section => {
            const cards = listed.filter(row => section === 'Documents' ? ['PDF','Documents'].includes(getKind(row)) : getKind(row) === section).slice(0,3);
            return cards.length > 0 && <div className="wa-file-shelf" key={section}><h2>{section === 'Documents' ? 'Files' : section}</h2>
              <div className="wa-card-grid">{cards.map(row => contentCard(row,section === 'Folders' ? 'folder' : section === 'Videos' ? 'video' : 'file'))}</div></div>;
          })}
          <section className="wa-surface wa-file-table">
            <div className="wa-file-heading"><h2>All Files</h2><label>From<input aria-label="Modified from" type="date" value={range.from} onChange={event => { setRange({ ...range, from:event.target.value }); clear(); }} /></label>
              <label>To<input aria-label="Modified to" type="date" value={range.to} onChange={event => { setRange({ ...range, to:event.target.value }); clear(); }} /></label></div>
            <div className="wa-table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Select all files" checked={listed.length > 0 && listed.every(row => selection.includes(row._id))}
              onChange={event => setSelection(event.target.checked ? listed.map(row => row._id) : [])} /></th><th>Name</th><th>Last Modified</th><th>Size</th><th>Owner</th><th>Action</th></tr></thead>
              <tbody>{listed.map(row => <tr key={row._id}><td>{checkbox(row)}</td><td><button type="button" className="wa-text-button" onClick={() => setDialog({ row })}>
                <Icon name={fileKinds.find(([name]) => name === getKind(row))?.[1] ?? 'file'} />{row.name}</button></td>
                <td>{showDate(byDate(row))}</td><td>{fileSize(row.size)}</td><td><span className="wa-owner"><Person name={user.name} size="small" />{user.name}</span></td><td>{quick(row)}</td></tr>)}</tbody>
            </table></div>{!listed.length && <p className="wa-empty">{loading ? 'Loading files…' : 'No files in this view.'}</p>}
          </section>
        </>}
        {!isFiles && !isTasks && <><h2 className="wa-section-heading">{folder}</h2><div className="wa-card-grid">{listed.map(row => contentCard(row))}</div></>}
        {isTasks && [...groups].map(([day,tasks]) => <section className="wa-task-group" key={day}>
          <IconButton icon="calendar" label={groupDate(day)} className="wa-task-date" aria-expanded={!folded[day]} onClick={() => setFolded(previous => ({ ...previous, [day]: !previous[day] }))}>
            {groupDate(day)} <b>{tasks.length}</b><Icon name="chevron" />
          </IconButton>
          {!folded[day] && tasks.map(row => <article key={row._id} className="wa-surface wa-task-row">{checkbox(row)}
            <div><button type="button" className="wa-text-button" onClick={() => edit(row)}>{row.name}</button><p>{row.notes}</p></div>
            <span className={'wa-tag wa-' + priorityTone[row.priority]}>{row.priority}</span><span className={'wa-tag wa-' + statusTone[status(row)]}>{status(row)}</span>{quick(row)}
          </article>)}
        </section>)}
        {!isFiles && !listed.length && <p className="wa-surface wa-empty">{loading ? 'Loading…' : 'No records in this view.'}</p>}
      </div>
    </div>
    {dialog?.create && <Dialog title="Add to File Manager" close={() => { if (!busy) setDialog(null); }}>
      <div className="wa-actions wa-file-choices">{[['upload','Upload file'],['folder','New folder'],['link','Add link']].map(([key,label]) => <button type="button"
        key={key} aria-pressed={key === dialog.create} onClick={() => { setNotice(''); if (key === 'link') { setDialog(null); edit({}); } else setDialog({ create:key }); }}>{label}</button>)}</div>
      {dialog.create === 'upload' ? <form onSubmit={upload}><label>File (up to 2 MB)<input type="file" name="file" required /></label>
        {notice && <p className="error" role="alert">{notice}</p>}<button className="primary" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button></form>
        : <form onSubmit={event => {
          event.preventDefault();
          const name = new FormData(event.currentTarget).get('name').trim();
          if (!name) return;
          const id = 'folder-' + Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8,'0')).join('');
          setPrefs(previous => ({ ...previous, folders:[...previous.folders,{ _id:id, name, folder:true, updatedAt:new Date().toISOString() }] }));
          setDialog(null);
        }}><label>Folder name<input name="name" required maxLength={160} /></label><button className="primary">Create folder</button></form>}
    </Dialog>}
    {dialog?.row && <Dialog title={dialog.row.name} close={() => setDialog(null)}>
      <p className="muted">{showDate(byDate(dialog.row))}</p>
      <p className="wa-mail-body">{dialog.row.body || dialog.row.notes}</p>
      {dialog.row.uploaded && <>
        {getKind(dialog.row) === 'Images' && <img className="wa-file-preview" src={fileURL(dialog.row) + '?preview=1'} alt={dialog.row.name} />}
        {getKind(dialog.row) === 'Videos' && <video className="wa-file-preview" controls src={fileURL(dialog.row) + '?preview=1'} />}
        {getKind(dialog.row) === 'Audios' && <audio controls src={fileURL(dialog.row) + '?preview=1'} />}
        <a href={fileURL(dialog.row)}>Download file</a>
      </>}
      {externalUrl(dialog.row.link) && <a href={externalUrl(dialog.row.link)} target="_blank" rel="noreferrer">Open document</a>}
      {dialog.row.folder && <><label>Files in this folder<select aria-label="Add file to folder" value="" onChange={event => patch([event.target.value],{ parent:dialog.row._id })}>
        <option value="">Add a file</option>{all.filter(row => !row.folder && meta(row._id).folder !== 'trash' && meta(row._id).parent !== dialog.row._id)
          .map(row => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>
        {all.filter(row => meta(row._id).parent === dialog.row._id && meta(row._id).folder !== 'trash').map(row => <p key={row._id}>
          <button type="button" onClick={() => setDialog({ row })}>{row.name}</button>
          <IconButton icon="close" label={'Remove ' + row.name + ' from folder'} onClick={() => patch([row._id],{ parent:'' })} /></p>)}</>}
      {module === 'notes' && <label>Status<select value={status(dialog.row)} onChange={event => patch([dialog.row._id],{ status:event.target.value })}>
        {['New','Pending','On Hold','In Progress','Done'].map(value => <option key={value}>{value}</option>)}</select></label>}
    </Dialog>}
  </div>;
}
