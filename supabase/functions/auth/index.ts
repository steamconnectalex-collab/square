// Square — backend de acesso à conta (Edge Function "auth")
// Rotas (todas POST, exceto /health): signup, verify, resend, login, login/totp, forgot, reset,
// qr/create, qr/info, qr/approve, qr/poll, email/change/request, email/change/confirm,
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
const QR_TTL_S = 120;

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

function secret(n = 24) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normEmail(v: unknown) {
  const e = String(v ?? "").trim().toLowerCase();
  if (e.length > 254 || !EMAIL_RE.test(e)) throw new HttpError(400, "invalid_email", "Informe um e-mail válido, como nome@exemplo.com.");
  return e;
}
function normUsername(v: unknown) {
  const u = String(v ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._]{3,20}$/.test(u)) throw new HttpError(400, "invalid_username", "Use de 3 a 20 letras, números, ponto ou sublinhado.");
  return u;
}
function checkPassword(v: unknown) {
  const p = String(v ?? "");
  if (p.length < 8) throw new HttpError(400, "weak_password", "Use pelo menos 8 caracteres.");
  if (enc.encode(p).length > 72) throw new HttpError(400, "weak_password", "A senha pode ter no máximo 72 caracteres.");
  return p;
}
function parseBirth(v: unknown) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v ?? ""));
  const bad = () => new HttpError(400, "invalid_birth_date", "Informe uma data de nascimento válida.");
  if (!m) throw bad();
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 1900 || dt.getTime() > Date.now()) throw bad();
  return `${m[1]}-${m[2]}-${m[3]}`;
}
const MIN_AGE = 13; // idade mínima para criar conta
function checkAge(birth: string) {
  const t = new Date();
  const cut = `${t.getUTCFullYear() - MIN_AGE}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
  if (birth > cut) throw new HttpError(400, "too_young", `É preciso ter pelo menos ${MIN_AGE} anos para criar uma conta.`);
}

function clientIp(req: Request) {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ??
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ?? "unknown";
}
function deviceLabel(ua: string) {
  const b = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const o = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /(iPhone|iPad|iOS)/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return o ? `${b} no ${o}` : b;
}

function background(p: Promise<unknown>) {
  const safe = p.catch((e) => console.error("background task failed:", e instanceof Error ? e.message : e));
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(safe);
}

async function limit(key: string, max: number, windowS: number, msg = "Muitas tentativas. Aguarde um pouco e tente de novo.") {
  const { data, error } = await admin.rpc("rate_check", { p_key: key, p_limit: max, p_window_seconds: windowS });
  if (error) {
    console.error("rate_check:", error.message);
    throw new HttpError(503, "unavailable", "Serviço indisponível no momento. Tente de novo em instantes.");
  }
  if (!data) throw new HttpError(429, "rate_limited", msg);
}

// ---------- dados ----------
async function findUser(email: string): Promise<{ id: string; email_confirmed: boolean } | null> {
  const { data, error } = await admin.rpc("get_auth_user_by_email", { p_email: email });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}
async function profileOf(id: string) {
  const { data } = await admin.from("profiles").select("username, display_name").eq("id", id).maybeSingle();
  return data ?? null;
}

async function mintSession(email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) throw new Error("generateLink: " + (error?.message ?? "sem token"));
  const { data: v, error: e2 } = await anonClient().auth.verifyOtp({ token_hash: hashed, type: "magiclink" });
  if (e2 || !v.session) throw new Error("verifyOtp: " + (e2?.message ?? "sem sessão"));
  return v.session;
}
async function sessionPayload(email: string, userId: string) {
  const s = await mintSession(email);
  return {
    session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at, token_type: s.token_type },
    user: { id: userId, email },
    profile: await profileOf(userId),
  };
}

// ---------- verificação em duas etapas (TOTP do Supabase Auth) ----------
async function totpFactor(userId: string) {
  const { data } = await admin.auth.admin.mfa.listFactors({ userId });
  return (data?.factors ?? []).find((f) => f.factor_type === "totp" && f.status === "verified") ?? null;
}
// cliente que age "como o usuário" (precisa do access_token dele) para o desafio/validação do código de 6 dígitos
async function mfaVerify(session: { access_token: string; refresh_token: string }, factorId: string, code: string) {
  const uc = createClient(SUPABASE_URL, ANON_KEY, opts);
  const { error: se } = await uc.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (se) throw se;
  const ch = await uc.auth.mfa.challenge({ factorId });
  if (ch.error || !ch.data) throw new HttpError(400, "wrong_totp", "Não foi possível validar o código. Tente de novo.");
  const v = await uc.auth.mfa.verify({ factorId, challengeId: ch.data.id, code: String(code).replace(/\D/g, "") });
  if (v.error || !v.data) throw new HttpError(400, "wrong_totp", "Esse código do aplicativo não confere. Confira o horário do celular e tente de novo.");
  return v.data;
}
const reactivate = (userId: string) => admin.from("profiles").update({ deactivated_at: null }).eq("id", userId).not("deactivated_at", "is", null);
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function recoveryCode() {
  const b = crypto.getRandomValues(new Uint8Array(10));
  let c = ""; for (const x of b) c += RECOVERY_ALPHABET[x & 31];
  return c.slice(0, 5) + "-" + c.slice(5);
}

// ---------- códigos por e-mail ----------
async function issueCode(email: string, purpose: Purpose, o: { soft?: boolean } = {}): Promise<boolean> {
  const { data: last } = await admin.from("email_codes").select("created_at").eq("email", email).eq("purpose", purpose)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last) {
    const age = Date.now() - Date.parse(last.created_at);
    if (age < RESEND_COOLDOWN_MS) {
      if (o.soft) return false;
      const wait = Math.ceil((RESEND_COOLDOWN_MS - age) / 1000);
      throw new HttpError(429, "too_soon", `Aguarde ${wait}s para pedir um novo código.`, { retry_after: wait });
    }
  }
  await limit(`code:${purpose}:${email}`, 5, 3600, "Você pediu códigos demais. Tente de novo em cerca de uma hora.");

  const code = makeCode();
  const hash = await hmac(`${email}|${purpose}|${code}`);
  const { error } = await admin.from("email_codes").insert({
    email, purpose, code_hash: hash, expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) throw error;
  await admin.from("email_codes").delete().eq("email", email).lt("created_at", new Date(Date.now() - 86_400_000).toISOString());

  try {
    await sendCodeMail({
      to: email, purpose, code,
      link: purpose === "reset" ? `${SITE_URL}/#reset?e=${encodeURIComponent(email)}&c=${code}` : undefined,
    });
  } catch (e) {
    console.error("email send failed:", e instanceof Error ? e.message : e);
    await admin.from("email_codes").delete().eq("code_hash", hash); // ninguém recebeu esse código
    if (e instanceof MailError && e.kind === "not_configured") {
      throw new HttpError(503, "email_unavailable", "O envio de e-mails ainda não está configurado.");
    }
    throw new HttpError(502, "email_failed", "Não conseguimos enviar o e-mail agora. Tente de novo em instantes.");
  }
  return true;
}

