// Weather labels and icon categories from JMA forecast TELOPS.
// Source: https://www.jma.go.jp/bosai/forecast/ (processed for this display).
const WEATHER = {
  "100": ["晴", 0],
  "101": ["晴時々曇", 2],
  "102": ["晴一時雨", 61],
  "103": ["晴時々雨", 61],
  "104": ["晴一時雪", 71],
  "105": ["晴時々雪", 71],
  "106": ["晴一時雨か雪", 61],
  "107": ["晴時々雨か雪", 61],
  "108": ["晴一時雨か雷雨", 61],
  "110": ["晴後時々曇", 2],
  "111": ["晴後曇", 2],
  "112": ["晴後一時雨", 61],
  "113": ["晴後時々雨", 61],
  "114": ["晴後雨", 61],
  "115": ["晴後一時雪", 71],
  "116": ["晴後時々雪", 71],
  "117": ["晴後雪", 71],
  "118": ["晴後雨か雪", 61],
  "119": ["晴後雨か雷雨", 61],
  "120": ["晴朝夕一時雨", 61],
  "121": ["晴朝の内一時雨", 61],
  "122": ["晴夕方一時雨", 61],
  "123": ["晴山沿い雷雨", 0],
  "124": ["晴山沿い雪", 0],
  "125": ["晴午後は雷雨", 61],
  "126": ["晴昼頃から雨", 61],
  "127": ["晴夕方から雨", 61],
  "128": ["晴夜は雨", 61],
  "130": ["朝の内霧後晴", 0],
  "131": ["晴明け方霧", 0],
  "132": ["晴朝夕曇", 2],
  "140": ["晴時々雨で雷を伴う", 61],
  "160": ["晴一時雪か雨", 71],
  "170": ["晴時々雪か雨", 71],
  "181": ["晴後雪か雨", 71],
  "200": ["曇", 3],
  "201": ["曇時々晴", 3],
  "202": ["曇一時雨", 61],
  "203": ["曇時々雨", 61],
  "204": ["曇一時雪", 71],
  "205": ["曇時々雪", 71],
  "206": ["曇一時雨か雪", 61],
  "207": ["曇時々雨か雪", 61],
  "208": ["曇一時雨か雷雨", 61],
  "209": ["霧", 3],
  "210": ["曇後時々晴", 3],
  "211": ["曇後晴", 3],
  "212": ["曇後一時雨", 61],
  "213": ["曇後時々雨", 61],
  "214": ["曇後雨", 61],
  "215": ["曇後一時雪", 71],
  "216": ["曇後時々雪", 71],
  "217": ["曇後雪", 71],
  "218": ["曇後雨か雪", 61],
  "219": ["曇後雨か雷雨", 61],
  "220": ["曇朝夕一時雨", 61],
  "221": ["曇朝の内一時雨", 61],
  "222": ["曇夕方一時雨", 61],
  "223": ["曇日中時々晴", 3],
  "224": ["曇昼頃から雨", 61],
  "225": ["曇夕方から雨", 61],
  "226": ["曇夜は雨", 61],
  "228": ["曇昼頃から雪", 71],
  "229": ["曇夕方から雪", 71],
  "230": ["曇夜は雪", 71],
  "231": ["曇海上海岸は霧か霧雨", 3],
  "240": ["曇時々雨で雷を伴う", 61],
  "250": ["曇時々雪で雷を伴う", 71],
  "260": ["曇一時雪か雨", 71],
  "270": ["曇時々雪か雨", 71],
  "281": ["曇後雪か雨", 71],
  "300": ["雨", 61],
  "301": ["雨時々晴", 61],
  "302": ["雨時々止む", 61],
  "303": ["雨時々雪", 71],
  "304": ["雨か雪", 61],
  "306": ["大雨", 61],
  "308": ["雨で暴風を伴う", 61],
  "309": ["雨一時雪", 71],
  "311": ["雨後晴", 61],
  "313": ["雨後曇", 61],
  "314": ["雨後時々雪", 71],
  "315": ["雨後雪", 71],
  "316": ["雨か雪後晴", 61],
  "317": ["雨か雪後曇", 61],
  "320": ["朝の内雨後晴", 61],
  "321": ["朝の内雨後曇", 61],
  "322": ["雨朝晩一時雪", 71],
  "323": ["雨昼頃から晴", 61],
  "324": ["雨夕方から晴", 61],
  "325": ["雨夜は晴", 61],
  "326": ["雨夕方から雪", 71],
  "327": ["雨夜は雪", 71],
  "328": ["雨一時強く降る", 61],
  "329": ["雨一時みぞれ", 61],
  "340": ["雪か雨", 71],
  "350": ["雨で雷を伴う", 61],
  "361": ["雪か雨後晴", 71],
  "371": ["雪か雨後曇", 71],
  "400": ["雪", 71],
  "401": ["雪時々晴", 71],
  "402": ["雪時々止む", 71],
  "403": ["雪時々雨", 71],
  "405": ["大雪", 71],
  "406": ["風雪強い", 71],
  "407": ["暴風雪", 71],
  "409": ["雪一時雨", 71],
  "411": ["雪後晴", 71],
  "413": ["雪後曇", 71],
  "414": ["雪後雨", 71],
  "420": ["朝の内雪後晴", 71],
  "421": ["朝の内雪後曇", 71],
  "422": ["雪昼頃から雨", 71],
  "423": ["雪夕方から雨", 71],
  "425": ["雪一時強く降る", 71],
  "426": ["雪後みぞれ", 71],
  "427": ["雪一時みぞれ", 71],
  "450": ["雪で雷を伴う", 71]
};
const BASE = 'https://www.jma.go.jp/bosai/';
const DAY = 86400000;
export const japanDay = date => new Date(+date + 9 * 3600000).toISOString().slice(0, 10);
export const jmaNumber = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) ? Number(value) : null;
const probability = value => { const n = jmaNumber(value); return n != null && n >= 0 && n <= 100 ? n : null; };
export function insideGeometry(lon, lat, geometry) {
  function inRing(ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i], [px, py] = ring[j];
      if (Math.abs((lon - x) * (py - y) - (lat - y) * (px - x)) < 1e-9 &&
          lon >= Math.min(x, px) && lon <= Math.max(x, px) && lat >= Math.min(y, py) && lat <= Math.max(y, py)) return true;
      if ((y > lat) !== (py > lat) && lon < (px - x) * (lat - y) / (py - y) + x) inside = !inside;
    }
    return inside;
  }
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.some(rings => rings.length && inRing(rings[0]) && !rings.slice(1).some(inRing));
}
export function selectJmaRegion(metadata, lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return metadata.regions.find(region => insideGeometry(lon, lat, region.geometry)) || null;
}
function distance(lat, lon, station) {
  const radians = Math.PI / 180;
  return (lat - station.lat) ** 2 + ((lon - station.lon) * Math.cos(lat * radians)) ** 2;
}
const seriesFor = (block, field) => block?.timeSeries?.find(series => series.areas?.some(area => Array.isArray(area[field])));
const areaFor = (series, codes) => codes.map(code => series?.areas?.find(area => area.area?.code === code)).find(Boolean);
const clean = text => typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
export function decodeJmaForecast(data, metadata, region, lat, lon, now = new Date()) {
  if (!Array.isArray(data)) throw new Error('Invalid JMA forecast');
  const short = data.find(block => seriesFor(block, 'weathers'));
  const weekly = data.find(block => seriesFor(block, 'tempsMin'));
  const fresh = block => block && Number.isFinite(Date.parse(block.reportDatetime)) &&
    +now - Date.parse(block.reportDatetime) >= -3600000 && +now - Date.parse(block.reportDatetime) <= 18 * 3600000;
  const shortBlock = fresh(short) ? short : null, weekBlock = fresh(weekly) ? weekly : null;
  const days = new Map(), today = japanDay(now);
  const dayRow = date => {
    const key = date.slice(0, 10);
    if (!days.has(key)) days.set(key, { date: key });
    return days.get(key);
  };
  const temperatureNames = new Set();
  const weekCodes = [region.code, ...(metadata.weekGroups[region.code] || [])];
  const weekWeather = seriesFor(weekBlock, 'weatherCodes'), weekArea = areaFor(weekWeather, weekCodes);
  if (weekArea) weekWeather.timeDefines.forEach((date, i) => {
    const condition = WEATHER[weekArea.weatherCodes[i]];
    if (!condition) return;
    Object.assign(dayRow(date), { description: condition[0], weather_code: condition[1], pop: probability(weekArea.pops?.[i]) });
  });
  const weekStations = metadata.weekAreas[region.office]?.filter(item => item.week === weekArea?.area.code).map(item => item.amedas) || [];
  const shortStations = metadata.shortAreas[region.office]?.find(item => item.class10 === region.code)?.amedas || [];
  const nearestFirst = ids => [...new Set(ids)].filter(id => metadata.stations[id]).sort((a, b) => distance(lat, lon, metadata.stations[a]) - distance(lat, lon, metadata.stations[b]));
  const weekTemps = seriesFor(weekBlock, 'tempsMin'), weekTemp = areaFor(weekTemps, nearestFirst(weekStations));
  if (weekTemp) {
    temperatureNames.add(weekTemp.area.name);
    weekTemps.timeDefines.forEach((date, i) => Object.assign(dayRow(date), {
      min: jmaNumber(weekTemp.tempsMin[i]), max: jmaNumber(weekTemp.tempsMax[i])
    }));
  }
  const weather = seriesFor(shortBlock, 'weathers'), shortArea = areaFor(weather, [region.code]);
  if (shortArea) weather.timeDefines.forEach((date, i) => {
    const condition = WEATHER[shortArea.weatherCodes[i]];
    if (!condition) return;
    Object.assign(dayRow(date), { description: clean(shortArea.weathers[i]) || condition[0], weather_code: condition[1] });
  });
  const pops = seriesFor(shortBlock, 'pops'), popArea = areaFor(pops, [region.code]);
  if (popArea) {
    const groups = new Map();
    pops.timeDefines.forEach((date, i) => {
      const value = probability(popArea.pops[i]);
      if (value != null) groups.set(date.slice(0, 10), Math.max(groups.get(date.slice(0, 10)) ?? -1, value));
    });
    for (const [date, pop] of groups) dayRow(date).pop = pop;
  }
  const temps = seriesFor(shortBlock, 'temps'), tempArea = areaFor(temps, nearestFirst(shortStations));
  if (tempArea && weather) {
    temperatureNames.add(tempArea.area.name);
    // JMA repeats today's high in a placeholder slot. It is never today's low.
    const evening = Number(shortBlock.reportDatetime.slice(11, 13)) >= 17;
    weather.timeDefines.slice(0, 2).forEach((date, index) => {
      const row = dayRow(date);
      if (index === 0) { row.min = null; if (!evening) row.max = jmaNumber(tempArea.temps[0]); }
      else {
        const offset = evening ? 0 : 2;
        row.min = jmaNumber(tempArea.temps[offset]);
        row.max = jmaNumber(tempArea.temps[offset + 1]);
      }
    });
  }
  const end = japanDay(new Date(+now + 7 * DAY));
  const result = [...days.values()].filter(row => row.date >= today && row.date < end && Number.isFinite(row.weather_code)).sort((a, b) => a.date.localeCompare(b.date));
  if (!result.length) throw new Error('No JMA forecast for this area');
  return { days: result, shortIssuedAt: shortArea ? shortBlock.reportDatetime : null,
    weekIssuedAt: weekArea ? weekBlock.reportDatetime : null, temperatureNames: [...temperatureNames] };
}
export function decodeJmaObservation(data, time, metadata, region, lat, lon, now = new Date()) {
  const timestamp = Date.parse(time);
  if (!Number.isFinite(timestamp) || +now - timestamp > 60 * 60000 || timestamp - +now > 10 * 60000) return null;
  const read = pair => Array.isArray(pair) && pair[1] === 0 && Number.isFinite(pair[0]) ? pair[0] : null;
  const representative = metadata.shortAreas[region.office]?.find(item => item.class10 === region.code)?.amedas || [];
  const candidates = Object.entries(metadata.stations).filter(([id, station]) =>
    read(data[id]?.temp) != null && (representative.includes(id) || insideGeometry(station.lon, station.lat, region.geometry))
  ).sort(([, a], [, b]) => distance(lat, lon, a) - distance(lat, lon, b));
  if (!candidates.length) return null;
  const [id, station] = candidates[0], observation = data[id];
  return { station: station.name, time, temperature_2m: read(observation.temp),
    relative_humidity_2m: read(observation.humidity), wind_speed_10m: read(observation.wind), precipitation: read(observation.precipitation1h) };
}
export function createJmaWeather({ store }) {
  let metadataPromise;
  async function read(path, signal, text = false) {
    const response = await fetch(BASE + path, { cache: 'no-store', credentials: 'omit', signal });
    if (!response.ok) throw new Error('JMA unavailable');
    return text ? response.text() : response.json();
  }
  async function metadata(signal) {
    const saved = store.get('nsJmaMetaV1');
    if (saved?.regions?.length && saved.stations && saved.shortAreas && saved.weekAreas && saved.weekGroups && saved.savedAt <= Date.now() && Date.now() - saved.savedAt < 7 * DAY) return saved;
    if (metadataPromise) return metadataPromise;
    metadataPromise = Promise.all([
      'common/const/area.json', 'common/const/geojson/class10s.json', 'forecast/const/forecast_area.json',
      'forecast/const/week_area.json', 'forecast/const/week_area05.json', 'amedas/const/amedastable.json'
    ].map(path => read(path, signal))).then(([areas, geo, shortAreas, weekAreas, weekGroups, table]) => {
      const regions = geo.features.map(feature => ({ code: feature.properties.code, name: areas.class10s[feature.properties.code]?.name || feature.properties.name,
        office: areas.class10s[feature.properties.code]?.parent, geometry: feature.geometry })).filter(region => region.office);
      const stations = Object.fromEntries(Object.entries(table).filter(([, value]) => value.lat && value.lon).map(([id, value]) => [id, {
        name: value.kjName, lat: value.lat[0] + value.lat[1] / 60, lon: value.lon[0] + value.lon[1] / 60
      }]));
      if (!regions.length || !Object.keys(stations).length) throw new Error('Invalid JMA metadata');
      const result = { regions, stations, shortAreas, weekAreas, weekGroups, savedAt: Date.now() };
      store.set('nsJmaMetaV1', result);
      return result;
    }).finally(() => { metadataPromise = null; });
    return metadataPromise;
  }
  return async function load(lat, lon) {
    if (lat < 18 || lat > 47 || lon < 120 || lon > 155) return null;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const meta = await metadata(controller.signal), region = selectJmaRegion(meta, lat, lon);
      if (!region) return null;
      const [forecast, observation] = await Promise.allSettled([
        read(`forecast/data/forecast/${region.office}.json`, controller.signal).then(data => decodeJmaForecast(data, meta, region, lat, lon)),
        (async () => {
          const time = (await read('amedas/data/latest_time.txt', controller.signal, true)).trim();
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/.test(time)) throw new Error('Invalid observation time');
          const stamp = time.slice(0, 19).replace(/[-:T]/g, '');
          return decodeJmaObservation(await read(`amedas/data/map/${stamp}.json`, controller.signal), time, meta, region, lat, lon);
        })()
      ]);
      const result = { region: region.name, office: region.office,
        forecast: forecast.status === 'fulfilled' ? forecast.value : null,
        observation: observation.status === 'fulfilled' ? observation.value : null };
      if (!result.forecast && !result.observation) throw new Error('JMA unavailable');
      return result;
    } finally { clearTimeout(timeout); controller.abort(); }
  };
}
