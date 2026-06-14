import React, { useState, useEffect } from 'react';
import { getLeaveList, submitLeave } from '../api';
import { LeaveRecord, LEAVE_STATUS_LABELS } from '../types';

interface Props {
  showToast: (msg: string, type?: string) => void;
}

export default function DriverLeave({ showToast }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadLeaves();
  }, [year, month]);

  async function loadLeaves() {
    setLoading(true);
    try {
      const data = await getLeaveList(year, month);
      setLeaves(data);
    } catch (err: any) {
      showToast('加载请假记录失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async () => {
    if (!formDate || !formReason.trim()) {
      showToast('请填写请假日期和原因', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submitLeave(formDate, formReason.trim());
      showToast('请假申请提交成功');
      setShowForm(false);
      setFormDate('');
      setFormReason('');
      loadLeaves();
    } catch (err: any) {
      showToast(err.message || '提交失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const statusClass = (s: string) => {
    if (s === 'approved') return 'tag-normal';
    if (s === 'rejected') return 'tag-absent';
    return 'tag-late';
  };

  return (
    <div>
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="month-selector">
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
          <button className="btn btn-outline btn-sm" onClick={loadLeaves}>刷新</button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>申请请假</button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">
            申请请假
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowForm(false)}>取消</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>请假日期</label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>请假原因</label>
              <textarea
                value={formReason}
                onChange={e => setFormReason(e.target.value)}
                placeholder="请输入请假原因..."
                rows={4}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? '提交中...' : '提交申请'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="card-title">请假记录</div>
          {leaves.length === 0 ? (
            <div className="empty-state"><p>暂无请假记录</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>请假原因</th>
                    <th>状态</th>
                    <th>审批人</th>
                    <th>拒绝原因</th>
                    <th>申请时间</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map(l => (
                    <tr key={l.id}>
                      <td>{l.date}</td>
                      <td>{l.reason}</td>
                      <td><span className={`tag ${statusClass(l.status)}`}>{LEAVE_STATUS_LABELS[l.status]}</span></td>
                      <td>{l.approver_name || '-'}</td>
                      <td>{l.reject_reason || '-'}</td>
                      <td>{l.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