async function checkCode(email: string, purpose: Purpose, raw: unknown) {
  const code = normCode(raw);
  if (code.length !== 6) throw new HttpError(400, "wrong_code", "Digite os 6 caracteres do código.");
  const hash = await hmac(`${email}|${purpose}|${code}`);
  const { data, error } = await admin.rpc("verify_email_code", { p_email: email, p_purpose: purpose, p_hash: hash, p_max_attempts: MAX_ATTEMPTS });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  switch (row?.status) {
    case "ok": return;
    case "wrong": throw new HttpError(400, "wrong_code", "Esse código não confere. Confira o e-mail e tente de novo.", { attempts_left: row.attempts_left });
    case "locked": throw new HttpError(429, "locked", "Muitas tentativas erradas. Peça um novo código.");
    default: throw new HttpError(400, "expired", "Esse código expirou ou já foi usado. Peça um novo código.");
  }
}

// ---------- rotas ----------
async function signup(body: Record<string, unknown>, ip: string) {
  const email = normEmail(body.email);
  const username = normUsername(body.username);
  const password = checkPassword(body.password);
  const birth = parseBirth(body.birth_date);
  checkAge(birth);
  if (body.accept_terms !== true) throw new HttpError(400, "terms_required", "Aceite os Termos de Uso e a Política de Privacidade para continuar.");
  const display = String(body.display_name ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40) || username;
  const optIn = body.marketing_opt_in === true;
  await limit(`signup:ip:${ip}`, 10, 3600, "Muitos cadastros deste endereço. Tente de novo mais tarde.");

  const existing = await findUser(email);
  if (existing?.email_confirmed) {
    throw new HttpError(409, "email_taken", "Já existe uma conta com esse e-mail. Entre ou recupere a senha.");
  }

  // nome de usuário: reservas de cadastros nunca confirmados (mais de 1h) são liberadas
  const { data: owner } = await admin.from("profiles").select("id, created_at").eq("username", username).maybeSingle();
  if (owner && owner.id !== existing?.id) {
    const { data: u } = await admin.auth.admin.getUserById(owner.id);
    const stale = !!u?.user && !u.user.email_confirmed_at && Date.now() - Date.parse(owner.created_at) > 3_600_000;
    if (!stale) throw new HttpError(409, "username_taken", "Esse nome de usuário já está em uso. Escolha outro.");
    await admin.auth.admin.deleteUser(owner.id);
  }

  const fields = { username, display_name: display, birth_date: birth, marketing_opt_in: optIn, terms_accepted_at: new Date().toISOString() };
  const taken = () => new HttpError(409, "username_taken", "Esse nome de usuário já está em uso. Escolha outro.");
  if (existing) {
    // cadastro anterior que nunca confirmou o e-mail: atualiza e reenvia o código
    const { error: ue } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (ue) throw ue;
    const { error: pe } = await admin.from("profiles").upsert({ id: existing.id, ...fields });
    if (pe) throw pe.code === "23505" ? taken() : pe;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: false });
    if (error || !data.user) {
      if (error && /already|registered|exists/i.test(error.message)) {
        throw new HttpError(409, "email_taken", "Já existe uma conta com esse e-mail. Entre ou recupere a senha.");
      }
      throw error ?? new Error("createUser falhou");
    }
    const { error: pe } = await admin.from("profiles").insert({ id: data.user.id, ...fields });
    if (pe) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw pe.code === "23505" ? taken() : pe;
    }
  }
  const sent = await issueCode(email, "signup", { soft: true });
  return { ok: true, email, sent };
}

