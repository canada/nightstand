export const jmaAreas = { class10s: { '130010': { parent: '130000', name: '東京地方' }, '130020': { parent: '130000', name: '伊豆諸島北部' } } };
const polygon = (x, y, width, height) => ({ type: 'Polygon', coordinates: [[[x,y],[x+width,y],[x+width,y+height],[x,y+height],[x,y]]] });
export const jmaGeo = { type: 'FeatureCollection', features: [
  { properties: { code: '130010', name: '東京都' }, geometry: polygon(138,35,3,1) },
  { properties: { code: '130020', name: '東京都' }, geometry: polygon(138,32,3,2) }
] };
export const jmaShortAreas = { '130000': [
  { class10: '130010', amedas: ['44132'] }, { class10: '130020', amedas: ['44172'] }
] };
export const jmaWeekAreas = { '130000': [
  { srf: '130010', week: '130010', amedas: '44132' }, { srf: '130020', week: '130100', amedas: '44172' }
] };
export const jmaWeekGroups = { '130010': ['130010'], '130020': ['130100'] };
export const jmaStations = {
  '44132': { lat: [35,41.5], lon: [139,45], kjName: '東京' },
  '44172': { lat: [34,0], lon: [139,20], kjName: '大島' }
};
export const latest = '2026-11-05T12:00:00+09:00';
export const jmaObservations = { '44132': { temp: [22.6,0], humidity: [58,0], wind: [2.1,0], precipitation1h: [0,0] } };
export const jmaForecast = [
  { reportDatetime: '2026-11-05T11:00:00+09:00', timeSeries: [
    { timeDefines: ['2026-11-05T11:00:00+09:00','2026-11-06T00:00:00+09:00','2026-11-07T00:00:00+09:00'], areas: [
      { area: { code: '130010', name: '東京地方' }, weatherCodes: ['100','201','300'], weathers: ['晴れ','くもり 時々 晴れ','雨'] },
      { area: { code: '130020', name: '伊豆諸島北部' }, weatherCodes: ['300','300','300'], weathers: ['雨','雨','雨'] }
    ] },
    { timeDefines: ['2026-11-05T12:00:00+09:00','2026-11-05T18:00:00+09:00','2026-11-06T00:00:00+09:00','2026-11-06T06:00:00+09:00','2026-11-06T12:00:00+09:00','2026-11-06T18:00:00+09:00'], areas: [
      { area: { code: '130010' }, pops: ['0','20','','10','50','10'] }
    ] },
    { timeDefines: ['2026-11-05T09:00:00+09:00','2026-11-05T00:00:00+09:00','2026-11-06T00:00:00+09:00','2026-11-06T09:00:00+09:00'], areas: [
      { area: { code: '44132', name: '東京' }, temps: ['21','21','8','18'] },
      { area: { code: '44172', name: '大島' }, temps: ['19','19','11','17'] }
    ] }
  ] },
  { reportDatetime: '2026-11-05T11:00:00+09:00', timeSeries: [
    { timeDefines: [], areas: [
      { area: { code: '130010' }, weatherCodes: ['201','300','200','101','101','100','100'], pops: ['','60','40','20','0','0','0'] },
      { area: { code: '130100' }, weatherCodes: ['300','300','300','300','300','300','300'], pops: ['','70','70','70','70','70','70'] }
    ] },
    { timeDefines: [], areas: [
      { area: { code: '44132', name: '東京' }, tempsMin: ['','7','6','5','4','3','2'], tempsMax: ['','14','15','16','17','18','19'] },
      { area: { code: '44172', name: '大島' }, tempsMin: ['','11','11','11','11','11','11'], tempsMax: ['','16','16','16','16','16','16'] }
    ] }
  ] }
];
for (const series of jmaForecast[1].timeSeries) {
  for (let day = 6; day <= 12; day++) series.timeDefines.push(`2026-11-${String(day).padStart(2,'0')}T00:00:00+09:00`);
}
export const jmaResponses = {
  '/bosai/common/const/area.json': jmaAreas,
  '/bosai/common/const/geojson/class10s.json': jmaGeo,
  '/bosai/forecast/const/forecast_area.json': jmaShortAreas,
  '/bosai/forecast/const/week_area.json': jmaWeekAreas,
  '/bosai/forecast/const/week_area05.json': jmaWeekGroups,
  '/bosai/amedas/const/amedastable.json': jmaStations,
  '/bosai/forecast/data/forecast/130000.json': jmaForecast,
  '/bosai/amedas/data/map/20261105120000.json': jmaObservations
};
export const jmaMetadata = {
  regions: jmaGeo.features.map(feature => ({ code: feature.properties.code, name: jmaAreas.class10s[feature.properties.code].name, geometry: feature.geometry, office: '130000' })),
  shortAreas: jmaShortAreas, weekAreas: jmaWeekAreas, weekGroups: jmaWeekGroups,
  stations: { '44132': { name: '東京', lat: 35+41.5/60, lon: 139.75 }, '44172': { name: '大島', lat: 34, lon: 139+20/60 } }
};
