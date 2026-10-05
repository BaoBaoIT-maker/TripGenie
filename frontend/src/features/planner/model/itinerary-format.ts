/** Small format helpers used by wizard, transit card, and detail page. */

const VND = new Intl.NumberFormat('vi-VN');

export function formatVnd(amount: number): string {
  return VND.format(amount) + '₫';
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}
