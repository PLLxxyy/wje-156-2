import React, { useState, useEffect } from 'react';
import { getOverviewStats, getRouteStats, getDriverStats, getAttendanceList, exportScheduleCSV, exportAttendanceCSV } from '../api';
import { OverviewStats, RouteStat, DriverStat, STATUS_LABELS, SHIFT_SHORT } from '../types';

interface Props {
  showToast: (msg: string, type?: string) => void;
}

export default function AdminStats({ showToast }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [tab, setTab] = useState<'overview' | 'routes' | 'drivers' | 'attendance'>('overview');
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [routeStats, setRouteStats] = useState<RouteStat[]>([]);
  const [driverStats, setDriverStats] = useState<DriverStat[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [year, month, tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const [ov, rs, ds] = await Promise.all([
          getOverviewStats(year, month),
          getRouteStats(year, month),
          getDriverStats(year, month),
        ]);
        setOverview(ov);
        setRouteStats(rs);
        setDriverStats(ds);
      } else if (tab === 'routes') {
        setRouteStats(await getRouteStats(year, month));
      } else if (tab === 'drivers') {
        setDriverStats(await getDriverStats(year, month));
      } else {
        setAttendanceList(await getAttendanceList(year, month));
      }
    } catch (err: any) {
      showToast('加载数据失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  const statusClass = (s: string) => {
    if (s === 'normal') return 'tag-normal';
    if (s === 'late') return 'tag-late';
    if (s === 'early_leave') return 'tag-early';
    if (s === 'absent') return 'tag-absent';
    return 'tag-late-early';
  };

  const handleExportSchedule = () => {
    exportScheduleCSV(year, month);
    showToast('排班表导出中...');
  };

  const handleExportAttendance = () => {
    exportAttendanceCSV(year, month);
    showToast('考勤报表导出中...');
  };

  return (
    <div>
      {/* Month Selector + Tabs */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="month-selector">
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
          </select>
          <button className="btn btn-outline btn-sm" onClick={loadData}>刷新</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['overview', 'routes', 'drivers', 'attendance'] as const).map(t => (
            <button
              key={t}
              className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTab(t)}
            >
              {{ overview: '总览', routes: '线路统计', drivers: '司机统计', attendance: '考勤记录' }[t]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={handleExportSchedule}>导出排班表</button>
          <button className="btn btn-outline btn-sm" onClick={handleExportAttendance}>导出考勤报表</button>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          {/* Overview Tab */}
          {tab === 'overview' && overview && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">总排班数</div>
                  <div className="stat-value">{overview.totalSchedules}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">出勤率</div>
                  <div className="stat-value success">{overview.attendanceRate}%</div>
                  <div className="progress-bar"><div className="progress-fill green" style={{ width: `${overview.attendanceRate}%` }} /></div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">正常率</div>
                  <div className="stat-value">{overview.normalRate}%</div>
                  <div className="progress-bar"><div className="progress-fill blue" style={{ width: `${overview.normalRate}%` }} /></div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">异常总数</div>
                  <div className="stat-value danger">{overview.abnormalTotal}</div>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">正常</div>
                  <div className="stat-value success">{overview.normalCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">迟到</div>
                  <div className="stat-value warning">{overview.lateCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">早退</div>
                  <div className="stat-value warning">{overview.earlyCount}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">缺勤</div>
                  <div className="stat-value danger">{overview.absentCount}</div>
                </div>
              </div>

              {/* Route stats summary */}
              <div className="card">
                <div className="card-title">线路出车率</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>线路</th>
                        <th>总班次</th>
                        <th>实际出车</th>
                        <th>出车率</th>
                        <th>正常率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routeStats.map(r => (
                        <tr key={r.id}>
                          <td>{r.route_no} {r.route_name}</td>
                          <td>{r.total_trips}</td>
                          <td>{r.actual_trips}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              {r.departure_rate}%
                              <span className="progress-bar" style={{ width: 60 }}>
                                <span className="progress-fill blue" style={{ width: `${r.departure_rate}%` }} />
                              </span>
                            </span>
                          </td>
                          <td>{r.normal_rate}%</td>
                        </tr>
                      ))}
                      {routeStats.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: '#aaa' }}>暂无数据</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Driver stats summary */}
              <div className="card">
                <div className="card-title">司机出勤率</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>司机</th>
                        <th>驾照号</th>
                        <th>总班次</th>
                        <th>出勤率</th>
                        <th>迟到</th>
                        <th>早退</th>
                        <th>缺勤</th>
                        <th>异常</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverStats.map(d => (
                        <tr key={d.id}>
                          <td>{d.name}</td>
                          <td>{d.license_no}</td>
                          <td>{d.total_shifts}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              {d.attendance_rate}%
                              <span className="progress-bar" style={{ width: 60 }}>
                                <span className="progress-fill green" style={{ width: `${d.attendance_rate}%` }} />
                              </span>
                            </span>
                          </td>
                          <td>{d.late_count}</td>
                          <td>{d.early_count}</td>
                          <td>{d.absent_count}</td>
                          <td><span className={`tag ${d.abnormal_count > 0 ? 'tag-late' : 'tag-normal'}`}>{d.abnormal_count}</span></td>
                        </tr>
                      ))}
                      {driverStats.length === 0 && (
                        <tr><td colSpan={8} style={{ textAlign: 'center', color: '#aaa' }}>暂无数据</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Route Stats Tab */}
          {tab === 'routes' && (
            <div className="card">
              <div className="card-title">线路出车率统计</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>线路编号</th><th>线路名称</th><th>总班次</th><th>实际出车</th><th>出车率</th><th>正常率</th></tr>
                  </thead>
                  <tbody>
                    {routeStats.map(r => (
                      <tr key={r.id}>
                        <td>{r.route_no}</td><td>{r.route_name}</td>
                        <td>{r.total_trips}</td><td>{r.actual_trips}</td>
                        <td>{r.departure_rate}%</td><td>{r.normal_rate}%</td>
                      </tr>
                    ))}
                    {routeStats.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#aaa' }}>暂无数据</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Driver Stats Tab */}
          {tab === 'drivers' && (
            <div className="card">
              <div className="card-title">司机出勤率统计</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>姓名</th><th>驾照号</th><th>总班次</th><th>正常</th><th>迟到</th><th>早退</th><th>缺勤</th><th>出勤率</th></tr>
                  </thead>
                  <tbody>
                    {driverStats.map(d => (
                      <tr key={d.id}>
                        <td>{d.name}</td><td>{d.license_no}</td>
                        <td>{d.total_shifts}</td><td>{d.normal_count}</td>
                        <td>{d.late_count}</td><td>{d.early_count}</td><td>{d.absent_count}</td>
                        <td>{d.attendance_rate}%</td>
                      </tr>
                    ))}
                    {driverStats.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#aaa' }}>暂无数据</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Attendance Records Tab */}
          {tab === 'attendance' && (
            <div className="card">
              <div className="card-title">考勤记录</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>日期</th><th>司机</th><th>线路</th><th>班次</th><th>签到</th><th>签退</th><th>状态</th></tr>
                  </thead>
                  <tbody>
                    {attendanceList.map((a: any) => (
                      <tr key={a.id}>
                        <td>{a.date}</td>
                        <td>{a.driver_name}</td>
                        <td>{a.route_no}</td>
                        <td>{SHIFT_SHORT[a.shift] || a.shift}</td>
                        <td>{a.check_in || '-'}</td>
                        <td>{a.check_out || '-'}</td>
                        <td><span className={`tag ${statusClass(a.status)}`}>{STATUS_LABELS[a.status]}</span></td>
                      </tr>
                    ))}
                    {attendanceList.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#aaa' }}>暂无数据</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
