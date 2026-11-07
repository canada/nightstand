import { test, expect } from '@playwright/test';
import { forecast, holidays } from '../support/forecast.js';
import { jmaResponses, latest } from '../support/jma.js';
const url = '/?lat=35.68&lon=139.76';
const modelURL = 'https://api.open-meteo.com/**';
const jmaURL = 'https://www.jma.go.jp/**';
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-05T12:00:00+09:00') });
  await page.route('https://www8.cao.go.jp/**', route => route.fulfill({ status: 503, body: '' }));
  await page.route('https://holidays-jp.github.io/**', route => route.fulfill({ json: holidays }));
  await page.route(modelURL, route => route.fulfill({ json: forecast }));
  await page.route(jmaURL, route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/latest_time.txt')) return route.fulfill({ body: latest, contentType: 'text/plain' });
    return jmaResponses[path] ? route.fulfill({ json: jmaResponses[path] }) : route.fulfill({ status: 404, body: '' });
  });
});
async function ready(page) {
  await page.goto(url);
  await expect(page.locator('#wxTemp')).toHaveText('23°');
}
async function details(page) {
  await page.getByRole('button', { name: '天気予報の詳細を開く' }).click();
  await expect(page.locator('.forecast-day')).toHaveCount(7);
}

test('JMA observations and forecasts take precedence on the clock screen and details identify every provider', async ({ page }) => {
  let modelReads = 0;
  await page.route(modelURL, route => { modelReads++; return route.fulfill({ json: forecast }); });
  await ready(page);
  await expect(page.locator('#wxSub')).toContainText('晴れ');
  await expect(page.locator('#wxSub2')).toHaveText('最高21° 最低10°');
  await details(page);
  await expect(page.locator('.forecast-description')).toContainText('今日の予報：晴れ');
  await expect(page.locator('.forecast-section-source').filter({ hasText: '東京地方' })).toBeVisible();
  await expect(page.getByText('東京観測所', { exact: false })).toBeVisible();
  await expect(page.locator('.forecast-facts')).toContainText('58%');
  await expect(page.locator('.forecast-facts')).toContainText('気象庁');
  await expect(page.locator('.forecast-source')).toContainText('出典：気象庁');
  await expect(page.locator('.forecast-source')).toContainText('加工して表示');
  await expect(page.locator('.forecast-source')).toContainText('Open-Meteo');
  await expect(page.locator('.forecast-hour')).toHaveCount(12);
  await expect(page.locator('.forecast-day').first()).toHaveAttribute('title', /最低気温：Open-Meteo/);
  expect(modelReads).toBe(1); // The classic loader must not race and overwrite JMA.
});

test('JMA remains usable when supplemental weather is unavailable and missing numbers remain dashes', async ({ page }) => {
  await page.route(modelURL, route => route.abort());
  await ready(page);
  await expect(page.locator('#wxSub2')).toHaveText('最高21° 最低—');
  await details(page);
  await expect(page.locator('.forecast-day').first().locator('.forecast-low')).toHaveText('—');
  await expect(page.locator('.forecast-hour')).toHaveCount(0);
  await expect(page.locator('.forecast-provider-note')).toContainText('気象庁で取得できる情報だけ');
});

test('JMA failure falls back explicitly to Open-Meteo and can recover', async ({ page }) => {
  const blocked = route => route.abort();
  await page.route(jmaURL, blocked);
  await page.goto(url);
  await expect(page.locator('#wxTemp')).toHaveText('19°');
  await details(page);
  await expect(page.locator('.forecast-provider-note')).toContainText('気象庁の情報を取得できなかった');
  await page.unroute(jmaURL, blocked);
  await page.keyboard.press('Escape');
  await page.clock.fastForward(16 * 60000);
  await expect(page.locator('#wxTemp')).toHaveText('23°');
  await details(page);
  await expect(page.locator('.forecast-source')).toContainText('気象庁');
});

