// Reads every enabled project's source tab from Google Sheets with a read-only
// service account and stores the raw values as a snapshot.
// Callers: the pg_cron job (x-sync-secret header) or an approved signed-in user (Sync Now).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function b64url(data: Uint8Array | string) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function googleAccessToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Authorise: cron secret, or a signed-in user on the approved list.
  const candidate = req.headers.get("x-sync-secret");
  const fromCron = !!candidate && (await admin.rpc("sync_secret_matches", { candidate })).data === true;
  if (!fromCron) {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: approved, error } = await userClient.rpc("is_approved");
    if (error || approved !== true) return json({ error: "Not authorised" }, 401);
  }

  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) return json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON secret is not set" }, 503);

  const { data: projects, error: pErr } = await admin
    .from("projects").select("id, name, spreadsheet_id, tab, range").eq("enabled", true).order("sort");
  if (pErr) return json({ error: pErr.message }, 500);

  let token: string;
  try {
    token = await googleAccessToken(JSON.parse(saJson));
  } catch (e) {
    return json({ error: String(e) }, 502);
  }

  const results = await Promise.all((projects ?? []).map(async (p) => {
    const range = encodeURIComponent(`'${p.tab.replace(/'/g, "''")}'!${p.range}`);
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${p.spreadsheet_id}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Sheets API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const values = ((await res.json()).values ?? []) as string[][];

      const { data: last } = await admin.from("snapshots").select("id, values")
        .eq("project_id", p.id).eq("status", "ok").order("synced_at", { ascending: false }).limit(1).maybeSingle();
      const now = new Date().toISOString();
      if (last && JSON.stringify(last.values) === JSON.stringify(values)) {
        await admin.from("snapshots").update({ checked_at: now }).eq("id", last.id);
        return { project: p.name, status: "ok", changed: false };
      }
      const { error } = await admin.from("snapshots").insert({ project_id: p.id, status: "ok", values, synced_at: now, checked_at: now });
      if (error) throw new Error(error.message);
      return { project: p.name, status: "ok", changed: true };
    } catch (e) {
      await admin.from("snapshots").insert({ project_id: p.id, status: "failed", error: String(e) });
      return { project: p.name, status: "failed", error: String(e) };
    }
  }));

  return json({ synced_at: new Date().toISOString(), results });
});
