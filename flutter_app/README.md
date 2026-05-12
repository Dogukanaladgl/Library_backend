# Flutter Migration App

Bu klasor, RN `mobile` uygulamasinin Flutter karsiligidir.

## Mimari
- `lib/src/core`: config, network, router, storage
- `lib/src/features/auth`: login + auth state
- `lib/src/features/student`: ogrenci ekranlari
- `lib/src/features/admin`: admin ekranlari
- `lib/src/features/staff`: staff ekranlari
- `lib/src/features/shared`: ortak modeller ve API servisleri

## API
Varsayilan API base URL:
- `http://172.20.10.4:8081/api/v1`

Override etmek icin:
```bash
flutter run --dart-define=API_BASE_URL=http://YOUR_IP:8081/api/v1
```

## Not
Bu ortamda Flutter SDK kurulu olmadigi icin komutlar burada calistirilmamistir. Lokal makinede su adimlari calistirin:
1. `flutter pub get`
2. `flutter analyze`
3. `flutter test`
4. `flutter run`
