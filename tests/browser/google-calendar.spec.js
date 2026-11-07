import { test, expect } from '@playwright/test';
import { forecast, holidays } from '../support/forecast.js';
const clientId = '1234567890-nightstandtest.apps.googleusercontent.com';
const scope = 'https://www.googleapis.com/auth/calendar.events.readonly';
const api = 'https://www.googleapis.com/calendar/v3/calendars/primary/events**';
const url = '/?next=1&lat=35.68&lon=139.76';
const items = [
  { id: 'a', summary: '会議A', start: { dateTime: '2026-11-05T10:00:00+09:00' }, end: { dateTime: '2026-11-05T11:00:00+09:00' } },
  { id: 'b', summary: '<img src=x onerror=alert(1)>', start: { dateTime: '2026-11-05T10:30:00+09:00' }, end: { dateTime: '2026-11-05T11:30:00+09:00' } },
  { id: 'trip', summary: '出張', start: { date: '2026-11-02' }, end: { date: '2026-11-04' } },
  { id: 'cancel', status: 'cancelled', summary: '中止', start: { date: '2026-11-05' }, end: { date: '2026-11-06' } }
];
async function fixtures(page) {
  await page.clock.install({ time: new Date('2026-11-05T12:00:00+09:00') });
  await page.route('https://www8.cao.go.jp/**', r => r.fulfill({ status: 503, body: '' }));
  await page.route('https://holidays-jp.github.io/**', r => r.fulfill({ json: holidays }));
  await page.route('https://api.open-meteo.com/**', r => r.fulfill({ json: forecast }));
  await page.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: `
    window.googleMock={mode:'success',expires:3600,requests:0};
    window.google={accounts:{oauth2:{initTokenClient(config){
      window.googleConfig={scope:config.scope,include_granted_scopes:config.include_granted_scopes};
      window.completeGoogleAuth=()=>config.callback({access_token:'fake-calendar-token',scope:${JSON.stringify(scope)},expires_in:window.googleMock.expires});
      return {requestAccessToken(){
        window.googleMock.requests++;
        if(window.googleMock.mode==='pending')return;
        if(window.googleMock.mode==='no_scope'){config.callback({access_token:'fake-calendar-token',scope:'openid',expires_in:3600});return;}
        if(window.googleMock.mode==='denied'){config.callback({error:'access_denied'});return;}
        if(window.googleMock.mode==='popup'){config.error_callback({type:'popup_failed_to_open'});return;}
        window.completeGoogleAuth();
      }};
    }}}};
  ` }));
  await page.route(api, r => r.fulfill({ json: { items } }));
}
test.beforeEach(async ({ page }) => fixtures(page));
async function openWeek(page) {
  await page.goto(url);
  await expect(page.locator('#googleCalendarSettings')).toBeAttached();
  await page.getByRole('button', { name: /11月1日から11月7日の週を開く/ }).click();
}
async function openSettings(page) {
  await page.locator('#googleCalendarSettings').click();
  await expect(page.locator('#googleCalendarConnect')).toBeEnabled();
}
async function connect(page) {
  await openSettings(page);
  await page.locator('#googleClientId').fill(clientId);
  await page.locator('#googleCalendarConnect').click();
  await expect(page.locator('#googleCalendarDialog')).not.toBeVisible();
  await expect(page.locator('#googleCalendarStatus')).toContainText('最終更新');
}

