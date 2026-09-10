-- Animo Pickleball Cup 2026
-- Registration Trash / Recycle Bin migration
-- Safe to run more than once.

begin;

alter table public.registrations
  add column if not exists trashed_at timestamptz,
  add column if not exists trashed_by_email text,
  add column if not exists trash_note text;

create index if not exists registrations_tournament_trashed_idx
  on public.registrations (tournament_id, trashed_at);

commit;

select
  'Registration recycle bin' as item,
  case
    when exists (
      select 1
      from information_schema.columns
      where table_schema='public'
        and table_name='registrations'
        and column_name='trashed_at'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema='public'
        and table_name='registrations'
        and column_name='trashed_by_email'
    )
    then 'READY'
    else 'CHECK'
  end as status;
