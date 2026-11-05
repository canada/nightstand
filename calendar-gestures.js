export function initCalendarGestures({ classic, calendar, dates }) {
  const info = document.getElementById('info');
  const { grid, viewport, changeMonth, fillMonthEdges } = calendar;
  let swipe = null,
    settling = false,
    settleTimer = null,
    wheelTimer = null;
  let previews = [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function resetSwipe() {
    clearTimeout(settleTimer);
    settleTimer = null;
    clearTimeout(wheelTimer);
    wheelTimer = null;
    swipe = null;
    settling = false;
    for (const preview of previews) preview.remove();
    previews = [];
    grid.style.removeProperty('transform');
    grid.style.removeProperty('transition');
    viewport.classList.remove('dragging');
  }
  function makePreviews(offset) {
    const now = new Date();
    const monthStart = (value) => {
      const date = dates.monthAtOffset(value, now);
      return Date.UTC(date.getFullYear(), date.getMonth(), 1 - date.getDay());
    };
    const start = monthStart(offset),
      rowHeight = grid.clientHeight / 6;
    try {
      for (const delta of [-1, 1]) {
        classic.setMonthOffset(offset + delta);
        fillMonthEdges(offset + delta);
        const preview = grid.cloneNode(true);
        preview.removeAttribute('id');
        preview.removeAttribute('aria-label');
        preview.className = 'calendar-preview';
        preview.setAttribute('aria-hidden', 'true');
        preview.dataset.side = delta;
        const shift = ((monthStart(offset + delta) - start) / (7 * 864e5)) * rowHeight;
        preview.dataset.shift = shift;
        // Adjacent month grids share weeks. Show each week only once while moving.
        const overlap = Math.max(0, grid.clientHeight - Math.abs(shift));
        preview.style.clipPath = delta > 0 ? `inset(${overlap}px 0 0)` : `inset(0 0 ${overlap}px)`;
        previews.push(preview);
      }
    } finally {
      classic.setMonthOffset(offset);
    }
    viewport.append(...previews);
  }
  function movePages(dy, transition = 'none') {
    grid.style.transition = transition;
    grid.style.transform = `translate3d(0,${dy}px,0)`;
    for (const preview of previews) {
      preview.style.transition = transition;
      preview.style.transform = `translate3d(0,${Number(preview.dataset.shift) + dy}px,0)`;
    }
  }
  function finishSwipe(commit) {
    const gesture = swipe;
    swipe = null;
    clearTimeout(wheelTimer);
    wheelTimer = null;
    if (!gesture?.started) return;
    settling = true;
    const direction = gesture.dy < 0 ? 1 : -1;
    const shift = Number(
      previews.find((preview) => Number(preview.dataset.side) === direction).dataset.shift
    );
    const duration = reducedMotion.matches ? 0 : 180;
    movePages(commit ? -shift : 0, `transform ${duration}ms cubic-bezier(.2,.8,.2,1)`);
    settleTimer = setTimeout(() => {
      // A keyboard or Today action during the animation takes precedence.
      if (commit && classic.getMonthOffset() === gesture.offset) changeMonth(direction);
      resetSwipe();
    }, duration);
  }
  // Both touch swipes and mouse drags move the calendar continuously.
  info.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) {
      if (swipe) finishSwipe(false);
      return;
    }
    if (settling || e.button !== 0 || e.target.closest('button:not(.calendar-week-button),#wx'))
      return;
    if (swipe?.id === 'wheel') resetSwipe();
    swipe = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      dy: 0,
      offset: classic.getMonthOffset(),
      height: grid.clientHeight,
      started: false,
      time: performance.now()
    };
    // Leave taps on a week button alone; capture only after its drag starts.
    if (!e.target.closest('.calendar-week-button')) info.setPointerCapture(e.pointerId);
  });
  info.addEventListener('pointermove', (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x,
      dy = e.clientY - swipe.y;
    if (!swipe.started) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        info.setPointerCapture(e.pointerId);
        swipe = null;
        return;
      }
      swipe.started = true;
      info.setPointerCapture(e.pointerId);
      makePreviews(swipe.offset);
      viewport.classList.add('dragging');
    }
    swipe.dy = Math.max(-swipe.height, Math.min(swipe.height, dy));
    movePages(swipe.dy);
  });
  info.addEventListener('pointerup', (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    if (!swipe.started) {
      swipe = null;
      return;
    }
    swipe.dy = Math.max(-swipe.height, Math.min(swipe.height, e.clientY - swipe.y));
    const distance = Math.abs(swipe.dy),
      elapsed = Math.max(1, performance.now() - swipe.time);
    const threshold = Math.max(30, Math.min(80, swipe.height * 0.18));
    finishSwipe(distance >= threshold || (distance >= 25 && distance / elapsed > 0.5));
  });
  info.addEventListener('pointercancel', () => finishSwipe(false));
  info.addEventListener('lostpointercapture', () => {
    if (swipe) finishSwipe(false);
  });
  addEventListener('pointerup', (e) => {
    if (swipe && !swipe.started && !info.contains(e.target)) swipe = null;
  });
  info.addEventListener(
    'wheel',
    (e) => {
      if (
        e.ctrlKey ||
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ||
        !e.deltaY ||
        e.target.closest('button:not(.calendar-week-button),#wx')
      )
        return;
      e.preventDefault();
      if (settling || (swipe && swipe.id !== 'wheel')) return;
      if (!swipe) {
        swipe = {
          id: 'wheel',
          dy: 0,
          offset: classic.getMonthOffset(),
          height: grid.clientHeight,
          started: true
        };
        makePreviews(swipe.offset);
        viewport.classList.add('dragging');
      }
      const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? swipe.height : 1;
      swipe.dy = Math.max(-swipe.height, Math.min(swipe.height, swipe.dy - e.deltaY * factor));
      movePages(swipe.dy);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(
        () => finishSwipe(Math.abs(swipe.dy) >= Math.max(30, Math.min(80, swipe.height * 0.18))),
        120
      );
    },
    { passive: false }
  );
  addEventListener('keydown', (e) => {
    if (
      document.querySelector('dialog[open]') ||
      e.target.closest('input,select,textarea,[contenteditable]')
    )
      return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      changeMonth(1);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      changeMonth(-1);
    }
  });
  addEventListener('resize', resetSwipe);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetSwipe();
  });
  // Prevent the classic swipe listener from handling the same gesture twice.
  for (const event of ['touchstart', 'touchend', 'touchcancel'])
    info.addEventListener(event, (e) => e.stopPropagation(), { passive: true });
  return { canOpenWeek: () => !swipe && !settling };
}
