// Edge Function: kirim Web Push saat baris notifications baru dibuat.
// Dipicu DB Webhook (notifications INSERT) → payload { record: { ... } }.
// Deploy: supabase functions deploy send-push
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...),
//          PUSH_WEBHOOK_SECRET (opsional, cocokkan header X-WEBHOOK-SECRET)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:ops@atapcare.id",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-webhook-secret",
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return json({ ok: true });
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    // Opsional: kunci webhook di dashboard harus sama dengan secret ini.
    const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
    if (secret && req.headers.get("X-WEBHOOK-SECRET") !== secret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const payload = await req.json();
    const rec = payload?.record;
    if (!rec?.id || !rec?.user_id) return json({ ok: true }); // bukan INSERT yang dimaksud

    // Hanya notif yang ditandai push (bila webhook dikonfigurasi dengan filter
    // push=eq.true, baris ini tak pernah dipanggil).
    if (rec.push !== true) return json({ ok: true });

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys_p256dh, keys_auth")
      .eq("user_id", rec.user_id);

    const body = {
      title: rec.title || "Atap Care",
      body: rec.message || "",
      url: "/",
    };

    let sent = 0;
    for (const s of subs || []) {
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.keys_p256dh, auth: s.keys_auth } };
      try {
        await webpush.sendNotification(sub, JSON.stringify(body));
        sent++;
      } catch (err: unknown) {
        const e = err as { statusCode?: number; status?: number };
        const code = e?.statusCode ?? e?.status;
        if (code === 404 || code === 410 || code === 403) {
          // Subscription mati/tolak: bersihkan supaya tidak dipanggil lagi.
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }

    return json({ ok: true, sent });
  } catch (err) {
    return json({ error: `Internal error: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});
