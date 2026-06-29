/**
 * apiservices Auth/Login bazen düz numara, bazen tam e-posta bekler.
 * Kullanıcı tipine göre e-posta son eki aday listesinde kullanılır.
 */
export type SelcukUserType = 0 | 1 | 2;

const DOMAIN_BY_TYPE: Record<SelcukUserType, string> = {
  0: '@selcuk.edu.tr', // personel
  1: '@ogr.selcuk.edu.tr', // lisans öğrenci
  2: '@lisansustu.selcuk.edu.tr', // enstitü
};

/** Giriş alanından saf kurum/öğrenci numarası */
export function stripUserNameToNumber(raw: string): string {
  return raw
    .trim()
    .replace(/@selcuk\.edu\.tr$/i, '')
    .replace(/@ogr\.selcuk\.edu\.tr$/i, '')
    .replace(/@lisansustu\.selcuk\.edu\.tr$/i, '')
    .trim();
}

/** Giriş alanından üniversite hesap tipini tahmin et */
export function inferSelcukUserType(rawUserName: string): SelcukUserType {
  const lower = rawUserName.trim().toLowerCase();

  if (lower.includes('@ogr.selcuk.edu.tr')) return 1;
  if (lower.includes('@lisansustu.selcuk.edu.tr')) return 2;
  if (lower.includes('@selcuk.edu.tr')) return 0;

  const number = stripUserNameToNumber(rawUserName);
  // 9 haneli 20xx–29xx öğrenci numarası (223301001 gibi)
  if (/^2\d{8}$/.test(number)) return 1;

  return 0;
}

/** Panel girişinde denenecek userType sırası */
export function panelUserTypesToTry(rawUserName: string): SelcukUserType[] {
  const primary = inferSelcukUserType(rawUserName);
  // 223301001 gibi öğrenci numarasında personel/enstitü tipi denenmez
  if (primary === 1) return [1];
  if (primary === 2) return [2, 1];
  return [0];
}

/** apiservices'e gönderilecek olası userName adayları (sırayla denenir) */
export function buildLoginUserNameCandidates(
  rawUserName: string,
  userType: SelcukUserType = 1,
): string[] {
  const trimmed = rawUserName.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes('@')) {
    const candidates = new Set<string>();
    candidates.add(trimmed);
    const number = stripUserNameToNumber(trimmed);
    if (number) {
      candidates.add(number);
      candidates.add(`${number}${DOMAIN_BY_TYPE[userType]}`);
    }
    return [...candidates];
  }

  const number = stripUserNameToNumber(trimmed);
  if (!number) {
    return [trimmed];
  }

  const candidates = new Set<string>();
  candidates.add(number);
  candidates.add(`${number}${DOMAIN_BY_TYPE[userType]}`);
  return [...candidates];
}
