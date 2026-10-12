alter table public.leave_requests
    add column if not exists id uuid default gen_random_uuid(),
    add column if not exists staff_id text,
    add column if not exists reason text,
    add column if not exists leave_date date,
    add column if not exists time_range text,
    add column if not exists subject text,
    add column if not exists period text,
    add column if not exists substitute_teacher text,
    add column if not exists status text not null default 'รออนุมัติ',
    add column if not exists created_at timestamptz not null default now();

grant select, insert, update on public.leave_requests to anon, authenticated;

notify pgrst, 'reload schema';
