import './weather-detail.js';
import './timer.js';
const classic = window.NightstandClassic;
const $ = id => document.getElementById(id);
const {store, icons:ICON, describeWeather:wmo, getPosition:getPos, renderWeather:renderWx, lockScreen} = classic;
const style = document.createElement('link');style.rel='stylesheet';style.href=new URL('enhancements.css',import.meta.url);document.head.append(style);
for(const file of ['weather-detail.css','timer.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(file,import.meta.url);document.head.append(link);}
const year=document.createElement('span');year.id='todayYear';
const dateBody=document.createElement('div');dateBody.append($('wday'),$('mday'));$('date').append(year,dateBody);
const chevron=direction=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${direction==='left'?'m14 5-7 7 7 7':'m10 5 7 7-7 7'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const controls=document.createElement('nav');controls.id='calControls';controls.setAttribute('aria-label','カレンダーの月移動');
controls.innerHTML=`<button id="prevMonth" class="cal-nav" type="button" aria-label="前月のカレンダー">${chevron('left')}</button><div id="calPeriod" aria-live="polite" aria-atomic="true"><span id="selectedYear"></span><span id="selectedMonth"></span></div><div id="calActions"><button id="currentMonth" type="button">今月</button><button id="nextMonth" class="cal-nav" type="button" aria-label="翌月のカレンダー">${chevron('right')}</button></div>`;
$('grid').before(controls);
function updateCalendar(){const now=new Date();const shown=new Date(now.getFullYear(),now.getMonth()+classic.getMonthOffset(),1);year.textContent=`${now.getFullYear()}年`;$('selectedYear').textContent=`${shown.getFullYear()}年`;$('selectedMonth').textContent=`${shown.getMonth()+1}月`;$('currentMonth').disabled=classic.getMonthOffset()===0;$('grid').setAttribute('aria-label',`${shown.getFullYear()}年${shown.getMonth()+1}月のカレンダー`);}
new MutationObserver(updateCalendar).observe($('grid'),{childList:true});updateCalendar();
function changeMonth(delta){classic.setMonthOffset(classic.getMonthOffset()+delta);lockScreen();}
$('prevMonth').addEventListener('click',()=>changeMonth(-1));$('nextMonth').addEventListener('click',()=>changeMonth(1));$('currentMonth').addEventListener('click',()=>classic.setMonthOffset(0));
let swipe=null;
$('info').addEventListener('touchstart',e=>{e.stopPropagation();if(e.touches.length!==1||e.target.closest('button,#wx')){swipe=null;return;}swipe={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
$('info').addEventListener('touchend',e=>{e.stopPropagation();if(!swipe||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-swipe.x,dy=e.changedTouches[0].clientY-swipe.y;swipe=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy))changeMonth(dx<0?1:-1);},{passive:true});
$('info').addEventListener('touchcancel',()=>{swipe=null;},{passive:true});
const classicLink=document.createElement('a');classicLink.id='classicLink';classicLink.textContent='クラシック';const classicURL=new URL(location.href);classicURL.searchParams.delete('next');classicLink.href=classicURL.href;document.body.append(classicLink);
for(const [name,eyebrow,title] of [['weather','WEATHER','天気予報'],['timer','TIMER','タイマー']]){const dialog=document.createElement('dialog');dialog.id=`${name}Dialog`;dialog.className='sheet';dialog.setAttribute('aria-labelledby',`${name}Title`);dialog.innerHTML=`<header class="sheet-header"><div><p class="eyebrow">${eyebrow}</p><h2 id="${name}Title">${title}</h2></div><button type="button" class="close-btn" data-close aria-label="閉じる">×</button></header><div id="${name==='weather'?'weatherDetails':'timerContents'}"></div>`;document.body.append(dialog);dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});}
// Keep classic page gestures out of the scrollable sheets.
for(const event of ['touchstart','touchmove','touchend'])document.addEventListener(event,e=>{if(e.target.closest('dialog'))e.stopPropagation();},{capture:true,passive:true});
document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))e.stopPropagation();},true);
function makeTrigger(node,label,open){node.setAttribute('role','button');node.tabIndex=0;node.setAttribute('aria-label',label);node.setAttribute('aria-haspopup','dialog');node.addEventListener('click',open);node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});}
if(!$('wxSub').textContent)$('wxSub').textContent='天気予報を開く';
makeTrigger($('wx'),'天気予報の詳細を開く',()=>{$('weatherDialog').showModal();lockScreen();loadWeather();});
const badge=document.createElement('button');badge.id='timerBadge';badge.type='button';badge.hidden=true;document.body.append(badge);
NightstandTimer.init();
function openTimer(){NightstandTimer.open();$('timerDialog').showModal();lockScreen();}
makeTrigger(document.querySelector('.clockp'),'時計・タイマーを開く',openTimer);badge.addEventListener('click',openTimer);
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

