const SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
const ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
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
  let state = { status: 'disconnected', loading: false, events: [], error: '', updatedAt: 0 };
  let token = '', expiresAt = 0, expiryTimer, authTimer, controller;
  let session = 0, request = 0, range;
  const listeners = new Set();
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
    state = { status, loading: false, events: [], error, updatedAt: 0 };
    emit();
  }
  function checkExpiry() {
    if (token && Date.now() >= expiresAt) clear('expired', 'Googleとの接続期限が切れました。再接続してください。');
    return !token;
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
    try {
      const events = [], pages = new Set();
      let pageToken = '';
      do {
        if (pages.has(pageToken) || pages.size >= 20) throw new Error('too_many_events');
        pages.add(pageToken);
        if (checkExpiry() || !current()) return;
        const url = new URL(ENDPOINT);
        url.search = new URLSearchParams({
          timeMin: activeRange.start, timeMax: activeRange.end,
          singleEvents: 'true', orderBy: 'startTime', showDeleted: 'false', maxResults: '2500',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          fields: 'nextPageToken,items(id,summary,start,end,status)',
          ...(pageToken ? { pageToken } : {})
        });
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${activeToken}`, Accept: 'application/json' },
          signal: abort.signal, cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer'
        });
        if (!current()) return;
        if (response.status === 401) { clear('expired', 'Googleとの接続が切れました。再接続してください。'); return; }
        if (response.status === 403) { clear('disconnected', '予定を読み取れません。Google Calendar APIの有効化とアクセス許可を確認してください。'); return; }
        if (!response.ok) throw new Error(response.status === 429 ? 'rate_limited' : 'network');
        const data = await response.json();
        if (!current() || checkExpiry()) return;
        if (!Array.isArray(data.items) || (data.nextPageToken != null && typeof data.nextPageToken !== 'string')) throw new Error('invalid_response');
        events.push(...data.items);
        if (events.length > 20000) throw new Error('too_many_events');
        pageToken = data.nextPageToken || '';
      } while (pageToken);
      if (current() && !checkExpiry()) {
        state.events = events;
        state.updatedAt = Date.now();
      }
    } catch (error) {
      if (!current()) return;
      const messages = {
        rate_limited: 'Googleが混み合っています。しばらくしてから更新してください。',
        too_many_events: 'この週の予定が多すぎるため取得できませんでした。',
        invalid_response: '予定を正しく取得できませんでした。もう一度更新してください。'
      };
      state.error = messages[error.message] || '予定を取得できませんでした。通信状態を確認して更新してください。';
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
        client_id: clientId, scope: SCOPE, include_granted_scopes: false, prompt: 'select_account',
        callback(response) {
          if (attempt !== session || state.status !== 'connecting') return;
          if (!response) { fail('Googleから接続情報を受け取れませんでした。もう一度接続してください。'); return; }
          const seconds = Number(response.expires_in);
          if (response.error || typeof response.access_token !== 'string' || !response.access_token || (typeof response.scope !== 'string' || !response.scope.split(' ').includes(SCOPE)) || !Number.isFinite(seconds) || seconds <= 0 || seconds > 86400) {
            fail('カレンダーへのアクセスが許可されませんでした。接続設定とGoogle側の許可を確認してください。');
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
      // Keep this call synchronous with the user's click so the popup is allowed.
      client.requestAccessToken();
    } catch {
      fail('Googleに接続できませんでした。設定を確認してもう一度お試しください。');
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkExpiry(); });
  window.addEventListener('pagehide', () => clear());
  return {
    getState, connect, refresh,
    disconnect: () => clear(),
    checkExpiry,
    setRange(start, end) {
      const next = { start: start.toISOString(), end: end.toISOString() };
      if (range?.start === next.start && range?.end === next.end) return;
      range = next;
      controller?.abort();
      request++;
      state.events = [];
      state.updatedAt = 0;
      state.error = '';
      state.loading = false;
      emit();
      void refresh();
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}