async function verify(body: Record<string, unknown>, ip: string) {
  const email = normEmail(body.email);
  await limit(`verify:ip:${ip}`, 30, 600);
  await checkCode(email, "signup", body.code);
  const user = await findUser(email);
  if (!user) throw new HttpError(400, "expired", "Esse código expirou ou já foi usado. Peça um novo código.");
  const { error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
  if (error) throw error;
  return { ok: true, ...(await sessionPayload(email, user.id)) };
}

async function resend(body: Record<string, unknown>, ip: string) {
  const email = normEmail(body.email);
  await limit(`resend:ip:${ip}`, 20, 3600);
  const user = await findUser(email);
  if (user && !user.email_confirmed) await issueCode(email, "signup");
  return { ok: true };
}

async function login(body: Record<string, unknown>, ip: string) {
  const identifier = String(body.identifier ?? "").trim();
  const password = String(body.password ?? "");
  if (!identifier || !password) throw new HttpError(400, "invalid_credentials", "Informe seu e-mail (ou nome de usuário) e a senha.");
  await limit(`login:ip:${ip}`, 20, 600);
  await limit(`login:id:${identifier.toLowerCase()}`, 10, 600);
  const bad = () => new HttpError(401, "invalid_credentials", "E-mail, nome de usuário ou senha incorretos.");

  let email: string | null = null;
  if (identifier.includes("@")) {
    email = identifier.toLowerCase();
  } else {
    const { data } = await admin.rpc("get_login_email_by_username", { p_username: identifier.toLowerCase() });
    email = typeof data === "string" ? data : null;
  }
  if (!email) throw bad();

  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    if (error && (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message))) {
      try { await issueCode(email, "signup", { soft: true }); } catch (e) { console.error("unverified resend:", e instanceof Error ? e.message : e); }
      throw new HttpError(403, "unverified", "Falta confirmar seu e-mail. Digite o código que enviamos para a sua caixa de entrada.", { email });
    }
    throw bad();
  }
  let s = data.session;
  const factor = await totpFactor(data.user.id);
  let mfaOff = false;
  if (factor) {
    const rec = normCode(body.recovery_code), totp = String(body.code ?? "").replace(/\D/g, "");
    if (!rec && totp.length !== 6) return { ok: true, mfa_required: true };
    await limit(`mfa:${data.user.id}`, 8, 600, "Muitas tentativas de código. Aguarde alguns minutos.");
    if (rec) {
      const hash = await hmac(`mfa-rec|${data.user.id}|${rec}`);
      const { data: used } = await admin.from("mfa_recovery").update({ used_at: new Date().toISOString() }).eq("user_id", data.user.id)
        .eq("code_hash", hash).is("used_at", null).select("code_hash").maybeSingle();
      if (!used) throw new HttpError(400, "wrong_recovery", "Esse código de recuperação não vale (já foi usado ou está errado).");
      await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: data.user.id }); // usar o código de recuperação desliga a verificação
      await admin.from("mfa_recovery").delete().eq("user_id", data.user.id);
      mfaOff = true;
    } else {
      const v = await mfaVerify(s, factor.id, totp);
      s = { ...s, access_token: v.access_token, refresh_token: v.refresh_token, expires_in: v.expires_in, expires_at: Math.floor(Date.now() / 1000) + v.expires_in, token_type: v.token_type } as typeof s;
    }
  }
  await reactivate(data.user.id);
  return {
    ok: true,
    ...(mfaOff ? { mfa_disabled: true } : {}),
    session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at, token_type: s.token_type },
    user: { id: data.user.id, email },
    profile: await profileOf(data.user.id),
  };
}

