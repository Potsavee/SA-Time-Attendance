alter table public.leave_requests
add column if not exists created_at timestamptz not null default now();
