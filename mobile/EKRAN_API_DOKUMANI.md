# Mobile Uygulama Ekran, Tasarım, Buton ve API Dokumani

Bu dokuman, `mobile` uygulamasindaki ekranlarin:
- ne is yaptigini,
- tasarim bloklarini (kartlar, listeler, durum panelleri),
- buton/press aksiyonlarini,
- hangi API istegini nereye attigini,
- beklenen cevap formatini,
- kullaniciya gosterdigi mesajlari
tek dosyada toplar.

Not: Route path'lerinde Expo Router grup klasorleri (`(tabs)`, `(admin)`, `(staff)`) kullanilir.

---

## 1) Route Envanteri (Tum Ekranlar)

### Cekirdek (Root) Ekranlar
- `/` -> `app/index.tsx`
- `/login` -> `app/login.tsx`
- `/notification-settings` -> `app/notification-settings.tsx`
- `/help-support` -> `app/help-support.tsx`
- `/qr-scan` -> `app/qr-scan.tsx`
- `/hall/[id]` -> `app/hall/[id].tsx`
- `/masa-kontrol` -> `app/masa-kontrol.tsx`
- `/table-qr-desk` -> `app/table-qr-desk.tsx`

### Ogrenci Sekmeleri (`(tabs)`)
- `/(tabs)` -> `app/(tabs)/index.tsx`
- `/(tabs)/halls` -> `app/(tabs)/halls.tsx`
- `/(tabs)/reservation` -> `app/(tabs)/reservation.tsx`
- `/(tabs)/reservation-history` -> `app/(tabs)/reservation-history.tsx` (tab bar'da gizli)
- `/(tabs)/profile` -> `app/(tabs)/profile.tsx`

### Admin Sekmeleri (`(admin)`)
- `/(admin)` -> `app/(admin)/index.tsx`
- `/(admin)/reservations` -> `app/(admin)/reservations.tsx`
- `/(admin)/halls` -> `app/(admin)/halls.tsx`
- `/(admin)/users` -> `app/(admin)/users.tsx`
- `/(admin)/qr-desk` -> `app/(admin)/qr-desk.tsx`
- `/(admin)/special-periods` -> `app/(admin)/special-periods.tsx`

### Staff Sekmeleri (`(staff)`)
- `/(staff)` -> `app/(staff)/index.tsx`
- `/(staff)/reservations` -> `app/(staff)/reservations.tsx`
- `/(staff)/halls` -> `app/(staff)/halls.tsx`
- `/(staff)/qr-desk` -> `app/(staff)/qr-desk.tsx`
- `/(staff)/masa-kontrol` -> `app/(staff)/masa-kontrol.tsx` (tab bar'da gizli)

### Ortak Bilesen Ekrani (Route'larca kullaniliyor)
- `components/TableQrDeskScreen.tsx`
  - `/(admin)/qr-desk`, `/(staff)/qr-desk`, `/table-qr-desk` tarafindan kullanilir.

---

## 2) Ekran Bazli Ayrintili Analiz

## 2.1 Root Ekranlari

### `app/index.tsx` (`/`)
- **Amac:** Uygulama acilisinda oturum kontrolu yapip uygun role yonlendirmek.
- **Tasarim:** Sadece tam ekran `ActivityIndicator`.
- **Butonlar:** Yok.
- **Is akis:**
  - `getToken()` -> token yoksa `/login`.
  - Token varsa `verifySession()` -> `GET /auth/me`.
  - `user.role` bazli yonlendirme:
    - `admin` -> `/(admin)`
    - `staff` -> `/(staff)`
    - diger -> `/(tabs)`
- **Mesajlar:** Gorsel spinner disinda mesaj yok.

### `app/login.tsx` (`/login`)
- **Amac:** Ogrenci/personel/admin girisi.
- **Tasarim:**
  - Ortalanmis kart, logo/ikon, baslik-alt baslik
  - `ogrenci numarasi/kullanici adi` input
  - `sifre` input
  - hata kutusu
  - `Giris Yap` butonu (loading durumunda spinner)
- **Butonlar:**
  - `Giris Yap`
    - Bos alan kontrolu yapar.
    - `login(studentNumber, password)` cagirir.
    - Basariliysa role veya `redirect` parametresine gore route degistirir.
- **API:**
  - `POST /auth/login`
- **Beklenen cevap:**
  - `{ accessToken, user: { id, studentNumber, fullName, role } }`
- **Mesajlar/Hatalar:**
  - `Kullanici adi / ogrenci numarasi ve sifre zorunludur.`
  - API veya fallback hata: `Giris basarisiz. Lutfen tekrar deneyin.`

### `app/notification-settings.tsx`
- **Amac:** Bildirim izinleri ve lokal bildirim tercihleri.
- **Tasarim:**
  - Hero kart
  - Sistem izin karti
  - Switch satirlari (tercih ayarlari)
- **Butonlar/Switchler:**
  - `Izin Ver` -> OS notification permission ister.
  - Switch'ler -> AsyncStorage preference kaydeder.
- **API:** Yok (tamamen local + OS permission).
- **Mesajlar:**
  - Izin zaten acik / izin reddedildi / ayarlar kaydedilemedi gibi durum mesajlari.

### `app/help-support.tsx`
- **Amac:** Destek iletisim kanallari.
- **Tasarim:** Hero + e-posta/telefon/SSS aksiyon satirlari + bilgilendirme karti.
- **Butonlar:**
  - E-posta satiri -> `mailto:...`
  - Telefon satiri -> `tel:...`
  - SSS satiri -> web URL
- **API:** Yok.
- **Mesajlar:**
  - `Linking.canOpenURL` basarisizsa uyari/hata dialoglari.

### `app/qr-scan.tsx` (`/qr-scan`)
- **Amac:** Ogrencinin rezervasyon check-in QR taramasi.
- **Tasarim:**
  - Kamera izin ekranlari
  - Lokasyon izin ekranlari
  - QR overlay scanner
  - `Tekrar Tara` ve kapatma butonlari
- **Butonlar:**
  - Kamera/lokasyon izin butonlari
  - `Tekrar Tara`
  - Kapat/Geri
- **API akisi:**
  - `GET /reservations/my/active` (aktif rezervasyon var mi)
  - `POST /reservations/validate-qr` (okutulan QR dogru masa mi)
  - `POST /reservations/check-in` (konum+QR ile check-in)
- **Cevaplar:**
  - `Reservation | null`
  - `ValidateQrResponse { isValid, table?, message? }`
  - Check-in sonucu (icerik ekranda sinirli kullanilir)
- **Mesajlar:**
  - Yanlis QR / farkli masa / erken check-in / basarili check-in gibi cok sayida durum mesaji.

### `app/hall/[id].tsx` (`/hall/[id]`)
- **Amac:** Salon krokisinden masa secip saat slotuna rezervasyon olusturmak.
- **Tasarim:**
  - Salon bilgisi + tarih chipleri (`Bugun`, `Yarin`)
  - Durum efsanesi (musait/dolu/secili)
  - Interaktif masa krokisi
  - Istatistik kartlari
  - Alt panel: slot listesi + `Rezervasyon Yap`
- **Butonlar:**
  - Masa kutularina tiklama
  - Tarih chipleri
  - Yenile / tekrar dene
  - Slot secimi
  - `Rezervasyon Yap`
- **API:**
  - `GET /halls/:id/slots?date=...`
  - `GET /halls/:id/availability?date=...`
  - `POST /reservations`
- **Cevaplar:**
  - `HallSlotsResponse`
  - `HallAvailabilityResponse`
  - `Reservation`
- **Mesajlar:**
  - Slot secmeden rezervasyon denemesi uyarisi
  - Rezervasyon basari mesaji
  - Tarih/politika kisiti mesajlari
  - API hata dialoglari

### `app/masa-kontrol.tsx`
- **Amac:** Admin yonetim kisayol ekrani.
- **Tasarim:** Kisa aciklama + aksiyon satirlari.
- **Butonlar:**
  - Salon yonetimine git
  - Rezervasyon yonetimine git
  - Kullanicilara git
- **API:** Yok.

### `app/table-qr-desk.tsx`
- **Amac:** Ortak `TableQrDeskScreen` bilesenini modal olarak acmak.
- **Tasarim/Buton/API:** Bizzat `TableQrDeskScreen` tarafinda.

---

## 2.2 Ogrenci Sekmeleri (`(tabs)`)

### `app/(tabs)/index.tsx`
- **Amac:** Ogrenci ana paneli.
- **Tasarim:**
  - Ozet kartlari
  - Aktif rezervasyon karti
  - Salon kart listesi
  - Hizli aksiyonlar (QR, rezervasyon vb.)
- **Butonlar:**
  - Hizli rezervasyon -> `/(tabs)/halls` veya `/hall/[id]`
  - Salon karti -> `/hall/:id`
  - QR check-in
  - Aktif rezervasyon iptal
- **API:**
  - `GET /statistics/occupancy`
  - `GET /halls`
  - `GET /reservations/my/status`
  - `DELETE /reservations/:id`
- **Cevaplar:**
  - `OverallStatistics`
  - `Hall[]`
  - `UserReservationStatus`
  - `Reservation`
- **Mesajlar:**
  - Iptal onayi / basari / hata
  - QR ile ilgili bilgilendirme mesajlari

### `app/(tabs)/halls.tsx`
- **Amac:** Salon doluluklarini listeleyip masa secim ekranina gitmek.
- **Tasarim:**
  - Her salon icin kart
  - Doluluk progress bar + sayisal metrikler
  - `Masa Sec` CTA
- **Butonlar:**
  - Kart tiklama
  - `Masa Sec`
  - Pull-to-refresh
- **API:**
  - `GET /statistics/occupancy`
- **Cevap:**
  - `OverallStatistics.hallsOccupancy[]`
- **Mesajlar:**
  - Liste bos/hata mesajlari.

### `app/(tabs)/reservation.tsx`
- **Amac:** Aktif rezervasyon yasam dongusu (goruntuleme, uzatma, sonlandirma, iptal, QR adimi).
- **Tasarim:**
  - Aktif rezervasyon yoksa bos durum + aksiyonlar
  - Aktif rezervasyon varsa:
    - zamanlayici/progress,
    - masa/salon bilgisi,
    - aksiyon butonlari,
    - tarihce onizleme.
- **Butonlar:**
  - `Rezervasyon Yap`
  - `QR Kod Tara`
  - `Sure Uzat`
  - `Sonlandir`
  - `Iptal Et`
  - `Tumunu Gor`
- **API:**
  - `GET /reservations/my/status`
  - `GET /reservations/my/history`
  - `DELETE /reservations/:id`
  - `PUT /reservations/:id/extend`
  - Kodda `acknowledgeScheduledEnd` cagrisi var (ayri notlara bak).
- **Cevaplar:**
  - `UserReservationStatus`
  - `Reservation[]`
  - `Reservation` (extend/cancel)
- **Mesajlar:**
  - Uzatma/iptal onaylari
  - Sure dolumu ve QR sure penceresi mesajlari
  - Basari/hata dialoglari
- **Ek davraniş:**
  - Local notification schedule/cancel islemleri.

### `app/(tabs)/reservation-history.tsx`
- **Amac:** Tum rezervasyon gecmisini filtreleyerek gormek.
- **Tasarim:**
  - Filtre karti (tarih secici + `Filtrele`/`Temizle`)
  - Kart listesi
  - Geri/FAB aksiyonu
- **Butonlar:**
  - `Filtrele`
  - `Temizle`
  - `Tumunu Gor`
  - Geri don
- **API:**
  - `GET /reservations/my/history`
- **Cevap:**
  - `Reservation[]`
- **Mesajlar:**
  - Tarih secmeden filtre denemesi uyari mesaji
  - Bos sonuc mesaji
  - Kart icinde iptal nedeni gibi detay metinleri

### `app/(tabs)/profile.tsx`
- **Amac:** Hesap bilgisi + ayarlar ve cikis.
- **Tasarim:**
  - Profil basligi/avatar
  - Bilgi karti
  - Menu satirlari (bildirim yardim cikis)
- **Butonlar:**
  - `Bildirim Ayarlari` -> `/notification-settings`
  - `Yardim & Destek` -> `/help-support`
  - `Cikis Yap`
- **API:**
  - `GET /auth/me`
  - `GET /reservations/my`
  - `POST /auth/logout`
- **Cevaplar:**
  - User object
  - `Reservation[]`
- **Mesajlar:**
  - Cikis onay mesaji (platforma gore farkli dialog yolu)

---

## 2.3 Admin Sekmeleri (`(admin)`)

### `app/(admin)/index.tsx`
- **Amac:** Admin dashboard.
- **Tasarim:**
  - Grid kartlar (kullanicilar, aktif rezervasyon, doluluk, QR, takvim vb.)
  - Cikis FAB
- **Butonlar:**
  - Her kart ilgili yonetim ekranina gider
  - Cikis butonu
- **API:**
  - `GET /admin/statistics/overview`
  - `POST /auth/logout`
- **Cevap:**
  - `AdminOverview`
- **Mesajlar:**
  - Istatistik yukleme hatalari
  - Cikis onayi

### `app/(admin)/reservations.tsx`
- **Amac:** Tum rezervasyonlari filtreleyip yonetmek.
- **Tasarim:**
  - Filtre chipleri
  - Rezervasyon kart listesi
  - Arama/FAB + modal filtre
- **Butonlar:**
  - Durum chipleri
  - Arama modal ac/kapat/temizle/uygula
  - (Admin yetkisiyle) `Iptal Et`
- **API:**
  - `GET /admin/reservations?status=...`
  - `DELETE /admin/reservations/:id`
- **Cevaplar:**
  - `AdminReservation[]`
  - `AdminReservation`
- **Mesajlar:**
  - Iptal onayi / basari / hata
  - Yukleme hatalari

### `app/(admin)/halls.tsx`
- **Amac:** Salon ve masa yonetimi; masa geometri guncelleme.
- **Tasarim:**
  - Salon ozet listesi
  - Secili salonun masa listesi
  - Edit modal (x,y,width,height,feature vb.)
- **Butonlar:**
  - Salon sec
  - Masa duzenle
  - Modal kaydet/iptal
- **API:**
  - `GET /admin/halls`
  - `GET /admin/halls/:id/tables`
  - `PATCH /admin/tables/:id`
- **Cevaplar:**
  - `AdminHall[]`
  - `AdminTable[]`
  - `AdminTable`
- **Mesajlar:**
  - Kayit basari/hata dialoglari
  - Bos liste metinleri

### `app/(admin)/users.tsx`
- **Amac:** Kullanici listesi, rol degistirme, zorunlu logout.
- **Tasarim:**
  - Search + role'a gore section list
  - User karti: rol/oturum bilgisi + aksiyonlar
  - Rol secim modal
- **Butonlar:**
  - `Rolu Degistir`
  - `Oturumu Sonlandir`
  - Modal role secenekleri
- **API:**
  - `GET /admin/users`
  - `POST /admin/users/:id/force-logout`
  - `PATCH /admin/users/:id/role`
  - (`getCurrentUser` local storage'dan okunur)
- **Cevaplar:**
  - `AdminUser[]`
  - `{ message: string }`
  - `AdminUser` (guncellenmis)
- **Mesajlar:**
  - Onay popup'lari
  - Basari/hata mesajlari

### `app/(admin)/special-periods.tsx`
- **Amac:** Ozel takvim donemleri olusturma/aktif-pasif yapma/silme.
- **Tasarim:**
  - Form karti
  - Donem kart listesi
- **Butonlar:**
  - `Takvim Ekle`
  - `Aktif Et / Pasife Al`
  - Sil ikon butonu
- **API:**
  - `GET /admin/special-periods`
  - `POST /admin/special-periods`
  - `PATCH /admin/special-periods/:id/status`
  - `DELETE /admin/special-periods/:id`
- **Cevaplar:**
  - `AdminSpecialPeriod[]`
  - `AdminSpecialPeriod`
  - `{ message: string }`
- **Mesajlar:**
  - Form validasyonlari
  - CRUD islem basari/hata dialoglari

### `app/(admin)/qr-desk.tsx`
- **Amac:** QR ile masa snapshot ekranini tab icinde gostermek.
- **Tasarim/Buton/API:** `TableQrDeskScreen` ile ortak.

---

## 2.4 Staff Sekmeleri (`(staff)`)

### `app/(staff)/index.tsx`
- **Amac:** Staff dashboard (admin'e benzer ama kisitli).
- **Butonlar:** Rezervasyonlar, salonlar, QR, cikis.
- **API:**
  - `GET /admin/statistics/overview`
  - `POST /auth/logout`

### `app/(staff)/reservations.tsx`
- **Amac:** Admin reservation ekraninin staff varyanti.
- **Fark:** `allowCancelReservation = false`, iptal aksiyonu gizli.
- **API:** `GET /admin/reservations?status=...`

### `app/(staff)/halls.tsx`
- **Amac:** Admin halls ekraninin staff varyanti.
- **Fark:** `allowTableEdit = false`, masa edit yok.
- **API:** `GET /admin/halls`, `GET /admin/halls/:id/tables`

### `app/(staff)/qr-desk.tsx`
- **Amac:** Ortak QR desk ekrani (tab varyanti).

### `app/(staff)/masa-kontrol.tsx`
- **Amac:** Staff kisayol sayfasi.
- **Butonlar:** hall ve reservations ekranina yonlendirme.
- **API:** Yok.

---

## 2.5 Ortak Bilesen: `components/TableQrDeskScreen.tsx`

- **Amac:** Masaya ait QR okutuldugunda masanin anlik rezervasyon snapshot'ini gostermek.
- **Tasarim:**
  - Kamera/izin alani
  - Sonuc bolumu:
    - aktif rezervasyon karti
    - gunluk rezervasyon listesi
- **Butonlar:**
  - Izin ver
  - Tekrar tara
  - Kapat/Geri
- **API:**
  - `POST /desk/table-snapshot`
- **Beklenen cevap:**
  - `DeskTableSnapshot { calendarDate, table, activeReservation, todayReservations[] }`
- **Mesajlar:**
  - Izin eksigi, uyumsuz hesap veya API hatasi bilgilendirmeleri.

---

## 3) API Katmani (mobile/api) Tam Harita

### `api/client.ts`
- Merkezi HTTP istemcisi.
- Base URL: `app.json` -> `expo.extra.apiUrl` (ornek: `http://172.20.10.4:8081/api/v1`).
- Authorization: AsyncStorage `authToken` varsa `Bearer`.
- 401 davranisi:
  - login endpoint disinda token temizleme + `UNAUTHORIZED` event.
  - login endpointinde kullanici-dostu login hatasi.
- Metotlar: `get`, `post`, `put`, `patch`, `delete`.

### `api/auth.ts`
- `login` -> `POST /auth/login` -> token+user kaydeder.
- `logout` -> `POST /auth/logout` -> local session temizler.
- `verifySession` -> `GET /auth/me` -> user dogrular.
- `getToken`, `getCurrentUser` local storage yardimcilari.

### `api/halls.ts`
- `getAll` -> `GET /halls`
- `getById` -> `GET /halls/:id`
- `getTables` -> `GET /halls/:hallId/tables`
- `getAvailability` -> `GET /halls/:id/availability?date=`
- `getSlots` -> `GET /halls/:id/slots?date=`
- `statistics.getOverallOccupancy` -> `GET /statistics/occupancy`
- `statistics.getHallOccupancy` -> `GET /statistics/occupancy/hall/:id`

### `api/reservations.ts`
- `getStatus` -> `GET /reservations/my/status`
- `create` -> `POST /reservations`
- `getById` -> `GET /reservations/:id`
- `getActive` -> `GET /reservations/my/active`
- `getHistory` -> `GET /reservations/my`
- `getHistoryAll` -> `GET /reservations/my/history`
- `checkIn` -> `POST /reservations/check-in`
- `validateQr` -> `POST /reservations/validate-qr`
- `cancel` -> `DELETE /reservations/:id`
- `extend` -> `PUT /reservations/:id/extend`

### `api/admin.ts`
- Users:
  - `GET /admin/users`
  - `POST /admin/users/:id/force-logout`
  - `PATCH /admin/users/:id/role`
- Reservations:
  - `GET /admin/reservations?status=`
  - `DELETE /admin/reservations/:id`
- Halls/Tables:
  - `GET /admin/halls`
  - `GET /admin/halls/:id/tables`
  - `PATCH /admin/tables/:id`
- Statistics:
  - `GET /admin/statistics/overview`
- Special periods:
  - `GET /admin/special-periods`
  - `POST /admin/special-periods`
  - `PATCH /admin/special-periods/:id`
  - `PATCH /admin/special-periods/:id/status`
  - `DELETE /admin/special-periods/:id`

### `api/desk.ts`
- `getTableSnapshot` -> `POST /desk/table-snapshot`

### `api/schedules.ts`
- `getCurrent` -> `GET /schedules/current`
- Not: Ekranlar tarafinda dogrudan kullanimi sinirli / mevcut akista aktif degil.

---

## 4) Tipler ve Beklenen Cevap Modelleri

Ana tiplerin buyuk kismi `mobile/types/index.ts` ve `mobile/api/*.ts` icinde tanimli:
- `LoginResponse`
- `Hall`, `Table`, `TableFeature`
- `Reservation`, `ReservationStatus`, `UserReservationStatus`
- `HallAvailabilityResponse`, `HallSlotsResponse`
- `AdminUser`, `AdminReservation`, `AdminHall`, `AdminTable`, `AdminOverview`
- `AdminSpecialPeriod`
- `DeskTableSnapshot`

Bu tipler, ekranlarda API cevaplarini render etmek icin referans alinan birincil kontratlardir.

---

## 5) Kritik Notlar / Tutarsizliklar

- `/(tabs)/reservation` ekraninda `acknowledgeScheduledEnd(...)` cagrisi var; bu metot `api/reservations.ts` icinde gorunmuyorsa derleme/runtime uyumsuzlugu olusabilir.
- `hallsApi.getTables` endpoint'i `/halls/:hallId/tables` olmasina ragmen donus tipi kontrol edilmeli (tip uyumsuzlugu riski).
- Bazi endpoint cevaplari ekranda kisitli kullanildigi icin gevsek parse ediliyor (ozellikle check-in akisinda).

---

## 6) Hizli Ozet (Fonksiyonel Bakis)

- **Ogrenci akisi:** login -> salon secimi -> masa/slot secimi -> rezervasyon -> QR check-in -> uzatma/iptal/gecmis.
- **Admin akisi:** dashboard -> rezervasyon/kullanici/salon yonetimi -> ozel takvim -> QR masa snapshot.
- **Staff akisi:** admin ekranlarinin kisitli yetkili varyanti (iptal/edit kapali).
- **Temel API domainleri:** `auth`, `halls`, `reservations`, `statistics`, `admin`, `desk`, `schedules`.

