# SA-Time-Attendance

## Supabase Realtime

The app refreshes attendance logs and leave requests when their rows change in
Supabase. Enable both tables in the `supabase_realtime` publication by running
[`supabase/migrations/20261012130000_enable_attendance_realtime.sql`](supabase/migrations/20261012130000_enable_attendance_realtime.sql)
in the Supabase SQL Editor (or applying it through the Supabase CLI).