// ---------- entrar só com o código do aplicativo de autenticação (sem senha) ----------
// Só funciona para contas que já ligaram a verificação em duas etapas. Qualquer falha dá a MESMA resposta,
// para ninguém descobrir se um e-mail ou usuário tem conta.
async function loginTotp(body: Record<string, unknown>, ip: string) {
  const identifier = String(body.identifier ?? "").trim();
  const code = String(body.code ?? "").replace(/\D/g, "");
  if (!identifier || code.length !== 6) throw new HttpError(400, "invalid_totp_login", "Informe seu e-mail ou usuário e o código de 6 números do aplicativo.");
  await limit(`ltotp:ip:${ip}`, 15, 600);
  await limit(`ltotp:id:${identifier.toLowerCase()}`, 8, 600, "Muitas tentativas. Aguarde alguns minutos.");
  const bad = () => new HttpError(401, "invalid_totp_login", "Não foi possível entrar com esse código. Confira os dados ou entre com e-mail e senha.");
  let email: string | null = null;
  if (identifier.includes("@")) email = identifier.toLowerCase();
  else {
    const { data } = await admin.rpc("get_login_email_by_username", { p_username: identifier.toLowerCase() });
    email = typeof data === "string" ? data : null;
  }
  if (!email) throw bad();
  const user = await findUser(email);
  if (!user || !user.email_confirmed) throw bad();
  const factor = await totpFactor(user.id);
  if (!factor) throw bad();
  await limit(`mfa:${user.id}`, 8, 600, "Muitas tentativas de código. Aguarde alguns minutos.");
  const s0 = await mintSession(email);
  let v;
  try { v = await mfaVerify(s0, factor.id, code); } catch (_e) { throw bad(); }
  await reactivate(user.id);
  return {
    ok: true,
    session: { access_token: v.access_token, refresh_token: v.refresh_token, expires_in: v.expires_in, expires_at: Math.floor(Date.now() / 1000) + v.expires_in, token_type: v.token_type },
    user: { id: user.id, email },
    profile: await profileOf(user.id),
  };
}

async function forgot(body: Record<string, unknown>, ip: string) {
  const email = normEmail(body.email);
  await limit(`forgot:ip:${ip}`, 10, 3600, "Muitos pedidos. Tente de novo mais tarde.");
  // sempre a mesma resposta; o trabalho roda em segundo plano para não vazar se o e-mail existe
  background((async () => {
    const user = await findUser(email);
    if (user?.email_confirmed) await issueCode(email, "reset", { soft: true });
  })());
  return { ok: true };
}

