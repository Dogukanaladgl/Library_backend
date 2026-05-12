# 📚 Selçuk Üniversitesi Kütüphane Rezervasyon Sistemi

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-development-orange.svg)

**Akıllı kütüphane masa rezervasyonu ve doluluk takip sistemi**

[Özellikler](#-özellikler) •
[Teknolojiler](#-teknoloji-stack) •
[Kurulum](#-kurulum) •
[Proje Yapısı](#-proje-yapısı) •
[API](#-api-dokümantasyonu)

</div>

---

## 📋 Proje Hakkında

Bu proje, Selçuk Üniversitesi mobil uygulamasına entegre edilecek kapsamlı bir **kütüphane masa rezervasyon ve doluluk takip sistemi**dir. Öğrenciler uygulama üzerinden masa rezervasyonu yapabilir, QR kod ile check-in gerçekleştirebilir ve anlık doluluk oranlarını takip edebilir.

### 🎯 Proje Hedefleri

- Kütüphane kaynaklarının verimli kullanımı
- Öğrenci deneyiminin iyileştirilmesi
- Gerçek zamanlı doluluk takibi
- Adil ve şeffaf masa dağıtımı

---

## ✨ Özellikler

### 🎫 Rezervasyon Sistemi

| Özellik | Açıklama |
|---------|----------|
| **Esnek Süre Seçimi** | 1, 2 veya 3 saatlik bloklar halinde rezervasyon |
| **3 Saatlik Kilit** | Her rezervasyon 3 saatlik masa kilidi oluşturur |
| **Zincir Rezervasyon** | Son 30 dakikada yeni rezervasyon ile süresiz uzatma |
| **Günlük Limit Yok** | Zincir rezervasyonlarla gün boyu çalışma imkanı |

### 📱 QR Check-in Sistemi

- **30 dakika** içinde QR okutma zorunluluğu
- **25. dakikada** push notification uyarısı
- **Konum doğrulama** (maksimum 50 metre)
- Zincir rezervasyonlarda **15 dakika** QR süresi

### 🗺️ İnteraktif Kroki Sistemi

Sinema salonu tarzı görsel masa seçimi:
- Renk kodlu masa durumları (Boş/Dolu/Rezerve)
- Masa özellik filtreleme (Priz, Cam kenarı, Sessiz bölge)
- Gerçek zamanlı güncelleme

### 📊 Doluluk Takibi

- Anlık genel doluluk oranı
- Salon bazlı doluluk gösterimi
- "Yakında boşalacak" masa gösterimi
- Gerçek zamanlı güncelleme (WebSocket)

---

## 🛠️ Teknoloji Stack

### Backend

| Teknoloji | Kullanım Amacı |
|-----------|----------------|
| **NestJS** | Ana backend framework (TypeScript) |
| **PostgreSQL** | İlişkisel veritabanı |
| **Redis** | Cache, session, real-time state |
| **TypeORM** | ORM |
| **Swagger** | API dokümantasyonu |

### Frontend - Web (Staff Dashboard)

| Teknoloji | Kullanım Amacı |
|-----------|----------------|
| **React 18** | Web uygulaması |
| **TypeScript** | Tip güvenliği |
| **Tailwind CSS** | Styling |
| **Vite** | Build tool |

### Frontend - Mobile (Expo)

| Teknoloji | Kullanım Amacı |
|-----------|----------------|
| **React Native** | Cross-platform mobil |
| **Expo** | Development platform |
| **Expo Router** | File-based navigation |
| **expo-camera** | QR kod okuma |
| **expo-location** | Konum doğrulama |

### Altyapı

| Teknoloji | Kullanım Amacı |
|-----------|----------------|
| **Docker** | Containerization |
| **Firebase FCM** | Push notifications |

---

## 📁 Proje Yapısı

```
library-reservation-system/
├── backend/                    # NestJS Backend API
│   ├── src/
│   │   ├── modules/           # Feature modules
│   │   │   ├── halls/         # Salon yönetimi
│   │   │   ├── tables/        # Masa yönetimi
│   │   │   ├── reservations/  # Rezervasyon işlemleri
│   │   │   ├── statistics/    # İstatistikler
│   │   │   └── schedules/     # Çalışma saatleri
│   │   └── config/            # Konfigürasyonlar
│   └── package.json
│
├── frontend/                   # React Web (Staff Dashboard)
│   ├── src/
│   │   ├── components/        # UI Components
│   │   │   ├── ui/            # Reusable (Card, Badge, etc.)
│   │   │   ├── layout/        # Layout components
│   │   │   ├── dashboard/     # Dashboard specific
│   │   │   └── icons/         # SVG icons
│   │   ├── config/            # Environment config
│   │   ├── constants/         # App & theme constants
│   │   ├── context/           # React Context
│   │   ├── hooks/             # Custom hooks
│   │   ├── services/          # API services
│   │   ├── types/             # TypeScript types
│   │   ├── utils/             # Utility functions
│   │   └── pages/             # Page components
│   └── package.json
│
├── mobile/                     # Expo React Native App
│   ├── app/                   # Expo Router screens
│   │   ├── (tabs)/            # Tab navigation
│   │   │   ├── index.tsx      # Ana sayfa
│   │   │   ├── halls.tsx      # Salonlar
│   │   │   ├── reservation.tsx # Rezervasyonlarım
│   │   │   └── profile.tsx    # Profil
│   │   ├── hall/[id].tsx      # Salon detay (Kroki)
│   │   └── qr-scan.tsx        # QR tarama
│   ├── api/                   # API client
│   ├── constants/             # Theme & constants
│   ├── types/                 # TypeScript types
│   └── package.json
│
├── database/                   # Database scripts
│   └── init/                  # Init SQL scripts
│
├── docker-compose.yml         # Docker services
└── README.md
```

---

## 🚀 Kurulum

### Gereksinimler

- Node.js 20+ (önerilen)
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose
- pnpm 10+

### 0. Ön Kontrol (Önemli)

Windows kullanıyorsanız önce **Docker Desktop uygulamasını açın** ve engine'in "running" durumda olduğunu doğrulayın.

```bash
node -v
pnpm -v
docker --version
docker compose version
```

### 1. Repository'yi Klonla

### 2. Docker Servislerini Başlat (PostgreSQL + Redis)

```bash
docker compose up -d
docker compose ps
```

Başarılı durumda aşağıdaki portlar dolu olmalıdır:

- PostgreSQL: `localhost:5433`
- Redis: `localhost:6380`
- pgAdmin: `localhost:5050`
- Redis Commander: `localhost:8081`

### 3. Backend Kurulumu

```bash
cd backend
cp .env.example .env
pnpm install
pnpm run build
pnpm run start:dev
```

Backend: http://localhost:8081  
Swagger: http://localhost:8081/api/docs

### 4. Web Frontend (Staff Dashboard)

```bash
cd frontend
pnpm install
pnpm run build
pnpm run dev
```

Web Dashboard: http://localhost:5173

### 5. Mobile App (Expo)

```bash
cd mobile
pnpm install
pnpm run typecheck
pnpm run start
```

Expo Go uygulamasını telefonuna indir ve QR kodu tara.

### 6. Bağlantı Bilgileri (SQL/Redis)

`backend/.env` dosyasındaki varsayılan değerler `docker-compose.yml` ile uyumludur:

```env
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=library_user
DB_PASSWORD=library_pass_2025
DB_DATABASE=library_reservation

REDIS_HOST=localhost
REDIS_PORT=6380
```

Sunucu / Docker ağındaki üretim PostgreSQL (örnek) için tam URL: `backend/src/env.defaults.ts` ve `docker-compose.yml` bu değerlerle hizalanmıştır:

```env
DATABASE_URL=postgresql://kutuphane:kutuphane123@postgres:5432/kütüphane
```

Ayrı ayrı alan: `DB_HOST=postgres`, `DB_PORT=5432`, `DB_USERNAME=kutuphane`, `DB_PASSWORD=...`, `DB_DATABASE=kütüphane` (veya yalnızca `DATABASE_URL`).

### 7. Sorun Giderme

- `docker compose up -d` sırasında `open //./pipe/dockerDesktopLinuxEngine` hatası alırsan Docker Desktop kapalıdır; uygulamayı açıp tekrar dene.
- `5432 already in use` hatasında bu proje için zaten `5433` kullanılıyor; gerekirse farklı bir boş porta çekebilirsin.
- Backend DB'ye bağlanamazsa `backend/.env` içindeki DB alanlarını tekrar kontrol et.

---

## 📚 API Dokümantasyonu

API dokümantasyonuna Swagger UI üzerinden erişebilirsiniz:

```
http://localhost:8081/api/docs
```

### Temel Endpoint'ler

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET` | `/api/halls` | Tüm salonları listele |
| `GET` | `/api/halls/:id/tables` | Salon masalarını getir |
| `GET` | `/api/statistics/realtime` | Gerçek zamanlı doluluk |
| `POST` | `/api/reservations` | Yeni rezervasyon oluştur |
| `POST` | `/api/reservations/check-in` | QR check-in |
| `DELETE` | `/api/reservations/:id` | Rezervasyon iptal |

---

## 📅 Geliştirme Yol Haritası

### Faz 1: Temel Altyapı ✅
- [x] Proje yapısı ve dokümantasyon
- [x] PostgreSQL şema oluşturma
- [x] NestJS modüler yapı kurulumu
- [x] Temel API endpoints
- [x] Docker yapılandırması

### Faz 2: Web Dashboard ✅
- [x] Staff Dashboard tasarımı
- [x] Profesyonel kod mimarisi
- [x] İnteraktif salon haritası
- [x] Gerçek zamanlı doluluk gösterimi

### Faz 3: Mobil Uygulama ✅
- [x] Expo React Native kurulumu
- [x] Tab navigation yapısı
- [x] Ana ekranlar (Salonlar, Rezervasyon, Profil)
- [x] Kroki görünümü
- [x] QR tarama ekranı
- [x] Selçuk UI tasarım entegrasyonu

### Faz 4: Bildirim & Zamanlama 🔄
- [ ] Cron job sistemi
- [ ] FCM entegrasyonu
- [ ] Otomatik rezervasyon iptali

### Faz 5: Entegrasyon
- [ ] Üniversite mobil app entegrasyonu
- [ ] Üniversite SSO entegrasyonu
- [ ] Performans optimizasyonu

---

## 🤝 Katkıda Bulunma

1. Bu repository'yi fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

---

## 📞 İletişim

**Selçuk Üniversitesi Bilgi İşlem Daire Başkanlığı**

- 📧 Email: bilgiislem@selcuk.edu.tr
- 🌐 Web: https://www.selcuk.edu.tr

---

<div align="center">

**Selçuk Üniversitesi © 2025**

*Akıllı Kampüs Projesi*

</div>
