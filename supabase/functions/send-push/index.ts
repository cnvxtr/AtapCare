// Edge Function: kirim Web Push saat baris notifications baru dibuat.
// Dipicu DB Webhook (notifications INSERT) → payload { record: { ... } }.
// Deploy: supabase functions deploy send-push
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...),
//          PUSH_WEBHOOK_SECRET (opsional, cocokkan header X-WEBHOOK-SECRET),
//          FCM_SERVICE_ACCOUNT (opsional, JSON service account Firebase →
//            memungkinkan push native ke APK via FCM v1)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseSecretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey,
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

function formatWIB(d: Date): string {
  return d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── FCM v1 (notifikasi native APK) ──
// Token akses caching per fungsi panas (Deno.serve) — 1 jam masa berlaku,
// refresh otomatis 5 menit sebelum kedaluwarsa.
let fcmTokenCache: { token: string; exp: number } | null = null;

function b64url(input: string | Uint8Array): string {
  const bin = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input;
  let s = "";
  bin.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ponytail: Web Crypto menandatangani JWT RS256 (service account). Tak butuh
// dependency JWT. Upgrade ke googleapis/oauth bila scope messaging perlu peruh.
async function fcmAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmTokenCache && fcmTokenCache.exp - 300 > now) return fcmTokenCache.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const data = `${header}.${claims}`;

  const pem = privateKey
    .replace(/-----(BEGIN|END) (RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  const jwt = `${data}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`fcm oauth: ${res.status} ${String(json.error_description || json.error)}`);
  fcmTokenCache = { token: json.access_token, exp: now + json.expires_in };
  return fcmTokenCache.token;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return json({ ok: true });
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
    if (secret && req.headers.get("X-WEBHOOK-SECRET") !== secret) {
      return json({ error: "Unauthorized" }, 401);
    }

    const payload = await req.json();
    const rec = payload?.record;
    if (!rec?.id || !rec?.user_id) return json({ ok: true });

    if (rec.push !== true) return json({ ok: true });

    // Fetch ticket code + recent notifications for richer body
    let ticketCode = "";
    let deepLink = "/";
    let bodyLines: string[] = [];

    if (rec.ticket_id) {
      const { data: ticket } = await supabase
        .from("tickets")
        .select("code")
        .eq("id", rec.ticket_id)
        .single();

      if (ticket?.code) {
        ticketCode = ticket.code;
        deepLink = `/customer/ticket/${ticketCode}`;
      }

      // Fetch last 3 notifications for this ticket to show context
      const { data: recent } = await supabase
        .from("notifications")
        .select("title, message, created_at")
        .eq("ticket_id", rec.ticket_id)
        .eq("user_id", rec.user_id)
        .order("created_at", { ascending: false })
        .limit(3);

      if (recent && recent.length > 0) {
        bodyLines = recent.reverse().map((n: { message: string; created_at: string }) => {
          const ts = formatWIB(new Date(n.created_at));
          return `${n.message}\n${ts}`;
        });
      }
    }

    // Fallback: just use the notification itself
    if (bodyLines.length === 0) {
      const ts = formatWIB(new Date(rec.created_at || Date.now()));
      bodyLines = [rec.message || "", ts];
    }

    const title = ticketCode
      ? `${rec.title || "Atap Care"}`
      : rec.title || "Atap Care";

    const body = bodyLines.join("\n\n");

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, keys_p256dh, keys_auth")
      .eq("user_id", rec.user_id)
      .order("created_at", { ascending: true });

    // ponytail: jaga maks 20 sub terbaru per user. Bug lama (resubscribe tiap
    // login) menumpuk ratusan endpoint mati per user, membuat tiap notif harus
    // mengirim buruh request dan kena limit waktu 150s. Upgrade: retensi per
    // perangkat nyata bila perangkat > 20/user.
    const all = subs || [];
    const stale = all.length > 20 ? all.slice(0, all.length - 20) : [];
    if (stale.length > 0) {
      await supabase.from("push_subscriptions").delete().in(
        "id",
        stale.map((s) => s.id),
      );
    }
    const toPush = all.slice(-20);

    const pushPayload = { title, body, url: deepLink };

    let sent = 0;
    const pushTimeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("push timeout")), ms));
    for (const s of toPush) {
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.keys_p256dh, auth: s.keys_auth } };
      try {
        await Promise.race([
          webpush.sendNotification(sub, JSON.stringify(pushPayload)),
          pushTimeout(5000),
        ]);
        sent++;
      } catch (err: unknown) {
        const e = err as { statusCode?: number; status?: number };
        const code = e?.statusCode ?? e?.status;
        if (code === 404 || code === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }

    // ── FCM v1 — notifikasi native (APK). Opsional: tanpa secret, web tetap jalan. ──
    const saStr = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (saStr) {
      let sa: { client_email: string; private_key: string; project_id: string };
      try {
        sa = JSON.parse(saStr);
      } catch {
        return json({ ok: true, sent, error: "FCM_SERVICE_ACCOUNT bukan JSON valid" }, 500);
      }

      const { data: fcmSubs } = await supabase
        .from("fcm_tokens")
        .select("id, token")
        .eq("user_id", rec.user_id);

      if (fcmSubs && fcmSubs.length > 0) {
        try {
          const token = await fcmAccessToken(sa.client_email, sa.private_key);
          const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
          let fcmSent = 0;
          for (const sub of fcmSubs) {
            // Data-only, bukan notification message: kalau pakai blok notification,
            // FCM SDK merender notifnya sendiri (DisplayNotification) tanpa bisa
            // pasang logo (largeIcon). Lewat data-only, render jatuh ke
            // AtapCareMessagingService (Android) yang memasang logo + channel HIGH.
            const fcmBody = {
              message: {
                token: sub.token,
                data: { title, body, url: deepLink },
                android: { priority: "HIGH" },
              },
            };
            try {
              const r = await Promise.race([
                fetch(fcmUrl, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(fcmBody),
                }),
                pushTimeout(5000),
              ]);
              if (r.status === 404) {
                // token mati / device un-register → bersihkan
                await supabase.from("fcm_tokens").delete().eq("id", sub.id);
              } else if (!r.ok) {
                console.error("fcm send fail", r.status, await r.text());
              } else {
                fcmSent++;
              }
            } catch { /* timeout — lewati */ }
          }
          // return setelah sukses; web push telah selesai di atas
          return json({ ok: true, sent, fcmSent });
        } catch (err) {
          return json({ ok: true, sent, error: `fcm: ${err instanceof Error ? err.message : String(err)}` }, 500);
        }
      }
    }

    return json({ ok: true, sent });
  } catch (err) {
    return json({ error: `Internal error: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});
