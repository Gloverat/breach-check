// Breach, Fix, Prove: end-to-end demo on a local Postgres (PGlite) with Supabase's auth model.
// Every probe runs inside a transaction that is rolled back, so the demo never changes its own data.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const here = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
const { flows, isolation } = JSON.parse(here("./app-flows.json"));
const USERS = {
  alice: "aaaaaaaa-0000-0000-0000-000000000001",
  bob: "bbbbbbbb-0000-0000-0000-000000000002",
};

const c = { red: (s) => `\x1b[31m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };
const mask = (v) => (v == null ? "" : String(v).replace(/^(.)(.*?)(.?)$/, (_, a, m, z) => a + "*".repeat(Math.max(m.length, 3)) + z));

// Run one statement as a given identity, exactly as PostgREST would, then roll back.
async function as(db, who, sql) {
  const role = who === "anon" ? "anon" : "authenticated";
  const claims = who === "anon" ? { role: "anon" } : { role: "authenticated", sub: USERS[who] };
  await db.query("begin");
  try {
    await db.query(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const res = await db.query(sql);
    return { ok: true, rows: res.rows, affected: res.affectedRows ?? res.rows.length };
  } catch (e) {
    return { ok: false, rows: [], affected: 0, error: e.message };
  } finally {
    await db.query("rollback");
  }
}

function passes(expect, r) {
  if ("ok" in expect) return r.ok === expect.ok;
  if (expect.rows === 0) return !r.ok || r.rows.length === 0; // blocked by error or filtered to nothing
  return r.ok && r.rows.length === expect.rows;
}

async function breach(db, quiet = false) {
  const read = {};
  for (const t of ["profiles", "bookings", "messages"]) read[t] = await as(db, "anon", `select * from ${t}`);
  const tamper = await as(db, "anon", "update bookings set price_cents = 1 returning id");
  const leaked = Object.values(read).reduce((n, r) => n + r.rows.length, 0) + tamper.rows.length;
  if (!quiet) {
    for (const [t, r] of Object.entries(read)) {
      console.log(`  ${t.padEnd(10)} ${r.rows.length ? c.red(`${r.rows.length} rows readable`) : c.green("blocked")}`);
    }
    const p = read.profiles.rows[0], b = read.bookings.rows[0], m = read.messages.rows[0];
    if (p) console.log(c.dim(`    e.g. ${mask(p.email)}  ${mask(p.phone)}  ${mask(p.home_address)}`));
    if (b) console.log(c.dim(`    e.g. pet "${b.pet_name}" from ${b.start_date?.toISOString?.().slice(0, 10) ?? b.start_date}, door code ${mask(b.door_code)}`));
    if (m) console.log(c.dim(`    e.g. message: "${m.body.slice(0, 18)}..."`));
    console.log(`  tamper     ${tamper.rows.length ? c.red(`could set the price of ${tamper.rows.length} bookings to $0.01`) : c.green("blocked")} ${c.dim("(rolled back)")}`);
  }
  return leaked;
}

async function prove(db, label) {
  const strangerRows = await breach(db, true);
  console.log(`  ${strangerRows ? c.red("x") : c.green("✓")} Stranger with the public key: ${strangerRows ? `${strangerRows} rows still exposed` : "sees nothing private, changes nothing"}`);
  let failed = 0;
  for (const group of [["App still works", flows], ["Users are isolated", isolation]]) {
    console.log(`  ${c.bold(group[0])}`);
    for (const f of group[1]) {
      const r = await as(db, f.as, f.sql);
      const ok = passes(f.expect, r);
      if (!ok) failed++;
      const got = r.ok ? `${r.rows.length} rows` : "denied";
      console.log(`    ${ok ? c.green("✓") : c.red("x")} ${f.name}${ok ? "" : c.red(`  (got ${got})`)}`);
    }
  }
  const total = flows.length + isolation.length + 1;
  const passed = total - failed - (strangerRows ? 1 : 0);
  console.log(`  ${label}: ${passed === total ? c.green(`${passed}/${total} checks pass`) : c.red(`${passed}/${total} checks pass`)}`);
  return passed === total;
}

async function fresh() {
  const db = new PGlite();
  await db.exec(here("./app.sql"));
  await db.exec(here("./seed.sql"));
  return db;
}

const t0 = Date.now();
console.log(c.bold("\nPAWPRINT  (a typical vibe-coded booking app, fake data)\n"));

console.log(c.bold("1. BREACH") + c.dim("  using only the public anon key from the website's JavaScript"));
const db = await fresh();
await breach(db);
if (process.argv.includes("--baseline")) {
  console.log(c.bold("\nBASELINE") + c.dim("  the same checks against the unfixed app, to show they catch leaks"));
  await prove(db, "Result");
}

console.log(c.bold("\n2. FIX, attempt 1") + c.dim("  the common advice: enable RLS on every table"));
const naive = await fresh();
await naive.exec(here("./fix-naive.sql"));
await prove(naive, "Result");
console.log(c.dim("  Strangers are out, but so are the real users. This is why fixes need proving."));

console.log(c.bold("\n2. FIX, attempt 2") + c.dim("  policies written from the app's own queries (fix-agent.sql)"));
await db.exec(here("./fix-agent.sql"));
console.log(c.bold("\n3. PROVE"));
const ok = await prove(db, "Result");

console.log(`\n${ok ? c.green(c.bold("SECURE AND WORKING.")) : c.red(c.bold("NOT DONE."))} ${c.dim(`Finished in ${((Date.now() - t0) / 1000).toFixed(1)}s.`)}\n`);
process.exit(ok ? 0 : 1);
