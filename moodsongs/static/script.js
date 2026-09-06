/* ═══════════════════════════════════════════════════════════
   Moodsongs — Frontend JS
   Face detection: face-api.js (browser-native neural network)
   Music preview:  iTunes Search API (free)
   ═══════════════════════════════════════════════════════════ */

const EMOTIONS = [
  { id:'happy',    icon:'😄', label:'Happy',    desc:'Upbeat & joyful',     grad:'linear-gradient(135deg,rgba(250,204,21,.18),rgba(249,115,22,.12))' },
  { id:'romantic', icon:'🥰', label:'Romantic', desc:'Love & longing',      grad:'linear-gradient(135deg,rgba(236,72,153,.18),rgba(244,114,182,.12))' },
  { id:'sad',      icon:'😢', label:'Sad',      desc:'Melancholic & deep',  grad:'linear-gradient(135deg,rgba(99,102,241,.18),rgba(59,130,246,.12))' },
  { id:'energetic',icon:'⚡', label:'Energetic',desc:'High-energy & hype',  grad:'linear-gradient(135deg,rgba(16,185,129,.18),rgba(20,184,166,.12))' },
  { id:'calm',     icon:'😌', label:'Calm',     desc:'Peaceful & soothing', grad:'linear-gradient(135deg,rgba(20,184,166,.18),rgba(99,102,241,.12))' },
  { id:'angry',    icon:'😤', label:'Angry',    desc:'Intense & powerful',  grad:'linear-gradient(135deg,rgba(239,68,68,.18),rgba(249,115,22,.12))' },
  { id:'relaxed',  icon:'😴', label:'Relaxed',  desc:'Soft & easy-going',   grad:'linear-gradient(135deg,rgba(139,92,246,.18),rgba(20,184,166,.12))' },
];

// face-api.js output labels → our 7 app emotions
const FACEAPI_MAP = {
  happy:    'happy',
  sad:      'sad',
  angry:    'angry',
  disgusted:'angry',
  surprised:'energetic',
  fearful:  'sad',
  neutral:  'calm',
};

// Neutral suppression — keeps variety alive
const NEUTRAL_WEIGHT = 0.22;

let selectedEmotion = null;
let camStream       = null;
let detectionLoop   = null;
let modelsLoaded    = false;
let currentLiveScores = {};

const audio = document.getElementById('audioEl');

/* ══ BOOT ══ */
document.addEventListener('DOMContentLoaded', () => {
  buildHomeGrid();
  buildMoodGrid();
  loadFaceModels();
  audio.addEventListener('timeupdate',    onTimeUpdate);
  audio.addEventListener('ended',         onAudioEnd);
  audio.addEventListener('loadedmetadata',onMetaLoaded);
  fetchEmotionCounts();
});

