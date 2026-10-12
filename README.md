# SA-Time-Attendance

## Supabase Realtime

The app refreshes attendance logs and leave requests when their rows change in
Supabase. Enable both tables in the `supabase_realtime` publication by running
[`supabase/migrations/20261012130000_enable_attendance_realtime.sql`](supabase/migrations/20261012130000_enable_attendance_realtime.sql)
in the Supabase SQL Editor (or applying it through the Supabase CLI).

## Leave request ordering

The approval center sorts new leave requests using their creation timestamp.
Run [`supabase/migrations/20261012131000_add_leave_request_created_at.sql`](supabase/migrations/20261012131000_add_leave_request_created_at.sql)
in the Supabase SQL Editor (or apply it through the Supabase CLI) so new requests
receive a `created_at` timestamp.

If the off-campus request form reports missing columns in `leave_requests`, run
[`supabase/migrations/20261012132500_repair_leave_requests_schema.sql`](supabase/migrations/20261012132500_repair_leave_requests_schema.sql)
in the Supabase SQL Editor. It adds any missing columns expected by the off-campus
request form and reloads the PostgREST schema cache. This table remains separate
from `leave_applications`.

## Sick and personal leave applications

Run [`supabase/migrations/20261012132000_create_leave_applications.sql`](supabase/migrations/20261012132000_create_leave_applications.sql)
in the Supabase SQL Editor before using the sick/personal leave form. Leave
applications are stored separately from off-campus requests and are included
in the executive approval center and personal request history. The migration
also enables Realtime updates for the new table.