test('good JMA observations remain in use when only its forecast fails', async ({ page }) => {
  await page.route('https://www.jma.go.jp/bosai/forecast/data/forecast/**', route => route.abort());
  await ready(page);
  await expect(page.locator('#wxSub2')).toHaveText('最高20° 最低10°');
  await details(page);
  await expect(page.locator('.forecast-provider-note')).toContainText('観測値は気象庁');
});

test('missing-quality observations use model values without replacing valid JMA forecasts', async ({ page }) => {
  await page.route('https://www.jma.go.jp/bosai/amedas/data/map/**', route => route.fulfill({ json: { '44132': { temp: [99, 1] } } }));
  await page.goto(url);
  await expect(page.locator('#wxTemp')).toHaveText('19°');
  await expect(page.locator('#wxSub2')).toHaveText('最高21° 最低10°');
  await details(page);
  await expect(page.getByText('現在値：Open-Meteo', { exact: true })).toBeVisible();
});

test('overseas locations do not request unrelated Japanese regional forecasts', async ({ page }) => {
  const reads = [];
  page.on('request', request => { if (request.url().startsWith('https://www.jma.go.jp/')) reads.push(request.url()); });
  await page.goto('/?lat=49.28&lon=-123.12');
  await expect(page.locator('#wxTemp')).toHaveText('19°');
  await details(page);
  await expect(page.locator('.forecast-source a')).toHaveText('Open-Meteo');
  expect(reads).toEqual([]);
});

test('metadata is reused while active forecast and observation data refresh', async ({ page }) => {
  const reads = [];
  page.on('request', request => { if (request.url().startsWith('https://www.jma.go.jp/')) reads.push(new URL(request.url()).pathname); });
  await ready(page);
  await page.clock.fastForward(16 * 60000);
  await expect.poll(() => reads.filter(path => path.includes('/forecast/data/forecast/')).length).toBe(2);
  expect(reads.filter(path => path.endsWith('/geojson/class10s.json'))).toHaveLength(1);
});

test('when both services fail a cached JMA forecast is marked stale and retry recovers', async ({ page }) => {
  await ready(page);
  const blocked = route => route.abort();
  await page.route(jmaURL, blocked);
  await page.route(modelURL, blocked);
  await page.clock.fastForward(16 * 60000);
  await details(page);
  await expect(page.locator('.forecast-notice')).toContainText('前回取得した予報');
  await expect(page.locator('#wxTemp')).toHaveText('23°');
  await page.unroute(jmaURL, blocked);
  await page.unroute(modelURL, blocked);
  await page.getByRole('button', { name: '再取得', exact: true }).click();
  await expect(page.locator('.forecast-notice')).toHaveCount(0);
});

test('a failed optional JMA module leaves fallback weather, calendar and timer working', async ({ page }) => {
  await page.route(target => target.pathname === '/jma-weather.js', route => route.abort());
  await page.goto(url);
  await expect(page.locator('#wxTemp')).toHaveText('19°');
  await expect(page.getByRole('button', { name: /週を開く/ })).toHaveCount(6);
  await page.getByRole('button', { name: '時計・タイマーを開く' }).click();
  await page.getByRole('button', { name: '1分のタイマーを開始', exact: true }).click();
  await expect(page.locator('#timerBadge')).toBeVisible();
});

test('JMA details fit the iPhone 15 Pro viewport and keep the source reachable', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await ready(page);
  await details(page);
  const dialog = page.locator('#weatherDialog');
  const widths = await dialog.evaluate(node => [node.clientWidth, node.scrollWidth]);
  expect(widths[1]).toBeLessThanOrEqual(widths[0] + 1);
  await page.locator('.forecast-source').scrollIntoViewIfNeeded();
  await expect(page.locator('.forecast-source a').first()).toBeInViewport();
});

test('an old cached classic loader cannot race and overwrite the JMA weather', async ({ page }) => {
  await page.route(target => target.pathname === '/classic.js' && !target.search, route => route.fulfill({
    contentType: 'text/javascript', body: 'throw new Error("stale classic weather loader");'
  }));
  await ready(page);
  await expect(page.locator('#wxSub2')).toHaveText('最高21° 最低10°');
  await details(page);
  await expect(page.locator('.forecast-source')).toContainText('気象庁');
});
