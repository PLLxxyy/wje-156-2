import React, { useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ScheduleCalendar from './pages/ScheduleCalendar';
import DriverSchedule from './pages/DriverSchedule';
import AttendancePage from './pages/AttendancePage';
import AdminStats from './pages/AdminStats';

type AdminPage = 'schedule' | 'stats';
type DriverPage = 'schedule' | 'attendance';

function App() {
  const { user, loading, logout } = useAuth();
  const [adminPage, setAdminPage] = useState<AdminPage>('schedule');
  const [driverPage, setDriverPage] = useState<DriverPage>('schedule');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = useCallback((msg: string, type: string = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  if (loading) {
    return (
      <div className="login-container">
        <div className="loading"><div className="spinner" /> 加载中...</div>
      </div>
    );
  }

  if (!user) {
    return <Login showToast={showToast} />;
  }

  if (user.role === 'admin') {
    return (
      <div className="app-container">
        <header className="header">
          <h1>公交司机排班管理系统</h1>
          <div className="header-nav">
            <button className={adminPage === 'schedule' ? 'active' : ''} onClick={() => setAdminPage('schedule')}>排班管理</button>
            <button className={adminPage === 'stats' ? 'active' : ''} onClick={() => setAdminPage('stats')}>统计后台</button>
          </div>
          <div className="header-right">
            <span className="header-role">管理员</span>
            <span className="header-user">{user.name}</span>
            <button className="btn btn-logout" onClick={logout}>退出</button>
          </div>
        </header>
        <main className="main-content">
          {adminPage === 'schedule' ? <ScheduleCalendar showToast={showToast} /> : <AdminStats showToast={showToast} />}
        </main>
        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    );
  }

  // Driver
  return (
    <div className="app-container">
      <header className="header">
        <h1>公交司机排班管理系统</h1>
        <div className="header-nav">
          <button className={driverPage === 'schedule' ? 'active' : ''} onClick={() => setDriverPage('schedule')}>我的排班</button>
          <button className={driverPage === 'attendance' ? 'active' : ''} onClick={() => setDriverPage('attendance')}>签到签退</button>
        </div>
        <div className="header-right">
          <span className="header-role">司机</span>
          <span className="header-user">{user.name}</span>
          <button className="btn btn-logout" onClick={logout}>退出</button>
        </div>
      </header>
      <main className="main-content">
        {driverPage === 'schedule' ? <DriverSchedule /> : <AttendancePage showToast={showToast} />}
      </main>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}

export default App;