/* ══ FACE-API.JS MODEL LOADING ══ */
async function loadFaceModels() {
  const status = document.getElementById('modelStatus');
  const text   = document.getElementById('msText');

  try {
    // Models served from /static/models/
    const MODEL_URL = '/static/models';
    text.textContent = 'Loading face detection model…';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

    text.textContent = 'Loading expression model…';
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

    modelsLoaded = true;
    status.classList.add('ready');
    status.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--teal);flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
      <span>face-api.js ready — real-time emotion detection active</span>`;
    document.getElementById('btnStart').disabled = false;

  } catch (err) {
    status.classList.add('error');
    status.innerHTML = `<span>⚠ Could not load models. Check your internet connection.</span>`;
    console.error('face-api.js load error:', err);
  }
}

/* ══ SECTIONS ══ */
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const nl = document.getElementById('nl-' + id);
  if (nl) nl.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (id !== 'camera') stopCamera();
  document.getElementById('navLinks').classList.remove('open');
}
function toggleMenu() {
  document.getElementById('navLinks').classList.toggle('open');
}

/* ══ EMOTION COUNTS ══ */
async function fetchEmotionCounts() {
  try {
    const d = await (await fetch('/emotions')).json();
    document.querySelectorAll('[data-eid]').forEach(el => {
      const cnt = d.emotions?.[el.dataset.eid]?.count;
      if (cnt) el.textContent = cnt + ' songs';
    });
  } catch {}
}

/* ══ HOME GRID ══ */
function buildHomeGrid() {
  document.getElementById('homeEmotionGrid').innerHTML = EMOTIONS.map(e => `
    <button class="hem-card" onclick="quickMood('${e.id}')">
      <span class="hem-icon">${e.icon}</span>
      <span class="hem-label">${e.label}</span>
      <span class="hem-count" data-eid="${e.id}">…</span>
    </button>`).join('');
}
function quickMood(id) { showSection('manual'); setTimeout(() => selectMood(id), 80); }

/* ══ MOOD GRID ══ */
function buildMoodGrid() {
  document.getElementById('moodGrid').innerHTML = EMOTIONS.map(e => `
    <button class="mood-card" id="mc-${e.id}" onclick="selectMood('${e.id}')"
      style="--mc-grad:${e.grad}" aria-pressed="false">
      <span class="mc-icon">${e.icon}</span>
      <span class="mc-label">${e.label}</span>
      <span class="mc-desc">${e.desc}</span>
    </button>`).join('');
}

function selectMood(id) {
  selectedEmotion = id;
  document.querySelectorAll('.mood-card').forEach(c => {
    c.classList.remove('selected'); c.setAttribute('aria-pressed','false');
  });
  const card = document.getElementById('mc-' + id);
  card.classList.add('selected'); card.setAttribute('aria-pressed','true');
  const emo = EMOTIONS.find(e => e.id === id);
  document.getElementById('selectedTag').innerHTML =
    `<span style="font-size:20px">${emo.icon}</span> ${emo.label} selected`;
  document.getElementById('controlsBar').style.display = 'flex';
  document.getElementById('manualResult').innerHTML = '';
  document.getElementById('controlsBar').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

/* ══ GET RECOMMENDATIONS ══ */
async function getRecommendations() {
  if (!selectedEmotion) return;
  const topN    = +document.getElementById('topN').value;
  const langVal = document.getElementById('langFilter').value;
  const emo     = EMOTIONS.find(e => e.id === selectedEmotion);
  const result  = document.getElementById('manualResult');
  showLoading(result, `Building your ${emo.label.toLowerCase()} playlist…`);

  try {
    const res  = await fetch('/recommend', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ emotion: selectedEmotion, top_n: topN * 3 })
    });
    let { recommendations } = await res.json();
    if (langVal !== 'all') recommendations = recommendations.filter(s => s.language === langVal);
    recommendations = recommendations.slice(0, topN);
    if (!recommendations.length) {
      showError(result, `No ${langVal} songs for this mood. Try "All languages".`);
      return;
    }
    renderSongs(result, recommendations, selectedEmotion);
  } catch (err) {
    showError(result, err.message || 'Server error — is app.py running?');
  }
}

/* ══ RENDER SONGS ══ */
function renderSongs(container, songs, emotion) {
  const emo = EMOTIONS.find(e => e.id === emotion) || { icon:'🎵', label: emotion };
  container.innerHTML = `
    <div class="songs-header">
      <span class="sh-icon">${emo.icon}</span>
      <span class="sh-title">${emo.label} playlist</span>
      <span class="sh-meta">${songs.length} tracks</span>
    </div>
    <div class="songs-list">${songs.map((s,i) => songHTML(s,i)).join('')}</div>`;
}

function songHTML(s, i) {
  const rc  = i===0?'r1':i===1?'r2':i===2?'r3':'';
  const emo = EMOTIONS.find(e=>e.id===s.emotion);
  return `
    <div class="${i===0?'song-card top':'song-card'}" id="sc-${i}">
      <div class="s-rank ${rc}">${i+1}</div>
      <div class="s-art" id="sa-${i}">${emo?emo.icon:'🎵'}</div>
      <div class="s-info">
        <div class="s-title">${esc(s.title)}</div>
        <div class="s-meta">
          <span class="s-artist">🎤 ${esc(s.artist)}</span>
          <span class="s-lang">${esc(s.language)}</span>
          <span class="s-genre">${esc(s.genre.split(' ')[0])}</span>
          <span class="s-year">${s.year}</span>
        </div>
      </div>
      <div class="s-right">
        <div class="s-rating">⭐ ${s.rating}</div>
        <div class="conf-bar"><div class="conf-fill" style="width:${Math.min(s.confidence,100)}%"></div></div>
        <div class="conf-pct">${Math.round(s.confidence)}% match</div>
      </div>
      <button class="s-play" id="pb-${i}"
        onclick="handlePlayBtn(${i},'${esc(s.title)}','${esc(s.artist)}','${esc(s.search_query||s.title+' '+s.artist)}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
    </div>`;
}

/* ══ PLAY BUTTON ══ */
async function handlePlayBtn(idx, title, artist, query) {
  const btn = document.getElementById('pb-' + idx);
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin .7s linear infinite"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;

  try {
    const res  = await fetch('/fetch_preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});
    const data = await res.json();
    if (data.preview_url) {
      const art = document.getElementById('sa-' + idx);
      if (art && data.artwork) art.innerHTML = `<img src="${data.artwork}" alt="art" loading="lazy">`;
      btn.classList.add('has-preview');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      playSong(title, artist, data.preview_url, data.artwork || '');
    } else {
      btn.style.opacity = '.3';
      btn.title = 'No preview on iTunes';
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
    }
  } catch {
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  }
}

/* ══ MUSIC PLAYER ══ */
function playSong(title, artist, url, art) {
  audio.src = url; audio.load(); audio.play().catch(()=>{});
  document.getElementById('playerTitle').textContent  = title;
  document.getElementById('playerArtist').textContent = artist;
  document.getElementById('playerArt').innerHTML = art
    ? `<img src="${art}" alt="">` : '🎵';
  document.getElementById('playerBar').classList.remove('hidden');
  setPlayPause(true);
  document.getElementById('pProgress').value = 0;
}
function togglePlay(){ audio.paused ? (audio.play(), setPlayPause(true)) : (audio.pause(), setPlayPause(false)); }
function setPlayPause(p){ document.getElementById('playIcon').style.display=p?'none':''; document.getElementById('pauseIcon').style.display=p?'':'none'; }
function seekBack(){ audio.currentTime = Math.max(0,audio.currentTime-5); }
function seekForward(){ audio.currentTime = Math.min(audio.duration||30,audio.currentTime+5); }
function seekTo(v){ audio.currentTime = parseFloat(v); }
function onTimeUpdate(){ const c=audio.currentTime,d=audio.duration||30; document.getElementById('pCurrent').textContent=fmtTime(c); document.getElementById('pDuration').textContent=fmtTime(d); document.getElementById('pProgress').max=d; document.getElementById('pProgress').value=c; }
function onMetaLoaded(){ document.getElementById('pDuration').textContent=fmtTime(audio.duration); document.getElementById('pProgress').max=audio.duration; }
function onAudioEnd(){ setPlayPause(false); }
function closePlayer(){ audio.pause(); document.getElementById('playerBar').classList.add('hidden'); }
function fmtTime(s){ if(!isFinite(s))return'0:00'; return`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

/* ══ CAMERA — face-api.js real-time detection ══ */
async function startCamera() {
  if (!modelsLoaded) {
    alert('Face detection models are still loading. Please wait a moment.');
    return;
  }
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode:'user', width:{ideal:640}, height:{ideal:480} }
    });
    const video = document.getElementById('webcam');
    video.srcObject = camStream;
    await new Promise(r => video.onloadedmetadata = r);
    video.style.display = 'block';
    document.getElementById('vfIdle').style.display = 'none';
    document.getElementById('liveDot').classList.add('on');
    document.getElementById('liveMeter').style.display = 'block';

    // Size the overlay canvas to match video
    const canvas = document.getElementById('faceCanvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;

    setBtn('btnStart', true); setBtn('btnSnap', false); setBtn('btnStop', false);
    startDetectionLoop(video, canvas);
  } catch {
    showError(document.getElementById('camResult'),
      'Camera access denied — click Allow when your browser asks for permission.');
  }
}

