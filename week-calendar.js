const weekdays=['日','月','火','水','木','金','土'];
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const parseDate=key=>{const [year,month,day]=key.split('-').map(Number);return new Date(year,month-1,day);};
const addDays=(date,count)=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+count);
const weekStart=date=>addDays(date,-date.getDay());
const shortDate=date=>`${date.getMonth()+1}月${date.getDate()}日`;
const weekTitle=(start,end)=>`${shortDate(start)}〜${start.getMonth()===end.getMonth()?end.getDate()+'日':shortDate(end)}`;

export function initWeekCalendar({classic,grid,viewport,canOpen}){
  const dialog=document.createElement('dialog');
  dialog.id='weekDialog';dialog.className='sheet week-sheet';
  dialog.setAttribute('aria-labelledby','weekYear weekTitle');
  dialog.innerHTML=`<header class="sheet-header week-header">
    <div class="week-heading"><p id="weekYear" class="eyebrow"></p><h2 id="weekTitle"></h2></div>
    <nav class="week-toolbar" aria-label="週の移動">
      <button type="button" id="weekToday">今週</button>
      <button type="button" id="weekPrevious" aria-label="前の週"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
      <button type="button" id="weekNext" aria-label="次の週"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button>
    </nav>
    <button type="button" class="close-btn" id="weekClose" aria-label="閉じる" autofocus>×</button>
  </header>
  <div class="week-scroll" tabindex="0" aria-label="週間カレンダーの時間表"></div>
  <footer class="week-footer"><p class="week-holiday-summary" hidden></p><p class="sheet-note">予定の連携前のため、祝日のみ表示しています。</p></footer>`;
  document.body.append(dialog);
  const scroll=dialog.querySelector('.week-scroll');
  const choices=document.createElement('div');choices.className='calendar-week-buttons';
  choices.setAttribute('role','group');choices.setAttribute('aria-label','週を選んで週間カレンダーを開く');
  viewport.append(choices);
  let start=weekStart(new Date()),openerKey='',minuteTimer;

  function element(tag,className,text){
    const node=document.createElement(tag);if(className)node.className=className;
    if(text!==undefined)node.textContent=text;return node;
  }
  function updateCurrentTime(){
    scroll.querySelectorAll('.week-current-time').forEach(node=>node.remove());
    const now=new Date(),today=dateKey(now);
    for(const title of scroll.querySelectorAll('.week-column-title')){
      const current=title.dataset.date===today;title.classList.toggle('week-today',current);
      if(current)title.setAttribute('aria-current','date');else title.removeAttribute('aria-current');
    }
    const lane=scroll.querySelector(`.week-day-lane[data-date="${today}"]`);
    if(lane){
      const line=element('div','week-current-time');
      line.style.top=`${(now.getHours()*60+now.getMinutes())/1440*100}%`;
      line.setAttribute('role','img');
      line.setAttribute('aria-label',`現在時刻 ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`);
      lane.append(line);
    }
  }
  function render(preserveScroll=false){
    const oldScroll=scroll.scrollTop,end=addDays(start,6),holidays=classic.store.get('holidays')?.d || {};
    dialog.querySelector('#weekYear').textContent=start.getFullYear()===end.getFullYear()?`${start.getFullYear()}年 · 週間`:`${start.getFullYear()}年〜${end.getFullYear()}年 · 週間`;
    dialog.querySelector('#weekTitle').textContent=weekTitle(start,end);
    dialog.querySelector('#weekToday').disabled=dateKey(start)===dateKey(weekStart(new Date()));
    const calendar=element('div','week-calendar');
    const headings=element('div','week-head');headings.append(element('div','week-corner','時刻'));
    const allDay=element('div','week-all-day');allDay.append(element('div','week-corner','終日'));
    const body=element('div','week-time-body'),times=element('div','week-times');
    for(let hour=0;hour<24;hour++){
      const label=element('span','week-hour-label',`${hour}:00`);label.style.setProperty('--hour',hour);times.append(label);
    }
    body.append(times);
    const summary=[];
    for(let day=0;day<7;day++){
      const date=addDays(start,day),key=dateKey(date),holiday=holidays[key];
      const heading=element('div','week-column-title');heading.dataset.date=key;
      heading.setAttribute('aria-label',`${date.getFullYear()}年${shortDate(date)} ${weekdays[day]}曜日`);
      heading.append(element('span','week-weekday',weekdays[day]),element('span','week-date',date.getDate()));
      headings.append(heading);
      const allDayCell=element('div','week-all-day-cell');
      if(holiday){
        const name=element('span','week-holiday',holiday);name.title=holiday;allDayCell.append(name);
        summary.push(`${shortDate(date)}（${weekdays[day]}）${holiday}`);
      }
      allDay.append(allDayCell);
      const lane=element('div','week-day-lane');lane.dataset.date=key;body.append(lane);
    }
    calendar.append(headings,allDay,body);scroll.replaceChildren(calendar);updateCurrentTime();
    const caption=dialog.querySelector('.week-holiday-summary');caption.textContent=summary.join(' · ');caption.hidden=!summary.length;
    if(preserveScroll)scroll.scrollTop=oldScroll;
    else{
      const now=new Date(),current=dateKey(start)===dateKey(weekStart(now));
      const height=parseFloat(getComputedStyle(dialog).getPropertyValue('--week-hour-height'));
      const visibleHeight=Math.max(0,scroll.clientHeight-headings.offsetHeight-allDay.offsetHeight);
      scroll.scrollTop=current?Math.max(0,(now.getHours()+now.getMinutes()/60)*height-visibleHeight*.4):8*height;
    }
  }
  function open(key){
    if(!canOpen() || dialog.open)return;
    openerKey=key;start=weekStart(parseDate(key));dialog.showModal();render();
    clearInterval(minuteTimer);minuteTimer=setInterval(updateCurrentTime,60000);classic.lockScreen();
  }
  function refreshChoices(){
    const focused=choices.contains(document.activeElement)?document.activeElement.dataset.weekStart:null;
    const buttons=[];
    for(let row=0;row<6;row++){
      const key=grid.children[row*7]?.dataset.date;if(!key)continue;
      const date=parseDate(key),end=addDays(date,6),button=element('button','calendar-week-button');
      button.type='button';button.dataset.weekStart=key;
      button.setAttribute('aria-label',`${date.getFullYear()}年${shortDate(date)}から${shortDate(end)}の週を開く`);
      button.addEventListener('click',()=>open(key));buttons.push(button);
    }
    choices.replaceChildren(...buttons);
    if(focused)choices.querySelector(`[data-week-start="${focused}"]`)?.focus({preventScroll:true});
    if(dialog.open)render(true);
  }
  refreshChoices();new MutationObserver(refreshChoices).observe(grid,{childList:true});
  dialog.querySelector('#weekPrevious').addEventListener('click',()=>{start=addDays(start,-7);render();});
  dialog.querySelector('#weekNext').addEventListener('click',()=>{start=addDays(start,7);render();});
  dialog.querySelector('#weekToday').addEventListener('click',()=>{start=weekStart(new Date());render();});
  dialog.querySelector('#weekClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{
    clearInterval(minuteTimer);
    (choices.querySelector(`[data-week-start="${openerKey}"]`)||choices.firstElementChild)?.focus({preventScroll:true});
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dialog.open)updateCurrentTime();});
}
