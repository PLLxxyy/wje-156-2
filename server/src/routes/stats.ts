import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = Router();

// GET /api/stats/overview - 管理员统计总览
router.get('/overview', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const { year, month } = req.query;
  const prefix = year && month ? `${year}-${String(month).padStart(2, '0')}` : null;

  // Total schedules
  let scheduleCountSql = 'SELECT COUNT(*) as cnt FROM schedules';
  let attendanceCountSql = `
    SELECT COUNT(*) as cnt FROM attendance a JOIN schedules s ON a.schedule_id = s.id
  `;
  const params: any[] = [];

  if (prefix) {
    scheduleCountSql += ' WHERE date LIKE ?';
    attendanceCountSql += ' WHERE s.date LIKE ?';
    params.push(`${prefix}%`);
  }

  const totalSchedules = (db.prepare(scheduleCountSql).get(...params) as { cnt: number }).cnt;
  const totalAttendance = (db.prepare(attendanceCountSql).get(...params) as { cnt: number }).cnt;

  // Status breakdown
  let statusSql = `
    SELECT a.status, COUNT(*) as cnt
    FROM attendance a JOIN schedules s ON a.schedule_id = s.id
  `;
  const statusParams: any[] = [];
  if (prefix) {
    statusSql += ' WHERE s.date LIKE ?';
    statusParams.push(`${prefix}%`);
  }
  statusSql += ' GROUP BY a.status';

  const statusBreakdown = db.prepare(statusSql).all(...statusParams) as Array<{ status: string; cnt: number }>;

  const normalCount = statusBreakdown.find(s => s.status === 'normal')?.cnt || 0;
  const lateCount = statusBreakdown.find(s => s.status === 'late')?.cnt || 0;
  const earlyCount = statusBreakdown.find(s => s.status === 'early_leave')?.cnt || 0;
  const absentCount = statusBreakdown.find(s => s.status === 'absent')?.cnt || 0;
  const lateAndEarly = statusBreakdown.find(s => s.status === 'late_and_early')?.cnt || 0;

  const abnormalTotal = lateCount + earlyCount + absentCount + lateAndEarly;
  const attendanceRate = totalAttendance > 0
    ? Math.round(((totalAttendance - absentCount) / totalAttendance) * 100)
    : 0;
  const normalRate = totalAttendance > 0
    ? Math.round((normalCount / totalAttendance) * 100)
    : 0;

  res.json({
    totalSchedules,
    totalAttendance,
    normalCount,
    lateCount,
    earlyCount,
    absentCount,
    lateAndEarly,
    abnormalTotal,
    attendanceRate,
    normalRate,
  });
});

// GET /api/stats/route - 每条线路的出车率
router.get('/route', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const { year, month } = req.query;
  const prefix = year && month ? `${year}-${String(month).padStart(2, '0')}` : null;

  let sql = `
    SELECT r.id, r.name as route_name, r.route_no,
      COUNT(s.id) as total_trips,
      SUM(CASE WHEN a.status = 'normal' THEN 1 ELSE 0 END) as normal_trips,
      SUM(CASE WHEN a.status != 'absent' THEN 1 ELSE 0 END) as actual_trips
    FROM routes r
    LEFT JOIN schedules s ON r.id = s.route_id
    LEFT JOIN attendance a ON s.id = a.schedule_id
  `;
  const params: any[] = [];
  if (prefix) {
    sql += ' WHERE s.date LIKE ?';
    params.push(`${prefix}%`);
  }
  sql += ' GROUP BY r.id ORDER BY r.route_no';

  const rows = db.prepare(sql).all(...params) as Array<{
    id: number; route_name: string; route_no: string;
    total_trips: number; normal_trips: number; actual_trips: number;
  }>;

  const result = rows.map(r => ({
    ...r,
    departure_rate: r.total_trips > 0
      ? Math.round((r.actual_trips / r.total_trips) * 100)
      : 0,
    normal_rate: r.total_trips > 0
      ? Math.round((r.normal_trips / r.total_trips) * 100)
      : 0,
  }));

  res.json(result);
});

