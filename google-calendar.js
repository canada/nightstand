const SCOPES = ['https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly'];
const API = 'https://www.googleapis.com/calendar/v3/';
export const validGoogleClientId = value => /^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(value);
let identityLoading;

// Load Google's official library only when connection settings are opened.
export function prepareGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (identityLoading) return identityLoading;
  identityLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let timeout;
    const finish = error => {
      clearTimeout(timeout);
      script.onload = script.onerror = null;
      if (error) { script.remove(); identityLoading = null; reject(error); }
      else resolve();
    };
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => finish(window.google?.accounts?.oauth2 ? null : new Error('identity_unavailable'));
    script.onerror = () => finish(new Error('identity_unavailable'));
    timeout = setTimeout(() => finish(new Error('identity_unavailable')), 15000);
    document.head.append(script);
  });
  return identityLoading;
}

export function createGoogleCalendar() {
  const emptyState = (status = 'disconnected', error = '') => ({
    status, error, loading: false, events: [], updatedAt: 0, stale: false,
    calendars: [], selectedIds: [], calendarErrors: []
  });
  let state = emptyState();
  let token = '', expiresAt = 0, expiryTimer, authTimer, controller;
  let session = 0, request = 0, range, selectionInitialized = false;
  const snapshots = new Map(), listeners = new Set();
  const getState = () => ({ ...state });
  const emit = () => { for (const listener of listeners) listener(getState()); };
  function clear(status = 'disconnected', error = '') {
    session++;
    request++;
    controller?.abort();
    clearTimeout(expiryTimer);
    clearTimeout(authTimer);
    token = '';
    expiresAt = 0;
    selectionInitialized = false;
    snapshots.clear();
    state = emptyState(status, error);
    emit();
  }
  function checkExpiry() {
    if (token && Date.now() >= expiresAt) clear('expired', 'Googleとの接続期限が切れました。再接続してください。');
    return !token;
  }
  function publishEvents() {
    const selected = state.calendars.filter(calendar => state.selectedIds.includes(calendar.id));
    const events = [], times = [];
    for (const calendar of selected) {
      const saved = snapshots.get(calendar.id);
      if (!saved) continue;
      if (events.length + saved.events.length > 20000) {
        snapshots.delete(calendar.id);
        state.calendarErrors.push({ id: calendar.id, message: `${calendar.name}の予定が多すぎるため表示できませんでした。` });
        continue;
      }
      times.push(saved.updatedAt);
      for (const event of saved.events) events.push({ ...event,
        calendarId: calendar.id, calendarName: calendar.name, calendarColor: calendar.color,
        holidayCalendar: /#holiday@group\.v\.calendar\.google\.com$/.test(calendar.id) });
    }
    state.events = events;
    state.updatedAt = times.length ? Math.min(...times) : 0;
    state.stale = state.calendarErrors.some(error => snapshots.has(error.id));
    state.error = state.calendarErrors[0]?.message || '';
    if (state.calendarErrors.length > 1) state.error += ` ほか${state.calendarErrors.length - 1}件のカレンダーも取得できませんでした。`;
  }
  async function refresh() {
    if (checkExpiry() || !range || state.loading) return;
    controller?.abort();
    const abort = new AbortController();
    controller = abort;
    const id = ++request, connectedSession = session, activeToken = token;
    const activeRange = { ...range };
    const current = () => id === request && connectedSession === session;
    const timeout = setTimeout(() => abort.abort(), 15000);
    state.loading = true;
    state.error = '';
    emit();
    async function readPages(path, params) {
      const items = [], pages = new Set();
      let pageToken = '';
      do {
        if (pages.has(pageToken) || pages.size >= 20) throw new Error('too_many_items');
        pages.add(pageToken);
        if (!current() || checkExpiry()) throw new Error('cancelled');
        const url = new URL(API + path);
        url.search = new URLSearchParams({ ...params, ...(pageToken ? { pageToken } : {}) });
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${activeToken}`, Accept: 'application/json' },
          signal: abort.signal, cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer'
        });
        if (!current()) throw new Error('cancelled');
        if (response.status === 401) {
          clear('expired', 'Googleとの接続が切れました。再接続してください。');
          throw new Error('cancelled');
        }
        if (!response.ok) throw new Error(response.status === 403 ? 'forbidden' : response.status === 404 ? 'missing' : response.status === 429 ? 'rate_limited' : 'network');
        const data = await response.json();
        if (!current() || checkExpiry()) throw new Error('cancelled');
        if (!Array.isArray(data.items) || (data.nextPageToken != null && typeof data.nextPageToken !== 'string')) throw new Error('invalid_response');
        for (const item of data.items) {
          if (items.length >= 20000) throw new Error('too_many_items');
          items.push(item);
        }
        pageToken = data.nextPageToken || '';
      } while (pageToken);
      return items;
    }
    try {
      const listed = await readPages('users/me/calendarList', {
        showHidden: 'true', showDeleted: 'false', maxResults: '250',
        fields: 'nextPageToken,items(id,summary,summaryOverride,backgroundColor,selected,primary,accessRole,deleted)'
      });
      if (!current()) return;
      const previousRoles = new Map(state.calendars.map(calendar => [calendar.id, calendar.role]));
      const seen = new Set();
      state.calendars = listed.filter(calendar => {
        if (!calendar || calendar.deleted || typeof calendar.id !== 'string' || !calendar.id || calendar.id.length > 1024 || seen.has(calendar.id)) return false;
        seen.add(calendar.id);
        return true;
      }).map(calendar => ({
        id: calendar.id,
        name: String(calendar.summaryOverride || calendar.summary || 'カレンダー').slice(0, 160),
        color: /^#[\da-f]{6}$/i.test(calendar.backgroundColor) ? calendar.backgroundColor : '#8db9ed',
        role: calendar.accessRole,
        readable: ['owner', 'writer', 'reader', 'writerWithoutPrivateAccess'].includes(calendar.accessRole),
        primary: calendar.primary === true, selected: calendar.selected === true
      }));
      for (const calendar of state.calendars) {
        if (previousRoles.has(calendar.id) && previousRoles.get(calendar.id) !== calendar.role) snapshots.delete(calendar.id);
      }
      const readable = state.calendars.filter(calendar => calendar.readable);
      state.selectedIds = selectionInitialized
        ? state.selectedIds.filter(id => readable.some(calendar => calendar.id === id))
        : readable.filter(calendar => calendar.primary || calendar.selected).map(calendar => calendar.id);
      selectionInitialized = true;
      for (const key of snapshots.keys()) if (!state.selectedIds.includes(key)) snapshots.delete(key);
      state.calendarErrors = [];
      // Remove data from calendars no longer shared before requesting other sources.
      publishEvents();
      emit();
      const selected = readable.filter(calendar => state.selectedIds.includes(calendar.id));
      for (let index = 0; index < selected.length; index += 4) {
        await Promise.all(selected.slice(index, index + 4).map(async calendar => {
          try {
            const events = await readPages(`calendars/${encodeURIComponent(calendar.id)}/events`, {
              timeMin: activeRange.start, timeMax: activeRange.end,
              singleEvents: 'true', orderBy: 'startTime', showDeleted: 'false', maxResults: '2500',
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              fields: 'nextPageToken,items(id,summary,start,end,status)'
            });
            if (current()) snapshots.set(calendar.id, { events, updatedAt: Date.now() });
          } catch (error) {
            if (!current()) return;
            const denied = error.message === 'forbidden' || error.message === 'missing';
            if (denied) snapshots.delete(calendar.id);
            const message = denied ? '予定を読み取れません。共有設定とアクセス許可を確認してください。' :
              error.message === 'rate_limited' ? 'Googleが混み合っています。しばらくしてから更新してください。' :
              '予定を取得できませんでした。もう一度更新してください。';
            state.calendarErrors.push({ id: calendar.id, message: `${calendar.name}: ${message}` });
          }
        }));
        if (!current()) return;
      }
      if (!checkExpiry() && current()) publishEvents();
    } catch (error) {
      if (!current()) return;
      if (error.message === 'forbidden') {
        clear('disconnected', 'カレンダー一覧を読み取れません。Google側で一覧の読み取り権限を追加して再接続してください。');
        return;
      }
      state.error = 'カレンダー一覧を取得できませんでした。通信状態を確認して更新してください。';
      state.stale = snapshots.size > 0;
    } finally {
      clearTimeout(timeout);
      if (current()) { state.loading = false; emit(); }
    }
  }
  function connect(clientId) {
    if (state.status === 'connecting' || state.status === 'connected') return;
    if (!validGoogleClientId(clientId) || !window.google?.accounts?.oauth2) {
      clear('disconnected', '接続設定を確認し、もう一度接続してください。');
      return;
    }
    clear('connecting');
    const attempt = session;
    const fail = message => { if (attempt === session) clear('disconnected', message); };
    authTimer = setTimeout(() => fail('接続が完了しませんでした。ログイン画面を閉じて、もう一度接続してください。'), 120000);
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope: SCOPES.join(' '), include_granted_scopes: false, prompt: 'select_account',
        callback(response) {
          if (attempt !== session || state.status !== 'connecting') return;
          if (!response) { fail('Googleから接続情報を受け取れませんでした。もう一度接続してください。'); return; }
          const seconds = Number(response.expires_in);
          if (response.error || typeof response.access_token !== 'string' || !response.access_token || typeof response.scope !== 'string' ||
              !SCOPES.every(scope => response.scope.split(' ').includes(scope)) || !Number.isFinite(seconds) || seconds <= 0 || seconds > 86400) {
            fail('予定とカレンダー一覧の読み取りが許可されませんでした。Google側のデータアクセス設定と許可を確認して再接続してください。');
            return;
          }
          clearTimeout(authTimer);
          token = response.access_token;
          expiresAt = Date.now() + seconds * 1000;
          expiryTimer = setTimeout(checkExpiry, seconds * 1000);
          state.status = 'connected';
          state.error = '';
          emit();
          void refresh();
        },
        error_callback(error) {
          fail(error.type === 'popup_closed' ? '接続を中止しました。' :
            'ログイン画面を開けませんでした。通常のブラウザーで開き、ポップアップを許可して再接続してください。');
        }
      });
      client.requestAccessToken();
    } catch { fail('Googleに接続できませんでした。設定を確認してもう一度お試しください。'); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkExpiry(); });
  window.addEventListener('pagehide', () => clear());
  function resetRangeData() {
    controller?.abort();
    request++;
    snapshots.clear();
    Object.assign(state, { events: [], updatedAt: 0, error: '', stale: false, calendarErrors: [], loading: false });
  }
  return {
    getState, connect, refresh, disconnect: () => clear(), checkExpiry,
    setRange(start, end) {
      const next = { start: start.toISOString(), end: end.toISOString() };
      if (range?.start === next.start && range?.end === next.end) return;
      range = next;
      resetRangeData();
      emit();
      void refresh();
    },
    setSelectedCalendars(ids) {
      const next = state.calendars.filter(calendar => calendar.readable && ids.includes(calendar.id)).map(calendar => calendar.id);
      if (next.length === state.selectedIds.length && next.every(id => state.selectedIds.includes(id))) return;
      controller?.abort();
      request++;
      state.selectedIds = next;
      selectionInitialized = true;
      for (const id of snapshots.keys()) if (!next.includes(id)) snapshots.delete(id);
      state.calendarErrors = [];
      state.loading = false;
      publishEvents();
      emit();
      void refresh();
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}