async function reset(body: Record<string, unknown>, ip: string) {
  const email = normEmail(body.email);
  const password = checkPassword(body.password);
  await limit(`reset:ip:${ip}`, 20, 600);
  await checkCode(email, "reset", body.code);
  const user = await findUser(email);
  if (!user) throw new HttpError(400, "expired", "Esse link expirou. Peça um novo.");
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) {
    if (/different|same/i.test(error.message)) throw new HttpError(400, "same_password", "Escolha uma senha diferente da anterior. Peça um novo link para tentar de novo.");
    throw error;
  }
  await admin.rpc("revoke_user_sessions", { p_user: user.id }); // derruba sessões antigas
  if (await totpFactor(user.id)) return { ok: true, mfa_required: true }; // com 2 etapas: entra pelo login normal (senha nova + código)
  await reactivate(user.id);
  return { ok: true, ...(await sessionPayload(email, user.id)) };
}

// ---------- QR Code ----------
async function qrCreate(req: Request, ip: string) {
  await limit(`qr:create:${ip}`, 15, 600);
  const approve = secret(), poll = secret();
  const { data, error } = await admin.from("qr_sessions").insert({
    approve_hash: await hmac("qa|" + approve),
    poll_hash: await hmac("qp|" + poll),
    expires_at: new Date(Date.now() + QR_TTL_S * 1000).toISOString(),
    requester_ua: deviceLabel(req.headers.get("user-agent") ?? ""),
  }).select("id, expires_at").single();
  if (error) throw error;
  await admin.from("qr_sessions").delete().lt("expires_at", new Date(Date.now() - 3_600_000).toISOString());
  // o QR aponta para o mesmo endereço do site em que foi gerado (a sessão fica guardada por endereço)
  const origin = req.headers.get("origin") ?? "";
  const base = ALLOWED_ORIGINS.has(origin) ? origin : SITE_URL;
  return {
    ok: true, id: data.id, poll_secret: poll, expires_at: data.expires_at, ttl: QR_TTL_S,
    url: `${base}/#qr?id=${data.id}&s=${approve}`,
  };
}

async function qrInfo(body: Record<string, unknown>) {
  const id = String(body.id ?? ""), s = String(body.approve_secret ?? "");
  if (!UUID_RE.test(id) || !s) throw new HttpError(400, "invalid_qr", "QR Code inválido.");
  const { data } = await admin.from("qr_sessions").select("status, expires_at, requester_ua, approve_hash").eq("id", id).maybeSingle();
  if (!data || data.approve_hash !== (await hmac("qa|" + s)) || data.status !== "pending" || Date.parse(data.expires_at) < Date.now()) {
    throw new HttpError(410, "expired", "Esse QR Code expirou. Gere um novo na tela de login.");
  }
  return { ok: true, device: data.requester_ua ?? "Navegador", expires_at: data.expires_at };
}

async function requireUser(req: Request) {
  const m = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
  if (!m) throw new HttpError(401, "unauthorized", "Entre na sua conta para autorizar o login.");
  const { data, error } = await admin.auth.getUser(m[1]);
  if (error || !data.user) throw new HttpError(401, "unauthorized", "Sua sessão expirou. Entre de novo para autorizar o login.");
  return data.user;
}

async function qrApprove(req: Request, body: Record<string, unknown>) {
  const user = await requireUser(req);
  const id = String(body.id ?? ""), s = String(body.approve_secret ?? "");
  if (!UUID_RE.test(id) || !s) throw new HttpError(400, "invalid_qr", "QR Code inválido.");
  const approve = body.decision !== "deny";
  const patch = approve
    ? { status: "approved", approved_by: user.id, expires_at: new Date(Date.now() + 30_000).toISOString() }
    : { status: "denied", approved_by: null };
  const { data, error } = await admin.from("qr_sessions").update(patch).eq("id", id).eq("approve_hash", await hmac("qa|" + s))
    .eq("status", "pending").gt("expires_at", new Date().toISOString()).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(410, "expired", "Esse QR Code expirou ou já foi usado. Gere um novo na tela de login.");
  return { ok: true, status: approve ? "approved" : "denied" };
}