// GET /api/stats/driver - 每个司机的出勤率
router.get('/driver', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const { year, month } = req.query;
  const prefix = year && month ? `${year}-${String(month).padStart(2, '0')}` : null;

  let sql = `
    SELECT u.id, u.name, u.license_no,
      COUNT(s.id) as total_shifts,
      SUM(CASE WHEN a.status = 'normal' THEN 1 ELSE 0 END) as normal_count,
      SUM(CASE WHEN a.status = 'late' OR a.status = 'late_and_early' THEN 1 ELSE 0 END) as late_count,
      SUM(CASE WHEN a.status = 'early_leave' OR a.status = 'late_and_early' THEN 1 ELSE 0 END) as early_count,
      SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count
    FROM users u
    LEFT JOIN schedules s ON u.id = s.driver_id
    LEFT JOIN attendance a ON s.id = a.schedule_id
    WHERE u.role = 'driver'
  `;
  const params: any[] = [];
  if (prefix) {
    sql += ' AND s.date LIKE ?';
    params.push(`${prefix}%`);
  }
  sql += ' GROUP BY u.id ORDER BY u.name';

  const rows = db.prepare(sql).all(...params) as Array<{
    id: number; name: string; license_no: string;
    total_shifts: number; normal_count: number;
    late_count: number; early_count: number; absent_count: number;
  }>;

  const result = rows.map(r => ({
    ...r,
    attendance_rate: r.total_shifts > 0
      ? Math.round(((r.total_shifts - r.absent_count) / r.total_shifts) * 100)
      : 0,
    abnormal_count: r.late_count + r.early_count + r.absent_count,
  }));

  res.json(result);
});

// GET /api/stats/export/schedule - 导出排班表CSV
router.get('/export/schedule', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const { year, month } = req.query;
  if (!year || !month) {
    res.status(400).json({ error: '请提供年月参数' });
    return;
  }
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  const rows = db.prepare(`
    SELECT s.date, u.name as driver_name, r.route_no, r.name as route_name,
      s.shift, r.plate_no, r.start_station, r.end_station
    FROM schedules s
    JOIN users u ON s.driver_id = u.id
    JOIN routes r ON s.route_id = r.id
    WHERE s.date LIKE ?
    ORDER BY s.date, s.shift
  `).all(`${prefix}%`) as any[];

  const shiftMap: Record<string, string> = { morning: '早班', afternoon: '中班', night: '晚班' };
  const header = '日期,司机,线路编号,线路名称,班次,车牌号,起点站,终点站\n';
  const csv = header + rows.map(r =>
    `${r.date},${r.driver_name},${r.route_no},${r.route_name},${shiftMap[r.shift] || r.shift},${r.plate_no},${r.start_station},${r.end_station}`
  ).join('\n');

  const bom = '﻿';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=schedule-${prefix}.csv`);
  res.send(bom + csv);
});

// GET /api/stats/export/attendance - 导出考勤报表CSV
router.get('/export/attendance', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const { year, month } = req.query;
  if (!year || !month) {
    res.status(400).json({ error: '请提供年月参数' });
    return;
  }
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  const rows = db.prepare(`
    SELECT s.date, u.name as driver_name, r.route_no, s.shift,
      a.check_in, a.check_out, a.status
    FROM attendance a
    JOIN schedules s ON a.schedule_id = s.id
    JOIN users u ON a.driver_id = u.id
    JOIN routes r ON s.route_id = r.id
    WHERE s.date LIKE ?
    ORDER BY s.date, u.name
  `).all(`${prefix}%`) as any[];

  const shiftMap: Record<string, string> = { morning: '早班', afternoon: '中班', night: '晚班' };
  const statusMap: Record<string, string> = {
    normal: '正常', late: '迟到', early_leave: '早退',
    absent: '缺勤', late_and_early: '迟到+早退',
  };
  const header = '日期,司机,线路编号,班次,签到时间,签退时间,状态\n';
  const csv = header + rows.map(r =>
    `${r.date},${r.driver_name},${r.route_no},${shiftMap[r.shift] || r.shift},${r.check_in || '-'},${r.check_out || '-'},${statusMap[r.status] || r.status}`
  ).join('\n');

  const bom = '﻿';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=attendance-${prefix}.csv`);
  res.send(bom + csv);
});

export default router;
