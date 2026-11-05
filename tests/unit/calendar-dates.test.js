import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  dateKey,
  parseDate,
  addDays,
  weekStart,
  monthAtOffset,
  weekTitle
} from '../../calendar-dates.js';

test('leap day is retained and rolls into March', () => {
  assert.equal(dateKey(addDays(parseDate('2028-02-28'), 1)), '2028-02-29');
  assert.equal(dateKey(addDays(parseDate('2028-02-28'), 2)), '2028-03-01');
  assert.equal(dateKey(addDays(parseDate('2027-02-28'), 1)), '2027-03-01');
});

test('day and month navigation cross year boundaries in either direction', () => {
  assert.equal(dateKey(addDays(parseDate('2026-12-31'), 1)), '2027-01-01');
  assert.equal(dateKey(addDays(parseDate('2027-01-01'), -1)), '2026-12-31');
  assert.equal(dateKey(monthAtOffset(1, parseDate('2026-12-31'))), '2027-01-01');
  assert.equal(dateKey(monthAtOffset(-1, parseDate('2027-01-31'))), '2026-12-01');
});

test('a week begins on Sunday and can span two years', () => {
  assert.equal(dateKey(weekStart(parseDate('2027-01-01'))), '2026-12-27');
  assert.equal(dateKey(weekStart(parseDate('2026-11-01'))), '2026-11-01');
});

test('week labels show the second month only when necessary', () => {
  assert.equal(weekTitle(parseDate('2026-11-01'), parseDate('2026-11-07')), '11月1日〜7日');
  assert.equal(weekTitle(parseDate('2026-12-27'), parseDate('2027-01-02')), '12月27日〜1月2日');
});

for (const timezone of ['Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Auckland']) {
  test(`local date keys and calendar-day arithmetic remain correct in ${timezone}`, () => {
    const moduleURL = new URL('../../calendar-dates.js', import.meta.url).href;
    const result = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import {dateKey,parseDate,addDays,weekStart} from ${JSON.stringify(moduleURL)};
      console.log(JSON.stringify([
        dateKey(parseDate('2026-11-05')),
        dateKey(addDays(parseDate('2026-03-07'),2)),
        dateKey(addDays(parseDate('2026-11-01'),1)),
        dateKey(weekStart(parseDate('2026-03-10')))
      ]));
    `
      ],
      { env: { ...process.env, TZ: timezone }, encoding: 'utf8' }
    );
    assert.deepEqual(JSON.parse(result), ['2026-11-05', '2026-03-09', '2026-11-02', '2026-03-08']);
  });
}
