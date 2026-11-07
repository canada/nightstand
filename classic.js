(() => {
'use strict';
const $ = id => document.getElementById(id);
const externalWeather = document.currentScript?.dataset.weather === 'external';
const SVGNS = 'http://www.w3.org/2000/svg';
const WD = ['日','月','火','水','木','金','土'];
const pad = n => String(n).padStart(2,'0');
const key = (y,m,d) => `${y}-${pad(m)}-${pad(d)}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch{ return null; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
};

/* ---------- clock face ---------- */
const ticks = $('ticks'), nums = $('nums');
for (let i = 0; i < 60; i++) {
  const h = i % 5 === 0, a = i * Math.PI / 30, r1 = 95, r2 = h ? 89.5 : 91.5;
  const l = document.createElementNS(SVGNS,'line');
  l.setAttribute('x1', 100 + r1*Math.sin(a)); l.setAttribute('y1', 100 - r1*Math.cos(a));
  l.setAttribute('x2', 100 + r2*Math.sin(a)); l.setAttribute('y2', 100 - r2*Math.cos(a));
  l.setAttribute('class', 'tick' + (h ? ' h' : ''));
  ticks.appendChild(l);
}
for (let n = 1; n <= 12; n++) {
  const a = n * Math.PI / 6, r = 77;
  const t = document.createElementNS(SVGNS,'text');
  t.setAttribute('x', 100 + r*Math.sin(a)); t.setAttribute('y', 100 - r*Math.cos(a));
  t.setAttribute('class','num'); t.textContent = n; nums.appendChild(t);
}
const hH = $('hH'), hM = $('hM'), hS = $('hS');
function tick() {
  const d = new Date();
  const s = d.getSeconds() + d.getMilliseconds()/1000;
  const m = d.getMinutes() + s/60;
  const h = (d.getHours() % 12) + m/60;
  hS.setAttribute('transform', `rotate(${s*6} 100 100)`);
  hM.setAttribute('transform', `rotate(${m*6} 100 100)`);
  hH.setAttribute('transform', `rotate(${h*30} 100 100)`);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- holidays (内閣府 CSV → fallback holidays-jp) ---------- */
const CAO = 'https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv';
const ALT = 'https://holidays-jp.github.io/api/v1/date.json';
let H = {}, hsrc = 'なし';
async function loadHolidays() {
  const c = store.get('holidays');
  if (c && c.d) { H = c.d; hsrc = c.s; renderCal(); if (Date.now() - c.t < 7*864e5) return; }
  try {
    const r = await fetch(CAO, {cache:'no-store'});
    if (!r.ok) throw 0;
    const txt = new TextDecoder('shift_jis').decode(await r.arrayBuffer());
    const d = {};
    for (const line of txt.split(/\r?\n/).slice(1)) {
      const [dt, name] = line.split(',');
      const p = (dt || '').split('/');
      if (p.length === 3 && name) d[key(+p[0], +p[1], +p[2])] = name.trim();
    }
    if (!Object.keys(d).length) throw 0;
    H = d; hsrc = '内閣府';
  } catch {
    try {
      const r = await fetch(ALT, {cache:'no-store'});
      if (!r.ok) throw 0;
      H = await r.json(); hsrc = 'holidays-jp';
    } catch { return; }
  }
  store.set('holidays', {t: Date.now(), s: hsrc, d: H});
  renderCal();
}

/* ---------- today + calendar ---------- */
let offset = 0, todayKey = '';
function renderToday() {
  const n = new Date();
  $('wday').textContent = `${WD[n.getDay()]}曜日`;
  $('mday').textContent = `${n.getMonth()+1}月${n.getDate()}日`;
}
function renderCal() {
  renderToday();
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const y = base.getFullYear(), m = base.getMonth();
  $('month').textContent = `${m+1}月`;
  $('year').textContent = y !== now.getFullYear() ? y : '';
  $('calhead').classList.toggle('hide', offset === 0);
  const g = $('grid'); g.textContent = '';
  WD.forEach(w => { const e = document.createElement('div'); e.className = 'wd'; e.textContent = w; g.appendChild(e); });
  const first = base.getDay(), days = new Date(y, m+1, 0).getDate();
  for (let i = 0; i < first; i++) { const e = document.createElement('div'); e.className = 'd blank'; g.appendChild(e); }
  for (let d = 1; d <= days; d++) {
    const dow = (first + d - 1) % 7, k = key(y, m+1, d), e = document.createElement('div');
    let cls = 'd';
    if (dow === 0 || dow === 6) cls += ' we';
    if (H[k]) { cls += ' hol'; e.title = H[k]; }
    if (y === now.getFullYear() && m === now.getMonth() && d === now.getDate()) cls += ' today';
    e.className = cls; e.textContent = d; g.appendChild(e);
  }
  const tk = key(now.getFullYear(), now.getMonth()+1, now.getDate());
  const f = $('foot');
  if (H[tk]) { f.innerHTML = `<span class="dot"></span>今日 <b>${esc(H[tk])}</b>`; return; }
  const next = Object.keys(H).filter(k => k > tk).sort()[0];
  if (next) {
    const [ny, nm, nd] = next.split('-').map(Number);
    const w = WD[new Date(ny, nm-1, nd).getDay()];
    f.innerHTML = `<span class="dot"></span>${nm}月${nd}日(${w}) <b>${esc(H[next])}</b>`;
  } else f.textContent = '';
}

/* ---------- weather (Open-Meteo) ---------- */
// 位置: URL の ?lat=35.68&lon=139.76 > 端末の位置情報 > 前回の位置 > 東京
const qs = new URLSearchParams(location.search);
const ICON = {
  sun:   '<circle class="i-sun" cx="16" cy="16" r="6"/>' + [0,45,90,135,180,225,270,315].map(a=>{const r=Math.PI*a/180;return `<line class="i-ray" x1="${16+9.5*Math.sin(r)}" y1="${16-9.5*Math.cos(r)}" x2="${16+12.5*Math.sin(r)}" y2="${16-12.5*Math.cos(r)}"/>`}).join(''),
  moon:  '<path class="i-moon" d="M20.5 5.2A11 11 0 1 0 26.8 21 8.8 8.8 0 0 1 20.5 5.2z"/>',
  cloud: '<path class="i-cloud" d="M9.5 25h14a5.5 5.5 0 0 0 .7-10.96A7.5 7.5 0 0 0 9.9 16.1 4.5 4.5 0 0 0 9.5 25z"/>',
  partly:'<circle class="i-sun" cx="12" cy="11" r="4.6"/>' + [270,315,0,45,225].map(a=>{const r=Math.PI*a/180;return `<line class="i-ray" x1="${12+7.4*Math.sin(r)}" y1="${11-7.4*Math.cos(r)}" x2="${12+9.8*Math.sin(r)}" y2="${11-9.8*Math.cos(r)}"/>`}).join('') +
         '<path class="i-cloud" d="M11.5 27h13a5 5 0 0 0 .6-9.96A6.8 6.8 0 0 0 12 18.9a4.1 4.1 0 0 0-.5 8.1z"/>',
  pmoon: '<path class="i-cloud2" d="M14 4.5A8.5 8.5 0 1 0 21 17.6 6.6 6.6 0 0 1 14 4.5z"/>' +
         '<path class="i-cloud" d="M11.5 27h13a5 5 0 0 0 .6-9.96A6.8 6.8 0 0 0 12 18.9a4.1 4.1 0 0 0-.5 8.1z"/>',
  rain:  '<path class="i-cloud" d="M9.5 20h14a5.5 5.5 0 0 0 .7-10.96A7.5 7.5 0 0 0 9.9 11.1 4.5 4.5 0 0 0 9.5 20z"/>' +
         '<line class="i-rain" x1="11" y1="23.5" x2="9.8" y2="27.5"/><line class="i-rain" x1="16.5" y1="23.5" x2="15.3" y2="27.5"/><line class="i-rain" x1="22" y1="23.5" x2="20.8" y2="27.5"/>',
  snow:  '<path class="i-cloud" d="M9.5 20h14a5.5 5.5 0 0 0 .7-10.96A7.5 7.5 0 0 0 9.9 11.1 4.5 4.5 0 0 0 9.5 20z"/>' +
         '<circle class="i-snow" cx="10.5" cy="25" r="1.5"/><circle class="i-snow" cx="16.5" cy="27" r="1.5"/><circle class="i-snow" cx="22.5" cy="25" r="1.5"/>',
  thunder:'<path class="i-cloud" d="M9.5 20h14a5.5 5.5 0 0 0 .7-10.96A7.5 7.5 0 0 0 9.9 11.1 4.5 4.5 0 0 0 9.5 20z"/>' +
         '<path class="i-bolt" d="M17.5 19.5l-4.5 6.5h3.2l-1.4 5 5.2-7h-3.3l1.6-4.5z"/>',
  fog:   '<path class="i-cloud" d="M9.5 18h14a5.5 5.5 0 0 0 .7-10.96A7.5 7.5 0 0 0 9.9 9.1 4.5 4.5 0 0 0 9.5 18z"/>' +
         '<line class="i-fog" x1="6" y1="22.5" x2="26" y2="22.5"/><line class="i-fog" x1="9" y1="27" x2="23" y2="27"/>'
};
function wmo(code, isDay) {
  if (code === 0) return [isDay ? 'sun' : 'moon', '快晴'];
  if (code === 1) return [isDay ? 'sun' : 'moon', '晴れ'];
  if (code === 2) return [isDay ? 'partly' : 'pmoon', '晴れ時々くもり'];
  if (code === 3) return ['cloud', 'くもり'];
  if (code === 45 || code === 48) return ['fog', '霧'];
  if (code >= 51 && code <= 57) return ['rain', '霧雨'];
  if (code >= 61 && code <= 67) return ['rain', '雨'];
  if (code >= 71 && code <= 77) return ['snow', '雪'];
  if (code >= 80 && code <= 82) return ['rain', 'にわか雨'];
  if (code === 85 || code === 86) return ['snow', 'にわか雪'];
  if (code >= 95) return ['thunder', '雷雨'];
  return ['cloud', ''];
}
function renderWx(w) {
  if (!w) return;
  const [ic, label] = wmo(w.code, w.isDay);
  $('wxIcon').innerHTML = ICON[ic];
  $('wxTemp').textContent = `${Math.round(w.temp)}°`;
  let sub = label;
  if (w.pop != null && w.pop >= 20) sub += `${sub ? ' · ' : ''}降水${w.pop}%`;
  $('wxSub').textContent = sub;
  $('wxSub2').textContent = `最高${Math.round(w.max)}° 最低${Math.round(w.min)}°`;
  $('wx').classList.add('on');
}
function getPos() {
  const lat = parseFloat(qs.get('lat')), lon = parseFloat(qs.get('lon'));
  if (!isNaN(lat) && !isNaN(lon)) return Promise.resolve({lat, lon});
  const saved = store.get('pos');
  return new Promise(res => {
    if (!navigator.geolocation) return res(saved || {lat:35.681, lon:139.767});
    navigator.geolocation.getCurrentPosition(
      p => { const v = {lat:+p.coords.latitude.toFixed(3), lon:+p.coords.longitude.toFixed(3)}; store.set('pos', v); res(v); },
      () => res(saved || {lat:35.681, lon:139.767}),
      {maximumAge: 6*3600e3, timeout: 10000}
    );
  });
}
async function loadWeather() {
  if (externalWeather) return;
  const c = store.get('wx');
  if (c) renderWx(c);
  if (c && Date.now() - c.t < 15*60e3) return;
  try {
    const {lat, lon} = await getPos();
    const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,weather_code,is_day' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=auto&forecast_days=1';
    const r = await fetch(u, {cache:'no-store'});
    if (!r.ok) throw 0;
    const j = await r.json();
    const w = {t: Date.now(), temp: j.current.temperature_2m, code: j.current.weather_code, isDay: !!j.current.is_day,
               max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0],
               pop: j.daily.precipitation_probability_max ? j.daily.precipitation_probability_max[0] : null};
    store.set('wx', w); renderWx(w);
  } catch {}
}

/* ---------- mode: auto / night / day ---------- */
const MODES = ['auto','night','day'], LABEL = {auto:'自動', night:'ナイト', day:'デイ'};
let mode = store.get('mode') || 'auto';
let modeReady = false, fadeTimer;
function applyMode() {
  const h = new Date().getHours();
  const night = mode === 'night' || (mode === 'auto' && (h >= 21 || h < 6));
  const root = document.documentElement;
  if (root.classList.contains('night') === night && modeReady) return;
  if (!modeReady) { root.classList.toggle('night', night); modeReady = true; return; }
  // フェードアウト → 配色を一括で切り替え → フェードイン（要素ごとの色トランジションは使わない）
  const st = $('stage');
  st.classList.add('fade');
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => { root.classList.toggle('night', night); st.classList.remove('fade'); }, 450);
}
const MODE_ICON = {
  auto:  '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor"/>',
  night: '<path d="M10.2 1.6A6.6 6.6 0 1 0 14.6 11 5.3 5.3 0 0 1 10.2 1.6z" fill="currentColor"/>',
  day:   '<circle cx="8" cy="8" r="3.2" fill="currentColor"/>' + [0,45,90,135,180,225,270,315].map(a=>{const r=Math.PI*a/180;return `<line x1="${8+5*Math.sin(r)}" y1="${8-5*Math.cos(r)}" x2="${8+6.8*Math.sin(r)}" y2="${8-6.8*Math.cos(r)}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`}).join('')
};
function renderModeBtn() {
  $('modeIcon').innerHTML = MODE_ICON[mode];
  $('modeLabel').textContent = LABEL[mode];
}
function cycleMode() {
  mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  store.set('mode', mode); applyMode(); renderModeBtn();
}

/* ---------- input ---------- */
// 右上: 1回目のタップでボタンを表示、表示中にもう1回タップでモード切替。4秒で自動的に隠れる
const hot = $('hot');
let hideTimer;
function hideBtn() { hot.classList.remove('show'); }
hot.addEventListener('pointerdown', () => hot.classList.add('press'));
hot.addEventListener('pointerup', e => {
  e.stopPropagation();
  hot.classList.remove('press');
  if (hot.classList.contains('show')) cycleMode();
  else { renderModeBtn(); hot.classList.add('show'); }
  clearTimeout(hideTimer); hideTimer = setTimeout(hideBtn, 4000);
  lockScreen();
});
hot.addEventListener('pointercancel', () => hot.classList.remove('press'));

// それ以外: 左右スワイプで月移動（タップでは何もしない。ボタン表示中なら隠す）
let sx = 0, sy = 0, resetTimer;
addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, {passive:true});
addEventListener('touchmove', e => e.preventDefault(), {passive:false});
addEventListener('touchend', e => {
  lockScreen();
  if (hot.contains(e.target)) return;
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
    offset += dx < 0 ? 1 : -1; renderCal();
    clearTimeout(resetTimer); resetTimer = setTimeout(() => { offset = 0; renderCal(); }, 60000);
  } else hideBtn();
});
addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && !hot.contains(e.target)) { hideBtn(); lockScreen(); } });
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') { offset++; renderCal(); }
  if (e.key === 'ArrowLeft')  { offset--; renderCal(); }
});

