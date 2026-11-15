import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { Icon, IconButton, Person } from './workspace-ui.jsx';

const endpoint = 'workspace/calls';
const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

async function description(peer, type) {
  await peer.setLocalDescription(type === 'offer' ? await peer.createOffer() : await peer.createAnswer());
  if (peer.iceGatheringState !== 'complete') {
    await new Promise(resolve => {
      const finish = () => {
        clearTimeout(timer);
        peer.removeEventListener('icegatheringstatechange', check);
        resolve();
      };
      const check = () => { if (peer.iceGatheringState === 'complete') finish(); };
      const timer = setTimeout(finish, 7000);
      peer.addEventListener('icegatheringstatechange', check);
      check();
    });
  }
  return peer.localDescription.sdp;
}

function Participant({ name, stream, local, camera, connected }) {
  const video = useRef(null);
  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream, camera]);
  return <div className="wa-call-person">
    <div className={'wa-call-portrait' + (connected ? ' is-connected' : '')}>
      <Person name={name} />
      {stream && <video ref={video} autoPlay playsInline muted={local} className={camera ? '' : 'wa-audio-only'} />}
      <span className="wa-call-glyph"><Icon name={camera ? 'video' : 'mic'} /></span>
    </div>
    <strong>{name}</strong>
  </div>;
}

