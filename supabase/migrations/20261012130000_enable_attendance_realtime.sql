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
          and tablename = 'attendance_logs'
    ) then
        alter publication supabase_realtime add table public.attendance_logs;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'leave_requests'
    ) then
        alter publication supabase_realtime add table public.leave_requests;
    end if;
end
$$;
