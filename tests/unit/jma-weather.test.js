import test from 'node:test';
import assert from 'node:assert/strict';
import { jmaNumber, japanDay, insideGeometry, selectJmaRegion, decodeJmaForecast, decodeJmaObservation } from '../../jma-weather.js';
import { combineForecast } from '../../forecast.js';
import { jmaForecast, jmaMetadata, jmaObservations, latest } from '../support/jma.js';
import { forecast } from '../support/forecast.js';
const now = new Date('2026-11-05T12:00:00+09:00');
const region = jmaMetadata.regions[0];
const decode = data => decodeJmaForecast(data, jmaMetadata, region, 35.68,139.76,now);

test('JMA numeric zero is valid while blanks, whitespace and missing values stay missing', () => {
  for (const value of [null,undefined,'',' ','　','--',false]) assert.equal(jmaNumber(value),null);
  assert.equal(jmaNumber('0'),0);
  assert.equal(jmaNumber('-3'),-3);
  assert.equal(jmaNumber(0),0);
});
test('forecast geometry includes boundaries and disjoint islands but excludes holes and overseas', () => {
  const polygon = { type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[2,2],[4,2],[4,4],[2,4],[2,2]]] };
  assert.equal(insideGeometry(0,5,polygon),true);
  assert.equal(insideGeometry(3,3,polygon),false);
  assert.equal(insideGeometry(20,5,polygon),false);
  assert.equal(selectJmaRegion(jmaMetadata,35.68,139.76).code,'130010');
  assert.equal(selectJmaRegion(jmaMetadata,33,139).code,'130020');
  assert.equal(selectJmaRegion(jmaMetadata,49.28,-123.12),null);
  assert.equal(insideGeometry(3,3,{type:'MultiPolygon',coordinates:[polygon.coordinates,[[[20,20],[21,20],[21,21],[20,21],[20,20]]]]}),false);
});
test('JMA forecast dates, short forecasts and temperatures align without treating the repeated high as a low', () => {
  const result = decode(jmaForecast);
  assert.equal(result.days.length,7);
  assert.deepEqual(result.days.slice(0,3).map(day=>[day.date,day.max,day.min,day.pop]),[
    ['2026-11-05',21,null,20],['2026-11-06',18,8,50],['2026-11-07',14,7,60]
  ]);
  assert.equal(result.days[0].description,'晴れ');
  assert.equal(result.days[2].description,'雨');
});
test('the official weekly group is selected for islands instead of using the first mainland area', () => {
  const result = decodeJmaForecast(jmaForecast,jmaMetadata,jmaMetadata.regions[1],33,139,now);
  assert.equal(result.days[2].pop,70);
  assert.equal(result.days[2].min,11);
  assert.equal(result.days[2].max,16);
});
test('evening temperature slots apply to the next day and remain correct after midnight', () => {
  const data = structuredClone(jmaForecast);
  data[0].reportDatetime='2026-11-05T17:00:00+09:00';
  data[0].timeSeries[2].areas[0].temps=['9','19'];
  const result = decodeJmaForecast(data,jmaMetadata,region,35.68,139.76,new Date('2026-11-06T00:30:00+09:00'));
  assert.equal(result.days[0].date,'2026-11-06');
  assert.equal(result.days[0].min,9);
  assert.equal(result.days[0].max,19);
  assert.equal(japanDay(new Date('2026-11-05T15:01:00Z')),'2026-11-06');
});
test('forecast data older than the valid issue window or from the future is rejected', () => {
  assert.throws(()=>decodeJmaForecast(jmaForecast,jmaMetadata,region,35.68,139.76,new Date('2026-11-06T12:00:00+09:00')));
  assert.throws(()=>decodeJmaForecast(jmaForecast,jmaMetadata,region,35.68,139.76,new Date('2026-11-03T12:00:00+09:00')));
});
test('AMeDAS accepts normal zero observations, rejects missing-quality fields and expires old observations', () => {
  const data=structuredClone(jmaObservations);
  data['44132'].temp=[0,0];data['44132'].humidity=[58,1];
  const result=decodeJmaObservation(data,latest,jmaMetadata,region,35.68,139.76,now);
  assert.equal(result.temperature_2m,0);
  assert.equal(result.precipitation,0);
  assert.equal(result.relative_humidity_2m,null);
  assert.equal(decodeJmaObservation(data,'2026-11-05T10:00:00+09:00',jmaMetadata,region,35.68,139.76,now),null);
});
test('an observation from another forecast region is excluded even if closer', () => {
  const metadata=structuredClone(jmaMetadata);
  metadata.stations.outside={name:'別地域',lat:36.001,lon:139.76};
  const data={...jmaObservations,outside:{temp:[99,0]}};
  const result=decodeJmaObservation(data,latest,metadata,region,35.999,139.76,now);
  assert.equal(result.station,'東京');
  assert.notEqual(result.temperature_2m,99);
});
test('JMA takes precedence field by field and missing JMA fields are supplemented without mutating inputs', () => {
  const jma={region:'東京地方',office:'130000',forecast:decode(jmaForecast),observation:decodeJmaObservation(jmaObservations,latest,jmaMetadata,region,35.68,139.76,now)};
  const result=combineForecast(forecast,jma,now);
  assert.equal(result.current.temperature_2m,22.6);
  assert.equal(result.daily.temperature_2m_max[0],21);
  assert.equal(result.daily.temperature_2m_min[0],10);
  assert.equal(result.daily.sources[0].temperature_2m_max,'気象庁');
  assert.equal(result.daily.sources[0].temperature_2m_min,'Open-Meteo');
  assert.equal(result.hourly.time.length,forecast.hourly.time.length);
  assert.equal(forecast.current.temperature_2m,18.5);
  const standalone=combineForecast(null,jma,now);
  assert.equal(standalone.daily.temperature_2m_min[0],null);
  assert.equal(standalone.hourly.time.length,0);
});

test('out-of-range rainfall probabilities are not shown as valid forecasts', () => {
  const data=structuredClone(jmaForecast);
  data[0].timeSeries[1].areas[0].pops=['-1','200','','','',''];
  const result=decode(data);
  assert.equal(result.days[0].pop,undefined);
});
test('supplemental values cannot make the daily low exceed the JMA high', () => {
  const model=structuredClone(forecast);
  model.daily.temperature_2m_min[0]=25;
  const result=combineForecast(model,{region:'東京地方',office:'130000',forecast:decode(jmaForecast)},now);
  assert.equal(result.daily.temperature_2m_max[0],21);
  assert.equal(result.daily.temperature_2m_min[0],null);
});
