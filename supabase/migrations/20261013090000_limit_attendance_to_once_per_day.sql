do $$
begin
    if exists (
        select 1
        from public.attendance_logs
        where check_in is not null
        group by staff_id, (check_in at time zone 'Asia/Bangkok')::date
        having count(*) > 1
    ) then
        raise exception 'Cannot enforce one check-in per staff per day: duplicate attendance_logs exist. Resolve duplicate records before applying this migration.';
    end if;
end
$$;

create unique index if not exists attendance_logs_one_check_in_per_staff_day
    on public.attendance_logs (
        staff_id,
        ((check_in at time zone 'Asia/Bangkok')::date)
    );
