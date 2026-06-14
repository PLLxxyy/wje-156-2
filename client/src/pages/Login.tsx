import React, { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin } from '../api';
import { User } from '../types';

interface LoginProps {
  showToast: (msg: string, type?: string) => void;
}

export default function Login({ showToast }: LoginProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiLogin(username, password);
      login(data.token, data.user as User);
      showToast('登录成功');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>公交排班管理系统</h2>
        <p>Bus Driver Scheduling System</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div style={{ marginTop: 24 }}>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? '登录中...' : '登 录'}
            </button>
          </div>
        </form>
        <div style={{ marginTop: 20, fontSize: 12, color: '#999', textAlign: 'center' }}>
          <p>管理员：admin / 123456</p>
          <p>司机：driver / 123456</p>
        </div>
      </div>
    </div>
  );
}
