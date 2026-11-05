(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const weekdays = ['日','月','火','水','木','金','土'];
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const value = (n, suffix='', digits=0) => Number.isFinite(n) ? `${n.toFixed(digits)}${suffix}` : '—';
  function icon(code, day, options) {
    const [name, description] = options.describe(code, day);
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 32 32');
    svg.setAttribute('aria-hidden','true');
    svg.innerHTML = options.icons[name] || '';
    return {svg, description};
  }
  function dateLabel(date) {
    const [year,month,day] = date.split('-').map(Number);
    return `${month}/${day}（${weekdays[new Date(Date.UTC(year,month-1,day)).getUTCDay()]}）`;
  }
  function showStatus(message, retry) {
    const root = $('weatherDetails');
    root.replaceChildren(el('p','sheet-note',message));
    if (retry) {
      const button = el('button','sheet-action','もう一度取得');
      button.type = 'button';
      button.addEventListener('click',()=>{showStatus('天気予報を取得しています…');retry();});
      root.append(button);
    }
  }
  function render(forecast, options) {
    const root = $('weatherDetails');
    const c = forecast.current || {}, d = forecast.daily || {}, h = forecast.hourly || {};
    root.replaceChildren();
    if (options.stale) {
      const notice = el('div','forecast-notice');
      notice.append(el('p','sheet-note','更新できなかったため、前回取得した予報を表示しています。'));
      const button = el('button','sheet-action','再取得');button.type='button';
      button.addEventListener('click',()=>options.retry?.());notice.append(button);root.append(notice);
    }
    const current = el('section','forecast-current');
    const currentIcon = icon(c.weather_code,!!c.is_day,options);
    const description = el('div');
    description.append(el('p','forecast-caption','現在の天気'),el('p','forecast-temperature',value(c.temperature_2m,'°')),el('p','forecast-description',currentIcon.description || '天気データなし'));
    current.append(description,currentIcon.svg);root.append(current);
    const facts = el('dl','forecast-facts');
    const entries = [
      ['体感温度',value(c.apparent_temperature,'°')],
      ['湿度',value(c.relative_humidity_2m,'%')],
      ['風速',value(c.wind_speed_10m,' m/s',1)],
      ['降水量',value(c.precipitation,' mm',1)],
      ['日の出',d.sunrise?.[0]?.slice(11,16) || '—'],
      ['日の入り',d.sunset?.[0]?.slice(11,16) || '—']
    ];
    for (const [label,text] of entries) {const fact=el('div');fact.append(el('dt','',label),el('dd','',text));facts.append(fact);}
    root.append(facts);
    const hourlySection = el('section','forecast-section');
    hourlySection.append(el('h3','','これから12時間'));
    const hourly = el('div','forecast-hours');hourly.tabIndex=0;hourly.setAttribute('aria-label','1時間ごとの天気予報。横にスクロールできます');
    const currentHour = (c.time || '').slice(0,13);
    const indices = (h.time || []).map((time,index)=>({time,index})).filter(item=>item.time.slice(0,13)>=currentHour).slice(0,12);
    for (const {time,index} of indices) {
      const cell = el('div','forecast-hour');
      const weather = icon(h.weather_code?.[index],!!h.is_day?.[index],options);
      const hour = Number(time.slice(11,13));
      cell.title = weather.description;
      cell.append(el('span','forecast-caption',`${hour}時`),weather.svg,el('strong','',value(h.temperature_2m?.[index],'°')),el('span','forecast-rain',value(h.precipitation_probability?.[index],'%')));
      hourly.append(cell);
    }
    if (!indices.length) hourly.append(el('p','sheet-note','時間別の予報はありません。'));
    hourlySection.append(hourly);root.append(hourlySection);
    const dailySection = el('section','forecast-section');dailySection.append(el('h3','','7日間の天気'));
    const days = el('div','forecast-days');
    for (let i=0;i<Math.min(7,d.time?.length || 0);i++) {
      const row = el('div','forecast-day');
      const weather = icon(d.weather_code?.[i],true,options);
      const label = i===0 ? '今日' : i===1 ? '明日' : dateLabel(d.time[i]);
      const condition=el('span','forecast-condition',weather.description || '—');
      row.append(el('span','forecast-day-label',label),weather.svg,condition,el('span','forecast-rain',value(d.precipitation_probability_max?.[i],'%')),el('span','forecast-low',value(d.temperature_2m_min?.[i],'°')),el('strong','forecast-high',value(d.temperature_2m_max?.[i],'°')));
      days.append(row);
    }
    dailySection.append(days);root.append(dailySection);
    const updated = el('p','sheet-note forecast-source');
    let timestamp = '—';
    if (Number.isFinite(forecast.fetchedAt)) {
      try {timestamp=new Intl.DateTimeFormat('ja-JP',{timeZone:forecast.timezone || 'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(forecast.fetchedAt);}catch{}
    }
    updated.append(document.createTextNode(`${timestamp} 更新 · ${forecast.timezone || '現地時刻'} · `));
    const source=el('a','','Open-Meteo');source.href='https://open-meteo.com/';source.target='_blank';source.rel='noopener noreferrer';updated.append(source);root.append(updated);
  }
  window.NightstandWeather = {render,showStatus};
})();
