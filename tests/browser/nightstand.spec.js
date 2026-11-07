import { test, expect } from '@playwright/test';
import { forecast, holidays } from '../support/forecast.js';

const now = new Date('2026-11-05T12:00:00+09:00');
const url = '/?next=1&lat=35.68&lon=139.76';
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: now });
  await page.route('https://www8.cao.go.jp/**', (route) =>
    route.fulfill({ status: 503, body: '' })
  );
  await page.route('https://holidays-jp.github.io/**', (route) =>
    route.fulfill({ json: holidays })
  );
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: forecast }));
});

async function openApp(page) {
  await page.goto(url);
  await expect(page.getByRole('button', { name: /週を開く/ })).toHaveCount(6);
  await expect(page.locator('#wxTemp')).toHaveText('19°');
}
async function drag(page, dy, dx = 0) {
  const rect = await page.locator('#grid').boundingBox();
  const x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 5 });
  await page.mouse.up();
}
async function goNext(page) {
  await page.keyboard.press('ArrowDown');
}

async function exerciseBasicFeatures(page) {
  await expect(page.locator('#mday')).toHaveText('11月');
  await drag(page, -90);
  await expect(page.locator('#mday')).toHaveText('12月');
  await page.getByRole('button', { name: '時計・タイマーを開く' }).click();
  await page.getByRole('button', { name: '1分のタイマーを開始', exact: true }).click();
  await expect(page.getByRole('button', { name: '一時停止', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '天気予報の詳細を開く' }).click();
  await expect(page.locator('.forecast-day')).toHaveCount(7);
  await page.keyboard.press('Escape');
}

test('basic features remain usable when the weekly module fails to load', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const failed = page.waitForEvent('requestfailed', {
    predicate: (request) => new URL(request.url()).pathname === '/week-calendar.js'
  });
  await page.route(
    (target) => target.pathname === '/week-calendar.js',
    (route) => route.abort('failed')
  );
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await failed;
  await exerciseBasicFeatures(page);
  await expect(page.getByRole('button', { name: /週を開く/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('basic features work while the weekly module is pending and its latest month loads later', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const requested = page.waitForRequest((request) => new URL(request.url()).pathname === '/week-calendar.js');
  await page.route((target) => target.pathname === '/week-calendar.js', async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await requested;
    await exerciseBasicFeatures(page);
    await expect(page.getByRole('button', { name: /週を開く/ })).toHaveCount(0);
  } finally {
    release();
  }
  const week = page.getByRole('button', { name: /11月29日から12月5日の週を開く/ });
  await expect(week).toBeVisible();
  await week.click();
  await expect(page.locator('#weekTitle')).toHaveText('11月29日〜12月5日');
  await expect(page.locator('#mday')).toHaveText('12月');
  expect(errors).toEqual([]);
});

test('an old unversioned module cannot replace the current release', async ({ page }) => {
  const resources = [];
  page.on('request', (request) => resources.push(request.url()));
  await page.route(
    (target) =>
      target.pathname.endsWith('.js') && !target.search && target.pathname !== '/classic.js',
    (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: 'throw new Error("stale cached module");'
      })
  );
  await openApp(page);
  const modules = resources
    .map((url) => new URL(url))
    .filter(
      (url) => /\.(js|css)$/.test(url.pathname) && !/\/classic\.(js|css)$/.test(url.pathname)
    );
  const versions = new Set(modules.map((url) => url.searchParams.get('v')));
  expect(versions.size).toBe(1);
  expect(versions.has(null)).toBe(false);
});

test('classic loads independently without enhancement resources', async ({ page }) => {
  const resources = [];
  page.on('request', (request) => resources.push(request.url()));
  await page.goto('/?lat=35.68&lon=139.76');
  await expect(page.locator('#mday')).toHaveText('11月5日');
  await expect(page.locator('#clock .num')).toHaveCount(12);
  expect(resources.some((url) => /enhancements|week-calendar|timer\.js/.test(url))).toBe(false);
});

test('month navigation keeps dates continuous and restores today and month holidays', async ({
  page
}) => {
  await openApp(page);
  await expect(page.locator('#wday')).toHaveText('5日（木）');
  await goNext(page);
  await expect(page.locator('#mday')).toHaveText('12月');
  await expect(page.locator('#grid [data-date="2027-01-01"]')).toHaveText('1');
  await goNext(page);
  await expect(page.locator('#todayYear')).toHaveText('2027年');
  await expect(page.locator('#foot')).toContainText('元日');
  await expect(page.locator('#foot')).toContainText('成人の日');
  await page.getByRole('button', { name: '今日のカレンダーに戻る' }).click();
  await expect(page.locator('#wday')).toBeVisible();
  await expect(page.locator('#mday')).toHaveText('11月');
});

test('a tap opens its week; dragging switches months without opening a week', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /11月1日から11月7日の週を開く/ }).click();
  const week = page.getByRole('dialog', { name: /11月1日〜7日/ });
  await expect(week).toBeVisible();
  await expect(week).toContainText('文化の日');
  await page.getByRole('button', { name: '次の週', exact: true }).click();
  await expect(page.locator('#weekTitle')).toHaveText('11月8日〜14日');
  await page.getByRole('button', { name: '今週', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(week).not.toBeVisible();
  await drag(page, -90);
  await expect(page.locator('#mday')).toHaveText('12月');
  await expect(page.locator('#weekDialog')).not.toBeVisible();
});

test('short and horizontal gestures do not activate a week or change month', async ({ page }) => {
  await openApp(page);
  await drag(page, 15);
  await expect(page.locator('#mday')).toHaveText('11月');
  await drag(page, 0, 80);
  await expect(page.locator('#weekDialog')).not.toBeVisible();
  await expect(page.locator('#mday')).toHaveText('11月');
});

test('a leap-day week opens from the calendar and restores keyboard focus when closed', async ({
  page
}) => {
  await openApp(page);
  for (let month = 0; month < 15; month++) await goNext(page);
  await expect(page.locator('#todayYear')).toHaveText('2028年');
  await expect(page.locator('#grid [data-date="2028-02-29"]')).toHaveText('29');
  const row = page.getByRole('button', { name: /2月27日から3月4日の週を開く/ });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#weekTitle')).toHaveText('2月27日〜3月4日');
  await expect(page.locator('.week-column-title[data-date="2028-02-29"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(row).toBeFocused();
});

test('wheel over a week row navigates; wheel inside the weekly sheet only scrolls time', async ({
  page
}) => {
  await openApp(page);
  await page
    .getByRole('button', { name: /週を開く/ })
    .nth(2)
    .hover();
  await page.mouse.wheel(0, 100);
  await expect(page.locator('#mday')).toHaveText('12月');
  await page.getByRole('button', { name: '今日のカレンダーに戻る' }).click();
  await page
    .getByRole('button', { name: /週を開く/ })
    .first()
    .click();
  await page.locator('.week-scroll').evaluate((node) => (node.scrollTop = 0));
  await page.locator('.week-scroll').hover();
  await page.mouse.wheel(0, 200);
  await expect
    .poll(() => page.locator('.week-scroll').evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  await expect(page.locator('#mday')).toHaveText('11月');
});

test('weather details show cached data when offline and can retry', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: '天気予報の詳細を開く' }).click();
  await expect(page.locator('.forecast-day')).toHaveCount(7);
  await page.keyboard.press('Escape');
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await page.clock.fastForward(16 * 60 * 1000);
  await page.getByRole('button', { name: '天気予報の詳細を開く' }).click();
  await expect(
    page.getByText('更新できなかったため、前回取得した予報を表示しています。')
  ).toBeVisible();
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: forecast }));
  await page.getByRole('button', { name: '再取得', exact: true }).click();
  await expect(page.locator('.forecast-notice')).toHaveCount(0);
});

