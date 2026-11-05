export const forecast = {
  timezone: 'Asia/Tokyo',
  current: {
    time: '2026-11-05T12:00',
    temperature_2m: 18.5,
    apparent_temperature: 17.2,
    relative_humidity_2m: 64,
    weather_code: 2,
    is_day: 1,
    precipitation: 0,
    wind_speed_10m: 2.4
  },
  hourly: {
    time: [],
    temperature_2m: [],
    weather_code: [],
    precipitation_probability: [],
    is_day: []
  },
  daily: {
    time: [],
    weather_code: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    precipitation_probability_max: [],
    sunrise: [],
    sunset: []
  }
};
for (let day = 5; day < 12; day++) {
  const date = `2026-11-${String(day).padStart(2, '0')}`;
  forecast.daily.time.push(date);
  forecast.daily.weather_code.push(2);
  forecast.daily.temperature_2m_max.push(20);
  forecast.daily.temperature_2m_min.push(10);
  forecast.daily.precipitation_probability_max.push(20);
  forecast.daily.sunrise.push(`${date}T06:10`);
  forecast.daily.sunset.push(`${date}T16:45`);
  for (let hour = 0; hour < 24; hour++) {
    forecast.hourly.time.push(`${date}T${String(hour).padStart(2, '0')}:00`);
    forecast.hourly.temperature_2m.push(18);
    forecast.hourly.weather_code.push(2);
    forecast.hourly.precipitation_probability.push(20);
    forecast.hourly.is_day.push(hour >= 6 && hour < 17 ? 1 : 0);
  }
}

export const holidays = {
  '2026-10-12': 'スポーツの日',
  '2026-11-03': '文化の日',
  '2026-11-23': '勤労感謝の日',
  '2027-01-01': '元日',
  '2027-01-11': '成人の日'
};
