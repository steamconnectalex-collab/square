// Envio dos e-mails da Square. (código de cadastro e recuperação de senha) via Resend.
// Segredos da função: RESEND_API_KEY (obrigatório), RESEND_FROM (opcional), BRAND_NAME (opcional).

export class MailError extends Error {
  constructor(public kind: "not_configured" | "rejected", message: string) {
    super(message);
  }
}

const apiKey = () => (Deno.env.get("RESEND_API_KEY") ?? "").trim();
const fromAddr = () => (Deno.env.get("RESEND_FROM") ?? "").trim() || "Square. <onboarding@resend.dev>";
const brand = () => (Deno.env.get("BRAND_NAME") ?? "").trim() || "Square.";

export const mailConfigured = () => apiKey() !== "";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

function layout(o: {
  preheader: string;
  title: string;
  intro: string;
  codeLabel: string;
  code: string;
  button?: { label: string; href: string };
  afterCode?: string;
  outro: string;
}) {
  const b = esc(brand());
  const button = o.button
    ? `<tr><td align="center" style="padding:4px 0 22px">
        <a href="${esc(o.button.href)}" style="display:inline-block;background:#1D1D22;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;line-height:1;padding:16px 30px;border-radius:14px;font-family:${FONT}">${esc(o.button.label)}</a>
      </td></tr>
      <tr><td align="center" style="padding:0 0 22px;font-size:12px;line-height:1.5;color:#62626D;font-family:${FONT}">Se o botão não funcionar, copie este link no navegador:<br><a href="${esc(o.button.href)}" style="color:#44444C;word-break:break-all">${esc(o.button.href)}</a></td></tr>`
    : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#F4F4F8">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F8"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
    <tr><td style="padding:0 4px 18px;font-family:${FONT};font-size:18px;font-weight:800;color:#1D1D22">
      <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:#1D1D22;color:#FFFFFF;border-radius:8px;font-size:14px;vertical-align:middle">&#9632;</span>
      <span style="vertical-align:middle;margin-left:6px">${b}</span>
    </td></tr>
    <tr><td style="background:#FFFFFF;border:1px solid #E6E6EC;border-radius:22px;padding:32px 28px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="font-family:${FONT};font-size:22px;line-height:1.25;font-weight:800;color:#1D1D22;padding-bottom:10px">${esc(o.title)}</td></tr>
        <tr><td style="font-family:${FONT};font-size:15px;line-height:1.6;color:#44444C;padding-bottom:22px">${esc(o.intro)}</td></tr>
        ${button}
        <tr><td align="center" style="padding-bottom:8px;font-family:${FONT};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#62626D">${esc(o.codeLabel)}</td></tr>
        <tr><td align="center" style="padding-bottom:${o.afterCode ? "10px" : "22px"}">
          <div style="display:inline-block;background:#F4F4F8;border:1px solid #E6E6EC;border-radius:14px;padding:14px 22px;font-family:${MONO};font-size:32px;line-height:1;font-weight:700;letter-spacing:.28em;color:#1D1D22">${esc(o.code)}</div>
        </td></tr>
        ${o.afterCode ? `<tr><td align="center" style="padding-bottom:22px;font-family:${FONT};font-size:12.5px;line-height:1.5;color:#62626D">${esc(o.afterCode)}</td></tr>` : ""}
        <tr><td style="font-family:${FONT};font-size:13px;line-height:1.6;color:#62626D;border-top:1px solid #E6E6EC;padding-top:18px">${esc(o.outro)}</td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:18px 0 0;font-family:${FONT};font-size:11.5px;color:#8A8A94">${b} &middot; Você recebeu este e-mail porque alguém usou este endereço na ${b}</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export async function sendCodeMail(o: { to: string; purpose: "signup" | "reset"; code: string; link?: string }) {
  const key = apiKey();
  if (!key) throw new MailError("not_configured", "RESEND_API_KEY não definido");
  const name = brand();

  let subject: string, html: string, text: string;
  if (o.purpose === "signup") {
    subject = `${o.code} é o seu código da ${name}`;
    html = layout({
      preheader: `Seu código de verificação: ${o.code}`,
      title: "Confirme seu e-mail",
      intro: `Use o código abaixo para concluir seu cadastro na ${name} O código vale por 15 minutos.`.replace(`${name} O`, `${name}. O`),
      codeLabel: "Código de verificação",
      code: o.code,
      outro: "Se você não criou uma conta, é só ignorar este e-mail. Nunca compartilhe este código com ninguém.",
    });
    text = `Confirme seu e-mail na ${name}\n\nSeu código de verificação: ${o.code}\n\nEle vale por 15 minutos. Se você não criou uma conta, ignore este e-mail.`;
  } else {
    subject = `Redefina sua senha da ${name}`;
    html = layout({
      preheader: `Clique para escolher uma nova senha. Código: ${o.code}`,
      title: "Redefinir sua senha",
      intro: "Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha. O botão e o código valem por 15 minutos.",
      codeLabel: "Seu código de verificação",
      code: o.code,
      button: o.link ? { label: "Redefinir minha senha", href: o.link } : undefined,
      afterCode: "Se o botão não abrir, digite este código na tela de recuperação de senha.",
      outro: "Se você não pediu isso, ignore este e-mail: sua senha continua a mesma. Nunca compartilhe este código com ninguém.",
    });
    text = `Redefinir sua senha da ${name}\n\nRecebemos um pedido para redefinir a senha da sua conta.\n\n${o.link ? `Abra este link para escolher uma nova senha:\n${o.link}\n\n` : ""}Seu código de verificação: ${o.code}\n\nO link e o código valem por 15 minutos. Se você não pediu isso, ignore este e-mail.`;
  }

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "user-agent": "square-auth/1.0" },
      body: JSON.stringify({ from: fromAddr(), to: [o.to], subject, html, text, headers: { "X-Entity-Ref-ID": crypto.randomUUID() } }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new MailError("rejected", "Resend inacessível: " + (e instanceof Error ? e.message : String(e)));
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new MailError("rejected", `Resend ${res.status}: ${detail}`);
  }
}
