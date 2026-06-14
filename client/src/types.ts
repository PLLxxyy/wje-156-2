export interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'driver';
  phone: string;
  license_no: string;
}

export interface Route {
  id: number;
  name: string;
  route_no: string;
  start_station: string;
  end_station: string;
  plate_no: string;
}

export interface Schedule {
  id: number;
  driver_id: number;
  route_id: number;
  date: string;
  shift: 'morning' | 'afternoon' | 'night';
  created_by: number;
  created_at: string;
  driver_name: string;
  route_name: string;
  route_no: string;
  plate_no: string;
  start_station: string;
  end_station: string;
}

export interface AttendanceRecord {
  id: number;
  schedule_id: number;
  driver_id: number;
  check_in: string | null;
  check_out: string | null;
  status: 'normal' | 'late' | 'early_leave' | 'absent' | 'late_and_early';
  driver_name?: string;
  date?: string;
  shift?: string;
  route_name?: string;
  route_no?: string;
  plate_no?: string;
}

export interface OverviewStats {
  totalSchedules: number;
  totalAttendance: number;
  normalCount: number;
  lateCount: number;
  earlyCount: number;
  absentCount: number;
  lateAndEarly: number;
  abnormalTotal: number;
  attendanceRate: number;
  normalRate: number;
}

export interface RouteStat {
  id: number;
  route_name: string;
  route_no: string;
  total_trips: number;
  normal_trips: number;
  actual_trips: number;
  departure_rate: number;
  normal_rate: number;
}

export interface DriverStat {
  id: number;
  name: string;
  license_no: string;
  total_shifts: number;
  normal_count: number;
  late_count: number;
  early_count: number;
  absent_count: number;
  attendance_rate: number;
  abnormal_count: number;
}

export const SHIFT_LABELS: Record<string, string> = {
  morning: '早班 (06:00-14:00)',
  afternoon: '中班 (14:00-22:00)',
  night: '晚班 (22:00-06:00)',
};

export const SHIFT_SHORT: Record<string, string> = {
  morning: '早班',
  afternoon: '中班',
  night: '晚班',
};

export const STATUS_LABELS: Record<string, string> = {
  normal: '正常',
  late: '迟到',
  early_leave: '早退',
  absent: '缺勤',
  late_and_early: '迟到+早退',
};