function stopCamera() {
  if (detectionLoop) { clearInterval(detectionLoop); detectionLoop = null; }
  if (camStream) { camStream.getTracks().forEach(t=>t.stop()); camStream = null; }
  const v = document.getElementById('webcam');
  if (v) { v.srcObject=null; v.style.display='none'; }
  document.getElementById('vfIdle').style.display  = 'block';
  document.getElementById('liveMeter').style.display = 'none';
  document.getElementById('faceCanvas').getContext('2d').clearRect(0,0,9999,9999);
  document.getElementById('liveDot').classList.remove('on');
  setBtn('btnStart',false); setBtn('btnSnap',true); setBtn('btnStop',true);
  currentLiveScores = {};
}

function startDetectionLoop(video, canvas) {
  const ctx        = canvas.getContext('2d');
  const opts       = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });
  const scoreHistory = {};   // rolling average over last N frames

  detectionLoop = setInterval(async () => {
    if (!camStream || video.paused || video.ended) return;

    try {
      const result = await faceapi
        .detectSingleFace(video, opts)
        .withFaceExpressions();

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!result) {
        renderLiveBars({});
        return;
      }

      // Draw bounding box
      const box = result.detection.box;
      ctx.strokeStyle = 'rgba(249,115,22,0.85)';
      ctx.lineWidth   = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      // Corner accents
      const cs = 14;
      [
        [box.x, box.y, cs, 0, 0, cs],
        [box.x+box.width-cs, box.y, cs, 0, 0, cs],
        [box.x, box.y+box.height-cs, cs, 0, 0, -cs],
        [box.x+box.width-cs, box.y+box.height-cs, cs, 0, 0, -cs],
      ].forEach(([x,y,dx1,dy1,dx2,dy2]) => {
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+dx1,y+dy1);
        ctx.moveTo(x,y); ctx.lineTo(x+dx2,y+dy2);
        ctx.strokeStyle='var(--saffron,#f97316)'; ctx.lineWidth=3; ctx.stroke();
      });

      // Map face-api expressions → our 7 emotions
      const raw = result.expressions;
      const mapped = { happy:0, sad:0, angry:0, energetic:0, calm:0, romantic:0, relaxed:0 };
      for (const [label, score] of Object.entries(raw)) {
        const em = FACEAPI_MAP[label];
        if (!em) continue;
        const w = label === 'neutral' ? NEUTRAL_WEIGHT : 1.0;
        mapped[em] = (mapped[em] || 0) + score * w;
      }

      // Rolling average (last 8 frames) for stability
      const N = 8;
      for (const [em, val] of Object.entries(mapped)) {
        if (!scoreHistory[em]) scoreHistory[em] = [];
        scoreHistory[em].push(val);
        if (scoreHistory[em].length > N) scoreHistory[em].shift();
      }
      const smoothed = {};
      for (const em of Object.keys(mapped)) {
        const arr = scoreHistory[em] || [0];
        smoothed[em] = arr.reduce((a,b)=>a+b,0) / arr.length;
      }

      // Normalise
      const total = Object.values(smoothed).reduce((a,b)=>a+b,0) || 1;
      for (const em of Object.keys(smoothed)) smoothed[em] /= total;

      currentLiveScores = smoothed;
      renderLiveBars(smoothed);

      // Label above box
      const dom = Object.entries(smoothed).sort((a,b)=>b[1]-a[1])[0];
      const emo = EMOTIONS.find(e=>e.id===dom[0]);
      if (emo) {
        ctx.font      = 'bold 14px DM Sans, system-ui, sans-serif';
        ctx.fillStyle = '#f97316';
        ctx.fillText(`${emo.icon} ${emo.label} ${Math.round(dom[1]*100)}%`,
                     box.x, Math.max(box.y - 8, 18));
      }

    } catch (err) {
      // Silently skip frame errors
    }
  }, 120);  // ~8fps — good balance of accuracy and performance
}

