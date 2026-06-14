import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
import { generateToken, authMiddleware } from '../middleware/auth';
import { User, AuthPayload } from '../types';

const router = Router();

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: '请输入用户名和密码' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  if (!user) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const payload: AuthPayload = { userId: user.id, role: user.role };
  const token = generateToken(payload);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone,
      license_no: user.license_no,
    },
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user as AuthPayload;
  const row = db.prepare('SELECT id, username, name, role, phone, license_no FROM users WHERE id = ?').get(user.userId) as Omit<User, 'password'> | undefined;
  if (!row) {
    res.status(404).json({ error: '用户不存在' });
    return;
  }
  res.json(row);
});

export default router;
