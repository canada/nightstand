import './weather-detail.js';
import './timer.js';
const classic = window.NightstandClassic;
const $ = id => document.getElementById(id);
const {store, icons:ICON, describeWeather:wmo, getPosition:getPos, renderWeather:renderWx, lockScreen} = classic;
// Keep styles and the entry module on the same release when browser caches are warm.
const assetURL=file=>{const url=new URL(file,import.meta.url);url.search=new URL(import.meta.url).search;return url;};
const style = document.createElement('link');style.rel='stylesheet';style.href=assetURL('enhancements.css');document.head.append(style);
for(const file of ['weather-detail.css','timer.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=assetURL(file);document.head.append(link);}
const year=document.createElement('span');year.id='todayYear';
const dateBody=document.createElement('div');dateBody.append($('wday'),$('mday'));$('date').append(year,dateBody);
const grid=$('grid');
const weekdays=document.createElement('div');weekdays.className='calendar-weekdays';
weekdays.append(...Array.from(grid.querySelectorAll('.wd'),node=>node.cloneNode(true)));
grid.before(weekdays);
const controls=document.createElement('nav');controls.id='calControls';controls.setAttribute('aria-label','カレンダーの月移動');
controls.innerHTML=`<button id="currentMonth" type="button" aria-label="今日のカレンダーに戻る" title="今日に戻る"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
$('date').append(controls);
$('date').setAttribute('aria-live','polite');
$('date').setAttribute('aria-atomic','true');
let calendarObserver;
function fillMonthEdges(offset,target=grid){
  // A fresh classic render contains weekday labels; decorated grids do not.
  const labels=target.querySelectorAll('.wd');
  if(!labels.length)return;
  labels.forEach(node=>node.remove());
  const now=new Date(),base=new Date(now.getFullYear(),now.getMonth()+offset,1);
  const y=base.getFullYear(),m=base.getMonth(),first=base.getDay();
  const holidays=store.get('holidays')?.d || {};
  for(let i=0;i<42;i++){
    const date=new Date(y,m,i-first+1);
    const dateKey=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    let cell=target.children[i];
    if(!cell){cell=document.createElement('div');target.append(cell);}
    if(date.getFullYear()!==y || date.getMonth()!==m){
      cell.className='d outside-month';
      cell.textContent=date.getDate();
      if(holidays[dateKey]){cell.classList.add('hol');cell.title=holidays[dateKey];}
      cell.setAttribute('aria-label',`${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`);
    }
    cell.dataset.date=dateKey;
  }
}
function updateCalendar(){
  const now=new Date(), offset=classic.getMonthOffset();
  const shown=new Date(now.getFullYear(),now.getMonth()+offset,1);
  calendarObserver?.disconnect();
  fillMonthEdges(offset);
  year.textContent=`${shown.getFullYear()}年`;
  const weekday=['日','月','火','水','木','金','土'][now.getDay()];
  $('wday').textContent=`${now.getDate()}日（${weekday}）`;
  $('wday').hidden=false;
  $('wday').classList.toggle('calendar-date-muted',offset!==0);
  $('foot').hidden=false;
  if(offset!==0){
    const monthKey=`${shown.getFullYear()}-${String(shown.getMonth()+1).padStart(2,'0')}-`;
    const holidays=Object.entries(store.get('holidays')?.d || {}).filter(([date])=>date.startsWith(monthKey)).sort(([a],[b])=>a.localeCompare(b));
    $('foot').replaceChildren();
    if(holidays.length){
      const dot=document.createElement('span');dot.className='dot';
      const names=document.createElement('b');
      names.textContent=holidays.map(([date,name])=>`${Number(date.slice(-2))}日 ${name}`).join(' · ');
      names.title=names.textContent;
      $('foot').append(dot,names);
    }
  }
  $('mday').textContent=`${shown.getMonth()+1}月`;
  controls.hidden=false;
  $('currentMonth').disabled=offset===0;
  grid.setAttribute('aria-label',`${shown.getFullYear()}年${shown.getMonth()+1}月のカレンダー`);
  calendarObserver?.observe(grid,{childList:true});
}
calendarObserver=new MutationObserver(updateCalendar);updateCalendar();
function changeMonth(delta){classic.setMonthOffset(classic.getMonthOffset()+delta);lockScreen();}
$('currentMonth').addEventListener('click',()=>classic.setMonthOffset(0));
const info=$('info');
const viewport=document.createElement('div');viewport.className='calendar-viewport';
grid.before(viewport);viewport.append(grid);
let swipe=null, settling=false, settleTimer=null, wheelTimer=null;
let previews=[];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function resetSwipe(){
  clearTimeout(settleTimer);settleTimer=null;
  clearTimeout(wheelTimer);wheelTimer=null;
  swipe=null;settling=false;
  for(const preview of previews)preview.remove();
  previews=[];
  grid.style.removeProperty('transform');grid.style.removeProperty('transition');
  viewport.classList.remove('dragging');
}
function makePreviews(offset){
  const now=new Date();
  const monthStart=value=>{
    const date=new Date(now.getFullYear(),now.getMonth()+value,1);
    return Date.UTC(date.getFullYear(),date.getMonth(),1-date.getDay());
  };
  const start=monthStart(offset),rowHeight=grid.clientHeight/6;
  try{
    for(const delta of [-1,1]){
      classic.setMonthOffset(offset+delta);
      fillMonthEdges(offset+delta);
      const preview=grid.cloneNode(true);
      preview.removeAttribute('id');preview.removeAttribute('aria-label');
      preview.className='calendar-preview';preview.setAttribute('aria-hidden','true');
      preview.dataset.side=delta;
      const shift=(monthStart(offset+delta)-start)/(7*864e5)*rowHeight;
      preview.dataset.shift=shift;
      // Adjacent month grids share weeks. Show each week only once while moving.
      const overlap=Math.max(0,grid.clientHeight-Math.abs(shift));
      preview.style.clipPath=delta>0?`inset(${overlap}px 0 0)`:`inset(0 0 ${overlap}px)`;
      previews.push(preview);
    }
  }finally{classic.setMonthOffset(offset);}
  viewport.append(...previews);
}
function movePages(dy,transition='none'){
  grid.style.transition=transition;grid.style.transform=`translate3d(0,${dy}px,0)`;
  for(const preview of previews){
    preview.style.transition=transition;
    preview.style.transform=`translate3d(0,${Number(preview.dataset.shift)+dy}px,0)`;
  }
}
function finishSwipe(commit){
  const gesture=swipe;swipe=null;
  clearTimeout(wheelTimer);wheelTimer=null;
  if(!gesture?.started)return;
  settling=true;
  const direction=gesture.dy<0?1:-1;
  const shift=Number(previews.find(preview=>Number(preview.dataset.side)===direction).dataset.shift);
  const duration=reducedMotion.matches?0:180;
  movePages(commit?-shift:0,`transform ${duration}ms cubic-bezier(.2,.8,.2,1)`);
  settleTimer=setTimeout(()=>{
    // A keyboard or Today action during the animation takes precedence.
    if(commit && classic.getMonthOffset()===gesture.offset)changeMonth(direction);
    resetSwipe();
  },duration);
}
// Both touch swipes and mouse drags move the calendar continuously.
info.addEventListener('pointerdown',e=>{
  if(!e.isPrimary){if(swipe)finishSwipe(false);return;}
  if(settling || e.button!==0 || e.target.closest('button,#wx'))return;
  if(swipe?.id==='wheel')resetSwipe();
  swipe={id:e.pointerId,x:e.clientX,y:e.clientY,dy:0,offset:classic.getMonthOffset(),
    height:grid.clientHeight,started:false,time:performance.now()};
  info.setPointerCapture(e.pointerId);
});
info.addEventListener('pointermove',e=>{
  if(!swipe || swipe.id!==e.pointerId)return;
  const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;
  if(!swipe.started){
    if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;
    if(Math.abs(dx)>Math.abs(dy)){swipe=null;return;}
    swipe.started=true;makePreviews(swipe.offset);viewport.classList.add('dragging');
  }
  swipe.dy=Math.max(-swipe.height,Math.min(swipe.height,dy));
  movePages(swipe.dy);
});
info.addEventListener('pointerup',e=>{
  if(!swipe || swipe.id!==e.pointerId)return;
  if(!swipe.started){swipe=null;return;}
  swipe.dy=Math.max(-swipe.height,Math.min(swipe.height,e.clientY-swipe.y));
  const distance=Math.abs(swipe.dy),elapsed=Math.max(1,performance.now()-swipe.time);
  const threshold=Math.max(30,Math.min(80,swipe.height*.18));
  finishSwipe(distance>=threshold || (distance>=25 && distance/elapsed>.5));
});
info.addEventListener('pointercancel',()=>finishSwipe(false));
info.addEventListener('lostpointercapture',()=>{if(swipe)finishSwipe(false);});
info.addEventListener('wheel',e=>{
  if(e.ctrlKey || Math.abs(e.deltaX)>Math.abs(e.deltaY) || !e.deltaY || e.target.closest('button,#wx'))return;
  e.preventDefault();
  if(settling || (swipe && swipe.id!=='wheel'))return;
  if(!swipe){
    swipe={id:'wheel',dy:0,offset:classic.getMonthOffset(),height:grid.clientHeight,started:true};
    makePreviews(swipe.offset);viewport.classList.add('dragging');
  }
  const factor=e.deltaMode===1?16:e.deltaMode===2?swipe.height:1;
  swipe.dy=Math.max(-swipe.height,Math.min(swipe.height,swipe.dy-e.deltaY*factor));
  movePages(swipe.dy);
  clearTimeout(wheelTimer);
  wheelTimer=setTimeout(()=>finishSwipe(Math.abs(swipe.dy)>=Math.max(30,Math.min(80,swipe.height*.18))),120);
},{passive:false});
addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]') || e.target.closest('input,select,textarea,[contenteditable]'))return;
  if(e.key==='ArrowDown'){e.preventDefault();changeMonth(1);}
  if(e.key==='ArrowUp'){e.preventDefault();changeMonth(-1);}
});
addEventListener('resize',resetSwipe);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetSwipe();});
// Prevent the classic swipe listener from handling the same gesture twice.
for(const event of ['touchstart','touchend','touchcancel'])info.addEventListener(event,e=>e.stopPropagation(),{passive:true});
const classicLink=document.createElement('a');classicLink.id='classicLink';classicLink.textContent='クラシック';const classicURL=new URL(location.href);classicURL.searchParams.delete('next');classicLink.href=classicURL.href;document.body.append(classicLink);
for(const [name,eyebrow,title] of [['weather','WEATHER','天気予報'],['timer','TIMER','タイマー']]){const dialog=document.createElement('dialog');dialog.id=`${name}Dialog`;dialog.className='sheet';dialog.setAttribute('aria-labelledby',`${name}Title`);dialog.innerHTML=`<header class="sheet-header"><div><p class="eyebrow">${eyebrow}</p><h2 id="${name}Title">${title}</h2></div><button type="button" class="close-btn" data-close aria-label="閉じる">×</button></header><div id="${name==='weather'?'weatherDetails':'timerContents'}"></div>`;document.body.append(dialog);dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});}
// Keep classic page gestures out of the scrollable sheets.
for(const event of ['touchstart','touchmove','touchend'])document.addEventListener(event,e=>{if(e.target.closest('dialog'))e.stopPropagation();},{capture:true,passive:true});
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))e.stopPropagation();},true);
function makeTrigger(node,label,open){node.setAttribute('role','button');node.tabIndex=0;node.setAttribute('aria-label',label);node.setAttribute('aria-haspopup','dialog');node.addEventListener('click',open);node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});}
if(!$('wxSub').textContent)$('wxSub').textContent='天気予報を開く';
if(!$('wxTemp').textContent)$('wxTemp').textContent='—';
$('wx').title='天気予報の詳細';
makeTrigger($('wx'),'天気予報の詳細を開く',()=>{$('weatherDialog').showModal();lockScreen();loadWeather();});
const clock=document.querySelector('.clockp');
const badge=document.createElement('span');badge.id='timerBadge';badge.hidden=true;badge.setAttribute('aria-live','off');clock.append(badge);
NightstandTimer.init();
function openTimer(){NightstandTimer.open();$('timerDialog').showModal();lockScreen();}
makeTrigger(clock,'時計・タイマーを開く',openTimer);
NightstandWeather.showStatus('天気予報を取得しています…');
let weatherPromise = null;
function showForecast(forecast) {
  const c = forecast.current, d = forecast.daily;
  renderWx({temp:c.temperature_2m,code:c.weather_code,isDay:!!c.is_day,
    max:d.temperature_2m_max[0],min:d.temperature_2m_min[0],pop:d.precipitation_probability_max?.[0]});
  NightstandWeather.render(forecast, {icons:ICON, describe:wmo});
}
async function loadWeather(force=false) {
  if (weatherPromise) return weatherPromise;
  weatherPromise = (async () => {
    const {lat,lon} = await getPos();
    const locationKey = `${lat},${lon}`;
    const cached = store.get('nsForecastV1');
    const c = cached?.locationKey === locationKey && cached?.current && cached?.daily && cached?.hourly ? cached : null;
    if (c) showForecast(c);
    if (!force && c && Date.now()-c.fetchedAt < 15*60e3) return;
    if (!c) NightstandWeather.showStatus('天気予報を取得しています…');
    const params = new URLSearchParams({latitude:lat,longitude:lon,
      current:'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,precipitation,wind_speed_10m',
      hourly:'temperature_2m,weather_code,precipitation_probability,is_day',
      daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
      timezone:'auto',forecast_days:'7',wind_speed_unit:'ms'});
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),15000);
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {cache:'no-store',signal:controller.signal});
      if (!r.ok) throw new Error('Weather unavailable');
      const j = await r.json();
      if (!j.current || !j.daily?.time?.length || !j.hourly?.time?.length) throw new Error('Incomplete forecast');
      const forecast = {...j,locationKey,fetchedAt:Date.now()};
      store.set('nsForecastV1',forecast);showForecast(forecast);
    } catch {
      if (c) {
        NightstandWeather.render(c,{icons:ICON,describe:wmo,stale:true,retry:()=>loadWeather(true)});
      } else {
        NightstandWeather.showStatus('天気予報を取得できませんでした。通信状況を確認して、もう一度お試しください。',()=>loadWeather(true));
      }
    } finally { clearTimeout(timeout); }
  })().catch(()=>{
    NightstandWeather.showStatus('天気予報を取得できませんでした。もう一度お試しください。',()=>loadWeather(true));
  }).finally(()=>{weatherPromise=null;});
  return weatherPromise;
}