test('a first weather failure offers a working retry', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort());
  await page.goto(url);
  await expect(page.getByRole('button', { name: /週を開く/ })).toHaveCount(6);
  await page.getByRole('button', { name: '天気予報の詳細を開く' }).click();
  await expect(page.getByText(/天気予報を取得できませんでした/)).toBeVisible();
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: forecast }));
  await page.getByRole('button', { name: 'もう一度取得' }).click();
  await expect(page.locator('.forecast-day')).toHaveCount(7);
});

test('a custom timer survives reload, pauses, resumes, finishes and clears its badge', async ({
  page
}) => {
  await openApp(page);
  await page.getByRole('button', { name: '時計・タイマーを開く' }).click();
  await page.getByRole('spinbutton', { name: 'タイマーの分' }).fill('0');
  await page.getByRole('spinbutton', { name: 'タイマーの秒' }).fill('5');
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await page.reload();
  await expect(page.locator('#timerBadge')).toHaveClass(/paused/);
  await page.getByRole('button', { name: '時計・タイマーを開く' }).click();
  await page.getByRole('button', { name: '再開', exact: true }).click();
  await page.clock.fastForward(6000);
  await expect(page.locator('#timerState')).toHaveText('終了');
  await expect(page.locator('#timerBadge')).toHaveText('00:00');
  await page.clock.fastForward(31000);
  await expect(page.locator('#timerBadge')).not.toBeVisible();
});

