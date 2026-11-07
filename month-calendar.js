// Keep the label in place while its two faces turn vertically.
function rollingLabel(node) {
  node.classList.add('calendar-roll');
  let value = null, face = null, outgoing = null, animations = [];
  return (nextValue, direction) => {
    if (nextValue === value) {
      // Classic rendering can replace the heading while preparing swipe previews.
      if (!node.contains(face)) node.replaceChildren(face, ...(outgoing ? [outgoing] : []));
      return;
    }
    for (const animation of animations) animation.cancel();
    outgoing?.remove();
    const previous = value;
    value = nextValue;
    face = document.createElement('span');
    face.className = 'calendar-roll-face';
    face.textContent = value;
    node.replaceChildren(face);
    outgoing = null;
    animations = [];
    if (previous === null || !direction || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const oldFace = document.createElement('span');
    oldFace.className = 'calendar-roll-outgoing';
    oldFace.textContent = previous;
    oldFace.setAttribute('aria-hidden', 'true');
    node.append(oldFace);
    outgoing = oldFace;
    const options = { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' };
    animations = [
      face.animate([
        { transform: `translateY(${direction * 65}%) rotateX(${-direction * 75}deg)`, opacity: 0 },
        { transform: 'translateY(0) rotateX(0)', opacity: 1 }
      ], options),
      oldFace.animate([
        { transform: 'translateY(0) rotateX(0)', opacity: 1 },
        { transform: `translateY(${-direction * 65}%) rotateX(${direction * 75}deg)`, opacity: 0 }
      ], options)
    ];
    animations[1].finished.then(() => {
      oldFace.remove();
      if (outgoing === oldFace) outgoing = null;
    }).catch(() => {}); // A rapid month change cancels the previous turn.
  };
}

export function initMonthCalendar({ classic, dates }) {
  const $ = (id) => document.getElementById(id);
  const { store, lockScreen } = classic;
  const year = document.createElement('span');
  year.id = 'todayYear';
  const dateBody = document.createElement('div');
  dateBody.append($('wday'), $('mday'));
  $('date').append(year, dateBody);
  const grid = $('grid');
  const listeners = new Set();
  const weekdays = document.createElement('div');
  weekdays.className = 'calendar-weekdays';
  weekdays.append(...Array.from(grid.querySelectorAll('.wd'), (node) => node.cloneNode(true)));
  grid.before(weekdays);
  const controls = document.createElement('nav');
  controls.id = 'calControls';
  controls.setAttribute('aria-label', 'カレンダーの月移動');
  controls.innerHTML = `<button id="currentMonth" type="button" aria-label="今日のカレンダーに戻る" title="今日に戻る"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  $('date').append(controls);
  $('date').setAttribute('aria-live', 'polite');
  $('date').setAttribute('aria-atomic', 'true');
  const setYear = rollingLabel(year);
  const setMonth = rollingLabel($('mday'));
  let previousMonth = null;
  let calendarObserver;
  function fillMonthEdges(offset, target = grid) {
    // A fresh classic render contains weekday labels; decorated grids do not.
    const labels = target.querySelectorAll('.wd');
    if (!labels.length) return;
    labels.forEach((node) => node.remove());
    const now = new Date(),
      base = dates.monthAtOffset(offset, now);
    const y = base.getFullYear(),
      m = base.getMonth(),
      first = base.getDay();
    const holidays = store.get('holidays')?.d || {};
    for (let i = 0; i < 42; i++) {
      const date = new Date(y, m, i - first + 1);
      const key = dates.dateKey(date);
      let cell = target.children[i];
      if (!cell) {
        cell = document.createElement('div');
        target.append(cell);
      }
      if (date.getFullYear() !== y || date.getMonth() !== m) {
        cell.className = 'd outside-month';
        cell.textContent = date.getDate();
        if (holidays[key]) {
          cell.classList.add('hol');
          cell.title = holidays[key];
        }
        cell.setAttribute(
          'aria-label',
          `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
        );
      }
      cell.dataset.date = key;
    }
  }
  function updateCalendar() {
    const now = new Date(),
      offset = classic.getMonthOffset();
    const shown = dates.monthAtOffset(offset, now);
    calendarObserver?.disconnect();
    fillMonthEdges(offset);
    const monthIndex = shown.getFullYear() * 12 + shown.getMonth();
    const direction = previousMonth === null ? 0 : Math.sign(monthIndex - previousMonth);
    previousMonth = monthIndex;
    setYear(`${shown.getFullYear()}年`, direction);
    const weekday = dates.weekdays[now.getDay()];
    $('wday').textContent = `${now.getDate()}日（${weekday}）`;
    $('wday').hidden = false;
    $('wday').classList.toggle('calendar-date-muted', offset !== 0);
    $('foot').hidden = false;
    if (offset !== 0) {
      const monthKey = dates.dateKey(shown).slice(0, 8);
      const holidays = Object.entries(store.get('holidays')?.d || {})
        .filter(([date]) => date.startsWith(monthKey))
        .sort(([a], [b]) => a.localeCompare(b));
      $('foot').replaceChildren();
      if (holidays.length) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        const names = document.createElement('b');
        names.textContent = holidays
          .map(([date, name]) => `${Number(date.slice(-2))}日 ${name}`)
          .join(' · ');
        names.title = names.textContent;
        $('foot').append(dot, names);
      }
    }
    setMonth(`${shown.getMonth() + 1}月`, direction);
    controls.hidden = false;
    $('currentMonth').disabled = offset === 0;
    grid.setAttribute(
      'aria-label',
      `${shown.getFullYear()}年${shown.getMonth() + 1}月のカレンダー`
    );
    calendarObserver?.observe(grid, { childList: true });
    for (const listener of listeners) listener();
  }
  calendarObserver = new MutationObserver(updateCalendar);
  updateCalendar();
  function changeMonth(delta) {
    classic.setMonthOffset(classic.getMonthOffset() + delta);
    lockScreen();
  }
  $('currentMonth').addEventListener('click', () => classic.setMonthOffset(0));

  const viewport = document.createElement('div');
  viewport.className = 'calendar-viewport';
  grid.before(viewport);
  viewport.append(grid);

  return {
    grid,
    viewport,
    changeMonth,
    fillMonthEdges,
    getWeekStarts: () =>
      Array.from({ length: 6 }, (_, row) => grid.children[row * 7]?.dataset.date).filter(Boolean),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