function renderLiveBars(scores) {
  const sorted = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const max    = sorted[0]?.[1] || 1;
  const barsEl = document.getElementById('lmBars');
  if (!barsEl) return;
  barsEl.innerHTML = sorted.map(([em, val], i) => {
    const emo  = EMOTIONS.find(e=>e.id===em) || { icon:'🎵', label: em };
    const pct  = Math.round((val / max) * 100);
    const isTop = i === 0 && val > 0.05;
    return `
      <div class="lm-row">
        <span class="lm-name ${isTop?'top':''}">${emo.icon} ${emo.label}</span>
        <div class="lm-track"><div class="lm-fill ${isTop?'top':''}" style="width:${pct}%"></div></div>
        <span class="lm-pct">${Math.round(val*100)}%</span>
      </div>`;
  }).join('');
}

/* ══ LOCK EMOTION & GET SONGS ══ */
async function lockEmotion() {
  if (!currentLiveScores || Object.keys(currentLiveScores).length === 0) {
    showError(document.getElementById('camResult'), 'No face detected yet — start the camera and position your face.');
    return;
  }

  // Pick dominant (already smoothed & normalised)
  const sorted  = Object.entries(currentLiveScores).sort((a,b)=>b[1]-a[1]);
  const [emotion, score] = sorted[0];
  const emo     = EMOTIONS.find(e=>e.id===emotion) || EMOTIONS[4];
  const conf    = Math.round(score * 100);
  const resultEl = document.getElementById('camResult');

  const songsDiv = document.createElement('div');
  resultEl.innerHTML = `
    <div class="det-banner">
      <span class="det-icon">${emo.icon}</span>
      <div style="flex:1">
        <div class="det-emotion">${emo.label} detected</div>
        <div class="det-sub">
          ${conf}% confidence
          <span class="det-chip">face-api.js</span>
        </div>
      </div>
      <button class="retry-btn" onclick="document.getElementById('camResult').innerHTML='';currentLiveScores={};">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Reset
      </button>
    </div>`;
  resultEl.appendChild(songsDiv);
  showLoading(songsDiv, `Loading ${emo.label.toLowerCase()} songs…`);

  try {
    const recs = await (await fetch('/recommend', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ emotion, top_n: 10 })
    })).json();
    renderSongs(songsDiv, recs.recommendations || [], emotion);
  } catch (err) {
    showError(songsDiv, err.message || 'Could not fetch songs.');
  }
}

