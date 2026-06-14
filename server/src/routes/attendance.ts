import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { AuthPayload, AttendanceWithDetail } from '../types';

const router = Router();

// Shift time definitions for status calculation
const SHIFT_TIMES: Record<string, { start: string; end: string }> = {
  morning: { start: '06:00', end: '14:00' },
  afternoon: { start: '14:00', end: '22:00' },
  night: { start: '22:00', end: '06:00' },
};

function determineStatus(shift: string, checkIn: string | null, checkOut: string | null): string {
  if (!checkIn && !checkOut) return 'absent';
  const times = SHIFT_TIMES[shift];
  if (!times) return 'normal';

  const isLate = checkIn ? checkIn > times.start : false;
  const isEarly = checkOut ? checkOut < times.end : false;

  if (isLate && isEarly) return 'late_and_early';
  if (isLate) return 'late';
  if (isEarly) return 'early_leave';
  return 'normal';
}

// POST /api/attendance/checkin - 签到
router.post('/checkin', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().split(' ')[0].substring(0, 5);

  // Find today's schedule
  const schedule = db.prepare(
    'SELECT s.id as schedule_id, s.shift FROM schedules s WHERE s.driver_id = ? AND s.date = ?'
  ).get(user.userId, today) as { schedule_id: number; shift: string } | undefined;

  if (!schedule) {
    res.status(404).json({ error: '今天没有排班' });
    return;
  }

  const attendance = db.prepare(
    'SELECT * FROM attendance WHERE schedule_id = ?'
  ).get(schedule.schedule_id) as { id: number; check_in: string | null } | undefined;

  if (!attendance) {
    res.status(404).json({ error: '考勤记录不存在' });
    return;
  }

  if (attendance.check_in) {
    res.status(400).json({ error: '今天已经签到过了' });
    return;
  }

  const status = determineStatus(schedule.shift, now, null);
  db.prepare('UPDATE attendance SET check_in = ?, status = ? WHERE id = ?').run(now, status, attendance.id);

  res.json({ message: '签到成功', check_in: now, status });
});

// POST /api/attendance/checkout - 签退
router.post('/checkout', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toTimeString().split(' ')[0].substring(0, 5);

  const schedule = db.prepare(
    'SELECT s.id as schedule_id, s.shift FROM schedules s WHERE s.driver_id = ? AND s.date = ?'
  ).get(user.userId, today) as { schedule_id: number; shift: string } | undefined;

  if (!schedule) {
    res.status(404).json({ error: '今天没有排班' });
    return;
  }

  const attendance = db.prepare(
    'SELECT * FROM attendance WHERE schedule_id = ?'
  ).get(schedule.schedule_id) as { id: number; check_in: string | null; check_out: string | null } | undefined;

  if (!attendance) {
    res.status(404).json({ error: '考勤记录不存在' });
    return;
  }

  if (!attendance.check_in) {
    res.status(400).json({ error: '请先签到' });
    return;
  }

  if (attendance.check_out) {
    res.status(400).json({ error: '今天已经签退过了' });
    return;
  }

  const status = determineStatus(schedule.shift, attendance.check_in, now);
  db.prepare('UPDATE attendance SET check_out = ?, status = ? WHERE id = ?').run(now, status, attendance.id);

  res.json({ message: '签退成功', check_out: now, status });
});

// GET /api/attendance/today - 获取今天的考勤状态
router.get('/today', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const today = new Date().toISOString().split('T')[0];

  const record = db.prepare(`
    SELECT a.*, s.date, s.shift, r.name as route_name, r.route_no, r.plate_no
    FROM attendance a
    JOIN schedules s ON a.schedule_id = s.id
    JOIN routes r ON s.route_id = r.id
    WHERE a.driver_id = ? AND s.date = ?
  `).get(user.userId, today);

  res.json(record || null);
});

// GET /api/attendance - 管理员查看考勤列表
router.get('/', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const { year, month } = req.query;

  let sql = `
    SELECT a.*, u.name as driver_name, s.date, s.shift, r.name as route_name, r.route_no
    FROM attendance a
    JOIN users u ON a.driver_id = u.id
    JOIN schedules s ON a.schedule_id = s.id
    JOIN routes r ON s.route_id = r.id
  `;
  const params: any[] = [];

  if (year && month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    sql += ' WHERE s.date LIKE ?';
    params.push(`${prefix}%`);
  }

  sql += ' ORDER BY s.date DESC, s.shift';

  const records = db.prepare(sql).all(...params) as AttendanceWithDetail[];
  res.json(records);
});

export default router;
