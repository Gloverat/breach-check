// Breach check spike: what can a stranger read from a Supabase project using only the public anon key?
// Read-only. Never writes. Prints counts and column names, never row values.
// Usage: node scan.mjs <supabase-url> <anon-key> [--repo path/to/your/app] [--tables a,b,c]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const [url, key] = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!url || !key) {
  console.error("Usage: node scan.mjs <supabase-url> <anon-key> [--repo path/to/your/app] [--tables a,b,c]");
  process.exit(1);
}

// Supabase no longer lets the anon key list tables, so learn table names from the owner's own code.
function tablesFromRepo(root) {
  const found = new Set();
  const patterns = [
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-z_][a-z0-9_]*)"?/gi, // SQL migrations
    /\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)/gi, // supabase-js queries
  ];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", ".git", ".next", "dist", "build", ".vercel"].includes(name)) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(sql|ts|tsx|js|jsx|mjs|vue|svelte)$/.test(name) && st.size < 2_000_000) {
        const text = readFileSync(p, "utf8");
        for (const re of patterns) for (const m of text.matchAll(re)) found.add(m[1].toLowerCase());
        // Generated types: Database["public"]["Tables"] keys
        const types = text.match(/Tables:\s*{([\s\S]*?)\n\s{4}Views:/);
        if (types) for (const m of types[1].matchAll(/^\s{6}([a-z_][a-z0-9_]*):\s*{/gm)) found.add(m[1]);
      }
    }
  };
  walk(root);
  ["storage", "objects", "buckets", "users"].forEach((t) => found.delete(t));
  return [...found];
}

const repoTables = flag("--repo") ? tablesFromRepo(flag("--repo")) : [];
const extra = [...repoTables, ...(flag("--tables") || "").split(",").filter(Boolean)].join(",");

const headers = { apikey: key, Authorization: `Bearer ${key}` };
const t0 = Date.now();

async function discoverTables() {
  // PostgREST publishes an OpenAPI description of every table and function the anon role can see.
  const res = await fetch(`${url}/rest/v1/`, { headers });
  if (!res.ok) return { tables: [], rpcs: [], openapi: `blocked (${res.status})` };
  const spec = await res.json();
  const paths = Object.keys(spec.paths || {});
  return {
    tables: paths.filter((p) => p !== "/" && !p.startsWith("/rpc/")).map((p) => p.slice(1)),
    rpcs: paths.filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)),
    openapi: "open",
  };
}

async function probeTable(table) {
  // HEAD with count=exact returns the readable row count without transferring any rows.
  const res = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?select=*`, {
    method: "HEAD",
    headers: { ...headers, Prefer: "count=exact" },
  });
  const range = res.headers.get("content-range") || "";
  const count = Number(range.split("/")[1]);
  let columns = [];
  if (res.ok && count > 0) {
    // Fetch one row only to learn the column names; values are discarded immediately.
    const one = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`, { headers });
    const rows = await one.json();
    columns = rows[0] ? Object.keys(rows[0]) : [];
  }
  return { table, status: res.status, readable: res.ok ? (Number.isFinite(count) ? count : "?") : 0, columns };
}

async function probeStorage() {
  const res = await fetch(`${url}/storage/v1/bucket`, { headers });
  if (!res.ok) return { status: res.status, buckets: [] };
  const buckets = await res.json();
  return { status: res.status, buckets: buckets.map((b) => `${b.name}${b.public ? " (public)" : ""}`) };
}

const SENSITIVE = /email|phone|name|address|abn|token|secret|password|stripe|customer|endpoint|auth|p256dh|ip|dob|lat|lng|polygon/i;

const found = await discoverTables();
const names = [...new Set([...found.tables, ...extra.split(",").filter(Boolean)])];
const results = await Promise.all(names.map(probeTable));
const storage = await probeStorage();

const exposed = results.filter((r) => r.readable && r.readable !== 0);
const totalRows = exposed.reduce((n, r) => n + (Number(r.readable) || 0), 0);

console.log(`\nBREACH CHECK  ${url}`);
console.log(`Finished in ${((Date.now() - t0) / 1000).toFixed(1)}s using only the public anon key\n`);
console.log(`Schema listing (OpenAPI): ${found.openapi}. ${found.tables.length} tables and ${found.rpcs.length} functions visible to anyone.`);
if (found.rpcs.length) console.log(`Callable functions: ${found.rpcs.join(", ")}`);
console.log(`Storage buckets listable: ${storage.status === 200 ? storage.buckets.join(", ") || "none" : `no (${storage.status})`}\n`);

console.log("TABLE".padEnd(28) + "ROWS A STRANGER CAN READ".padEnd(26) + "SENSITIVE-LOOKING COLUMNS");
for (const r of results.sort((a, b) => (Number(b.readable) || 0) - (Number(a.readable) || 0))) {
  const sens = r.columns.filter((c) => SENSITIVE.test(c));
  const rows = r.readable ? String(r.readable) : `0 (${r.status === 200 ? "RLS filters all" : `blocked ${r.status}`})`;
  console.log(r.table.padEnd(28) + rows.padEnd(26) + (sens.join(", ") || (r.readable ? "none flagged" : "")));
}
if (!names.length) console.log("No tables to test. Pass --repo path/to/your/app or --tables a,b,c.");
console.log(`\nVerdict: ${exposed.length ? `EXPOSED. ${totalRows} rows across ${exposed.length} tables are readable by anyone.` : "No table rows readable with the anon key."}`);
if (exposed.length) console.log("Some tables may be public on purpose (a product catalogue, blog posts). Anything with user data should not be.");
console.log("Nothing was written and no row values were printed.\n");
