const FIELDS = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_probability_max'];
function dayAt(date, timezone) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone || 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function combineForecast(model, jma, now = new Date()) {
  const result = structuredClone(model || { timezone: 'Asia/Tokyo', current: {}, daily: { time: [] }, hourly: { time: [] } });
  result.jma = null;
  result.hasModel = Boolean(model);
  if (!jma) return result;
  result.timezone = 'Asia/Tokyo';
  const today = dayAt(now, 'Asia/Tokyo');
  const rows = new Map();
  for (let index = 0; index < result.daily.time.length; index++) {
    const row = { date: result.daily.time[index], sources: {} };
    for (const field of FIELDS) { row[field] = result.daily[field]?.[index] ?? null; row.sources[field] = 'Open-Meteo'; }
    rows.set(row.date, row);
  }
  for (const day of jma.forecast?.days || []) {
    const row = rows.get(day.date) || { date: day.date, sources: {} };
    for (const [key, value] of Object.entries({ weather_code: day.weather_code, temperature_2m_max: day.max,
      temperature_2m_min: day.min, precipitation_probability_max: day.pop })) {
      if (Number.isFinite(value)) { row[key] = value; row.sources[key] = '気象庁'; }
    }
    row.description = day.description;
    rows.set(day.date, row);
  }
  const ordered = [...rows.values()].filter(row => row.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
  for (const row of ordered) {
    if (row.temperature_2m_min > row.temperature_2m_max && Number.isFinite(row.temperature_2m_min) && Number.isFinite(row.temperature_2m_max)) {
      // Do not invent an impossible high/low pair by mixing different providers.
      for (const field of ['temperature_2m_min', 'temperature_2m_max']) {
        if (row.sources[field] === 'Open-Meteo') { row[field] = null; row.sources[field] = ''; }
      }
    }
  }
  const daily = { ...result.daily, time: ordered.map(row => row.date), descriptions: ordered.map(row => row.description || ''), sources: ordered.map(row => row.sources) };
  for (const field of FIELDS) daily[field] = ordered.map(row => row[field] ?? null);
  // Sunrise/sunset belong to the model dates and must not shift when JMA fills a day.
  for (const field of ['sunrise', 'sunset']) daily[field] = ordered.map(row => {
    const index = result.daily.time.indexOf(row.date);
    return index >= 0 ? result.daily[field]?.[index] || null : null;
  });
  result.daily = daily;
  const current = result.current;
  current.sources = Object.fromEntries(['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'precipitation', 'apparent_temperature'].map(field => [field, model ? 'Open-Meteo' : '']));
  if (jma.observation) {
    for (const field of ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'precipitation']) {
      if (Number.isFinite(jma.observation[field])) { current[field] = jma.observation[field]; current.sources[field] = '気象庁'; }
    }
    current.time = jma.observation.time;
  }
  const todayForecast = jma.forecast?.days.find(day => day.date === today);
  if (todayForecast) {
    current.weather_code = todayForecast.weather_code;
    current.description = todayForecast.description;
    current.conditionCaption = '今日の予報';
  }
  if (!current.time) current.time = now.toISOString();
  if (current.is_day == null) current.is_day = Number(new Date(+now + 9 * 3600000).getUTCHours() >= 6 && new Date(+now + 9 * 3600000).getUTCHours() < 18);
  result.jma = { region: jma.region, office: jma.office, forecast: Boolean(jma.forecast),
    station: jma.observation?.station || '', observedAt: jma.observation?.time || null,
    shortIssuedAt: jma.forecast?.shortIssuedAt, weekIssuedAt: jma.forecast?.weekIssuedAt,
    temperatureNames: jma.forecast?.temperatureNames || [] };
  return result;
}

export function initForecast({ classic, details, loadJma }) {
  const { store, icons, describeWeather, getPosition, renderWeather } = classic;
  details.showStatus('天気予報を取得しています…');
  let weatherPromise = null;
  const jmaProvider = loadJma().then(module => module.createJmaWeather({ store })).catch(() => null);
  function showForecast(forecast, options = {}) {
    const c = forecast.current, d = forecast.daily;
    const index = d.time.indexOf(dayAt(new Date(), forecast.timezone));
    renderWeather({ temp: c.temperature_2m, code: c.weather_code, isDay: !!c.is_day,
      max: d.temperature_2m_max?.[index], min: d.temperature_2m_min?.[index], pop: d.precipitation_probability_max?.[index] });
    const value = n => Number.isFinite(n) ? `${Math.round(n)}°` : '—';
    document.getElementById('wxTemp').textContent = value(c.temperature_2m);
    document.getElementById('wxSub2').textContent = `最高${value(d.temperature_2m_max?.[index])} 最低${value(d.temperature_2m_min?.[index])}`;
    if (c.description) {
      const pop = d.precipitation_probability_max?.[index];
      document.getElementById('wxSub').textContent = c.description + (Number.isFinite(pop) && pop >= 20 ? ` · 降水${pop}%` : '');
    }
    document.getElementById('wx').title = forecast.jma
      ? `${forecast.jma.region} · 天気予報の詳細` : '天気予報の詳細';
    details.render(forecast, { icons, describe: describeWeather, ...options });
  }
  async function modelWeather(lat, lon) {
    const params = new URLSearchParams({ latitude: lat, longitude: lon,
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,precipitation,wind_speed_10m',
      hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
      timezone: 'auto', forecast_days: '7', wind_speed_unit: 'ms' });
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Weather unavailable');
      const data = await response.json();
      if (!data.current || !data.daily?.time?.length || !data.hourly?.time?.length) throw new Error('Incomplete forecast');
      return data;
    } finally { clearTimeout(timeout); }
  }
  async function loadWeather(force = false) {
    if (weatherPromise) return weatherPromise;
    weatherPromise = (async () => {
      const { lat, lon } = await getPosition(), locationKey = `${lat},${lon}`;
      const cached = store.get('nsForecastV2');
      const c = cached?.locationKey === locationKey && cached?.current && cached?.daily?.time?.length && cached?.hourly ? cached : null;
      if (c) showForecast(c);
      if (!force && c && c.dayKey === dayAt(new Date(), c.timezone) && Date.now() - c.fetchedAt < 15 * 60000) return;
      if (!c) details.showStatus('天気予報を取得しています…');
      const [model, jma] = await Promise.allSettled([
        modelWeather(lat, lon),
        jmaProvider.then(provider => { if (!provider) throw new Error('JMA unavailable'); return provider(lat, lon); })
      ]);
      const modelData = model.status === 'fulfilled' ? model.value : null;
      const jmaData = jma.status === 'fulfilled' ? jma.value : null;
      if (!modelData && !jmaData?.forecast) {
        if (c) showForecast(c, { stale: true, retry: () => loadWeather(true) });
        else details.showStatus('天気予報を取得できませんでした。通信状況を確認して、もう一度お試しください。', () => loadWeather(true));
        return;
      }
      const forecast = combineForecast(modelData, jmaData);
      Object.assign(forecast, { locationKey, fetchedAt: Date.now(), dayKey: dayAt(new Date(), forecast.timezone),
        jmaUnavailable: jma.status === 'rejected', modelUnavailable: !modelData });
      store.set('nsForecastV2', forecast);
      showForecast(forecast);
    })().catch(() => details.showStatus('天気予報を取得できませんでした。もう一度お試しください。', () => loadWeather(true)))
      .finally(() => { weatherPromise = null; });
    return weatherPromise;
  }
  void loadWeather();
  setInterval(() => { if (!document.hidden) void loadWeather(); }, 15 * 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void loadWeather(); });
  return { load: loadWeather };
}
