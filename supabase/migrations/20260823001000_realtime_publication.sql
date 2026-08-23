-- Durable rows are the source of truth; Realtime only signals clients to fetch
-- authorized deltas. Keep the default replica identity so DELETE events cannot
-- expose full old rows from RLS-protected tables.

alter table public.messages replica identity default;
alter table public.bookings replica identity default;
alter table public.availability_offers replica identity default;
alter table public.notifications replica identity default;

do $$
declare
  v_table text;
begin
  if exists (
    select 1
      from pg_catalog.pg_publication p
     where p.pubname = 'supabase_realtime'
  ) then
    foreach v_table in array array[
      'messages', 'bookings', 'availability_offers', 'notifications'
    ]
    loop
      if not exists (
        select 1
          from pg_catalog.pg_publication_tables pt
         where pt.pubname = 'supabase_realtime'
           and pt.schemaname = 'public'
           and pt.tablename = v_table
      ) then
        execute pg_catalog.format(
          'alter publication supabase_realtime add table public.%I',
          v_table
        );
      end if;
    end loop;
  end if;
end;
$$;