/* ---------- keep screen awake ---------- */
let wl = null;
async function lockScreen() {
  try {
    if ('wakeLock' in navigator && !wl && document.visibilityState === 'visible') {
      wl = await navigator.wakeLock.request('screen');
      wl.addEventListener('release', () => { wl = null; });
    }
  } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { lockScreen(); renderCal(); applyMode(); loadWeather(); }
});

/* ---------- periodic ---------- */
setInterval(() => {
  const k = new Date().toDateString();
  if (k !== todayKey) { todayKey = k; renderCal(); }
  applyMode();
}, 1000);
setInterval(loadWeather, 15*60e3);
setInterval(() => {
  $('stage').style.transform = `translate(${(Math.random()*8-4).toFixed(1)}px,${(Math.random()*8-4).toFixed(1)}px)`;
}, 60000);

/* ---------- home screen icon (generated) ---------- */
(function makeIcon() {
  const S = 180, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), C = S/2;
  x.fillStyle = '#000'; x.fillRect(0,0,S,S);
  x.fillStyle = '#1c1c1e'; x.beginPath(); x.arc(C,C,70,0,Math.PI*2); x.fill();
  x.lineCap = 'round';
  for (let i = 0; i < 60; i++) { const a = i*Math.PI/30, h = i%5===0;
    x.strokeStyle = h ? 'rgba(235,235,245,.35)' : 'rgba(235,235,245,.16)'; x.lineWidth = h ? 1.6 : 1;
    x.beginPath(); x.moveTo(C+66*Math.sin(a),C-66*Math.cos(a)); x.lineTo(C+(h?60:63)*Math.sin(a),C-(h?60:63)*Math.cos(a)); x.stroke(); }
  const hand = (deg,len) => { const a = deg*Math.PI/180, s = Math.sin(a), co = Math.cos(a);
    x.strokeStyle = '#fff'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(C,C); x.lineTo(C+8*s,C-8*co); x.stroke();
    x.lineWidth = 6.4; x.beginPath(); x.moveTo(C+8*s,C-8*co); x.lineTo(C+len*s,C-len*co); x.stroke(); };
  hand(305,36); hand(60,56);
  x.fillStyle = '#fff'; x.beginPath(); x.arc(C,C,4.6,0,Math.PI*2); x.fill();
  const sa = 200*Math.PI/180; x.strokeStyle = '#ff9f0a'; x.lineWidth = 1.6;
  x.beginPath(); x.moveTo(C-12*Math.sin(sa),C+12*Math.cos(sa)); x.lineTo(C+60*Math.sin(sa),C-60*Math.cos(sa)); x.stroke();
  x.fillStyle = '#ff9f0a'; x.beginPath(); x.arc(C,C,3,0,Math.PI*2); x.fill();
  x.fillStyle = '#000'; x.beginPath(); x.arc(C,C,1.1,0,Math.PI*2); x.fill();
  const url = c.toDataURL('image/png');
  $('touchIcon').href = url; $('favicon').href = url;
})();

// Small public interface for optional enhancements; the classic view works on its own.
window.NightstandClassic = Object.freeze({
  getMonthOffset: () => offset,
  setMonthOffset(value) { if (Number.isInteger(value)) { offset = value; renderCal(); } },
  getPosition: getPos, renderWeather: renderWx,
  icons: ICON, describeWeather: wmo, store, lockScreen
});

applyMode(); renderCal(); loadHolidays(); loadWeather(); lockScreen();
})();
