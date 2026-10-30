# Launch posts (drafts for Will to post)

Check each community's self-promotion rules before posting. These posts link only to a free, open-source tool and ask for feedback, which most allow. Post from your own account and reply to every comment personally.

Replace `<repo-link>` with your GitHub URL once it's pushed.

---

## r/Supabase

**Title:** I built a free read-only check for "can strangers read my tables with the anon key?" and found the usual RLS fix breaks apps

**Body:**

I kept seeing reports that around half of vibe-coded Supabase apps let anyone read their tables with the public anon key, so I wrote a small script to check my own project.

What it does:
- Asks your project, as an anonymous visitor, how many rows of each table it can read
- Reads table names from your own repo (migrations, generated types, `.from()` calls), since the anon key can no longer list them
- Read-only, prints counts and column names only, runs on your machine, no dependencies

`node scan.mjs https://YOURPROJECT.supabase.co ANON_KEY --repo ../your-app`

The more interesting part: I built a fake booking app with RLS off, then tried the common advice of "just enable RLS". Strangers were blocked, but 0 of 8 real user flows still worked. Policies written from the app's own queries got 8/8 flows working and 6/6 isolation checks passing. Demo is in the repo.

Repo: <repo-link>

Two honest questions for this sub:
1. If you run it, would you share just the verdict line (rows exposed, not names)? I'm trying to find out whether the "50%+ exposed" stat is real or inflated.
2. For anyone who found exposed tables: would a tool that writes the policies and proves your app still works be useful, or is writing RLS by hand fine for you?

Only run it on projects you own.

---

## r/lovable (and r/boltnewbuilders, r/vibecoding)

**Title:** Free 30-second check: can strangers read your Lovable app's database?

**Body:**

If your app uses Supabase, the public key is in your site's JavaScript. That's normal, as long as Row Level Security is set up properly. If it isn't, anyone can read your users' emails, orders and messages.

I made a free, read-only script that tells you in about 30 seconds. It runs on your own computer, never changes anything and never shows actual data, just row counts.

<repo-link>

Heads up from building it: the quick fix ("turn on RLS") can lock out your own users and break the app. The repo has a demo showing why.

First 10 people who find something exposed: reply or DM me and I'll write the fix for your app and prove it still works, free. I'm testing whether that's worth turning into a product.

---

## Lovable Discord (#showcase or #help, whichever allows tools)

> Made a free read-only check for whether strangers can read your Supabase tables with the public key: <repo-link>
> Runs locally, prints row counts only, never writes. Found that "just enable RLS" broke every user flow in my test app, so the demo shows the safe way. Happy to help anyone who finds something exposed.

---

## X / LinkedIn (optional)

> I wrote a fake booking app the way AI builders scaffold them. With the public key from the website's JavaScript, a stranger could read every customer's email, door code and private messages, and change prices.
>
> The usual fix ("enable RLS") blocked the stranger and broke all 8 real user flows.
>
> The proper fix passed 15/15 checks in 1.8 seconds.
>
> Free read-only check for your own Supabase app: <repo-link>

---

## Replying to people who find exposure

> Thanks for running it. If you'd like, I can write the policies for those tables and test that your app's main flows still work. Free for the first 10, I'm testing whether this is useful. I'd need read access to the repo (or the schema plus the files that query Supabase). I never need your service_role key.
>
> One question so I learn something: if this had been a paid tool, what would a fix like this be worth to you?
