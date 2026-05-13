import 'reflect-metadata';
import { DataSource } from 'typeorm';
import '../env.defaults';
import {
  Hall,
  Table,
  TableFeature,
  TableLock,
  Reservation,
  ReservationLog,
  OperatingSchedule,
  Notification,
  User,
} from './entities';

const url = process.env.DATABASE_URL;

const AppDataSource = new DataSource({
  type: 'postgres',
  ...(url
    ? { url }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
      }),
  entities: [
    Hall,
    Table,
    TableFeature,
    TableLock,
    Reservation,
    ReservationLog,
    OperatingSchedule,
    Notification,
    User,
  ],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: false,
});

export default AppDataSource;