test('a running timer restores its deadline after reload', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: '時計・タイマーを開く' }).click();
  await page.getByRole('button', { name: '1分のタイマーを開始', exact: true }).click();
  await page.clock.fastForward(20000);
  await page.reload();
  await expect(page.locator('#timerBadge')).toHaveText(/^00:(39|40)$/);
});

test('zero-length timers remain unstarted and show a validation message', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: '時計・タイマーを開く' }).click();
  await page.getByRole('spinbutton', { name: 'タイマーの分' }).fill('0');
  await page.getByRole('spinbutton', { name: 'タイマーの秒' }).fill('0');
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('1秒以上の時間を設定してください。');
  await expect(page.locator('#timerBadge')).not.toBeVisible();
});

test('real touch distinguishes a tap, a cancelled swipe and a committed swipe', async ({
  page,
  browserName
}) => {
  test.skip(
    browserName !== 'chromium',
    'Native touch injection uses the Chromium protocol; pointer behavior is covered on both engines.'
  );
  await openApp(page);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const touch = async (type, points) => {
    await client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((point) => ({ ...point, id: 1 }))
    });
  };
  const rect = await page.locator('#grid').boundingBox();
  const x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2;
  await touch('touchStart', [{ x, y: y + 40 }]);
  await touch('touchMove', [{ x, y: y - 50 }]);
  await touch('touchCancel', []);
  await expect(page.locator('#mday')).toHaveText('11月');
  await expect(page.locator('#weekDialog')).not.toBeVisible();
  // Wait for snap-back before beginning another independent gesture.
  await expect(page.locator('.calendar-viewport')).not.toHaveClass(/dragging/);
  const row = await page
    .getByRole('button', { name: /週を開く/ })
    .first()
    .boundingBox();
  const point = { x: row.x + row.width / 2, y: row.y + row.height / 2 };
  await touch('touchStart', [point]);
  await touch('touchEnd', []);
  await expect(page.locator('#weekDialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await touch('touchStart', [{ x, y: y + 40 }]);
  await touch('touchMove', [{ x, y }]);
  await touch('touchMove', [{ x, y: y - 50 }]);
  await touch('touchEnd', []);
  await expect(page.locator('#mday')).toHaveText('12月');
  await expect(page.locator('#weekDialog')).not.toBeVisible();
});

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [548, 291],
  [667, 375],
  [844, 390]
]) {
  test(`weekly calendar and controls fit ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openApp(page);
    await page
      .getByRole('button', { name: /週を開く/ })
      .first()
      .click();
    const calendar = page.locator('#weekDialog');
    await expect(calendar).toBeVisible();
    const rect = await calendar.boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1);
    const columns = await page.locator('.week-column-title').all();
    expect(columns).toHaveLength(7);
    await expect(page.getByRole('button', { name: '閉じる', exact: true })).toBeInViewport();
  });
}
