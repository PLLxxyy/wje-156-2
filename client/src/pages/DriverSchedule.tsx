import React, { useState, useEffect, useMemo } from 'react';
import { getSchedules } from '../api';
import { Schedule, SHIFT_LABELS, SHIFT_SHORT } from '../types';

export default function DriverSchedule() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
  }, [year, month]);

  async function loadSchedules() {
    setLoading(true);
    try {
      const data = await getSchedules(year, month);
      setSchedules(data);
    } catch {} finally {
      setLoading(false);
    }
  }

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startWeekday = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    const prevLast = new Date(year, month - 1, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevLast - i;
      const m = month - 1 === 0 ? 12 : month - 1;
      const y = month - 1 === 0 ? year - 1 : year;
      days.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push({ date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month + 1 > 12 ? 1 : month + 1;
      const y = month + 1 > 12 ? year + 1 : year;
      days.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

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

  const selectedSchedules = selectedDate ? scheduleMap[selectedDate] || [] : [];

  return (
    <div>
      <div className="card">
        <div className="calendar-header">
          <h3>我的排班</h3>
          <div className="calendar-nav">
            <button className="btn btn-outline btn-sm" onClick={prevMonth}>&lt;</button>
            <span style={{ fontWeight: 600, minWidth: 100, textAlign: 'center' }}>{year}年{month}月</span>
            <button className="btn btn-outline btn-sm" onClick={nextMonth}>&gt;</button>
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
                  onClick={() => day.isCurrentMonth && setSelectedDate(day.date)}
                >
                  <div className="day-num">{day.day}</div>
                  {daySchedules.map((s, i) => (
                    <div key={i} className={`shift-badge shift-${s.shift}`}>
                      {SHIFT_SHORT[s.shift]} {s.route_no}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedDate && (
        <div className="card">
          <div className="card-title">
            {selectedDate} 班次详情
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setSelectedDate(null)}>关闭</button>
          </div>
          {selectedSchedules.length === 0 ? (
            <div className="empty-state"><p>该日无排班</p></div>
          ) : (
            selectedSchedules.map(s => (
              <div key={s.id} style={{ padding: '12px 0', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span className={`shift-badge shift-${s.shift}`} style={{ fontSize: 13, padding: '4px 12px' }}>{SHIFT_LABELS[s.shift]}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: '#555' }}>
                  <div>线路：{s.route_no} {s.route_name}</div>
                  <div>车牌号：{s.plate_no}</div>
                  <div>起点站：{s.start_station}</div>
                  <div>终点站：{s.end_station}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
