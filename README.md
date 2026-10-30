# breach-check

Find out in seconds whether strangers can read your Supabase data using the public key that ships in your website's JavaScript.

Built for apps made with Lovable, Bolt, v0, Cursor or by hand. **Only run it on projects you own.**

## Run it

Needs Node 18 or newer. No install, no dependencies.

```bash
git clone https://github.com/<you>/breach-check
cd breach-check
node scan.mjs https://YOURPROJECT.supabase.co YOUR_ANON_KEY --repo ../your-app
```

- `YOUR_ANON_KEY` is the public `anon` key (Supabase dashboard, Project Settings, API). Never use the `service_role` key.
- `--repo` points at your app's code. Supabase no longer lets the anon key list your tables, so the check reads table names from your migrations, generated types and `.from('...')` calls.
- No repo handy? Use `--tables profiles,orders,messages` instead.

## What it does, and doesn't

- Asks Supabase, as an anonymous visitor would, how many rows of each table it can read.
- Lists column names that look sensitive (email, phone, address, tokens).
- **Read-only.** It never writes, and it never prints row values.
- Everything runs on your machine. Nothing is sent anywhere except your own Supabase project.

Example output:

```
TABLE        ROWS A STRANGER CAN READ   SENSITIVE-LOOKING COLUMNS
profiles     2314                       email, full_name, phone
orders       412                        stripe_customer_id, address
messages     0 (RLS filters all)

Verdict: EXPOSED. 2726 rows across 2 tables are readable by anyone.
```

## Why "just enable RLS" isn't the whole fix

Turning on Row Level Security with no policies does stop strangers. It also stops your real users, and your app quietly breaks. `demo/` shows this on a fake booking app:

```bash
npm install && node demo/run.mjs
```

| State | Strangers blocked | App still works | Users isolated |
|---|---|---|---|
| RLS off (typical default) | no | 8/8 | 0/6 |
| "Enable RLS" | yes | 0/8 | 6/6 |
| Policies written from the app's own queries | yes | 8/8 | 6/6 |

The right fix is policies that match how your app actually reads and writes data, proven by testing real user flows afterwards.

## License

MIT
