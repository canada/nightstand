const classic = window.NightstandClassic;
const $ = (id) => document.getElementById(id);
// One release identifier covers every enhancement module and stylesheet.
const assetURL = (file) => {
  const url = new URL(file, import.meta.url);
  url.search = new URL(import.meta.url).search;
  return url;
};
for (const file of ['enhancements.css', 'weather-detail.css', 'timer.css', 'week-calendar.css']) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = assetURL(file);
  document.head.append(link);
}
const [dates, ui, month, gestures, forecast] = await Promise.all(
  [
    'calendar-dates.js',
    'sheets.js',
    'month-calendar.js',
    'calendar-gestures.js',
    'forecast.js',
    'weather-detail.js',
    'timer.js'
  ].map((file) => import(assetURL(file)))
);

const calendar = month.initMonthCalendar({ classic, dates });
const navigation = gestures.initCalendarGestures({ classic, calendar, dates });
ui.protectDialogGestures();

const classicURL = new URL(location.href);
classicURL.searchParams.delete('next');
const classicLink = ui.element('a', '', 'クラシック');
classicLink.id = 'classicLink';
classicLink.href = classicURL.href;
document.body.append(classicLink);

const weatherDialog = ui.createSheet({
  name: 'weather',
  eyebrow: 'WEATHER',
  title: '天気予報',
  contentId: 'weatherDetails'
});
const timerDialog = ui.createSheet({
  name: 'timer',
  eyebrow: 'TIMER',
  title: 'タイマー',
  contentId: 'timerContents'
});
const clock = document.querySelector('.clockp');
const badge = ui.element('span');
badge.id = 'timerBadge';
badge.hidden = true;
badge.setAttribute('aria-live', 'off');
clock.append(badge);
NightstandTimer.init();
const weather = forecast.initForecast({ classic, details: window.NightstandWeather });

if (!$('wxSub').textContent) $('wxSub').textContent = '天気予報を開く';
if (!$('wxTemp').textContent) $('wxTemp').textContent = '—';
$('wx').title = '天気予報の詳細';
ui.makeTrigger($('wx'), '天気予報の詳細を開く', () => {
  weatherDialog.showModal();
  classic.lockScreen();
  weather.load();
});
ui.makeTrigger(clock, '時計・タイマーを開く', () => {
  NightstandTimer.open();
  timerDialog.showModal();
  classic.lockScreen();
});
// Weekly view is optional: its loading must not block the basic features.
import(assetURL('week-calendar.js'))
  .then(({ initWeekCalendar }) => {
    initWeekCalendar({ classic, calendar, dates, ui, canOpen: navigation.canOpenWeek });
  })
  .catch((error) => {
    console.warn('週間カレンダーを読み込めませんでした。', error);
  });
