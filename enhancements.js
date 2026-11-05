import './weather-detail.js';
import './timer.js';
import {teamsConfig} from './teams-config.js';
import {initTeamsCalendar} from './teams-calendar.js';
const classic = window.NightstandClassic;
const $ = id => document.getElementById(id);
const {store, icons:ICON, describeWeather:wmo, getPosition:getPos, renderWeather:renderWx, lockScreen} = classic;
const style = document.createElement('link');style.rel='stylesheet';style.href=new URL('enhancements.css',import.meta.url);document.head.append(style);
for(const file of ['weather-detail.css','timer.css','teams-calendar.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(file,import.meta.url);document.head.append(link);}
let teamsCalendar=null;
const year=document.createElement('span');year.id='todayYear';
const dateBody=document.createElement('div');dateBody.append($('wday'),$('mday'));$('date').append(year,dateBody);
const controls=document.createElement('nav');controls.id='calControls';controls.setAttribute('aria-label','カレンダーの月移動');
controls.innerHTML=`<button id="currentMonth" type="button" aria-label="今日のカレンダーに戻る" title="今日に戻る"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
$('date').append(controls);
$('date').setAttribute('aria-live','polite');
$('date').setAttribute('aria-atomic','true');
function updateCalendar(){
  const now=new Date(), offset=classic.getMonthOffset();
  const shown=new Date(now.getFullYear(),now.getMonth()+offset,1);
  year.textContent=`${shown.getFullYear()}年`;
  $('wday').hidden=offset!==0;
  $('foot').hidden=offset!==0;
  $('mday').textContent=offset===0?`${now.getMonth()+1}月${now.getDate()}日`:`${shown.getMonth()+1}月`;
  controls.hidden=offset===0;
  $('currentMonth').disabled=offset===0;
  $('grid').setAttribute('aria-label',`${shown.getFullYear()}年${shown.getMonth()+1}月のカレンダー`);
  teamsCalendar?.setMonthOffset(offset);
}
new MutationObserver(updateCalendar).observe($('grid'),{childList:true});updateCalendar();
function changeMonth(delta){classic.setMonthOffset(classic.getMonthOffset()+delta);lockScreen();}
$('currentMonth').addEventListener('click',()=>classic.setMonthOffset(0));
const info=$('info');
const grid=$('grid');
const viewport=document.createElement('div');viewport.className='calendar-viewport';
grid.before(viewport);viewport.append(grid);
let swipe=null, settling=false, settleTimer=null;
let previews=[];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function resetSwipe(){
  clearTimeout(settleTimer);settleTimer=null;
  swipe=null;settling=false;
  for(const preview of previews)preview.remove();
  previews=[];
  grid.style.removeProperty('transform');grid.style.removeProperty('transition');
  viewport.classList.remove('dragging');
}
function makePreviews(offset){
  try{
    for(const delta of [-1,1]){
      classic.setMonthOffset(offset+delta);
      const preview=grid.cloneNode(true);
      preview.removeAttribute('id');preview.removeAttribute('aria-label');
      preview.className='calendar-preview';preview.setAttribute('aria-hidden','true');
      preview.dataset.side=delta;
      previews.push(preview);
    }
  }finally{classic.setMonthOffset(offset);}
  viewport.append(...previews);
}
function movePages(dx,width,transition='none'){
  grid.style.transition=transition;grid.style.transform=`translate3d(${dx}px,0,0)`;
  for(const preview of previews){
    preview.style.transition=transition;
    preview.style.transform=`translate3d(${Number(preview.dataset.side)*width+dx}px,0,0)`;
  }
}
function finishSwipe(commit){
  const gesture=swipe;swipe=null;
  if(!gesture?.started)return;
  settling=true;
  const direction=gesture.dx<0?1:-1;
  const duration=reducedMotion.matches?0:180;
  movePages(commit?-direction*gesture.width:0,gesture.width,`transform ${duration}ms cubic-bezier(.2,.8,.2,1)`);
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
  swipe={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,offset:classic.getMonthOffset(),
    width:viewport.clientWidth,started:false,time:performance.now()};
  info.setPointerCapture(e.pointerId);
});
info.addEventListener('pointermove',e=>{
  if(!swipe || swipe.id!==e.pointerId)return;
  const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;
  if(!swipe.started){
    if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;
    if(Math.abs(dy)>Math.abs(dx)){swipe=null;return;}
    swipe.started=true;makePreviews(swipe.offset);viewport.classList.add('dragging');
  }
  swipe.dx=Math.max(-swipe.width,Math.min(swipe.width,dx));
  movePages(swipe.dx,swipe.width);
});
info.addEventListener('pointerup',e=>{
  if(!swipe || swipe.id!==e.pointerId)return;
  if(!swipe.started){swipe=null;return;}
  swipe.dx=Math.max(-swipe.width,Math.min(swipe.width,e.clientX-swipe.x));
  const distance=Math.abs(swipe.dx),elapsed=Math.max(1,performance.now()-swipe.time);
  const threshold=Math.max(30,Math.min(80,swipe.width*.18));
  finishSwipe(distance>=threshold || (distance>=25 && distance/elapsed>.5));
});
info.addEventListener('pointercancel',()=>finishSwipe(false));
info.addEventListener('lostpointercapture',()=>{if(swipe)finishSwipe(false);});
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
teamsCalendar=initTeamsCalendar({config:teamsConfig,offset:classic.getMonthOffset()});
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

