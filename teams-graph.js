export const CALENDAR_SCOPE = 'https://graph.microsoft.com/Calendars.ReadBasic';
const GRAPH_ORIGIN = 'https://graph.microsoft.com';
const MAX_EVENTS = 1000;

export class CalendarError extends Error {
  constructor(code) { super(code);this.name='CalendarError';this.code=code; }
}

export function calendarRange(offset, now=new Date()) {
  if (!Number.isInteger(offset)) throw new CalendarError('invalid_range');
  const start=new Date(now.getFullYear(),now.getMonth()+offset,1);
  const end=new Date(now.getFullYear(),now.getMonth()+offset+1,1);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) throw new CalendarError('invalid_range');
  return {start,end};
}

export function calendarUrl(offset, now=new Date()) {
  const {start,end}=calendarRange(offset,now);
  const url=new URL('/v1.0/me/calendarView',GRAPH_ORIGIN);
  url.search=new URLSearchParams({
    startDateTime:start.toISOString(),endDateTime:end.toISOString(),
    $select:'id,subject,start,end,isAllDay,isCancelled,sensitivity',
    $orderby:'start/dateTime',$top:'100'
  });
  return url.href;
}

// Only this exact Graph resource may receive the Authorization header.
export function validateCalendarUrl(value) {
  let url;
  try { url=new URL(value); }catch{ throw new CalendarError('invalid_response'); }
  if (url.origin!==GRAPH_ORIGIN || url.username || url.password || url.hash ||
      !/^\/v1\.0\/me\/calendarview\/?$/i.test(url.pathname)) throw new CalendarError('invalid_response');
  return url.href;
}

export function graphTime(value) {
  if (!value || typeof value.dateTime!=='string') return null;
  let text=value.dateTime;
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(text)) {
    if (value.timeZone!=='UTC' && value.timeZone!=='Etc/UTC') return null;
    text+='Z';
  }
  // Graph returns seven fractional digits; normalize to browser ISO milliseconds.
  text=text.replace(/(\.\d{3})\d+(?=Z|[+-]\d{2}:\d{2})/,'$1');
  const time=new Date(text);
  return Number.isFinite(time.getTime())?time:null;
}

export function normalizeEvent(event) {
  if (!event || typeof event.id!=='string' || event.isCancelled) return null;
  const start=graphTime(event.start),end=graphTime(event.end);
  if (!start || !end || end<=start) return null;
  const privateEvent=event.sensitivity==='private' || event.sensitivity==='confidential';
  return {id:event.id,start,end,allDay:!!event.isAllDay,
    title:privateEvent?'非公開の予定':typeof event.subject==='string'?event.subject.slice(0,300)||'件名のない予定':'件名のない予定'};
}

export async function readCalendar({token,offset,signal,fetcher=fetch,now=new Date()}) {
  let next=calendarUrl(offset,now);
  const visited=new Set(),events=new Map();
  for (let page=0;next && page<10;page++) {
    if (signal?.aborted) throw new DOMException('Aborted','AbortError');
    const url=validateCalendarUrl(next);
    if (visited.has(url)) throw new CalendarError('invalid_response');
    visited.add(url);
    const response=await fetcher(url,{
      method:'GET',credentials:'omit',redirect:'error',cache:'no-store',signal,
      headers:{Authorization:`Bearer ${token}`,Prefer:'outlook.timezone="UTC"'}
    });
    if (!response.ok) throw new CalendarError(response.status===401?'sign_in_required':response.status===403?'access_denied':response.status===429?'rate_limited':'unavailable');
    const body=await response.json();
    if (!Array.isArray(body.value)) throw new CalendarError('invalid_response');
    for (const raw of body.value) {
      const event=normalizeEvent(raw);
      if (event) events.set(event.id,event);
      if (events.size>=MAX_EVENTS) break;
    }
    next=body['@odata.nextLink'] || null;
    if (next) validateCalendarUrl(next);
    if (events.size>=MAX_EVENTS) break;
  }
  return {events:[...events.values()].sort((a,b)=>a.start-b.start),truncated:!!next};
}

export function upcomingEvents(events,offset,now=new Date()) {
  return offset===0?events.filter(event=>event.end>now):events;
}

export function eventDate(event,now=new Date()) {
  const sameDay=event.start.getFullYear()===now.getFullYear() && event.start.getMonth()===now.getMonth() && event.start.getDate()===now.getDate();
  const date=sameDay?'今日':new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric'}).format(event.start);
  const time=event.allDay?'終日':new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit',hour12:false}).format(event.start);
  return `${date} ${time}`;
}
