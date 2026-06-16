/**
 * Kütüphane sistemi Türkiye (Europe/Istanbul) duvar saati ile çalışır.
 * DB `timestamp without time zone` kolonları bu saat değerlerini taşır.
 * Node `new Date()` UTC verdiği için iş kurallarında bu yardımcılar kullanılmalıdır.
 */

const DEFAULT_TZ_OFFSET_HOURS = 3;

export function getTurkeyOffsetHours(): number {
  const raw = process.env.TZ_OFFSET_HOURS;
  const parsed = raw != null ? parseInt(raw, 10) : DEFAULT_TZ_OFFSET_HOURS;
  return Number.isFinite(parsed) ? parsed : DEFAULT_TZ_OFFSET_HOURS;
}

/**
 * Gerçek anı Türkiye duvar saati eksenine kaydırır.
 * UTC sunucuda `getUTC*` bileşenleri İstanbul takvim/saatini verir.
 */
export function getNowInTurkeyFrame(): Date {
  const offsetMs = getTurkeyOffsetHours() * 60 * 60 * 1000;
  return new Date(Date.now() + offsetMs);
}

/** Bugünün tarihi YYYY-MM-DD (İstanbul) */
export function getTodayYmdInTurkey(): string {
  const t = getNowInTurkeyFrame();
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, '0');
  const d = String(t.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD parçalarından duvar saati Date (slot / DB ile uyumlu) */
export function turkeyWallClockDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
}

/** Date → ISO (Z suffix; saat bileşenleri duvar saati — mobil parse ile uyumlu) */
export function toWallClockIso(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
}
