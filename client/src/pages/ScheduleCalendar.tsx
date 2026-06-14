import React, { useState, useEffect, useMemo } from 'react';
import { getSchedules, getRoutes, getDrivers, createBatchSchedules, deleteSchedule } from '../api';
import { Schedule, Route, SHIFT_LABELS, SHIFT_SHORT } from '../types';

interface Props {
  showToast: (msg: string, type?: string) => void;
}

export default function ScheduleCalendar({ showToast }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<string | null>(null);

  // Batch form
  const [batchStart, setBatchStart] = useState('');
  const [batchEnd, setBatchEnd] = useState('');
  const [batchRoute, setBatchRoute] = useState<number>(0);
  const [batchDriverShifts, setBatchDriverShifts] = useState<Record<number, string>>({});
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    loadRoutes();
    loadDrivers();
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [year, month]);

  async function loadRoutes() {
    try {
      const data = await getRoutes();
      setRoutes(data);
      if (data.length > 0) setBatchRoute(data[0].id);
    } catch {}
  }

  async function loadDrivers() {
    try {
      const data = await getDrivers();
      setDrivers(data);
    } catch {}
  }

  async function loadSchedules() {
    setLoading(true);
    try {
      const data = await getSchedules(year, month);
      setSchedules(data);
    } catch {
      showToast('加载排班失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Build calendar days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startWeekday = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    // Prev month fill
    const prevLast = new Date(year, month - 1, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevLast - i;
      const m = month - 1 === 0 ? 12 : month - 1;
      const y = month - 1 === 0 ? year - 1 : year;
      days.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      days.push({ date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: true });
    }

    // Next month fill
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month + 1 > 12 ? 1 : month + 1;
      const y = month + 1 > 12 ? year + 1 : year;
      days.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Group schedules by date
  const scheduleMap = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    schedules.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [schedules]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  // Click day -> show detail or open create
  const handleDayClick = (date: string) => {
    const daySchedules = scheduleMap[date] || [];
    if (daySchedules.length > 0) {
      setShowDetail(date);
    } else {
      setSelectedDate(date);
      setShowModal(true);
    }
  };

  // Handle batch create
  const handleBatchCreate = async () => {
    if (!batchStart || !batchEnd || !batchRoute) {
      showToast('请填写完整信息', 'error');
      return;
    }

    const items: Array<{ driver_id: number; route_id: number; date: string; shift: string }> = [];
    const startDate = new Date(batchStart);
    const endDate = new Date(batchEnd);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      Object.entries(batchDriverShifts).forEach(([driverId, shift]) => {
        if (shift) {
          items.push({ driver_id: Number(driverId), route_id: batchRoute, date: dateStr, shift });
        }
      });
    }

    if (items.length === 0) {
      showToast('请至少分配一个司机的班次', 'error');
      return;
    }

    setBatchLoading(true);
    try {
      const result = await createBatchSchedules(items);
      showToast(`${result.message}${result.conflicts?.length ? `，${result.conflicts.length}条冲突` : ''}`);
      setShowModal(false);
      setBatchDriverShifts({});
      loadSchedules();
    } catch (err: any) {
      showToast(err.message || '创建排班失败', 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此排班？')) return;
    try {
      await deleteSchedule(id);
      showToast('排班已删除');
      loadSchedules();
      setShowDetail(null);
    } catch (err: any) {
      showToast(err.message || '删除失败', 'error');
    }
  };

  return (
    <div>
      <div className="card">
        <div className="calendar-header">
          <h3>排班日历</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setSelectedDate(null); setShowModal(true); }}>
              批量排班
            </button>
            <div className="calendar-nav">
              <button className="btn btn-outline btn-sm" onClick={prevMonth}>&lt;</button>
              <span style={{ fontWeight: 600, minWidth: 100, textAlign: 'center' }}>{year}年{month}月</span>
              <button className="btn btn-outline btn-sm" onClick={nextMonth}>&gt;</button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : (
          <div className="calendar-grid">
            {['日', '一', '二', '三', '四', '五', '六'].map(w => (
              <div key={w} className="calendar-weekday">{w}</div>
            ))}
            {calendarDays.map((day) => {
              const daySchedules = scheduleMap[day.date] || [];
              return (
                <div
                  key={day.date}
                  className={`calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.date === todayStr ? 'today' : ''}`}
                  onClick={() => day.isCurrentMonth && handleDayClick(day.date)}
                >
                  <div className="day-num">{day.day}</div>
                  {daySchedules.slice(0, 3).map((s, i) => (
                    <div key={i} className={`shift-badge shift-${s.shift}`}>
                      {SHIFT_SHORT[s.shift]} {s.driver_name}
                    </div>
                  ))}
                  {daySchedules.length > 3 && (
                    <div style={{ fontSize: 10, color: '#888' }}>+{daySchedules.length - 3}更多</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Day Detail Modal */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{showDetail} 排班详情</h3>
            {(scheduleMap[showDetail] || []).map(s => (
              <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className={`shift-badge shift-${s.shift}`} style={{ marginRight: 8 }}>{SHIFT_SHORT[s.shift]}</span>
                  <strong>{s.driver_name}</strong>
                  <span style={{ color: '#888', marginLeft: 8 }}>{s.route_no} {s.route_name} | {s.plate_no}</span>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>删除</button>
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowDetail(null)}>关闭</button>
              <button className="btn btn-primary" onClick={() => { setShowDetail(null); setShowModal(true); }}>添加排班</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Schedule Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 600 }}>
            <h3>创建排班</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>开始日期</label>
                <input type="date" value={batchStart} onChange={e => setBatchStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label>结束日期</label>
                <input type="date" value={batchEnd} onChange={e => setBatchEnd(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>线路</label>
              <select value={batchRoute} onChange={e => setBatchRoute(Number(e.target.value))}>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.route_no} {r.name} ({r.start_station} - {r.end_station}) | {r.plate_no}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>分配司机班次（留空表示不排班）</label>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>司机</th>
                      <th>班次</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map(d => (
                      <tr key={d.id}>
                        <td>{d.name} ({d.license_no})</td>
                        <td>
                          <select
                            value={batchDriverShifts[d.id] || ''}
                            onChange={e => setBatchDriverShifts(prev => ({ ...prev, [d.id]: e.target.value }))}
                          >
                            <option value="">不排班</option>
                            <option value="morning">早班 (06:00-14:00)</option>
                            <option value="afternoon">中班 (14:00-22:00)</option>
                            <option value="night">晚班 (22:00-06:00)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleBatchCreate} disabled={batchLoading}>
                {batchLoading ? '创建中...' : '确认创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
