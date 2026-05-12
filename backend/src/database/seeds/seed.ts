import '../../env.defaults';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import * as fs from 'node:fs/promises';
import { User, UserRole } from '../entities/user.entity';
import { OperatingSchedule, ScheduleType } from '../entities/operating-schedule.entity';
import { Hall } from '../entities/hall.entity';
import { Table, TableStatus } from '../entities/table.entity';

// Salon gruplarina gore referans koordinatlari
const HALL_GROUP_COORDINATES = {
  AD: { latitude: 38.02394, longitude: 32.51194 }, // A-D
  BE: { latitude: 38.02417, longitude: 32.51221 }, // B-E
  CF: { latitude: 38.02439, longitude: 32.51193 }, // C-F
} as const;

function getHallCenterCoordinates(hallName: string): { latitude: number; longitude: number } {
  const code = hallName.trim().charAt(0).toUpperCase();
  if (code === 'A' || code === 'D') return HALL_GROUP_COORDINATES.AD;
  if (code === 'B' || code === 'E') return HALL_GROUP_COORDINATES.BE;
  if (code === 'C' || code === 'F') return HALL_GROUP_COORDINATES.CF;
  return HALL_GROUP_COORDINATES.AD;
}

const DEFAULT_ALLOWED_RADIUS_METERS = 300;
const HALL_TABLE_COUNTS: Array<{ code: string; count: number }> = [
  { code: 'A', count: 104 },
  { code: 'B', count: 112 },
  { code: 'C', count: 104 },
  { code: 'D', count: 100 },
  { code: 'E', count: 100 },
  { code: 'F', count: 104 },
];
const QR_CSV_PATH = process.env.QR_CSV_PATH || 'C:/Users/Kaan/Desktop/qr_codes_all.csv';

async function loadQrMapFromCsv(): Promise<Map<string, string>> {
  const qrMap = new Map<string, string>();
  try {
    const raw = await fs.readFile(QR_CSV_PATH, 'utf8');
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    for (const line of lines.slice(1)) {
      const parts = line.split(',');
      if (parts.length < 3) continue;
      const tableNumber = parts[1].trim();
      const qrCode = parts.slice(2).join(',').trim();
      if (tableNumber && qrCode) {
        qrMap.set(tableNumber, qrCode);
      }
    }
  } catch {
    console.warn(`  [UYARI] QR CSV okunamadi: ${QR_CSV_PATH}. Seed fallback QR uretecek.`);
  }
  return qrMap;
}

/**
 * SUMOB entegrasyonu sonrası login parolası kullanılmıyor; bu seed sadece
 * admin/staff için kütüphane DB'sinde rol tanımı oluşturur. SUMOB'tan giriş
 * yapan öğrenciler ilk istekte otomatik olarak oluşturulur (sp_find_user).
 */
