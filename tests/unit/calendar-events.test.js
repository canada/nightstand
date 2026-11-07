import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { splitWeekEvents, layoutTimedEvents } from '../../calendar-events.js';
process.env.TZ = 'Asia/Tokyo';
const start = new Date(2026, 10, 1);
const timed = (id, from, to) => ({ id, summary: id, start: { dateTime: from }, end: { dateTime: to } });

test('all-day end dates are exclusive and dates crossing the week are clipped', () => {
  const segments = splitWeekEvents([{ id: 'trip', start: { date: '2026-10-31' }, end: { date: '2026-11-03' } }], start);
  assert.deepEqual(segments.map(event => event.day), [0, 1]);
  assert.ok(segments.every(event => event.allDay));
});
test('a midnight ending creates no extra event on the following day', () => {
  const segments = splitWeekEvents([timed('night', '2026-11-05T23:00:00+09:00', '2026-11-06T00:00:00+09:00')], start);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].day, 4);
  assert.equal(segments[0].endMinutes, 1440);
});
test('multi-day timed events split at local midnight and timezone offsets are converted', () => {
  const segments = splitWeekEvents([timed('night', '2026-11-05T14:30:00Z', '2026-11-05T16:00:00Z')], start);
  assert.deepEqual(segments.map(event => [event.day, event.startMinutes, event.endMinutes]), [[4, 1410, 1440], [5, 0, 60]]);
});
test('cancelled, invalid, reversed and duplicate events are omitted', () => {
  const good = timed('valid', '2026-11-05T10:00:00+09:00', '2026-11-05T11:00:00+09:00');
  const result = splitWeekEvents([good, good, { ...good, id: 'cancel', status: 'cancelled' }, {}, null,
    timed('bad', 'missing', 'missing'), timed('reverse', good.end.dateTime, good.start.dateTime),
    { start: { date: '2026-02-30' }, end: { date: '2026-03-03' } }], start);
  assert.equal(result.length, 1);
});
test('overlapping groups share columns while adjacent events use full width', () => {
  const segments = splitWeekEvents([
    timed('one', '2026-11-05T10:00:00+09:00', '2026-11-05T11:00:00+09:00'),
    timed('two', '2026-11-05T10:30:00+09:00', '2026-11-05T12:00:00+09:00'),
    timed('three', '2026-11-05T11:00:00+09:00', '2026-11-05T11:30:00+09:00'),
    timed('next', '2026-11-05T12:00:00+09:00', '2026-11-05T13:00:00+09:00')], start);
  const positioned = layoutTimedEvents(segments);
  assert.deepEqual(positioned.map(event => event.columns), [2, 2, 2, 1]);
  assert.equal(positioned[0].column, positioned[2].column);
  assert.notEqual(positioned[0].column, positioned[1].column);
});
for (const [date, end] of [['2026-03-08', '2026-03-09'], ['2026-11-01', '2026-11-02']]) {
  test(`all-day dates stay on one day across the DST change on ${date}`, () => {
    const moduleURL = new URL('../../calendar-events.js', import.meta.url).href;
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import {splitWeekEvents} from ${JSON.stringify(moduleURL)};
      const [year,month,day]=${JSON.stringify(date)}.split('-').map(Number);
      const events=splitWeekEvents([{start:{date:${JSON.stringify(date)}},end:{date:${JSON.stringify(end)}}}],new Date(year,month-1,day));
      console.log(JSON.stringify(events.map(event=>[event.day,event.startMinutes,event.endMinutes])));
    `], { env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(result), [[0, 0, 1440]]);
  });
}

test('the same event ID on different calendars keeps separate identity and source details', () => {
  const event = timed('same', '2026-11-05T10:00:00+09:00', '2026-11-05T11:00:00+09:00');
  const segments = splitWeekEvents([
    { ...event, calendarId: 'mine', calendarName: '自分', calendarColor: '#4285f4' },
    { ...event, calendarId: 'family', calendarName: '家族', calendarColor: '#f4511e' }
  ], start);
  assert.equal(segments.length, 2);
  assert.notEqual(segments[0].id, segments[1].id);
  assert.deepEqual(segments.map(event => event.calendarName), ['自分', '家族']);
  assert.ok(layoutTimedEvents(segments).every(event => event.columns === 2));
});
