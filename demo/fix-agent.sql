-- Fix written by the agent after reading the schema and every query in app-flows.json.
-- Each policy exists because a real app flow needs it; nothing broader.

alter table profiles enable row level security;
alter table bookings enable row level security;
alter table messages enable row level security;
alter table services enable row level security;

-- Strangers keep only what the public site needs.
revoke all on profiles, bookings, messages from anon;
revoke insert, update, delete on services from anon, authenticated;

-- services: public catalogue, read-only for everyone.
create policy "services are public" on services for select to anon, authenticated using (true);

-- bookings: visible to the owner and the assigned sitter; only owners create and edit their own.
create policy "see own bookings" on bookings for select to authenticated
  using (owner_id = auth.uid() or sitter_id = auth.uid());
create policy "owners create bookings" on bookings for insert to authenticated
  with check (owner_id = auth.uid());
create policy "owners edit own bookings" on bookings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- profiles: your own row, plus the people you share a booking with (the app shows your sitter's name).
create policy "see own profile" on profiles for select to authenticated
  using (id = auth.uid());
create policy "see booking counterparties" on profiles for select to authenticated
  using (id in (select owner_id from bookings union select sitter_id from bookings));
create policy "edit own profile" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- is_sitter is an admin decision: users may edit contact details only.
revoke update on profiles from authenticated;
grant update (full_name, phone, home_address) on profiles to authenticated;

-- messages: readable and writable only by the two people on the booking, posting as themselves.
create policy "booking parties read messages" on messages for select to authenticated
  using (booking_id in (select id from bookings));
create policy "booking parties post as themselves" on messages for insert to authenticated
  with check (sender_id = auth.uid() and booking_id in (select id from bookings));