export default function WorkspaceCall({ user, contacts, target, go }) {
  const [contact, setContact] = useState(target?.to ?? '');
  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState([]);
  const [connection, setConnection] = useState('idle');
  const [error, setError] = useState('');
  const [local, setLocal] = useState(null);
  const [remote, setRemote] = useState(null);
  const [camera, setCamera] = useState(false);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(null);
  const [now, setNow] = useState(Date.now);
  const current = useRef({});
  const recipient = contacts.find(item => item._id === contact);

  function release() {
    const { peer, stream } = current.current;
    if (peer) {
      peer.onconnectionstatechange = null;
      peer.ontrack = null;
      peer.close();
    }
    stream?.getTracks().forEach(track => track.stop());
    current.current = {};
  }
  useEffect(() => () => {
    const id = current.current.id;
    release();
    if (id) void api(endpoint + '/' + id + '/end', 'POST', {}).catch(() => {});
  }, []);

  function reset() {
    release();
    setCall(null);
    setLocal(null);
    setRemote(null);
    setStarted(null);
    setCamera(false);
    setMuted(false);
    setConnection('idle');
  }

  useEffect(() => {
    let active = true;
    async function poll() {
      if (current.current.polling) return;
      const transaction = current.current;
      transaction.polling = true;
      try {
        if (!call) {
          if (connection !== 'idle') return;
          const requests = await api(endpoint);
          if (active && current.current === transaction) setIncoming(requests);
          return;
        }
        const status = await api(endpoint + '/' + call.id);
        if (!active || current.current !== transaction) return;
        if (status.ended || (!status.answer && Date.now() - new Date(status.createdAt).getTime() > 120000)) {
          setError(status.ended ? 'Call ended.' : 'The call was not answered.');
          if (!status.ended) void api(endpoint + '/' + call.id + '/end', 'POST', {}).catch(() => {});
          reset();
          return;
        }
        if (status.answer && call.from === user.id && !transaction.peer.remoteDescription) {
          await transaction.peer.setRemoteDescription({ type: 'answer', sdp: status.answer });
        }
      } catch (err) {
        if (active && current.current === transaction) {
          setError(err.message);
          if (err.status === 404 && call) reset();
        }
      } finally { transaction.polling = false; }
    }
    void poll();
    const timer = setInterval(poll, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [call, connection, user.id]);

  useEffect(() => {
    if (!started) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [started]);

  async function connect(pending, video = false) {
    if (connection !== 'idle' || (!pending && !contact)) return;
    setError('');
    setConnection('preparing');
    const transaction = current.current = {};
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Calls require browser media access over HTTPS or localhost.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      if (current.current !== transaction) { stream.getTracks().forEach(track => track.stop()); return; }
      transaction.stream = stream;
      const peer = transaction.peer = new RTCPeerConnection({ iceServers });
      peer.ontrack = event => setRemote(event.streams[0]);
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') {
          setNow(Date.now());
          setStarted(previous => previous ?? Date.now());
          setConnection('connected');
        }
        if (peer.connectionState === 'failed') {
          setConnection('failed');
          setError('The two browsers could not establish a media connection.');
        }
      };
      if (pending) {
        const request = await api(endpoint + '/' + pending.id);
        if (current.current !== transaction) return;
        if (request.ended) throw new Error('The caller has ended the call.');
        transaction.id = pending.id;
        await peer.setRemoteDescription({ type: 'offer', sdp: request.offer });
        setContact(request.from);
      }
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      setLocal(stream);
      setCamera(video);
      const sdp = await description(peer, pending ? 'answer' : 'offer');
      if (current.current !== transaction) return;
      const row = pending ? await api(endpoint + '/' + pending.id + '/answer', 'POST', { answer: sdp })
        : await api(endpoint, 'POST', { to: contact, offer: sdp });
      if (current.current !== transaction) {
        void api(endpoint + '/' + row.id + '/end', 'POST', {}).catch(() => {});
        return;
      }
      transaction.id = row.id;
      setCall(row);
      setConnection(previous => previous === 'connected' ? previous : 'waiting');
    } catch (err) {
      if (current.current !== transaction) return;
      reset();
      setError(err.message);
    }
  }

  function hangUp() {
    const id = current.current.id;
    reset();
    setError('');
    if (id) void api(endpoint + '/' + id + '/end', 'POST', {}).catch(err => setError(err.message));
  }

  const seconds = started ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  const elapsed = [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2,'0')).join(':');
  const status = { idle: 'Ready to call', preparing: 'Connecting devices…', waiting: 'Waiting for connection…', connected: elapsed, failed: 'Connection failed' }[connection];
  return <section className="wa-call wa-surface" aria-label="Call">
    <div className="wa-call-stage">
      <span className="wa-call-timer" role="status"><i />{status}</span>
      <div className="wa-call-people">
        <Participant name={user.name} stream={local} local camera={camera} connected={connection === 'connected'} />
        {recipient ? <Participant name={recipient.name} stream={remote} camera={Boolean(remote?.getVideoTracks().length)} />
          : <div className="wa-call-person"><div className="wa-call-portrait wa-call-placeholder"><Icon name="users" /></div><strong>Choose a contact</strong></div>}
      </div>
      <IconButton icon="chat" label="Open chat" className="primary wa-call-chat" disabled={connection !== 'idle'}
        onClick={() => go('messages', false, { to: contact })} />
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {connection === 'idle' ? <div className="wa-call-controls">
      {incoming.map(request => <div className="wa-incoming" key={request.id}>
        <strong>{contacts.find(item => item._id === request.from)?.name ?? 'School contact'} is calling</strong>
        <button type="button" onClick={async () => {
          try { await api(endpoint + '/' + request.id + '/end', 'POST', {}); setIncoming(previous => previous.filter(item => item.id !== request.id)); }
          catch (err) { setError(err.message); }
        }}>Decline</button>
        <button type="button" className="primary" onClick={() => connect(request)}>Accept audio</button>
        <button type="button" onClick={() => connect(request, true)}>Accept video</button>
      </div>)}
      <select aria-label="Call contact" value={contact} onChange={event => setContact(event.target.value)}>
        <option value="">Choose a school contact</option>{contacts.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}
      </select>
      <IconButton icon="phone" label="Start audio call" className="primary" disabled={!contact} onClick={() => connect(null)}>Audio call</IconButton>
      <IconButton icon="video" label="Start video call" disabled={!contact} onClick={() => connect(null, true)}>Video call</IconButton>
    </div> : <div className="wa-call-controls">
      <IconButton icon="mic" label={muted ? 'Unmute' : 'Mute'} disabled={!local} aria-pressed={muted} onClick={() => {
        local.getAudioTracks().forEach(track => { track.enabled = muted; }); setMuted(!muted);
      }} />
      <IconButton icon="end" label="End call" className="wa-hangup" onClick={hangUp} />
      <IconButton icon="video" label={camera ? 'Turn camera off' : 'Turn camera on'} disabled={!local?.getVideoTracks().length} aria-pressed={camera} onClick={() => {
        local.getVideoTracks().forEach(track => { track.enabled = !camera; }); setCamera(!camera);
      }} />
    </div>}
  </section>;
}