async function qrPoll(body: Record<string, unknown>, ip: string) {
  await limit(`qr:poll:${ip}`, 120, 60);
  const id = String(body.id ?? ""), s = String(body.poll_secret ?? "");
  const gone = new HttpError(404, "expired", "Esse QR Code expirou.", { status: "expired" });
  if (!UUID_RE.test(id) || !s) throw gone;
  const { data: row } = await admin.from("qr_sessions").select("status, expires_at, poll_hash").eq("id", id).maybeSingle();
  if (!row || row.poll_hash !== (await hmac("qp|" + s))) throw gone;
  if (row.status === "denied") return { ok: true, status: "denied" };
  if (row.status === "consumed" || Date.parse(row.expires_at) < Date.now()) return { ok: true, status: "expired" };
  if (row.status === "pending") return { ok: true, status: "pending" };

  // aprovado: só um poll consegue "consumir" e receber a sessão
  const { data: claimed } = await admin.from("qr_sessions").update({ status: "consumed" }).eq("id", id).eq("status", "approved")
    .select("approved_by").maybeSingle();
  if (!claimed?.approved_by) return { ok: true, status: "expired" };
  const { data: u, error } = await admin.auth.admin.getUserById(claimed.approved_by);
  if (error || !u.user?.email) throw new Error("usuário do QR não encontrado");
  await reactivate(u.user.id);
  return { ok: true, status: "approved", ...(await sessionPayload(u.user.email, u.user.id)) };
}

// ---------- conta: e-mail, desativar, excluir, 2 etapas ----------
async function checkPasswordOf(email: string, password: unknown) {
  const { data, error } = await anonClient().auth.signInWithPassword({ email, password: String(password ?? "") });
  if (error || !data.session) throw new HttpError(401, "invalid_credentials", "Senha incorreta.");
}
async function emailChangeRequest(req: Request, body: Record<string, unknown>, ip: string) {
  const user = await requireUser(req);
  await limit(`echange:${user.id}`, 6, 3600, "Muitas tentativas. Tente de novo mais tarde.");
  await checkPasswordOf(user.email!, body.password);
  const next = normEmail(body.new_email);
  if (next === (user.email ?? "").toLowerCase()) throw new HttpError(400, "same_email", "Esse já é o e-mail da sua conta.");
  const existing = await findUser(next);
  if (existing) throw new HttpError(409, "email_taken", "Já existe uma conta com esse e-mail.");
  await issueCode(next, "change");
  return { ok: true, email: next };
}
async function emailChangeConfirm(req: Request, body: Record<string, unknown>) {
  const user = await requireUser(req);
  const next = normEmail(body.new_email);
  await limit(`echange:c:${user.id}`, 20, 600);
  await checkCode(next, "change", body.code);
  if (await findUser(next)) throw new HttpError(409, "email_taken", "Já existe uma conta com esse e-mail.");
  const { error } = await admin.auth.admin.updateUserById(user.id, { email: next, email_confirm: true });
  if (error) throw error;
  return { ok: true, email: next };
}
async function accountDeactivate(req: Request, body: Record<string, unknown>) {
  const user = await requireUser(req);
  await limit(`acct:${user.id}`, 8, 3600);
  await checkPasswordOf(user.email!, body.password);
  const { error } = await admin.from("profiles").update({ deactivated_at: new Date().toISOString(), presence: "invisible" }).eq("id", user.id);
  if (error) throw error;
  await admin.rpc("revoke_user_sessions", { p_user: user.id });
  return { ok: true };
}
async function accountDelete(req: Request, body: Record<string, unknown>) {
  const user = await requireUser(req);
  await limit(`acct:${user.id}`, 8, 3600);
  await checkPasswordOf(user.email!, body.password);
  if (String(body.confirm ?? "").trim().toUpperCase() !== "EXCLUIR") throw new HttpError(400, "confirm_required", 'Digite EXCLUIR para confirmar.');
  const { error: pe } = await admin.rpc("purge_user_data", { p_user: user.id });
  if (pe) throw pe;
  for (const bucket of ["avatars", "attachments"]) {
    const { data: files } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;
  return { ok: true };
}
// gera 8 códigos de recuperação (aparecem uma única vez); precisa já ter a verificação em duas etapas ligada
async function mfaRecovery(req: Request) {
  const user = await requireUser(req);
  if (!(await totpFactor(user.id))) throw new HttpError(400, "no_mfa", "Ligue a verificação em duas etapas primeiro.");
  await limit(`mfarec:${user.id}`, 5, 3600);
  const codes = Array.from({ length: 8 }, recoveryCode);
  await admin.from("mfa_recovery").delete().eq("user_id", user.id);
  const rows = await Promise.all(codes.map(async (c) => ({ user_id: user.id, code_hash: await hmac(`mfa-rec|${user.id}|${normCode(c)}`) })));
  const { error } = await admin.from("mfa_recovery").insert(rows);
  if (error) throw error;
  return { ok: true, codes };
}
// desligar: exige a senha e um código válido do aplicativo (ou de recuperação)
async function mfaDisable(req: Request, body: Record<string, unknown>) {
  const user = await requireUser(req);
  await limit(`mfa:${user.id}`, 8, 600, "Muitas tentativas de código. Aguarde alguns minutos.");
  const { data: sg, error: se } = await anonClient().auth.signInWithPassword({ email: user.email!, password: String(body.password ?? "") });
  if (se || !sg.session) throw new HttpError(401, "invalid_credentials", "Senha incorreta.");
  const factor = await totpFactor(user.id);
  if (!factor) return { ok: true };
  const rec = normCode(body.recovery_code);
  if (rec) {
    const { data: used } = await admin.from("mfa_recovery").update({ used_at: new Date().toISOString() }).eq("user_id", user.id)
      .eq("code_hash", await hmac(`mfa-rec|${user.id}|${rec}`)).is("used_at", null).select("code_hash").maybeSingle();
    if (!used) throw new HttpError(400, "wrong_recovery", "Esse código de recuperação não vale (já foi usado ou está errado).");
  } else {
    await mfaVerify(sg.session, factor.id, String(body.code ?? ""));
  }
  await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id });
  await admin.from("mfa_recovery").delete().eq("user_id", user.id);
  return { ok: true };
}