test('connection requests only event reads, follows all pages, lays out overlaps and keeps private data out of storage', async ({ page }) => {
  const requests = [];
  await page.route(api, r => {
    requests.push(r.request());
    const next = new URL(r.request().url()).searchParams.get('pageToken');
    return r.fulfill({ json: next ? { items: items.slice(2) } : { items: items.slice(0, 2), nextPageToken: 'page2' } });
  });
  await openWeek(page);
  await expect(page.locator('script[src="https://accounts.google.com/gsi/client"]')).toHaveCount(0);
  await connect(page);
  await expect(page.locator('.google-timed-event')).toHaveCount(2);
  await expect(page.locator('.google-all-day-event')).toHaveCount(2);
  await expect(page.locator('#weekDialog img')).toHaveCount(0);
  await expect(page.locator('.google-timed-event').first()).toHaveCSS('width', await page.locator('.google-timed-event').last().evaluate(n => getComputedStyle(n).width));
  expect(await page.locator('.google-timed-event').first().evaluate(n => n.style.width)).toBe('50%');
  expect(requests).toHaveLength(2);
  const query = new URL(requests[0].url()).searchParams;
  expect(query.get('timeMin')).toBe('2026-10-31T15:00:00.000Z');
  expect(query.get('timeMax')).toBe('2026-11-07T15:00:00.000Z');
  expect(query.get('singleEvents')).toBe('true');
  expect(requests[0].headers().authorization).toBe('Bearer fake-calendar-token');
  expect(await page.evaluate(() => window.googleConfig)).toEqual({ scope, include_granted_scopes: false });
  const stored = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage, location.href]));
  expect(stored).not.toContain('fake-calendar-token');
  expect(stored).not.toContain('会議A');
  await page.getByRole('button', { name: '10:00 会議A', exact: true }).click();
  await expect(page.locator('#googleEventContents')).toContainText('会議A');
});

test('another tab and another browser start disconnected, and reload clears this tab too', async ({ page, browser }) => {
  await openWeek(page);
  await connect(page);
  const otherTab = await page.context().newPage();
  await fixtures(otherTab);
  await openWeek(otherTab);
  await expect(otherTab.locator('.google-event')).toHaveCount(0);
  await expect(otherTab.locator('#googleCalendarDisconnect')).not.toBeVisible();
  const otherContext = await browser.newContext({ timezoneId: 'Asia/Tokyo', locale: 'ja-JP' });
  try {
    const otherDevice = await otherContext.newPage();
    await fixtures(otherDevice);
    await openWeek(otherDevice);
    await expect(otherDevice.locator('.google-event')).toHaveCount(0);
    await expect(otherDevice.locator('#googleClientId')).toHaveValue('');
  } finally { await otherContext.close(); }
  await otherTab.close();
  await page.reload();
  await expect(page.locator('#googleCalendarSettings')).toBeAttached();
  await expect(page.locator('.google-event')).toHaveCount(0);
});

test('failed refresh marks the last result as stale and retry replaces it with an empty success', async ({ page }) => {
  await openWeek(page);
  await connect(page);
  await page.route(api, r => r.abort());
  await page.locator('#googleCalendarRefresh').click();
  await expect(page.locator('#googleCalendarStatus')).toContainText('前回取得した予定');
  await expect(page.locator('.google-timed-event')).toHaveCount(2);
  await page.route(api, r => r.fulfill({ json: { items: [] } }));
  await page.locator('#googleCalendarRefresh').click();
  await expect(page.locator('#googleCalendarStatus')).toContainText('この週の予定はありません');
  await expect(page.locator('.google-event')).toHaveCount(0);
});

test('moving to another week clears the previous range even if the new request fails', async ({ page }) => {
  await openWeek(page);
  await connect(page);
  await page.route(api, r => r.fulfill({ status: 500, json: {} }));
  await page.locator('#weekNext').click();
  await expect(page.locator('#googleCalendarStatus')).toContainText('取得できませんでした');
  await expect(page.locator('#googleCalendarStatus')).not.toContainText('前回取得');
  await expect(page.locator('.google-event')).toHaveCount(0);
});

test('disconnect clears events immediately and an in-flight response cannot restore them', async ({ page }) => {
  await openWeek(page);
  await connect(page);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route(api, async r => { await held; await r.fulfill({ json: { items } }).catch(() => {}); });
  const requested = page.waitForRequest(api);
  await page.locator('#googleCalendarRefresh').click();
  await requested;
  await page.locator('#googleCalendarDisconnect').click();
  await expect(page.locator('.google-event')).toHaveCount(0);
  release();
  await expect(page.locator('#googleCalendarStatus')).toContainText('このタブに表示できます');
  await expect(page.locator('.google-event')).toHaveCount(0);
});