const SEED_USERS = [
  {
    studentNumber: 'admin001',
    fullName: 'Sistem Yöneticisi',
    role: UserRole.ADMIN,
    isSuperAdmin: true,
  },
  {
    studentNumber: 'admin002',
    fullName: 'Yardımcı Yönetici',
    role: UserRole.ADMIN,
    isSuperAdmin: false,
  },
  {
    studentNumber: 'staff001',
    fullName: 'Kütüphane Personeli',
    role: UserRole.STAFF,
  },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const userRepo = dataSource.getRepository(User);
  const csvQrMap = await loadQrMapFromCsv();

  console.log('Seed başlatılıyor...\n');

  for (const userData of SEED_USERS) {
    const existing = await userRepo.findOne({
      where: { studentNumber: userData.studentNumber },
    });

    if (existing) {
      const shouldBeSuperAdmin = !!userData.isSuperAdmin;
      if (existing.isSuperAdmin !== shouldBeSuperAdmin) {
        existing.isSuperAdmin = shouldBeSuperAdmin;
        await userRepo.save(existing);
        console.log(
          `  [GUNCELLENDI] ${userData.studentNumber} super-admin=${shouldBeSuperAdmin ? 'evet' : 'hayir'}`,
        );
      }
      console.log(`  [MEVCUT] ${userData.studentNumber} - ${userData.fullName}`);
      continue;
    }

    const user = userRepo.create({
      studentNumber: userData.studentNumber,
      fullName: userData.fullName,
      role: userData.role,
      isSuperAdmin: !!userData.isSuperAdmin,
      passwordHash: null,
    });
    await userRepo.save(user);
    console.log(`  [OLUŞTURULDU] ${userData.studentNumber} - ${userData.fullName} (${userData.role})`);
  }

  // Varsayilan calisma takvimi olustur
  const scheduleRepo = dataSource.getRepository(OperatingSchedule);
  const existingSchedule = await scheduleRepo.findOne({
    where: { scheduleType: ScheduleType.NORMAL, isActive: true },
  });

  if (!existingSchedule) {
    const schedule = scheduleRepo.create({
      name: 'Normal Donem',
      scheduleType: ScheduleType.NORMAL,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      is24h: false,
      openingTime: '08:00',
      closingTime: '23:00',
      maxDurationHours: 3,
      chainQrTimeoutMinutes: 15,
      isActive: true,
    });
    await scheduleRepo.save(schedule);
    console.log('  [OLUSTURULDU] Varsayilan calisma takvimi (08:00 - 23:00)');
  } else {
    console.log('  [MEVCUT] Calisma takvimi');
  }

  // Mevcut salonlara koordinat bilgisi ekle (check-in icin gerekli)
  const hallRepo = dataSource.getRepository(Hall);
  const tableRepo = dataSource.getRepository(Table);
  const halls = await hallRepo.find();

  for (const hall of halls) {
    const center = getHallCenterCoordinates(hall.name);
    hall.centerLatitude = center.latitude;
    hall.centerLongitude = center.longitude;
    hall.allowedRadiusMeters = DEFAULT_ALLOWED_RADIUS_METERS;

    await hallRepo.save(hall);
    console.log(
      `  [GUNCELLENDI] Salon "${hall.name}" koordinatlari set edildi ` +
        `(${center.latitude}, ${center.longitude}, ${DEFAULT_ALLOWED_RADIUS_METERS}m)`,
    );
  }

  if (halls.length === 0) {
    console.log('  [BILGI] Henuz salon tanimlanmamis. Salonlar olusturulduktan sonra seed tekrar calistirilabilir.');
  }

  // Excel'deki SALON MASALARI verisine göre varsayilan salon/masa olustur
  for (let index = 0; index < HALL_TABLE_COUNTS.length; index++) {
    const { code, count } = HALL_TABLE_COUNTS[index];
    const hallName = `${code} Salonu`;
    let hall = await hallRepo.findOne({ where: { name: hallName } });

    if (!hall) {
      const center = getHallCenterCoordinates(hallName);
      hall = hallRepo.create({
        name: hallName,
        floor: 1,
        description: `${code} bloğu çalışma salonu`,
        layoutWidth: 1400,
        layoutHeight: 900,
        capacity: count,
        isActive: true,
        displayOrder: index + 1,
        centerLatitude: center.latitude,
        centerLongitude: center.longitude,
        allowedRadiusMeters: DEFAULT_ALLOWED_RADIUS_METERS,
      });
      hall = await hallRepo.save(hall);
      console.log(`  [OLUSTURULDU] Salon: ${hallName} (kapasite: ${count})`);
    } else {
      const center = getHallCenterCoordinates(hallName);
      hall.capacity = count;
      hall.isActive = true;
      hall.centerLatitude = center.latitude;
      hall.centerLongitude = center.longitude;
      hall.allowedRadiusMeters = DEFAULT_ALLOWED_RADIUS_METERS;
      hall = await hallRepo.save(hall);
      console.log(`  [GUNCELLENDI] Salon: ${hallName} (kapasite: ${count})`);
    }

    const existingTables = await tableRepo.find({
      where: { hallId: hall.id },
      select: { tableNumber: true },
    });
    const existingTableNumbers = new Set(existingTables.map((t) => t.tableNumber));

    let createdCount = 0;
    for (let i = 1; i <= count; i++) {
      const tableNumber = `${code} ${i.toString().padStart(3, '0')}`;
      if (existingTableNumbers.has(tableNumber)) continue;

      const col = (i - 1) % 16;
      const row = Math.floor((i - 1) / 16);
      const table = tableRepo.create({
        hallId: hall.id,
        tableNumber,
        positionX: 60 + col * 80,
        positionY: 60 + row * 80,
        width: 52,
        height: 52,
        rotation: 0,
        qrCode:
          csvQrMap.get(tableNumber) ||
          `SELCUK_LIB_${hall.id.slice(0, 8)}_${tableNumber.replace(/\s+/g, '')}_${Math.random().toString(36).slice(2, 10)}`,
        status: TableStatus.AVAILABLE,
        isActive: true,
      });
      await tableRepo.save(table);
      createdCount++;
    }
    console.log(`  [BILGI] ${hallName} masalari: +${createdCount} yeni, toplam hedef ${count}`);
  }

  console.log('\nSeed tamamlandi!');
  console.log('\nNot: Login artık SUMOB üzerinden yapılmakta. Bu seed yalnızca');
  console.log('admin/staff için rol kaydı oluşturur. Öğrenci kayıtları ilk');
  console.log('SUMOB girişinde sp_find_user üzerinden otomatik açılır.');

  await app.close();
}

seed().catch((err) => {
  console.error('Seed hatası:', err);
  process.exit(1);
});
