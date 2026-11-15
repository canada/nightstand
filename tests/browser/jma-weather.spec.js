import { test, expect } from '@playwright/test';
import { forecast, holidays } from '../support/forecast.js';
import { jmaResponses, jmaStations, jmaObservations, latest } from '../support/jma.js';
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

test('JMA observations and forecasts take precedence on the clock screen and source attribution stays in the footer', async ({ page }) => {
  let modelReads = 0;
  await page.route(modelURL, route => { modelReads++; return route.fulfill({ json: forecast }); });
  await ready(page);
  await expect(page.locator('#wxSub')).toContainText('晴れ');
  await expect(page.locator('#wxSub2')).toHaveText('最高21° 最低10°');
  await details(page);
  await expect(page.locator('.forecast-description')).toContainText('今日の予報：晴れ');
  await expect(page.locator('.forecast-current .forecast-caption')).toHaveText('東京');
  await expect(page.locator('.forecast-current')).not.toContainText(/観測所|観測/);
  await expect(page.locator('#weatherDetails')).not.toContainText(/府県予報|気温の予報地点|加工して表示/);
  await expect(page.locator('.forecast-facts')).toContainText('58%');
  await expect(page.locator('.forecast-facts')).not.toContainText(/気象庁|Open-Meteo/);
  await expect(page.locator('.forecast-section').filter({ hasText: /気象庁|Open-Meteo/ })).toHaveCount(0);
  await expect(page.locator('.forecast-source p')).not.toBeVisible();
  await page.locator('.forecast-source summary').click();
  await expect(page.locator('.forecast-source')).toContainText('気象庁');
  await expect(page.locator('.forecast-source')).toContainText('Nightstandが作成');
  await expect(page.locator('.forecast-source')).toContainText('Open-Meteo');
  await expect(page.locator('.forecast-hour')).toHaveCount(12);
  await expect(page.locator('.forecast-day').first()).not.toHaveAttribute('title', /気象庁|Open-Meteo/);
  expect(modelReads).toBe(1); // The classic loader must not race and overwrite JMA.
});

test('JMA remains usable when supplemental weather is unavailable and missing numbers remain dashes', async ({ page }) => {
  await page.route(modelURL, route => route.abort());
  await ready(page);
  await expect(page.locator('#wxSub2')).toHaveText('最高21° 最低—');
  await details(page);
  await expect(page.locator('.forecast-day').first().locator('.forecast-low')).toHaveText('—');
  await expect(page.locator('.forecast-hour')).toHaveCount(0);
  await expect(page.locator('.forecast-provider-note')).toContainText('一部の情報を取得できなかった');
});

test('JMA failure falls back explicitly to Open-Meteo and can recover', async ({ page }) => {
  const blocked = route => route.abort();
  await page.route(jmaURL, blocked);
  await page.goto(url);
  await expect(page.locator('#wxTemp')).toHaveText('19°');
  await details(page);
  await expect(page.locator('.forecast-provider-note')).toContainText('一部の情報を取得できなかった');
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
  await expect(page.locator('.forecast-provider-note')).toContainText('一部の情報を取得できなかった');
});

