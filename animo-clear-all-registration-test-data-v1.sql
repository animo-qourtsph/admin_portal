-- DANGER / INTENTIONAL RESET
-- Deletes ALL registration/team records for Animo Pickleball Cup 2026.
-- Keeps tournament setup, divisions, roles, permissions, admin members,
-- and email notification templates.
--
-- Run only if you intentionally want a fresh registration database.

begin;

create temporary table _animo_registration_reset_ids
on commit drop
as
select r.id
from public.registrations r
join public.tournaments t on t.id = r.tournament_id
where t.slug = 'animo-pickleball-cup-2026';

delete from public.email_events
where registration_id in (select id from _animo_registration_reset_ids);

delete from public.registration_status_history
where registration_id in (select id from _animo_registration_reset_ids);

delete from public.payments
where registration_id in (select id from _animo_registration_reset_ids);

delete from public.players
where registration_id in (select id from _animo_registration_reset_ids);

delete from public.registrations
where id in (select id from _animo_registration_reset_ids);

commit;

select
  'Remaining registrations' as item,
  count(*)::text as status
from public.registrations r
join public.tournaments t on t.id = r.tournament_id
where t.slug = 'animo-pickleball-cup-2026';
