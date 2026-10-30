-- The fix most scanners and tutorials suggest: "enable RLS on every table".
-- It stops strangers, but with no policies it also locks out the app's real users.
alter table profiles enable row level security;
alter table bookings enable row level security;
alter table messages enable row level security;
alter table services enable row level security;