test('missing-quality observations use model values without replacing valid JMA forecasts', async ({ page }) => {
  await page.route('https://www.jma.go.jp/bosai/amedas/data/map/**', route => route.fulfill({ json: { '44132': { temp: [99, 1] } } }));
  await page.goto(url);
  await expect(page.locator('#wxTemp')).toHaveText('19°');
  await expect(page.locator('#wxSub2')).toHaveText('最高21° 最低10°');
  await details(page);
  await expect(page.locator('.forecast-current')).not.toContainText('Open-Meteo');
  await expect(page.locator('.forecast-current .forecast-caption')).toHaveText('指定地点周辺');
  await expect(page.locator('.forecast-location-note')).toHaveCount(0);
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
  await page.locator('.forecast-source summary').click();
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

test('fresh device coordinates near Nishi-Tokyo select nearby observations and local temperature forecasts', async ({ page }) => {
  const modelRequests = [];
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (success, failure, options) => {
      window.positionOptions = options;
      success({ coords: { latitude: 35.72641, longitude: 139.53832 } });
    };
  });
  await page.route('https://www.jma.go.jp/bosai/amedas/const/amedastable.json', route => route.fulfill({ json: {
    ...jmaStations, '44071': { lat: [35,44.3], lon: [139,35.5], kjName: '練馬' }
  } }));
  await page.route('https://www.jma.go.jp/bosai/amedas/data/map/**', route => route.fulfill({ json: {
    ...jmaObservations, '44071': { temp: [16.2,0], humidity: [60,0], wind: [1.5,0], precipitation1h: [0,0] }
  } }));
  await page.route(modelURL, route => {
    modelRequests.push(new URL(route.request().url()));
    return route.fulfill({ json: forecast });
  });
  await page.goto('/');
  await expect(page.locator('#wxTemp')).toHaveText('16°');
  await expect(page.locator('#wxSub2')).toHaveText('最高20° 最低10°');
  await details(page);
  await expect(page.locator('.forecast-current .forecast-caption')).toHaveText('練馬');
  expect(await page.evaluate(() => window.positionOptions)).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });
  expect(modelRequests[0].searchParams.get('latitude')).toBe('35.7264');
  expect(modelRequests[0].searchParams.get('longitude')).toBe('139.5383');
});

for (const saved of [false, true]) test(`unavailable geolocation explains the ${saved ? 'previous location' : 'Tokyo fallback'} and recovers on scheduled refresh`, async ({ page }) => {
  await page.addInitScript(({ saved }) => {
    if (saved) localStorage.setItem('pos', JSON.stringify({ lat: 35.726, lon: 139.538 }));
    window.positionAvailable = false;
    navigator.geolocation.getCurrentPosition = (success, failure) => {
      if (window.positionAvailable) success({ coords: { latitude: 35.726, longitude: 139.538 } });
      else failure({ code: 1 });
    };
  }, { saved });
  await page.goto('/');
  await expect(page.locator('#wxTemp')).toHaveText('23°');
  await details(page);
  await expect(page.locator('.forecast-location-note')).toContainText(saved ? '前回の場所' : '東京の天気');
  await expect(page.getByRole('button', { name: '現在地で更新' })).toHaveCount(0);
  await page.evaluate(() => { window.positionAvailable = true; });
  await page.clock.fastForward(16 * 60000);
  await expect(page.locator('.forecast-location-note')).toHaveCount(0);
  await expect(page.locator('.forecast-current .forecast-caption')).toHaveText('東京');
});

const hanedaURL = '/?lat=35.5533&lon=139.7811';
async function haneda(page) {
  await page.route('https://www.jma.go.jp/bosai/amedas/const/amedastable.json', route => route.fulfill({ json: {
    ...jmaStations, '44166': { lat: [35,33.2], lon: [139,46.8], kjName: '羽田' }
  } }));
  await page.route('https://www.jma.go.jp/bosai/amedas/data/map/**', route => route.fulfill({ json: {
    ...jmaObservations, '44166': { temp: [14.1,0], wind: [2,0], precipitation1h: [1,0] }
  } }));
}
const fact = (page, name) => page.locator('.forecast-facts > div').filter({ has: page.getByText(name, { exact: true }) }).locator('dd');

test('Haneda humidity, apparent temperature and hourly forecasts survive a failed primary endpoint', async ({ page }) => {
  await haneda(page);
  await page.route('https://api.open-meteo.com/v1/forecast?**', route => route.fulfill({ status:503, body:'' }));
  let backupRequest;
  await page.route('https://api.open-meteo.com/v1/jma?**', route => {
    backupRequest = new URL(route.request().url());
    const backup = structuredClone(forecast);
    delete backup.hourly.precipitation_probability;
    delete backup.daily.precipitation_probability_max;
    return route.fulfill({ json:backup });
  });
  await page.goto(hanedaURL);
  await expect(page.locator('#wxTemp')).toHaveText('14°');
  await details(page);
  await expect(page.locator('.forecast-current .forecast-caption')).toHaveText('羽田');
  await expect(fact(page,'体感温度')).toHaveText('17°');
  await expect(fact(page,'湿度')).toHaveText('64%');
  await expect(page.locator('.forecast-hour')).toHaveCount(12);
  expect(backupRequest.searchParams.get('hourly')).not.toContain('precipitation_probability');
  expect(backupRequest.searchParams.get('daily')).not.toContain('precipitation_probability_max');
});

