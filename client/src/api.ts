const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${url}`, { ...options, headers });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  // For CSV downloads
  const ct = res.headers.get('content-type');
  if (ct && ct.includes('text/csv')) {
    return res.text() as unknown as T;
  }

  return res.json();
}

// Auth
export function login(username: string, password: string) {
  return request<{ token: string; user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function getMe() {
  return request<any>('/auth/me');
}

// Schedules
export function getSchedules(year?: number, month?: number) {
  const params = year && month ? `?year=${year}&month=${month}` : '';
  return request<any[]>(`/schedules${params}`);
}

export function createSchedule(data: { driver_id: number; route_id: number; date: string; shift: string }) {
  return request<any>('/schedules', { method: 'POST', body: JSON.stringify(data) });
}

export function createBatchSchedules(items: Array<{ driver_id: number; route_id: number; date: string; shift: string }>) {
  return request<any>('/schedules/batch', { method: 'POST', body: JSON.stringify({ items }) });
}

export function deleteSchedule(id: number) {
  return request<any>(`/schedules/${id}`, { method: 'DELETE' });
}

export function getRoutes() {
  return request<any[]>('/schedules/routes');
}

export function getDrivers() {
  return request<any[]>('/schedules/drivers');
}

// Attendance
export function checkin() {
  return request<any>('/attendance/checkin', { method: 'POST' });
}

export function checkout() {
  return request<any>('/attendance/checkout', { method: 'POST' });
}

export function getTodayAttendance() {
  return request<any>('/attendance/today');
}

export function getAttendanceList(year?: number, month?: number) {
  const params = year && month ? `?year=${year}&month=${month}` : '';
  return request<any[]>(`/attendance${params}`);
}

// Stats
export function getOverviewStats(year?: number, month?: number) {
  const params = year && month ? `?year=${year}&month=${month}` : '';
  return request<any>(`/stats/overview${params}`);
}

export function getRouteStats(year?: number, month?: number) {
  const params = year && month ? `?year=${year}&month=${month}` : '';
  return request<any[]>(`/stats/route${params}`);
}

export function getDriverStats(year?: number, month?: number) {
  const params = year && month ? `?year=${year}&month=${month}` : '';
  return request<any[]>(`/stats/driver${params}`);
}

async function downloadCSV(url: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${BASE}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('导出失败');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportScheduleCSV(year: number, month: number) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return downloadCSV(`/stats/export/schedule?year=${year}&month=${month}`, `schedule-${prefix}.csv`);
}

export function exportAttendanceCSV(year: number, month: number) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return downloadCSV(`/stats/export/attendance?year=${year}&month=${month}`, `attendance-${prefix}.csv`);
}
