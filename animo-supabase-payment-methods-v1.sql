-- Animo Pickleball Cup 2026
-- Live payment-method configuration + private QR asset bucket

begin;

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  method_key text not null,
  label text not null,
  enabled boolean not null default false,
  account_name text,
  account_number text,
  instructions text,
  qr_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, method_key)
);

create index if not exists payment_methods_tournament_sort_idx
  on public.payment_methods (tournament_id, sort_order, label);

alter table public.payment_methods enable row level security;
revoke all on table public.payment_methods from anon, authenticated;
grant all on table public.payment_methods to service_role;

insert into storage.buckets (id, name, public)
values ('animo-payment-assets', 'animo-payment-assets', false)
on conflict (id) do update set public = excluded.public;

insert into public.payment_methods (tournament_id, method_key, label, enabled, sort_order)
select t.id, seed.method_key, seed.label, false, seed.sort_order
from public.tournaments t
cross join (
  values
    ('gcash', 'GCash', 10),
    ('paymaya', 'PayMaya', 20),
    ('maribank', 'MariBank', 30),
    ('bdo', 'BDO', 40),
    ('bpi', 'BPI', 50)
) as seed(method_key, label, sort_order)
where t.slug = 'animo-pickleball-cup-2026'
on conflict (tournament_id, method_key) do nothing;

commit;

select 'Payment methods table' as item,
       case when to_regclass('public.payment_methods') is not null then 'READY' else 'CHECK' end as status
union all
select 'Payment QR bucket',
       case when exists (select 1 from storage.buckets where id='animo-payment-assets' and public=false)
            then 'READY' else 'CHECK' end
union all
select 'Seeded payment methods',
       count(*)::text
from public.payment_methods pm
join public.tournaments t on t.id=pm.tournament_id
where t.slug='animo-pickleball-cup-2026';