test('a first supplemental outage retries after one minute and fills Haneda missing values', async ({ page }) => {
  await haneda(page);
  let unavailable = true;
  await page.route(modelURL, route => unavailable ? route.abort() : route.fulfill({ json:forecast }));
  await page.goto(hanedaURL);
  await expect(page.locator('#wxTemp')).toHaveText('14°');
  await details(page);
  await expect(fact(page,'体感温度')).toHaveText('—');
  await expect(fact(page,'湿度')).toHaveText('—');
  await expect(page.locator('.forecast-hour')).toHaveCount(0);
  unavailable = false;
  await page.clock.fastForward(61000);
  await expect(fact(page,'体感温度')).toHaveText('17°');
  await expect(fact(page,'湿度')).toHaveText('64%');
  await expect(page.locator('.forecast-hour')).toHaveCount(12);
  await expect(page.locator('.forecast-provider-note')).toHaveCount(0);
});

test('a partial forecast does not block supplemental recovery for fifteen minutes after reload', async ({ page }) => {
  await haneda(page);
  const blocked = route => route.abort();
  await page.route(modelURL,blocked);
  await page.goto(hanedaURL);
  await expect(page.locator('#wxTemp')).toHaveText('14°');
  await details(page);
  await expect(page.locator('.forecast-hour')).toHaveCount(0);
  await page.unroute(modelURL,blocked);
  await page.reload();
  await details(page);
  await expect(fact(page,'体感温度')).toHaveText('17°');
  await expect(fact(page,'湿度')).toHaveText('64%');
  await expect(page.locator('.forecast-hour')).toHaveCount(12);
});

test('a later outage preserves recent supplemental data while fresh Haneda observations update', async ({ page }) => {
  await haneda(page);
  await page.goto(hanedaURL);
  await expect(page.locator('#wxTemp')).toHaveText('14°');
  const blocked = route => route.abort();
  await page.route(modelURL,blocked);
  await page.route('https://www.jma.go.jp/bosai/amedas/data/map/**', route => route.fulfill({ json: {
    ...jmaObservations, '44166': { temp: [16.5,0], wind: [2,0], precipitation1h: [1,0] }
  } }));
  await page.clock.fastForward(16 * 60000);
  await expect(page.locator('#wxTemp')).toHaveText('17°');
  await details(page);
  await expect(fact(page,'体感温度')).toHaveText('17°');
  await expect(fact(page,'湿度')).toHaveText('64%');
  await expect(page.locator('.forecast-hour')).toHaveCount(12);
  await expect(page.locator('.forecast-provider-note')).toContainText('前回取得した予報');
  await page.unroute(modelURL,blocked);
  await page.getByRole('button',{name:'再取得',exact:true}).click();
  await expect(page.locator('.forecast-provider-note')).toHaveCount(0);
});

for (const invalid of ['old','other-location']) test(`supplemental data from ${invalid} is not reused for Haneda missing values`, async ({ page }) => {
  await haneda(page);
  await page.goto(hanedaURL);
  await expect(page.locator('#wxTemp')).toHaveText('14°');
  await page.evaluate(({ invalid }) => {
    const saved = JSON.parse(localStorage.getItem('nsSupplementalForecastV1'));
    if (invalid === 'old') saved.fetchedAt -= 61 * 60000;
    else saved.locationKey = '49.28,-123.12';
    localStorage.setItem('nsSupplementalForecastV1',JSON.stringify(saved));
  },{invalid});
  await page.route(modelURL,route => route.abort());
  await page.clock.fastForward(16 * 60000);
  await details(page);
  await expect(fact(page,'体感温度')).toHaveText('—');
  await expect(fact(page,'湿度')).toHaveText('—');
  await expect(page.locator('.forecast-hour')).toHaveCount(0);
});
