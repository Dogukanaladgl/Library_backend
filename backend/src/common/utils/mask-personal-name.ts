/**
 * KVKK kapsamında personel panelinde gösterilecek ad/soyad maskeleme.
 * Her kelimenin yalnızca ilk 2 harfi açık kalır, kalanı '*' ile gizlenir.
 * Örnek: "mehmet fartlı" → "me**** fa****", "ali ahmet kör" → "al* ah*** kö*"
 */
export function maskPersonalName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return trimmed;

  return trimmed
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map(maskNamePart)
    .join(' ');
}

function maskNamePart(part: string): string {
  const visibleCount = Math.min(2, part.length);
  const visible = part.slice(0, visibleCount);
  const hiddenCount = part.length - visibleCount;
  return visible + '*'.repeat(hiddenCount);
}
