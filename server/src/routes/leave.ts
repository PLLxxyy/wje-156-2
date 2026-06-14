import { Router, Request, Response } from 'express';
import db from '../db';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { AuthPayload, LeaveRequestWithDetail } from '../types';

const router = Router();

// POST /api/leaves - 提交请假申请
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const { date, reason } = req.body;

  if (!date || !reason) {
    res.status(400).json({ error: '请假日期和原因不能为空' });
    return;
  }

  const schedule = db.prepare(
    'SELECT id FROM schedules WHERE driver_id = ? AND date = ?'
  ).get(user.userId, date) as { id: number } | undefined;

  if (!schedule) {
    res.status(400).json({ error: '该日期没有排班，无需请假' });
    return;
  }

  const existing = db.prepare(
    'SELECT id, status FROM leave_requests WHERE driver_id = ? AND date = ?'
  ).get(user.userId, date) as { id: number; status: string } | undefined;

  if (existing) {
    if (existing.status === 'pending') {
      res.status(400).json({ error: '该日期已有待审批的请假申请' });
      return;
    }
    if (existing.status === 'approved') {
      res.status(400).json({ error: '该日期请假已审批通过' });
      return;
    }
    if (existing.status === 'rejected') {
      db.prepare(
        'UPDATE leave_requests SET status = ?, reason = ?, created_at = datetime(\'now\', \'localtime\'), approved_by = NULL, approved_at = NULL, reject_reason = ? WHERE id = ?'
      ).run('pending', reason, '', existing.id);
      res.json({ id: existing.id, message: '请假申请重新提交成功' });
      return;
    }
  }

  const result = db.prepare(
    'INSERT INTO leave_requests (driver_id, date, reason) VALUES (?, ?, ?)'
  ).run(user.userId, date, reason);

  res.json({ id: result.lastInsertRowid, message: '请假申请提交成功' });
});

// GET /api/leaves - 获取请假列表
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const { year, month, status } = req.query;

  let sql = `
    SELECT l.*, u.name as driver_name, a.name as approver_name
    FROM leave_requests l
    JOIN users u ON l.driver_id = u.id
    LEFT JOIN users a ON l.approved_by = a.id
  `;
  const params: any[] = [];
  const conditions: string[] = [];

  if (user.role === 'driver') {
    conditions.push('l.driver_id = ?');
    params.push(user.userId);
  }

  if (year && month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    conditions.push('l.date LIKE ?');
    params.push(`${prefix}%`);
  }

  if (status) {
    conditions.push('l.status = ?');
    params.push(status);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY l.date DESC, l.created_at DESC';

  const records = db.prepare(sql).all(...params) as LeaveRequestWithDetail[];
  res.json(records);
});

// PUT /api/leaves/:id/approve - 批准请假
router.put('/:id/approve', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const { id } = req.params;
  const now = new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0].substring(0, 5);

  const leave = db.prepare(
    'SELECT * FROM leave_requests WHERE id = ?'
  ).get(Number(id)) as any;

  if (!leave) {
    res.status(404).json({ error: '请假申请不存在' });
    return;
  }

  if (leave.status !== 'pending') {
    res.status(400).json({ error: '该请假申请已审批' });
    return;
  }

  const schedule = db.prepare(
    'SELECT id FROM schedules WHERE driver_id = ? AND date = ?'
  ).get(leave.driver_id, leave.date) as { id: number } | undefined;

  db.prepare(
    'UPDATE leave_requests SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?'
  ).run('approved', user.userId, now, id);

  if (schedule) {
    db.prepare(
      'UPDATE attendance SET is_leave = 1, leave_reason = ? WHERE schedule_id = ?'
    ).run(leave.reason, schedule.id);
  }

  res.json({ message: '请假已批准' });
});

// PUT /api/leaves/:id/reject - 拒绝请假
router.put('/:id/reject', authMiddleware, adminOnly, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const { id } = req.params;
  const { reject_reason } = req.body;
  const now = new Date().toISOString().split('T')[0] + ' ' + new Date().toTimeString().split(' ')[0].substring(0, 5);

  const leave = db.prepare(
    'SELECT * FROM leave_requests WHERE id = ?'
  ).get(Number(id)) as any;

  if (!leave) {
    res.status(404).json({ error: '请假申请不存在' });
    return;
  }

  if (leave.status !== 'pending') {
    res.status(400).json({ error: '该请假申请已审批' });
    return;
  }

  const schedule = db.prepare(
    'SELECT id FROM schedules WHERE driver_id = ? AND date = ?'
  ).get(leave.driver_id, leave.date) as { id: number } | undefined;

  db.prepare(
    'UPDATE leave_requests SET status = ?, approved_by = ?, approved_at = ?, reject_reason = ? WHERE id = ?'
  ).run('rejected', user.userId, now, reject_reason || '', id);

  if (schedule) {
    db.prepare(
      'UPDATE attendance SET is_leave = 0, leave_reason = ? WHERE schedule_id = ?'
    ).run('', schedule.id);
  }

  res.json({ message: '请假已拒绝' });
});

export default router;
