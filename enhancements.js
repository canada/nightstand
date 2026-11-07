const classic = window.NightstandClassic;
const $ = (id) => document.getElementById(id);
// One release identifier covers every enhancement module and stylesheet.
const assetURL = (file) => {
  const url = new URL(file, import.meta.url);
  url.search = new URL(import.meta.url).search;
  return url;
};
for (const file of ['enhancements.css', 'weather-detail.css', 'timer.css', 'week-calendar.css', 'google-calendar.css']) {
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

const classicURL = new URL('classic.html', location.href);
classicURL.search = location.search;
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
const badge = ui.element('button');
badge.type = 'button';
badge.id = 'timerBadge';
badge.hidden = true;
badge.setAttribute('aria-live', 'off');
clock.append(badge);
NightstandTimer.init({ onStart() { timerDialog.close(); $('clock').focus(); } });
const weather = forecast.initForecast({ classic, details: window.NightstandWeather });

if (!$('wxSub').textContent) $('wxSub').textContent = '天気予報を開く';
if (!$('wxTemp').textContent) $('wxTemp').textContent = '—';
$('wx').title = '天気予報の詳細';
ui.makeTrigger($('wx'), '天気予報の詳細を開く', () => {
  weatherDialog.showModal();
  classic.lockScreen();
  weather.load();
});
function openTimer() {
  NightstandTimer.open();
  timerDialog.showModal();
  classic.lockScreen();
}
ui.makeTrigger($('clock'), '時計・タイマーを開く', openTimer);
badge.addEventListener('click', () => {
  if (NightstandTimer.dismissFinished()) $('clock').focus();
  else openTimer();
});
// Weekly view is optional: its loading must not block the basic features.
import(assetURL('week-calendar.js'))
  .then(({ initWeekCalendar }) => {
    const week = initWeekCalendar({ classic, calendar, dates, ui, canOpen: navigation.canOpenWeek });
    // Calendar connections are optional and must not block the weekly view.
    Promise.all(['google-calendar.js', 'calendar-events.js', 'google-calendar-view.js'].map(file => import(assetURL(file))))
      .then(([identity, events, { initGoogleCalendarView }]) => {
        initGoogleCalendarView({ week, ui, dates, service: identity.createGoogleCalendar(), identity, events });
      })
      .catch(() => console.warn('Googleカレンダーの接続機能を読み込めませんでした。'));
  })
  .catch((error) => {
    console.warn('週間カレンダーを読み込めませんでした。', error);
  });
