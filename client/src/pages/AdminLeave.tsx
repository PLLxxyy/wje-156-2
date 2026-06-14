import React, { useState, useEffect } from 'react';
import { getLeaveList, approveLeave, rejectLeave } from '../api';
import { LeaveRecord, LEAVE_STATUS_LABELS } from '../types';

interface Props {
  showToast: (msg: string, type?: string) => void;
}

export default function AdminLeave({ showToast }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadLeaves();
  }, [year, month, statusFilter]);

  async function loadLeaves() {
    setLoading(true);
    try {
      const data = await getLeaveList(year, month, statusFilter || undefined);
      setLeaves(data);
    } catch (err: any) {
      showToast('加载请假记录失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleApprove = async (id: number) => {
    if (!confirm('确定批准该请假申请吗？')) return;

    setActionLoading(id);
    try {
      await approveLeave(id);
      showToast('已批准请假');
      loadLeaves();
    } catch (err: any) {
      showToast(err.message || '操作失败', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    if (!rejectReason.trim()) {
      showToast('请填写拒绝原因', 'error');
      return;
    }

    setActionLoading(rejectId);
    try {
      await rejectLeave(rejectId, rejectReason.trim());
      showToast('已拒绝请假');
      setRejectId(null);
      setRejectReason('');
      loadLeaves();
    } catch (err: any) {
      showToast(err.message || '操作失败', 'error');
    } finally {
      setActionLoading(null);
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
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option value="pending">待审批</option>
            <option value="approved">已批准</option>
            <option value="rejected">已拒绝</option>
          </select>
          <button className="btn btn-outline btn-sm" onClick={loadLeaves}>刷新</button>
        </div>
      </div>

      {rejectId && (
        <div className="card">
          <div className="card-title">
            拒绝请假
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setRejectId(null); setRejectReason(''); }}>取消</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>拒绝原因</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="请输入拒绝原因..."
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => { setRejectId(null); setRejectReason(''); }}>取消</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={actionLoading === rejectId}>
                {actionLoading === rejectId ? '提交中...' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="card-title">请假申请列表</div>
          {leaves.length === 0 ? (
            <div className="empty-state"><p>暂无请假申请</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>司机</th>
                    <th>请假原因</th>
                    <th>状态</th>
                    <th>审批人</th>
                    <th>拒绝原因</th>
                    <th>申请时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map(l => (
                    <tr key={l.id}>
                      <td>{l.date}</td>
                      <td>{l.driver_name}</td>
                      <td>{l.reason}</td>
                      <td><span className={`tag ${statusClass(l.status)}`}>{LEAVE_STATUS_LABELS[l.status]}</span></td>
                      <td>{l.approver_name || '-'}</td>
                      <td>{l.reject_reason || '-'}</td>
                      <td>{l.created_at}</td>
                      <td>
                        {l.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove(l.id)}
                              disabled={actionLoading === l.id}
                            >
                              批准
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setRejectId(l.id)}
                              disabled={actionLoading === l.id}
                            >
                              拒绝
                            </button>
                          </div>
                        )}
                        {l.status !== 'pending' && <span style={{ color: '#999' }}>-</span>}
                      </td>
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