test('a cancelled authorization cannot reconnect through its late callback', async ({ page }) => {
  await openWeek(page);
  await openSettings(page);
  await page.evaluate(() => { window.googleMock.mode = 'pending'; });
  await page.locator('#googleClientId').fill(clientId);
  await page.locator('#googleCalendarConnect').click();
  await page.locator('#googleCalendarCancel').click();
  await page.evaluate(() => window.completeGoogleAuth());
  await expect(page.locator('#googleCalendarDisconnect')).not.toBeVisible();
  await expect(page.locator('.google-event')).toHaveCount(0);
});

test('token expiry clears events and open event details and offers reconnect without opening a popup', async ({ page }) => {
  await openWeek(page);
  await openSettings(page);
  await page.evaluate(() => { window.googleMock.expires = 60; });
  await page.locator('#googleClientId').fill(clientId);
  await page.locator('#googleCalendarConnect').click();
  await page.getByRole('button', { name: '10:00 会議A', exact: true }).click();
  await page.clock.fastForward(61000);
  await expect(page.locator('.google-event')).toHaveCount(0);
  await expect(page.locator('#googleEventDialog')).not.toBeVisible();
  await expect(page.locator('#googleEventContents')).toBeEmpty();
  await expect(page.locator('#googleCalendarStatus')).toContainText('期限が切れました');
  expect(await page.evaluate(() => window.googleMock.requests)).toBe(1);
  await openSettings(page);
  await expect(page.locator('#googleCalendarConnect')).toHaveText('Googleに再接続');
});

for (const code of [401, 403]) test(`API response ${code} clears cached private events`, async ({ page }) => {
  await openWeek(page);
  await connect(page);
  await page.route(api, r => r.fulfill({ status: code, json: {} }));
  await page.locator('#googleCalendarRefresh').click();
  await expect(page.locator('.google-event')).toHaveCount(0);
  await expect(page.locator('#googleCalendarStatus')).toContainText(/接続が切れました|読み取れません/);
});

test('periodic synchronization runs only while the weekly calendar is open', async ({ page }) => {
  let reads = 0;
  await page.route(api, r => { reads++; return r.fulfill({ json: { items } }); });
  await openWeek(page);
  await connect(page);
  expect(reads).toBe(1);
  await page.clock.fastForward(300001);
  await expect.poll(() => reads).toBe(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('#weekDialog')).not.toBeVisible();
  await page.clock.fastForward(300001);
  expect(reads).toBe(2);
});

test('a failed Google module leaves weekly navigation, weather and timer available', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(target => target.pathname === '/google-calendar.js', r => r.abort());
  await page.goto(url);
  await page.getByRole('button', { name: /11月1日から11月7日の週を開く/ }).click();
  await page.locator('#weekNext').click();
  await expect(page.locator('#weekTitle')).toHaveText('11月8日〜14日');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '時計・タイマーを開く' }).click();
  await page.getByRole('button', { name: '1分のタイマーを開始', exact: true }).click();
  await expect(page.locator('#timerBadge')).toBeVisible();
  await page.getByRole('button', { name: '天気予報の詳細を開く' }).click();
  await expect(page.locator('.forecast-day')).toHaveCount(7);
  expect(errors).toEqual([]);
});

