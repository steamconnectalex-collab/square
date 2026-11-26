// Shiqi — backend de acesso à conta (Edge Function "auth")
// Rotas (todas POST, exceto /health): signup, verify, resend, login, login/totp, forgot, reset,
// email/change/request, email/change/confirm,
// account/deactivate, account/delete, mfa/recovery, mfa/disable
import { createClient } from "npm:@supabase/supabase-js@2";
import { MailError, mailConfigured, sendCodeMail } from "./mail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_CIp2fqI3eX1NG1vPljxYIw_M-LU2YkA";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://square-chat-silk.vercel.app").replace(/\/+$/, "");

const CODE_TTL_MS = 15 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;
const MAX_ATTEMPTS = 5;

type Purpose = "signup" | "reset" | "change";

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(SUPABASE_URL, SERVICE_KEY, opts);
const anonClient = () => createClient(SUPABASE_URL, ANON_KEY, opts);

// ---------- utilidades ----------
const enc = new TextEncoder();
const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
let keyP: Promise<CryptoKey> | null = null;
const hmacKey = () =>
  (keyP ??= crypto.subtle.importKey("raw", enc.encode("square-v1:" + SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]));
async function hmac(msg: string) {
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(msg))));
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 símbolos, sem I/O/0/1
function makeCode() {
  for (;;) {
    const b = crypto.getRandomValues(new Uint8Array(6));
    let c = "";
    for (const x of b) c += CODE_ALPHABET[x & 31];
    if (/[A-Z]/.test(c) && /[2-9]/.test(c)) return c; // sempre letras E números
  }
}
const normCode = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
