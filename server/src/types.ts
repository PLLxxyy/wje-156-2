export interface User {
  id: number;
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'driver';
  phone: string;
  license_no: string;
  created_at: string;
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
}

export interface ScheduleWithDetail extends Schedule {
  driver_name: string;
  route_name: string;
  route_no: string;
  plate_no: string;
  start_station: string;
  end_station: string;
}

export interface Attendance {
  id: number;
  schedule_id: number;
  driver_id: number;
  check_in: string | null;
  check_out: string | null;
  status: 'normal' | 'late' | 'early_leave' | 'absent' | 'late_and_early';
  created_at: string;
}

export interface AttendanceWithDetail extends Attendance {
  driver_name: string;
  date: string;
  shift: string;
  route_name: string;
  route_no: string;
}

export interface AuthPayload {
  userId: number;
  role: 'admin' | 'driver';
}
