const CLIENT_KEY = 'nsGoogleClientId';
const clockTime = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
const fullDate = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

export function initGoogleCalendarView({ week, ui, dates, service, events, identity }) {
  const { element } = ui;
  const footer = week.dialog.querySelector('.week-footer');
  footer.querySelector('.sheet-note').remove();
  const actions = element('div', 'google-actions');
  const status = element('p', 'sheet-note google-status');
  status.id = 'googleCalendarStatus';
  status.setAttribute('role', 'status');
  const button = (text, id, handler) => {
    const node = element('button', 'google-button', text);
    node.id = id;
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  };
  const openButton = button('Googleカレンダー', 'googleCalendarSettings', openSettings);
  const refreshButton = button('更新', 'googleCalendarRefresh', () => { void service.refresh(); });
  const disconnectButton = button('切断', 'googleCalendarDisconnect', () => service.disconnect());
  actions.append(openButton, refreshButton, disconnectButton);
  footer.append(actions, status);
  const settings = ui.createSheet({ name: 'googleCalendar', eyebrow: 'CALENDAR', title: 'Googleカレンダー', contentId: 'googleCalendarContents' });
  settings.querySelector('#googleCalendarContents').innerHTML = `
    <p class="sheet-note">共有・追加済みのカレンダーを選び、予定を読み取り専用で表示します。接続と予定はこのタブ内でのみ有効です。</p>
    <form id="googleCalendarForm" class="google-form">
      <label for="googleClientId">GoogleのアプリID<span class="sheet-note">（OAuthクライアントID）</span></label>
      <input id="googleClientId" type="text" autocomplete="off" spellcheck="false" maxlength="300" placeholder="…apps.googleusercontent.com" required>
      <p class="sheet-note">このIDだけをブラウザーに保存します。パスワードやシークレットは入力しません。</p>
      <button id="googleCalendarConnect" class="google-button" type="submit">Googleに接続</button>
      <button id="googleCalendarCancel" class="google-button" type="button">接続を解除</button>
    </form>
    <fieldset id="googleCalendarSelection" class="google-calendar-selection" hidden>
      <legend>表示するカレンダー</legend>
      <p class="sheet-note">Googleに追加済みの共有・祝日カレンダーも選べます。日本の祝日は接続に関係なく表示します。</p>
      <div id="googleCalendarChoices"></div>
    </fieldset>
    <p id="googleCalendarHelp" class="sheet-note" role="status"></p>
    <button id="googleIdentityRetry" class="google-button" type="button" hidden>接続の準備をやり直す</button>
    <details class="google-setup"><summary>初回の接続設定</summary>
      <ol><li><a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noopener noreferrer">Google Cloud</a>でプロジェクトを作り、Google Calendar APIを有効にします。</li>
      <li>Google Auth Platformで同意画面を設定し、テストユーザーに自分のGoogleアカウントを追加します。「データアクセス」に <code>calendar.events.readonly</code> と <code>calendar.calendarlist.readonly</code> を追加します。</li>
      <li>「ウェブアプリケーション」のOAuthクライアントIDを作り、承認済みのJavaScript生成元に <code id="googleAllowedOrigin"></code> を登録します。作成されたIDを上に入力してください。</li></ol>
      <p>ログイン画面が開かない場合は、通常のChrome・Edge・SafariなどでNightstandを開いてください。</p>
      <a href="https://developers.google.com/workspace/guides/create-credentials#oauth-client-id" target="_blank" rel="noopener noreferrer">Google公式の登録手順</a>
    </details>`;
  const clientInput = settings.querySelector('#googleClientId');
  const connectButton = settings.querySelector('#googleCalendarConnect');
  const cancelButton = settings.querySelector('#googleCalendarCancel');
  settings.querySelector('#googleCalendarSelection').after(cancelButton);
  const help = settings.querySelector('#googleCalendarHelp');
  const retry = settings.querySelector('#googleIdentityRetry');
  settings.querySelector('#googleAllowedOrigin').textContent = location.origin;
  try { clientInput.value = localStorage.getItem(CLIENT_KEY) || ''; } catch {}
  settings.querySelector('details').open = !clientInput.value;
  const details = ui.createSheet({ name: 'googleEvent', eyebrow: 'GOOGLE CALENDAR', title: '予定', contentId: 'googleEventContents' });
  let ready = false, preparing = false, preparationError = '', previousStatus = 'disconnected', openEventId = null;
  let visibleEvents = [];

  function renderEventDetails(event) {
    const content = details.querySelector('#googleEventContents');
    const title = element('p', 'google-event-title', event.title);
    const end = event.allDay ? dates.addDays(event.end, -1) : event.end;
    const time = event.allDay
      ? `${fullDate.format(event.start)}〜${fullDate.format(end)} · 終日`
      : `${fullDate.format(event.start)} ${clockTime.format(event.start)}〜${fullDate.format(end)} ${clockTime.format(end)}`;
    content.replaceChildren(title, element('p', 'sheet-note', event.calendarName || 'Googleカレンダー'), element('p', 'sheet-note', time),
      element('p', 'sheet-note', '予定の変更はGoogleカレンダーで行ってください。'));
  }
  function showEvent(event) {
    openEventId = event.id;
    renderEventDetails(event);
    details.showModal();
  }
  function eventButton(event, allDay) {
    const node = element('button', allDay ? 'google-event google-all-day-event' : 'google-event google-timed-event');
    node.type = 'button';
    if (/^#[\da-f]{6}$/i.test(event.calendarColor)) node.style.setProperty('--calendar-color', event.calendarColor);
    node.dataset.calendarId = event.calendarId || '';
    const time = `${String(Math.floor(event.startMinutes / 60)).padStart(2, '0')}:${String(Math.floor(event.startMinutes % 60)).padStart(2, '0')}`;
    node.append(element('span', 'google-event-name', event.title));
    if (!allDay) node.prepend(element('span', 'google-event-time', time));
    node.setAttribute('aria-label', `${allDay ? '終日' : time} ${event.title}`);
    node.title = `${node.getAttribute('aria-label')}${event.calendarName ? ` · ${event.calendarName}` : ''}`;
    node.addEventListener('click', () => showEvent(event));
    return node;
  }
  function renderEvents(state) {
    week.scroll.querySelectorAll('.google-event').forEach(node => node.remove());
    const segments = events.splitWeekEvents(state.events, week.getStart());
    visibleEvents = segments;
    const allDayCells = week.scroll.querySelectorAll('.week-all-day-cell');
    const lanes = week.scroll.querySelectorAll('.week-day-lane');
    for (const event of segments.filter(event => event.allDay)) {
      const cell = allDayCells[event.day];
      // Japanese holidays already supplied by Nightstand appear once.
      if (event.holidayCalendar && cell?.querySelector('.week-holiday')?.textContent === event.title) continue;
      cell?.append(eventButton(event, true));
    }
    for (const event of events.layoutTimedEvents(segments)) {
      const node = eventButton(event, false);
      node.style.top = `${event.startMinutes / 1440 * 100}%`;
      node.style.height = `${(event.endMinutes - event.startMinutes) / 1440 * 100}%`;
      node.style.left = `${event.column / event.columns * 100}%`;
      node.style.width = `${100 / event.columns}%`;
      lanes[event.day]?.append(node);
    }
    return segments.length;
  }
  function renderCalendarChoices(state) {
    const selection = settings.querySelector('#googleCalendarSelection');
    selection.hidden = state.status !== 'connected';
    const choices = settings.querySelector('#googleCalendarChoices');
    const focused = choices.contains(document.activeElement) ? document.activeElement.dataset.calendarId : null;
    const rows = state.calendars.map(calendar => {
      const row = element('label', 'google-calendar-choice');
      const input = element('input');
      input.type = 'checkbox';
      input.dataset.calendarId = calendar.id;
      input.checked = state.selectedIds.includes(calendar.id);
      input.disabled = !calendar.readable;
      input.addEventListener('change', () => {
        const selected = new Set(service.getState().selectedIds);
        if (input.checked) selected.add(calendar.id); else selected.delete(calendar.id);
        service.setSelectedCalendars([...selected]);
      });
      const dot = element('span', 'google-calendar-dot');
      dot.style.backgroundColor = calendar.color;
      dot.setAttribute('aria-hidden', 'true');
      const label = element('span', 'google-calendar-choice-name', calendar.name);
      const error = state.calendarErrors.find(error => error.id === calendar.id);
      if (!calendar.readable) label.append(element('small', 'sheet-note', '空き時間のみの共有です。予定の詳細を読む権限が必要です。'));
      else if (error) label.append(element('small', 'sheet-note', error.message));
      row.append(input, dot, label);
      return row;
    });
    choices.replaceChildren(...rows);
    if (focused) Array.from(choices.querySelectorAll('input')).find(input => input.dataset.calendarId === focused)?.focus({ preventScroll: true });
  }
  function render(state = service.getState()) {
    const connected = state.status === 'connected', connecting = state.status === 'connecting';
    if (connected && previousStatus === 'connecting') { settings.close(); settings.querySelector('details').open = false; }
    previousStatus = state.status;
    settings.querySelector('#googleCalendarForm').hidden = connected;
    const count = renderEvents(state);
    renderCalendarChoices(state);
    refreshButton.hidden = !connected;
    refreshButton.disabled = state.loading;
    disconnectButton.hidden = !connected && !connecting;
    connectButton.hidden = connected;
    connectButton.disabled = !ready || preparing || connecting;
    connectButton.textContent = connecting ? '接続中…' : state.status === 'expired' ? 'Googleに再接続' : 'Googleに接続';
    clientInput.disabled = connected || connecting;
    cancelButton.hidden = !connected && !connecting;
    const message = state.error || (connecting ? 'Googleへの接続を待っています…' :
      state.loading ? '予定を同期しています…' : connected && !state.selectedIds.length ? '表示するカレンダーを選んでください。日本の祝日は表示しています。' : connected && state.updatedAt ?
        `${count ? '' : 'この週の予定はありません。'}最終更新 ${clockTime.format(state.updatedAt)} · 5分ごとに更新` :
      connected ? 'Googleに接続しました。' : 'Googleの予定をこのタブに表示できます。');
    status.textContent = message + (state.stale ? ' 前回取得した予定を表示しています。' : '');
    help.textContent = preparationError || (preparing ? 'Googleへの接続を準備しています…' : status.textContent);
    retry.hidden = !preparationError;
    // A disconnected or expired session must also clear any open event detail.
    const currentEvent = visibleEvents.find(event => event.id === openEventId);
    if (!connected || !currentEvent) { details.close(); details.querySelector('#googleEventContents').replaceChildren(); openEventId = null; }
    else if (details.open) renderEventDetails(currentEvent);
  }
  async function prepare() {
    if (ready || preparing) return;
    preparing = true;
    preparationError = '';
    render();
    try { await identity.prepareGoogleIdentity(); ready = true; }
    catch { preparationError = 'Googleの接続機能を読み込めませんでした。通信状態を確認してやり直してください。'; }
    finally { preparing = false; render(); }
  }
  function openSettings() {
    settings.showModal();
    render();
    void prepare();
  }
  retry.addEventListener('click', () => { void prepare(); });
  settings.querySelector('#googleCalendarForm').addEventListener('submit', event => {
    event.preventDefault();
    const clientId = clientInput.value.trim();
    if (!identity.validGoogleClientId(clientId)) {
      help.textContent = '「apps.googleusercontent.com」で終わるOAuthクライアントIDを入力してください。';
      clientInput.focus();
      return;
    }
    try { localStorage.setItem(CLIENT_KEY, clientId); } catch {}
    service.connect(clientId);
  });
  cancelButton.addEventListener('click', () => service.disconnect());
  service.subscribe(render);
  const updateRange = () => {
    const start = week.getStart();
    service.setRange(start, dates.addDays(start, 7));
    if (service.getState().updatedAt && Date.now() - service.getState().updatedAt >= 300000) void service.refresh();
    render();
  };
  week.subscribe(updateRange);
  if (week.dialog.open) updateRange();
  const refreshVisible = () => {
    if (week.dialog.open && !document.hidden) { service.checkExpiry(); void service.refresh(); }
  };
  setInterval(refreshVisible, 300000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshVisible(); });
  render();
}