// ---------- servidor ----------
const ALLOWED_ORIGINS = new Set([
  SITE_URL, "https://square-chat-silk.vercel.app", "https://square-chat-steamconnectalex-9536.vercel.app",
  "http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173",
  ...(Deno.env.get("EXTRA_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
]);
function corsHeaders(req: Request) {
  const o = req.headers.get("origin") ?? "";
  return {
    "access-control-allow-origin": ALLOWED_ORIGINS.has(o) ? o : SITE_URL,
    "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-max-age": "86400",
    "vary": "origin",
  };
}
function json(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const path = new URL(req.url).pathname.replace(/^\/(functions\/v1\/)?auth/, "").replace(/\/+$/, "") || "/";
    if (req.method === "GET" && path === "/health") return json({ ok: true, site: SITE_URL, email_configured: mailConfigured() }, 200, cors);
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "Método não permitido.");
    if (Number(req.headers.get("content-length") ?? 0) > 10_000) throw new HttpError(413, "too_large", "Requisição grande demais.");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ip = clientIp(req) || "unknown";

    let out: unknown;
    switch (path) {
      case "/signup": out = await signup(body, ip); break;
      case "/verify": out = await verify(body, ip); break;
      case "/resend": out = await resend(body, ip); break;
      case "/login": out = await login(body, ip); break;
      case "/login/totp": out = await loginTotp(body, ip); break;
      case "/forgot": out = await forgot(body, ip); break;
      case "/reset": out = await reset(body, ip); break;
      case "/qr/create": out = await qrCreate(req, ip); break;
      case "/qr/info": out = await qrInfo(body); break;
      case "/qr/approve": out = await qrApprove(req, body); break;
      case "/qr/poll": out = await qrPoll(body, ip); break;
      case "/email/change/request": out = await emailChangeRequest(req, body, ip); break;
      case "/email/change/confirm": out = await emailChangeConfirm(req, body); break;
      case "/account/deactivate": out = await accountDeactivate(req, body); break;
      case "/account/delete": out = await accountDelete(req, body); break;
      case "/mfa/recovery": out = await mfaRecovery(req); break;
      case "/mfa/disable": out = await mfaDisable(req, body); break;
      default: throw new HttpError(404, "not_found", "Rota não encontrada.");
    }
    return json(out, 200, cors);
  } catch (e) {
    if (e instanceof HttpError) return json({ ok: false, error: e.code, message: e.message, ...e.extra }, e.status, cors);
    console.error("unhandled:", e instanceof Error ? `${e.message}` : JSON.stringify(e));
    return json({ ok: false, error: "server_error", message: "Algo deu errado. Tente de novo em instantes." }, 500, cors);
  }
});
