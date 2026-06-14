import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { AuthPayload, ScheduleWithDetail, Route, User } from '../types';

const router = Router();

// GET /api/schedules - 获取排班列表
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const { year, month } = req.query;

  let sql = `
    SELECT s.*, u.name as driver_name, r.name as route_name, r.route_no, r.plate_no, r.start_station, r.end_station
    FROM schedules s
    JOIN users u ON s.driver_id = u.id
    JOIN routes r ON s.route_id = r.id
  `;
  const params: any[] = [];

  if (user.role === 'driver') {
    sql += ' WHERE s.driver_id = ?';
    params.push(user.userId);
  }

  if (year && month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const whereClause = user.role === 'driver' ? ' AND' : ' WHERE';
    sql += `${whereClause} s.date LIKE ?`;
    params.push(`${prefix}%`);
  }

  sql += ' ORDER BY s.date, s.shift';

  const schedules = db.prepare(sql).all(...params) as ScheduleWithDetail[];
  res.json(schedules);
});

// POST /api/schedules - 创建排班（管理员）
router.post('/', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const { driver_id, route_id, date, shift } = req.body;

  if (!driver_id || !route_id || !date || !shift) {
    res.status(400).json({ error: '缺少必填字段' });
    return;
  }

  // Conflict detection: same driver, same date
  const conflict = db.prepare(
    'SELECT * FROM schedules WHERE driver_id = ? AND date = ?'
  ).get(driver_id, date);

  if (conflict) {
    res.status(409).json({ error: '冲突：该司机当天已有排班' });
    return;
  }

  try {
    const result = db.prepare(
      'INSERT INTO schedules (driver_id, route_id, date, shift, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(driver_id, route_id, date, shift, user.userId);

    // Auto-create attendance record
    db.prepare(
      'INSERT INTO attendance (schedule_id, driver_id, status) VALUES (?, ?, ?)'
    ).run(result.lastInsertRowid, driver_id, 'absent');

    res.json({ id: result.lastInsertRowid, message: '排班创建成功' });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint')) {
      res.status(409).json({ error: '冲突：该司机当天已有排班' });
      return;
    }
    res.status(500).json({ error: '创建排班失败' });
  }
});

// GET /api/schedules/routes - 获取所有线路
router.get('/routes', authMiddleware, (req: Request, res: Response) => {
  const routes = db.prepare('SELECT * FROM routes ORDER BY route_no').all() as Route[];
  res.json(routes);
});

// GET /api/schedules/drivers - 获取所有司机
router.get('/drivers', authMiddleware, (req: Request, res: Response) => {
  const drivers = db.prepare(
    "SELECT id, username, name, phone, license_no FROM users WHERE role = 'driver' ORDER BY name"
  ).all() as Omit<User, 'password' | 'role' | 'created_at'>[];
  res.json(drivers);
});

// POST /api/schedules/batch - 批量创建排班
router.post('/batch', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const { items } = req.body as {
    items: Array<{ driver_id: number; route_id: number; date: string; shift: string }>;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: '缺少排班数据' });
    return;
  }

  const conflicts: string[] = [];
  const created: number[] = [];

  const insertSchedule = db.prepare(
    'INSERT INTO schedules (driver_id, route_id, date, shift, created_by) VALUES (?, ?, ?, ?, ?)'
  );
  const insertAttendance = db.prepare(
    'INSERT INTO attendance (schedule_id, driver_id, status) VALUES (?, ?, ?)'
  );
  const checkConflict = db.prepare(
    'SELECT id FROM schedules WHERE driver_id = ? AND date = ?'
  );

  const batchInsert = db.transaction(() => {
    for (const item of items) {
      const existing = checkConflict.get(item.driver_id, item.date) as { id: number } | undefined;
      if (existing) {
        conflicts.push(`司机(ID:${item.driver_id})在${item.date}已有排班`);
        continue;
      }
      try {
        const result = insertSchedule.run(
          item.driver_id, item.route_id, item.date, item.shift, user.userId
        );
        insertAttendance.run(result.lastInsertRowid, item.driver_id, 'absent');
        created.push(Number(result.lastInsertRowid));
      } catch {
        conflicts.push(`司机(ID:${item.driver_id})在${item.date}创建失败`);
      }
    }
  });

  batchInsert();

  res.json({
    message: `成功创建${created.length}条排班`,
    created_count: created.length,
    conflicts,
  });
});

// DELETE /api/schedules/:id - 删除排班（管理员）
router.delete('/:id', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM attendance WHERE schedule_id = ?').run(id);
  const result = db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: '排班不存在' });
    return;
  }
  res.json({ message: '排班已删除' });
});

export default router;
