// Google all-day end dates are exclusive; date-only values use local calendar days.
function localDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
const nextDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
const minutes = date => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
export function splitWeekEvents(events, weekStart) {
  const segments = [], seen = new Set();
  for (const event of events) {
    if (!event || event.status === 'cancelled') continue;
    const allDay = Boolean(event.start?.date);
    const start = allDay ? localDate(event.start.date) : new Date(event.start?.dateTime || NaN);
    const end = allDay ? localDate(event.end?.date) : new Date(event.end?.dateTime || NaN);
    if (!start || !end || !Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) continue;
    const id = JSON.stringify([event.calendarId || '', event.id || '', +start, +end]);
    if (seen.has(id)) continue;
    seen.add(id);
    const title = typeof event.summary === 'string' && event.summary.trim() ? event.summary.slice(0, 512) : '予定';
    for (let day = 0, date = new Date(weekStart); day < 7; day++, date = nextDay(date)) {
      const boundary = nextDay(date);
      if (start >= boundary || end <= date) continue;
      segments.push({ id, title, day, allDay, start, end,
        calendarId: event.calendarId, calendarName: event.calendarName, calendarColor: event.calendarColor, holidayCalendar: event.holidayCalendar,
        startMinutes: start < date ? 0 : minutes(start),
        endMinutes: end >= boundary ? 1440 : Math.max(start < date ? 1 : minutes(start) + 1, minutes(end)) });
    }
  }
  return segments;
}

// Give simultaneous events separate columns, sharing width across each overlap group.
export function layoutTimedEvents(segments) {
  const result = [];
  for (let day = 0; day < 7; day++) {
    const sorted = segments.filter(event => !event.allDay && event.day === day)
      .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);
    let group = [], ends = [], groupEnd = -1;
    const flush = () => { result.push(...group.map(event => ({ ...event, columns: ends.length }))); };
    for (const event of sorted) {
      if (event.startMinutes >= groupEnd) { flush(); group = []; ends = []; }
      let column = ends.findIndex(end => end <= event.startMinutes);
      if (column < 0) column = ends.length;
      ends[column] = event.endMinutes;
      group.push({ ...event, column });
      groupEnd = group.length === 1 ? event.endMinutes : Math.max(groupEnd, event.endMinutes);
    }
    flush();
  }
  return result;
}