test('popup failures and denied consent can be retried', async ({ page }) => {
  await openWeek(page);
  await openSettings(page);
  await page.locator('#googleClientId').fill(clientId);
  await page.evaluate(() => { window.googleMock.mode = 'popup'; });
  await page.locator('#googleCalendarConnect').click();
  await expect(page.locator('#googleCalendarHelp')).toContainText('ポップアップ');
  await page.evaluate(() => { window.googleMock.mode = 'denied'; });
  await page.locator('#googleCalendarConnect').click();
  await expect(page.locator('#googleCalendarHelp')).toContainText('許可されませんでした');
  await page.evaluate(() => { window.googleMock.mode = 'success'; });
  await page.locator('#googleCalendarConnect').click();
  await expect(page.locator('.google-timed-event')).toHaveCount(2);
});

for (const [width, height] of [[320, 568], [548, 291], [844, 390]]) {
  test(`connected calendar and controls fit ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openWeek(page);
    await connect(page);
    await expect(page.locator('#googleCalendarRefresh')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#googleCalendarDisconnect')).toBeInViewport({ ratio: 1 });
    const widths = await page.locator('#weekDialog').evaluate(n => ({ outer: n.clientWidth, inner: n.scrollWidth }));
    expect(widths.inner).toBeLessThanOrEqual(widths.outer + 1);
    await page.getByRole('button', { name: '10:00 会議A', exact: true }).click();
    await expect(page.locator('#googleEventContents')).toContainText('会議A');
  });
}


test('missing calendar consent never makes an API request', async ({ page }) => {
  let reads = 0;
  await page.route(api, r => { reads++; return r.fulfill({ json: { items } }); });
  await openWeek(page);
  await openSettings(page);
  await page.evaluate(() => { window.googleMock.mode = 'no_scope'; });
  await page.locator('#googleClientId').fill(clientId);
  await page.locator('#googleCalendarConnect').click();
  await expect(page.locator('#googleCalendarHelp')).toContainText('許可されませんでした');
  expect(reads).toBe(0);
  await expect(page.locator('.google-event')).toHaveCount(0);
});

test('Google library failure can be retried from the connection screen', async ({ page }) => {
  const blocked = route => route.abort();
  await page.route('https://accounts.google.com/gsi/client', blocked);
  await openWeek(page);
  await page.locator('#googleCalendarSettings').click();
  await expect(page.locator('#googleIdentityRetry')).toBeVisible();
  await expect(page.locator('#googleCalendarConnect')).toBeDisabled();
  await page.unroute('https://accounts.google.com/gsi/client', blocked);
  await page.locator('#googleIdentityRetry').click();
  await expect(page.locator('#googleCalendarConnect')).toBeEnabled();
  await page.locator('#googleClientId').fill(clientId);
  await page.locator('#googleCalendarConnect').click();
  await expect(page.locator('.google-timed-event')).toHaveCount(2);
});

test('a delayed response from the previous week cannot replace the newly selected week', async ({ page }) => {
  await openWeek(page);
  await connect(page);
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route(api, async route => {
    const start = new URL(route.request().url()).searchParams.get('timeMin');
    if (start.startsWith('2026-11-07')) {
      await held;
      await route.fulfill({ json: { items: [items[0]] } }).catch(() => {});
    } else await route.fulfill({ json: { items: [] } });
  });
  const requested = page.waitForRequest(api);
  await page.locator('#weekNext').click();
  await requested;
  await page.locator('#weekNext').click();
  await expect(page.locator('#googleCalendarStatus')).toContainText('この週の予定はありません');
  release();
  await expect(page.locator('#weekTitle')).toHaveText('11月15日〜21日');
  await expect(page.locator('.google-event')).toHaveCount(0);
});

test('repeated pagination tokens report failure without showing a partial success', async ({ page }) => {
  let reads = 0;
  await page.route(api, route => { reads++; return route.fulfill({ json: { items, nextPageToken: 'same' } }); });
  await openWeek(page);
  await openSettings(page);
  await page.locator('#googleClientId').fill(clientId);
  await page.locator('#googleCalendarConnect').click();
  await expect(page.locator('#googleCalendarStatus')).toContainText('取得できませんでした');
  await expect(page.locator('.google-event')).toHaveCount(0);
  expect(reads).toBe(2);
});
