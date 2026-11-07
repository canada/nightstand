export const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
export const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function parseDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}
export const addDays = (date, count) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
export const weekStart = (date) => addDays(date, -date.getDay());
export const monthAtOffset = (offset, now = new Date()) =>
  new Date(now.getFullYear(), now.getMonth() + offset, 1);
export const shortDate = (date) => `${date.getMonth() + 1}月${date.getDate()}日`;
export const weekTitle = (start, end) =>
  `${shortDate(start)}〜${start.getMonth() === end.getMonth() ? end.getDate() + '日' : shortDate(end)}`;
