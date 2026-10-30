-- Fake data only. Alice owns a dog, Bob is a sitter, Carol is another owner.
insert into profiles values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.com', 'Alice Fake', '0400 000 001', '1 Example St, Fitzroy VIC', false),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@example.com',   'Bob Fake',   '0400 000 002', '2 Example St, Carlton VIC', true),
  ('cccccccc-0000-0000-0000-000000000003', 'carol@example.com', 'Carol Fake', '0400 000 003', '3 Example St, Brunswick VIC', false);

insert into bookings (owner_id, sitter_id, pet_name, start_date, door_code, price_cents) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Biscuit', '2026-11-08', '4471#', 9000),
  ('cccccccc-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'Mango',   '2026-11-15', '9020#', 12000);

insert into messages (booking_id, sender_id, body) values
  (1, 'aaaaaaaa-0000-0000-0000-000000000001', 'Spare key is under the blue pot.'),
  (2, 'cccccccc-0000-0000-0000-000000000003', 'Alarm code is the same as the door.');

insert into services (title, price_cents) values ('Day visit', 4500), ('Overnight stay', 9000);
