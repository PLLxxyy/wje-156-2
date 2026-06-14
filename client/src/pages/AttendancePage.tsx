import React, { useState, useEffect } from 'react';
import { getTodayAttendance, checkin, checkout } from '../api';
import { AttendanceRecord, SHIFT_LABELS, STATUS_LABELS } from '../types';

interface Props {
  showToast: (msg: string, type?: string) => void;
}

export default function AttendancePage({ showToast }: Props) {
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadToday();
  }, []);

  async function loadToday() {
    setLoading(true);
    try {
      const data = await getTodayAttendance();
      setRecord(data);
    } catch {} finally {
      setLoading(false);
    }
  }

  const handleCheckin = async () => {
    setActionLoading(true);
    try {
      const result = await checkin();
      showToast(`签到成功 ${result.check_in}`);
      loadToday();
    } catch (err: any) {
      showToast(err.message || '签到失败', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckout = async () => {
    setActionLoading(true);
    try {
      const result = await checkout();
      showToast(`签退成功 ${result.check_out}`);
      loadToday();
    } catch (err: any) {
      showToast(err.message || '签退失败', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const currentTime = now.toTimeString().substring(0, 8);

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!record) {
    return (
      <div>
        <div className="card">
          <div className="card-title">今日考勤 - {todayStr}</div>
          <div className="empty-state">
            <p>今天没有排班，无需签到签退</p>
          </div>
        </div>
      </div>
    );
  }

  const hasCheckin = !!record.check_in;
  const hasCheckout = !!record.check_out;

  const statusClass = record.status === 'normal' ? 'tag-normal'
    : record.status === 'late' ? 'tag-late'
    : record.status === 'early_leave' ? 'tag-early'
    : record.status === 'absent' ? 'tag-absent'
    : 'tag-late-early';

  return (
    <div>
      <div className="attendance-card">
        <h3>今日考勤 - {todayStr}</h3>
        <div className="attendance-info">
          <div className="attendance-info-item">
            <label>当前时间</label>
            <span>{currentTime}</span>
          </div>
          <div className="attendance-info-item">
            <label>班次</label>
            <span>{SHIFT_LABELS[record.shift || ''] || record.shift}</span>
          </div>
          <div className="attendance-info-item">
            <label>线路</label>
            <span>{record.route_no} {record.route_name}</span>
          </div>
          <div className="attendance-info-item">
            <label>车牌号</label>
            <span>{record.plate_no}</span>
          </div>
          <div className="attendance-info-item">
            <label>签到时间</label>
            <span>{record.check_in || '未签到'}</span>
          </div>
          <div className="attendance-info-item">
            <label>签退时间</label>
            <span>{record.check_out || '未签退'}</span>
          </div>
        </div>
        <div className="attendance-buttons">
          <button
            className="btn btn-success"
            onClick={handleCheckin}
            disabled={hasCheckin || actionLoading}
          >
            {hasCheckin ? '已签到' : '签 到'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCheckout}
            disabled={!hasCheckin || hasCheckout || actionLoading}
          >
            {hasCheckout ? '已签退' : '签 退'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">考勤状态</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`tag ${statusClass}`}>{STATUS_LABELS[record.status]}</span>
          {record.status === 'late' && <span style={{ color: '#856404', fontSize: 13 }}>签到时间晚于班次开始时间</span>}
          {record.status === 'early_leave' && <span style={{ color: '#856404', fontSize: 13 }}>签退时间早于班次结束时间</span>}
          {record.status === 'late_and_early' && <span style={{ color: '#721c24', fontSize: 13 }}>迟到且早退</span>}
          {record.status === 'absent' && <span style={{ color: '#721c24', fontSize: 13 }}>未签到，标记为缺勤</span>}
          {record.status === 'normal' && <span style={{ color: '#155724', fontSize: 13 }}>考勤正常</span>}
        </div>
      </div>
    </div>
  );
}
