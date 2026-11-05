import './weather-detail.js';
import './timer.js';
const classic = window.NightstandClassic;
const $ = id => document.getElementById(id);
const {store, icons:ICON, describeWeather:wmo, getPosition:getPos, renderWeather:renderWx, lockScreen} = classic;
const style = document.createElement('link');style.rel='stylesheet';style.href=new URL('enhancements.css',import.meta.url);document.head.append(style);
for(const file of ['weather-detail.css','timer.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(file,import.meta.url);document.head.append(link);}
const year=document.createElement('span');year.id='todayYear';
const dateBody=document.createElement('div');dateBody.append($('wday'),$('mday'));$('date').append(year,dateBody);
const controls=document.createElement('nav');controls.id='calControls';controls.setAttribute('aria-label','カレンダーの月移動');
controls.innerHTML=`<div id="calPeriod" aria-live="polite" aria-atomic="true"><span id="selectedYear"></span><span id="selectedMonth"></span></div><button id="currentMonth" type="button" aria-label="今日のカレンダーに戻る" title="今日に戻る"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 3v4m8-4v4M4 10h16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><text id="todayNumber" x="12" y="18.5" text-anchor="middle" fill="currentColor" font-size="8" font-weight="600"></text></svg></button>`;
$('grid').before(controls);
function updateCalendar(){
  const now=new Date(), offset=classic.getMonthOffset();
  const shown=new Date(now.getFullYear(),now.getMonth()+offset,1);
  year.textContent=`${now.getFullYear()}年`;
  $('selectedYear').textContent=`${shown.getFullYear()}年`;
  $('selectedMonth').textContent=`${shown.getMonth()+1}月`;
  $('todayNumber').textContent=now.getDate();
  controls.hidden=offset===0;
  $('currentMonth').disabled=offset===0;
  $('grid').setAttribute('aria-label',`${shown.getFullYear()}年${shown.getMonth()+1}月のカレンダー`);
}
new MutationObserver(updateCalendar).observe($('grid'),{childList:true});updateCalendar();
function changeMonth(delta){classic.setMonthOffset(classic.getMonthOffset()+delta);lockScreen();}
$('currentMonth').addEventListener('click',()=>classic.setMonthOffset(0));
let swipe=null;
const info=$('info');
// Pointer events cover both touch swipes and dragging with a mouse.
info.addEventListener('pointerdown',e=>{
  if(!e.isPrimary || e.button!==0 || e.target.closest('button,#wx'))return;
  swipe={id:e.pointerId,x:e.clientX,y:e.clientY};info.setPointerCapture(e.pointerId);
});
info.addEventListener('pointerup',e=>{
  if(!swipe || swipe.id!==e.pointerId)return;
  const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;
  if(Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy))changeMonth(dx<0?1:-1);
});
info.addEventListener('pointercancel',()=>{swipe=null;});
// Prevent the classic swipe listener from handling the same gesture twice.
for(const event of ['touchstart','touchend','touchcancel'])info.addEventListener(event,e=>e.stopPropagation(),{passive:true});
const classicLink=document.createElement('a');classicLink.id='classicLink';classicLink.textContent='クラシック';const classicURL=new URL(location.href);classicURL.searchParams.delete('next');classicLink.href=classicURL.href;document.body.append(classicLink);
for(const [name,eyebrow,title] of [['weather','WEATHER','天気予報'],['timer','TIMER','タイマー']]){const dialog=document.createElement('dialog');dialog.id=`${name}Dialog`;dialog.className='sheet';dialog.setAttribute('aria-labelledby',`${name}Title`);dialog.innerHTML=`<header class="sheet-header"><div><p class="eyebrow">${eyebrow}</p><h2 id="${name}Title">${title}</h2></div><button type="button" class="close-btn" data-close aria-label="閉じる">×</button></header><div id="${name==='weather'?'weatherDetails':'timerContents'}"></div>`;document.body.append(dialog);dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});}
// Keep classic page gestures out of the scrollable sheets.
for(const event of ['touchstart','touchmove','touchend'])document.addEventListener(event,e=>{if(e.target.closest('dialog'))e.stopPropagation();},{capture:true,passive:true});
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))e.stopPropagation();},true);
function makeTrigger(node,label,open){node.setAttribute('role','button');node.tabIndex=0;node.setAttribute('aria-label',label);node.setAttribute('aria-haspopup','dialog');node.addEventListener('click',open);node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});}
if(!$('wxSub').textContent)$('wxSub').textContent='天気予報を開く';
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

