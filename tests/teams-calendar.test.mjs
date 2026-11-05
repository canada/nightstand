import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarRange,calendarUrl,validateCalendarUrl,graphTime,normalizeEvent,readCalendar,upcomingEvents,CALENDAR_SCOPE} from '../teams-graph.js';

const now=new Date('2026-11-05T01:00:00Z');
const event=(id='a',extra={})=>({id,subject:'打ち合わせ',start:{dateTime:'2026-11-05T02:00:00.0000000',timeZone:'UTC'},
  end:{dateTime:'2026-11-05T03:00:00.0000000',timeZone:'UTC'},...extra});

test('only delegated calendar basics are requested',()=>{
  assert.equal(CALENDAR_SCOPE,'https://graph.microsoft.com/Calendars.ReadBasic');
  const url=new URL(calendarUrl(0,now));
  assert.equal(url.origin,'https://graph.microsoft.com');
  assert.equal(url.pathname,'/v1.0/me/calendarView');
  assert.ok(!url.searchParams.get('$select').match(/body|attendees|attachments|onlineMeeting/));
  assert.equal(url.searchParams.get('$top'),'100');
});

test('month boundaries use real instants and handle year/leap boundaries',()=>{
  const range=calendarRange(2,now);
  assert.equal(range.start.getFullYear(),2027);assert.equal(range.start.getMonth(),0);
  const leap=calendarRange(1,new Date(2028,0,15));
  assert.equal(new Date(leap.end.getFullYear(),leap.end.getMonth(),0).getDate(),29);
  assert.throws(()=>calendarRange(Infinity,now));assert.throws(()=>calendarRange(.5,now));
});

test('pagination cannot send a token to another host or resource',()=>{
  for(const url of ['https://evil.example/v1.0/me/calendarView','http://graph.microsoft.com/v1.0/me/calendarView',
    'https://graph.microsoft.com.evil.example/v1.0/me/calendarView','https://user@graph.microsoft.com/v1.0/me/calendarView',
    'https://graph.microsoft.com/v1.0/users/another/calendarView','https://graph.microsoft.com/v1.0/me/messages',
    'https://graph.microsoft.com/v1.0/me/calendarView#token','not-a-url'])assert.throws(()=>validateCalendarUrl(url),undefined,url);
  assert.equal(validateCalendarUrl('https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=a'),'https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=a');
});

test('Graph UTC fractions and explicit offsets parse without local-time ambiguity',()=>{
  assert.equal(graphTime({dateTime:'2026-11-05T02:00:00.1234567',timeZone:'UTC'}).toISOString(),'2026-11-05T02:00:00.123Z');
  assert.equal(graphTime({dateTime:'2026-11-05T11:00:00+09:00',timeZone:'Tokyo Standard Time'}).toISOString(),'2026-11-05T02:00:00.000Z');
  assert.equal(graphTime({dateTime:'2026-11-05T11:00:00',timeZone:'Tokyo Standard Time'}),null);
  assert.equal(graphTime({dateTime:'invalid',timeZone:'UTC'}),null);
});

test('cancelled/invalid events are removed and private titles are masked',()=>{
  assert.equal(normalizeEvent(event('a',{isCancelled:true})),null);
  assert.equal(normalizeEvent(event('a',{end:{dateTime:'2026-11-04T01:00:00',timeZone:'UTC'}})),null);
  assert.equal(normalizeEvent(event('a',{sensitivity:'private',subject:'秘密の面談'})).title,'非公開の予定');
  assert.equal(normalizeEvent(event('a',{sensitivity:'confidential',subject:'機密'})).title,'非公開の予定');
  const raw='<img src=x onerror=alert(1)>';
  assert.equal(normalizeEvent(event('a',{subject:raw})).title,raw);
  assert.equal(normalizeEvent(event('a',{subject:'a'.repeat(1000)})).title.length,300);
});

test('month loading is read-only, uncached and follows only validated pagination',async()=>{
  const calls=[];
  const result=await readCalendar({token:'TEST_TOKEN',offset:0,now,fetcher:async(url,options)=>{
    calls.push({url,options});
    return new Response(JSON.stringify(calls.length===1?{value:[event('a')],'@odata.nextLink':'https://graph.microsoft.com/v1.0/me/calendarView?$skiptoken=next'}:{value:[event('a'),event('b')]}),{status:200});
  }});
  assert.equal(calls.length,2);assert.equal(result.events.length,2);assert.equal(result.truncated,false);
  for(const call of calls){
    assert.equal(call.options.method,'GET');assert.equal(call.options.credentials,'omit');
    assert.equal(call.options.cache,'no-store');assert.equal(call.options.redirect,'error');
    assert.equal(call.options.headers.Authorization,'Bearer TEST_TOKEN');
    assert.equal(call.options.headers.Prefer,'outlook.timezone="UTC"');
  }
});

test('hostile nextLink is rejected before another request is made',async()=>{
  let requests=0;
  await assert.rejects(readCalendar({token:'TEST_TOKEN',offset:0,now,fetcher:async()=>{
    requests++;return new Response(JSON.stringify({value:[event()], '@odata.nextLink':'https://evil.example/collect'}));
  }}),{code:'invalid_response'});
  assert.equal(requests,1);
});

test('pagination loops and malformed responses fail closed',async()=>{
  const url=calendarUrl(0,now);let requests=0;
  await assert.rejects(readCalendar({token:'TEST_TOKEN',offset:0,now,fetcher:async()=>{
    requests++;return new Response(JSON.stringify({value:[event()], '@odata.nextLink':url}));
  }}),{code:'invalid_response'});
  assert.equal(requests,1);
  await assert.rejects(readCalendar({token:'TEST_TOKEN',offset:0,now,fetcher:async()=>new Response(JSON.stringify({message:'missing events'}))}),{code:'invalid_response'});
});

test('authentication, access and rate-limit failures remain distinct',async()=>{
  for(const [status,code] of [[401,'sign_in_required'],[403,'access_denied'],[429,'rate_limited'],[500,'unavailable']]){
    await assert.rejects(readCalendar({token:'TEST_TOKEN',offset:0,now,fetcher:async()=>new Response('',{status})}),{code});
  }
});

test('aborted requests do not fetch and current-month agenda excludes finished events',async()=>{
  const controller=new AbortController();controller.abort();let requests=0;
  await assert.rejects(readCalendar({token:'TEST_TOKEN',offset:0,now,signal:controller.signal,fetcher:async()=>{requests++;}}),{name:'AbortError'});
  assert.equal(requests,0);
  const events=[{end:new Date('2026-11-05T00:00:00Z')},{end:new Date('2026-11-05T03:00:00Z')}];
  assert.equal(upcomingEvents(events,0,now).length,1);assert.equal(upcomingEvents(events,-1,now).length,2);
});