/* ══ STATS ══ */
async function openStats() {
  document.getElementById('modalBg').classList.remove('hidden');
  const body = document.getElementById('statsBody');
  body.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';
  try {
    const d = await (await fetch('/statistics')).json();
    body.innerHTML = `
      <p style="font-size:12px;color:var(--text3);margin-bottom:1rem;font-family:var(--fm)">${d.total_songs} songs · 6 languages</p>
      ${Object.entries(d.statistics).map(([em,s])=>`
        <div class="stat-item">
          <span class="si-ico">${s.icon}</span>
          <div class="si-info">
            <div class="si-name">${em.charAt(0).toUpperCase()+em.slice(1)}</div>
            <div class="si-detail">Top: ${esc(s.top_artist)} · ⭐ ${s.avg_rating} · ${s.languages.join(', ')}</div>
          </div>
          <span class="si-count">${s.count}</span>
        </div>`).join('')}`;
  } catch {
    body.innerHTML = '<div class="error-box">Could not load stats.</div>';
  }
}
function closeStats() { document.getElementById('modalBg').classList.add('hidden'); }

/* ══ HELPERS ══ */
function setBtn(id,disabled){ const el=document.getElementById(id); if(el) el.disabled=disabled; }
function showLoading(el,msg){ el.innerHTML=`<div class="loading-state"><div class="spinner"></div><p>${msg}</p></div>`; }
function showError(el,msg){ el.innerHTML=`<div class="error-box">⚠ ${esc(msg)}</div>`; }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

document.addEventListener('keydown', e => {
  if (e.key==='Escape') closeStats();
  if (e.key===' ' && !document.getElementById('playerBar').classList.contains('hidden')){
    e.preventDefault(); togglePlay();
  }
});
