# SA-Time-Attendance

## Notifications

The notification bell checks Supabase for new requests, attendance records, and
personal request-status changes on sign-in, in addition to receiving Realtime
updates while signed in. It stores the last-seen state in the browser for each
account. The first sign-in after this feature is added establishes a baseline;
missed-event checks are limited to the same browser and account.