export function initForecast({ classic, details }) {
  const {
    store,
    icons: ICON,
    describeWeather: wmo,
    getPosition: getPos,
    renderWeather: renderWx
  } = classic;
  details.showStatus('天気予報を取得しています…');
  let weatherPromise = null;
  function showForecast(forecast) {
    const c = forecast.current,
      d = forecast.daily;
    renderWx({
      temp: c.temperature_2m,
      code: c.weather_code,
      isDay: !!c.is_day,
      max: d.temperature_2m_max[0],
      min: d.temperature_2m_min[0],
      pop: d.precipitation_probability_max?.[0]
    });
    details.render(forecast, { icons: ICON, describe: wmo });
  }
  async function loadWeather(force = false) {
    if (weatherPromise) return weatherPromise;
    weatherPromise = (async () => {
      const { lat, lon } = await getPos();
      const locationKey = `${lat},${lon}`;
      const cached = store.get('nsForecastV1');
      const c =
        cached?.locationKey === locationKey && cached?.current && cached?.daily && cached?.hourly
          ? cached
          : null;
      if (c) showForecast(c);
      if (!force && c && Date.now() - c.fetchedAt < 15 * 60e3) return;
      if (!c) details.showStatus('天気予報を取得しています…');
      const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current:
          'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,precipitation,wind_speed_10m',
        hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
        daily:
          'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
        timezone: 'auto',
        forecast_days: '7',
        wind_speed_unit: 'ms'
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!r.ok) throw new Error('Weather unavailable');
        const j = await r.json();
        if (!j.current || !j.daily?.time?.length || !j.hourly?.time?.length)
          throw new Error('Incomplete forecast');
        const forecast = { ...j, locationKey, fetchedAt: Date.now() };
        store.set('nsForecastV1', forecast);
        showForecast(forecast);
      } catch {
        if (c) {
          details.render(c, {
            icons: ICON,
            describe: wmo,
            stale: true,
            retry: () => loadWeather(true)
          });
        } else {
          details.showStatus(
            '天気予報を取得できませんでした。通信状況を確認して、もう一度お試しください。',
            () => loadWeather(true)
          );
        }
      } finally {
        clearTimeout(timeout);
      }
    })()
      .catch(() => {
        details.showStatus('天気予報を取得できませんでした。もう一度お試しください。', () =>
          loadWeather(true)
        );
      })
      .finally(() => {
        weatherPromise = null;
      });
    return weatherPromise;
  }

  return { load: loadWeather };
}
