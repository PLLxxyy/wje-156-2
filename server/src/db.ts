import Database, { type Database as SqliteDatabase } from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(__dirname, '..', 'data.db');
const db: SqliteDatabase = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'driver')),
      phone TEXT DEFAULT '',
      license_no TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      route_no TEXT UNIQUE NOT NULL,
      start_station TEXT NOT NULL,
      end_station TEXT NOT NULL,
      plate_no TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER NOT NULL,
      route_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      shift TEXT NOT NULL CHECK(shift IN ('morning', 'afternoon', 'night')),
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (driver_id) REFERENCES users(id),
      FOREIGN KEY (route_id) REFERENCES routes(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      UNIQUE(driver_id, date)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL UNIQUE,
      driver_id INTEGER NOT NULL,
      check_in TEXT,
      check_out TEXT,
      status TEXT DEFAULT 'absent' CHECK(status IN ('normal', 'late', 'early_leave', 'absent', 'late_and_early')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id),
      FOREIGN KEY (driver_id) REFERENCES users(id)
    );
  `);

  // Seed data
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
  if (userCount === 0) {
    const adminHash = bcrypt.hashSync('123456', 10);
    const driverHash = bcrypt.hashSync('123456', 10);

    const insertUser = db.prepare(
      'INSERT INTO users (username, password, name, role, phone, license_no) VALUES (?, ?, ?, ?, ?, ?)'
    );

    insertUser.run('admin', adminHash, '系统管理员', 'admin', '13800000001', '');
    insertUser.run('driver', driverHash, '张师傅', 'driver', '13800000002', 'A1-20230001');
    insertUser.run('driver2', driverHash, '李师傅', 'driver', '13800000003', 'A1-20230002');
    insertUser.run('driver3', driverHash, '王师傅', 'driver', '13800000004', 'A1-20230003');
    insertUser.run('driver4', driverHash, '赵师傅', 'driver', '13800000005', 'A1-20230004');
    insertUser.run('driver5', driverHash, '刘师傅', 'driver', '13800000006', 'A1-20230005');
    insertUser.run('driver6', driverHash, '陈师傅', 'driver', '13800000007', 'A1-20230006');

    const insertRoute = db.prepare(
      'INSERT INTO routes (name, route_no, start_station, end_station, plate_no) VALUES (?, ?, ?, ?, ?)'
    );

    insertRoute.run('1路', 'L001', '火车站', '科技园', '京A·12345');
    insertRoute.run('2路', 'L002', '市政府', '大学城', '京A·23456');
    insertRoute.run('3路', 'L003', '汽车站', '工业园', '京A·34567');
    insertRoute.run('5路', 'L005', '市中心', '高铁站', '京A·45678');
    insertRoute.run('8路', 'L008', '体育馆', '医院', '京A·56789');
  }
}

export default db;
