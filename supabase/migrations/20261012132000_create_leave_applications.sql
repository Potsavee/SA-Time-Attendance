create table if not exists public.leave_applications (
    id uuid primary key default gen_random_uuid(),
    staff_id text not null,
    leave_type text not null check (leave_type in ('ลาป่วย', 'ลากิจ')),
    start_date date not null,
    end_date date not null,
    reason text not null,
    status text not null default 'รออนุมัติ',
    created_at timestamptz not null default now(),
    constraint leave_applications_date_range_check check (end_date >= start_date)
);

grant select, insert, update on public.leave_applications to anon, authenticated;

do $$
begin
    if not exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
    ) then
        raise exception 'Supabase Realtime publication "supabase_realtime" does not exist';
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'leave_applications'
    ) then
        alter publication supabase_realtime add table public.leave_applications;
    end if;
end
$$;
