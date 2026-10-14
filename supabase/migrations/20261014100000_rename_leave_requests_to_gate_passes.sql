do $$
begin
    if to_regclass('public.leave_requests') is not null
       and to_regclass('public.gate_passes') is null then
        alter table public.leave_requests rename to gate_passes;
    elsif to_regclass('public.leave_requests') is not null
       and to_regclass('public.gate_passes') is not null then
        raise exception 'Both public.leave_requests and public.gate_passes exist';
    elsif to_regclass('public.gate_passes') is null then
        raise exception 'Neither public.leave_requests nor public.gate_passes exists';
    end if;
end
$$;

notify pgrst, 'reload schema';