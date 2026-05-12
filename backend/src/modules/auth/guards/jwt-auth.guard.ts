/**
 * Geçiş notu: Eski JWT tabanlı kimlik doğrulama kaldırıldı; istekler artık
 * SUMOB mobil DB (`sp_find_user`) üzerinden doğrulanıyor. Var olan
 * `@UseGuards(JwtAuthGuard)` dekoratörlerini değiştirmemek için bu isim
 * korunuyor ve doğrudan [SumobAuthGuard]'a yönlendiriyor.
 */
export { SumobAuthGuard as JwtAuthGuard } from '../../sumob-auth/sumob-auth.guard';
