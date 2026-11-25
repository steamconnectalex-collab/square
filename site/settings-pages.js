(() => {
'use strict';
const SET = window.SQ_SET;
const { esc, h2, hr, tg, rd, sel, range, btnRow, link, info, expand } = SET;
const api = () => window.SQ_API || {};
const P = SET.P;
const toast = (t) => SET.toast(t);
const SOON = 'Isso ainda não está disponível na Square.';

/* ----------------------------------------------------- valores iniciais */
Object.assign(SET.def, {
  // dados e privacidade
  dp_improve: true, dp_personalize: true, dp_sponsored_activity: true, dp_sponsored_third: false, dp_public_web: false, dp_voice_clips: true,
  profile_share: 'all', share_profile_update: true,
  // permissões de mensagens
  sx_dm_friends: 'blur', sx_dm_others: 'block', sx_server: 'blur', gr_dm_friends: 'blur', gr_dm_others: 'block', gr_server: 'blur',
  age_cmds: false, ios_age: false, spam: 'all', dm_scope: 'all', dm_over: {}, dm_allow: true, dm_requests: true, fr_all: true, fr_fof: true, fr_server: true,
  // notificações
  n_desktop: false, n_stream: true, n_anniv: true, n_friend_online: true, n_event: true, n_friend_profile: true, n_mute_all: false, n_badge: true, e_tips: true, e_rec: true, n_delay: 'never', n_preview: true,
  // voz e vídeo
  in_device: 'default', out_device: 'default', out_vol: 100, input_profile: 'custom', sens: 40, noise: 'standard', echo: true, ptt: false, auto_gain: true, adv_vad: true, warn_switch: true,
  transmit_preview: true, join_server: 'all', join_sound: 'none', fx_vol: 100, fx_mute: true, fx_unmute: true, fx_deaf: true, fx_undeaf: true, fx_join: true, fx_leave: true, fx_cam_on: true, fx_cam_off: true, fx_disconnect: true,
  // aparência
  theme: 'light', sync_theme: true, theme_others: false, app_icon: 0, msg_links: true, msg_upload: true, msg_attach: true, msg_react: true, spoilers: 'click', threads_split: true, show_avatars: true, fav_servers: false,
  send_btn: false, search_scope: 'selected', streamer: false, s_hide_personal: true, s_hide_invite: true, s_mute_sfx: true, s_mute_notif: true,
  // acessibilidade
  chat_fs: 16, zoom: 100, side_density: 'default', chat_display: 'default', group_gap: 16, saturation: 100, reduce_motion: false, sync_motion: true, notif_ms: 3, play_gifs: true, play_emoji: true, stickers: 'always', tts_rate: 1, img_desc: false, plain_input: false,
  // idioma e horário
  lang: 'pt-BR', time_fmt: 'auto',
  // atividades / dev
  act_share: true, dev_mode: false
});

/* --------------------------------------------------------------- grupos */
SET.groups = [
  { title: '', pages: ['account', 'privacy', 'msgs', 'notif'] },
  { title: 'Cobrança', pages: ['plus', 'boost', 'subs', 'gifts', 'billing'] },
  { title: 'Experiência', pages: ['voice', 'look', 'access', 'system', 'lang'] },
  { title: 'Jogos e apps', pages: ['activity', 'apps'] },
  { title: '', pages: ['dev'] }
];
const page = (o) => SET.pages.push(o);
const box = (inner, cls) => `<div class="sbox${cls ? ' ' + cls : ''}">${inner}</div>`;
const dice = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1D1D22" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="#fff"/><circle cx="8.5" cy="8.5" r=".6" fill="#1D1D22"/><circle cx="15.5" cy="8.5" r=".6" fill="#1D1D22"/><circle cx="12" cy="12" r=".6" fill="#1D1D22"/><circle cx="8.5" cy="15.5" r=".6" fill="#1D1D22"/><circle cx="15.5" cy="15.5" r=".6" fill="#1D1D22"/></svg>';
const plan = () => { const a = api(); return (a.plan && a.plan()) || 'free'; };
const paid = () => plan() !== 'free';
const servers = () => { const a = api(); return (a.servers && a.servers()) || []; };
const ageGroup = () => SET.getState('age') || 'unknown';
const loadAge = () => { const a = api(); if (SET.getState('age') || !a.rpc) return; SET.setState('age', 'unknown'); a.rpc('my_age_group').then((g) => { SET.setState('age', String(g || 'unknown')); SET.redraw(); }).catch(() => {}); };
const ageBanner = (text) => (ageGroup() === 'adult' ? '' : info(text, 'Confirmar idade', 'age'));

SET.acts.age = () => SET.modal({ title: 'Confirmar idade', body: '<p>A Square já guarda a data de nascimento que você informou ao criar a conta. A confirmação por documento ainda não existe, então os recursos só para adultos continuam bloqueados por enquanto.</p>', actions: [{ label: 'Entendi', act: 'modal-close', cls: 'primary' }] });
SET.acts.soon = () => toast(SOON);

/* ============================================================== CONTA */
const mask = (e) => { const i = String(e).indexOf('@'); return i < 0 ? '•••' : '*'.repeat(Math.max(4, i)) + e.slice(i); };
const acct = (label, val, btn, act) => `<div class="srow acct"><b class="sal">${esc(label)}</b><span class="sav">${val}</span>${btn ? `<button type="button" class="sbtn" data-sa="${act}">${esc(btn)}</button>` : ''}</div>`;
const chevRow = (label, val, act) => `<button type="button" class="srow chevrow" data-sa="${act}"><b class="sal">${esc(label)}</b><span class="sav">${val}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#33333A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>`;
const shield = '<span class="sicb"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D1D22" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><circle cx="12" cy="10" r="2"/><path d="M8.5 16c.8-1.6 2-2.3 3.5-2.3s2.7.7 3.5 2.3"/></svg></span>';

const dmOver = () => Object.assign({}, P('dm_over') || {});
function dmScopeToggles(dis) {
  const sc = P('dm_scope') || 'all';
  if (sc === 'all' || !servers().some((x) => x.id === sc)) {
    return `${tg('dm_allow', 'Mensagens Diretas', 'Permitir DMs de outros membros dos meus servidores')}
${tg('dm_requests', 'Solicitações de mensagens', 'Filtrar mensagens de membros do servidor que você talvez não conheça. <a class="lnk" href="/privacidade" target="_blank" rel="noopener">Saiba mais</a>', { dis })}`;
  }
  const o = dmOver()[sc] || {}, allow = o.allow === undefined ? P('dm_allow') !== false : !!o.allow, req = o.req === undefined ? P('dm_requests') !== false : !!o.req;
  const sw = (f, on, label, desc, d) => `<div class="srow"><div class="stx"><b>${label}</b><small>${desc}</small></div><button type="button" class="stg${on ? ' on' : ''}" role="switch" aria-checked="${on}" aria-label="${label}" data-sa="dm-over" data-f="${f}"${d ? ' disabled' : ''}><i></i></button></div>`;
  return `${sw('allow', allow, 'Mensagens Diretas', 'Permitir DMs de membros deste servidor (vale só para ele)')}${sw('req', req, 'Solicitações de mensagens', 'Filtrar mensagens de membros deste servidor que você talvez não conheça.', dis)}`;
}
const check = '<span class="sicb ok"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B6B47" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/></svg></span>';

page({ id: 'account', label: 'Conta', title: 'Conta', kw: 'usuário email telefone senha excluir desativar idade',
  subs: [{ id: 'acc-info', label: 'Informações da conta' }, { id: 'acc-sec', label: 'Senha e segurança' }, { id: 'acc-status', label: 'Status da conta' }, { id: 'acc-fam', label: 'Central da Família' }],
  render() {
    loadAge();
    const a = api(), me = (a.me && a.me()) || {}, email = (a.email && a.email()) || '', show = SET.getState('showEmail') && !(P('streamer') && P('s_hide_personal'));
    const g = ageGroup();
    const ageTxt = g === 'adult' ? 'Maior de 18 anos' : g === 'teen' ? 'De 13 a 17 anos' : 'Não confirmado';
    return `${h2('acc-info', 'Informações da conta')}
${acct('Nome de usuário', esc(me.user || ''), 'Editar', 'ed-user')}
${acct('E-mail', `<span class="semail">${esc(show ? email : mask(email))}</span> <button type="button" class="sinl" data-sa="show-email">${show ? 'Ocultar' : 'Mostrar'}</button>`, 'Editar', 'ed-email')}
${acct('Telefone', 'Você ainda não adicionou um telefone.', 'Adicionar', 'ed-phone')}
${hr()}
${h2('acc-sec', 'Senha e segurança')}
<div class="srow"><b class="sal">Senha</b><span class="sav"></span><button type="button" class="sbtn" data-sa="ed-pass">Editar</button></div>
${chevRow('Autenticação Multifatorial', 'Gerenciar', 'ed-mfa')}
${chevRow('Dispositivos conectados', '1 dispositivo', 'devices')}
${hr()}
${h2('acc-status', 'Status da conta')}
<div class="sst">${shield}<div class="stx"><b>Grupo etário</b><small>${g === 'adult' ? 'Seu grupo etário foi confirmado pela data de nascimento informada no cadastro.' : g === 'teen' ? 'Seu grupo etário foi definido pela data de nascimento informada no cadastro. Alguns conteúdos e configurações destinados a adultos não estão disponíveis.' : 'Seu grupo etário ainda não foi confirmado, então <a class="lnk" href="#" data-sa="age">alguns conteúdos e configurações</a> destinados a adultos não estarão disponíveis até você <a class="lnk" href="#" data-sa="age">confirmar que é maior de idade</a>.'}</small></div><span class="sav">${ageTxt}</span>${g === 'unknown' ? '<button type="button" class="sbtn" data-sa="age">Confirmar idade</button>' : ''}</div>
<button type="button" class="sst chevrow" data-sa="acc-ok">${check}<div class="stx"><b>Status da Conta</b><small>Agradecemos por respeitar os <a class="lnk" href="/termos" target="_blank" rel="noopener">termos de serviço</a> da Square. Se você tiver uma violação, ela aparecerá aqui.</small></div><span class="sav">Tudo certo!</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#33333A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
${hr()}
${h2('acc-fam', 'Central da Família')}
<button type="button" class="srow chevrow fam" data-sa="family"><span class="stx"><b>Configurar Central da Família</b><small>Conecte-se com um responsável para que ele possa ficar por dentro. Suas mensagens permanecem privadas e você sempre poderá saber exatamente o que ele vê.</small></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#33333A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
${hr()}
${btnRow('Desative sua conta', 'Desative temporariamente sua conta.', 'Desativar conta', 'deact', 'dangerghost')}
${btnRow('Encerrar sua conta', 'Encerre sua conta permanentemente.', 'Excluir conta', 'del-acct', 'dangersolid')}`;
  }
});
Object.assign(SET.acts, {
  'show-email': () => { SET.setState('showEmail', !SET.getState('showEmail')); SET.redraw(); },
  'ed-user': () => SET.modal({ title: 'Mudar nome de usuário', body: `<label class="sgl" for="u-in">Novo nome de usuário</label><input id="u-in" class="sinp" maxlength="20" autocomplete="off" value="${esc(((api().me && api().me()) || {}).user || '')}"><small class="sgd">De 3 a 20 letras minúsculas, números, ponto ou sublinhado.</small><p class="smerr" id="u-err" role="alert"></p>`, actions: [{ label: 'Cancelar', act: 'modal-close' }, { label: 'Salvar', act: 'save-user', cls: 'primary' }] }),
  'save-user': async () => {
    const v = (document.getElementById('u-in').value || '').trim().toLowerCase(), er = document.getElementById('u-err');
    if (!/^[a-z0-9._]{3,20}$/.test(v)) { er.textContent = 'Use de 3 a 20 letras minúsculas, números, ponto ou sublinhado.'; return; }
    try { await api().rpc('change_username', { p_username: v }); const m = api().me && api().me(); if (m) m.user = v; if (api().reload) api().reload(); SET.modal(null); SET.redraw(); toast('Nome de usuário atualizado'); }
    catch (e) { er.textContent = /username_taken/.test((e && e.message) || '') ? 'Esse nome de usuário já está em uso.' : /invalid_username/.test((e && e.message) || '') ? 'Esse nome de usuário não é válido.' : 'Não deu certo. Tente de novo.'; }
  },
  'ed-phone': () => SET.modal({ title: 'Telefone', body: '<p>Login e verificação por telefone ainda não existem na Square.</p>', actions: [{ label: 'Entendi', act: 'modal-close', cls: 'primary' }] }),
  'ed-pass': () => SET.modal({ title: 'Mudar senha', body: '<label class="sgl" for="p1">Nova senha</label><input id="p1" class="sinp" type="password" autocomplete="new-password"><label class="sgl" for="p2">Confirmar nova senha</label><input id="p2" class="sinp" type="password" autocomplete="new-password"><small class="sgd">Use pelo menos 8 caracteres.</small><p class="smerr" id="p-err" role="alert"></p>', actions: [{ label: 'Cancelar', act: 'modal-close' }, { label: 'Mudar senha', act: 'save-pass', cls: 'primary' }] }),
  'save-pass': async () => {
    const a = document.getElementById('p1').value, b = document.getElementById('p2').value, er = document.getElementById('p-err');
    if (a.length < 8) { er.textContent = 'Use pelo menos 8 caracteres.'; return; }
    if (a !== b) { er.textContent = 'As senhas não são iguais.'; return; }
    try { const r = await api().authFetch('/auth/v1/user', { method: 'PUT', body: { password: a } }); if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j && (j.msg || j.message || j.error_description)) || 'erro'); } SET.modal(null); toast('Senha alterada'); }
    catch (e) { er.textContent = /same|diferente|different/i.test(String(e.message)) ? 'A nova senha precisa ser diferente da atual.' : /weak|fraca|pwned|leak/i.test(String(e.message)) ? 'Essa senha é fraca ou já vazou. Escolha outra.' : 'Não deu certo. Entre de novo e tente outra vez.'; }
  },
  devices: () => SET.modal({ title: 'Dispositivos conectados', body: '<div class="sdev"><b>Este dispositivo</b><small>Sessão atual, ativa agora</small></div><p class="sgd">Se você entrou em outros aparelhos e quer encerrar essas sessões, use o botão abaixo. A sessão atual continua.</p>', actions: [{ label: 'Fechar', act: 'modal-close' }, { label: 'Sair dos outros dispositivos', act: 'logout-others', cls: 'dangersolid' }] }),
  'logout-others': async () => { try { const r = await api().authFetch('/auth/v1/logout?scope=others', { method: 'POST' }); if (!r.ok) throw new Error('x'); SET.modal(null); toast('Os outros dispositivos foram desconectados'); } catch (e) { toast('Não deu certo. Tente de novo.'); } },
  'acc-ok': () => toast('Sua conta está em dia. Nenhuma violação registrada.'),
  'dm-over': (t) => { const sc = P('dm_scope'), all = dmOver(), cur = Object.assign({}, all[sc] || {}); const base = t.dataset.f === 'allow' ? P('dm_allow') !== false : P('dm_requests') !== false; const was = cur[t.dataset.f] === undefined ? base : !!cur[t.dataset.f]; cur[t.dataset.f] = !was; all[sc] = cur; SET.setP('dm_over', all); SET.redraw(); },
  family: () => toast(SOON),
  /* ---- trocar e-mail ---- */
  'ed-email': () => SET.modal({ title: 'Mudar e-mail', body: '<label class="sgl" for="em-new">Novo e-mail</label><input id="em-new" class="sinp" type="email" autocomplete="off"><label class="sgl" for="em-pw">Sua senha atual</label><input id="em-pw" class="sinp" type="password" autocomplete="current-password"><small class="sgd">Enviamos um código para o novo endereço para confirmar que ele é seu.</small><p class="smerr" id="em-err" role="alert"></p>', actions: [{ label: 'Cancelar', act: 'modal-close' }, { label: 'Enviar código', act: 'em-send', cls: 'primary' }] }),
  'em-send': async () => {
    const ne = (document.getElementById('em-new').value || '').trim().toLowerCase(), pw = document.getElementById('em-pw').value, er = document.getElementById('em-err');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ne)) { er.textContent = 'Informe um e-mail válido.'; return; }
    if (!pw) { er.textContent = 'Digite sua senha atual.'; return; }
    try { await api().fn('/email/change/request', { new_email: ne, password: pw }); }
    catch (e) { er.textContent = (e && e.message) || 'Não deu certo. Tente de novo.'; return; }
    SET.modal({ title: 'Confirme o novo e-mail', body: `<p class="sgd">Enviamos um código de 6 caracteres para <b>${esc(ne)}</b>.</p><input id="em-code" class="sinp" maxlength="12" autocomplete="one-time-code" autocapitalize="characters" data-ne="${esc(ne)}"><p class="smerr" id="em-err" role="alert"></p>`, actions: [{ label: 'Cancelar', act: 'modal-close' }, { label: 'Confirmar', act: 'em-ok', cls: 'primary' }] });
  },
  'em-ok': async () => {
    const i = document.getElementById('em-code'), er = document.getElementById('em-err');
    try { const r = await api().fn('/email/change/confirm', { new_email: i.dataset.ne, code: i.value }); SET.modal(null); toast('E-mail alterado para ' + r.email); if (api().setEmail) api().setEmail(r.email); SET.redraw(); }
    catch (e) { er.textContent = (e && e.message) || 'Não deu certo. Tente de novo.'; }
  },
  /* ---- verificação em duas etapas ---- */
  'ed-mfa': async () => {
    let fs = [];
    try { const r = await api().authFetch('/auth/v1/user'); const u = await r.json(); fs = (u && u.factors) || []; } catch (e) { /* segue */ }
    const on = fs.some((f) => f.factor_type === 'totp' && f.status === 'verified');
    if (on) {
      SET.modal({ title: 'Autenticação multifatorial', body: '<p>A verificação em duas etapas está <b>ligada</b>. Ao entrar com senha, será pedido o código do aplicativo. Em outros aparelhos você também pode entrar só com esse código, pela tela de login.</p>', actions: [{ label: 'Fechar', act: 'modal-close' }, { label: 'Novos códigos de recuperação', act: 'mfa-newrec' }, { label: 'Desligar', act: 'mfa-off', cls: 'dangersolid' }] });
    } else {
      SET.modal({ title: 'Autenticação multifatorial', body: '<p>Baixe o <b>Google Authenticator</b> (ou outro aplicativo de autenticação) no celular. Você vai ler um QR Code uma única vez; depois o aplicativo gera códigos de 6 números para entrar na sua conta em qualquer aparelho.</p>', actions: [{ label: 'Cancelar', act: 'modal-close' }, { label: 'Ligar', act: 'mfa-start', cls: 'primary' }] });
    }
  },
  'mfa-start': async () => {
    try {
      const r0 = await api().authFetch('/auth/v1/user'); const u = await r0.json().catch(() => ({}));
      for (const f of ((u && u.factors) || []).filter((x) => x.status !== 'verified')) await api().authFetch('/auth/v1/factors/' + f.id, { method: 'DELETE' });
      const r = await api().authFetch('/auth/v1/factors', { method: 'POST', body: { factor_type: 'totp', friendly_name: 'Square ' + Date.now(), issuer: 'Square' } });
      const j = await r.json(); if (!r.ok || !j.id) throw new Error('x');
      SET.modal({ title: 'Ligar verificação em duas etapas', body: `<p class="sgd">1. Escaneie o QR Code no aplicativo de autenticação.</p><div style="text-align:center"><img alt="QR Code para o aplicativo de autenticação" src="${esc(j.totp.qr_code)}" width="180" height="180" style="background:#fff;border-radius:12px"></div><p class="sgd">Ou digite esta chave: <b style="user-select:all;word-break:break-all">${esc(j.totp.secret)}</b></p><p class="sgd">2. Digite o código de 6 números que o aplicativo mostrar.</p><input id="mf-code" class="sinp" inputmode="numeric" maxlength="8" autocomplete="one-time-code" data-fid="${esc(j.id)}"><p class="smerr" id="mf-err" role="alert"></p>`, actions: [{ label: 'Cancelar', act: 'modal-close' }, { label: 'Ativar', act: 'mfa-verify', cls: 'primary' }] });
    } catch (e) { toast('Não deu certo ligar agora. Tente de novo.'); }
  },
  'mfa-verify': async () => {
    const i = document.getElementById('mf-code'), er = document.getElementById('mf-err'), code = (i.value || '').replace(/\D/g, '');
    if (code.length !== 6) { er.textContent = 'Digite os 6 números do código.'; return; }
    try {
      const c = await api().authFetch('/auth/v1/factors/' + i.dataset.fid + '/challenge', { method: 'POST', body: {} }); const cj = await c.json(); if (!c.ok) throw new Error('c');
      const v = await api().authFetch('/auth/v1/factors/' + i.dataset.fid + '/verify', { method: 'POST', body: { challenge_id: cj.id, code } }); if (!v.ok) throw new Error('v');
    } catch (e) { er.textContent = 'Esse código não confere. Confira o horário do celular e tente de novo.'; return; }
    SET.acts['mfa-newrec'](true);
  },
  'mfa-newrec': async (first) => {
    try {
      const r = await api().fn('/mfa/recovery', {});
      SET.modal({ title: first === true ? 'Verificação ligada!' : 'Novos códigos de recuperação', body: `<p class="sgd">Guarde estes 8 códigos em um lugar seguro. Cada um vale uma vez, e só aparecem agora. Se você perder o celular, use um deles para entrar (isso desliga a verificação).</p><div class="sgrp" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-family:monospace;font-size:15px;user-select:all">${r.codes.map((c) => `<span>${esc(c)}</span>`).join('')}</div>`, actions: [{ label: 'Copiar', act: 'mfa-copy' }, { label: 'Já guardei', act: 'modal-close', cls: 'primary' }] });
      SET._rec = r.codes;
    } catch (e) { toast((e && e.message) || 'Não deu certo. Tente de novo.'); }
  },
  'mfa-copy': () => { try { navigator.clipboard.writeText((SET._rec || []).join('\n')); toast('Códigos copiados'); } catch (e) { toast('Não foi possível copiar. Selecione e copie.'); } },
  'mfa-off': () => SET.modal({ title: 'Desligar verificação', body: '<label class="sgl" for="mo-pw">Sua senha</label><input id="mo-pw" class="sinp" type="password" autocomplete="current-password"><label class="sgl" for="mo-code">Código do aplicativo (ou de recuperação)</label><input id="mo-code" class="sinp" maxlength="12" autocomplete="one-time-code"><p class="smerr" id="mo-err" role="alert"></p>', actions: [{ label: 'Cancelar', act: 'modal-close' }, { label: 'Desligar', act: 'mfa-off-ok', cls: 'dangersolid' }] }),
  'mfa-off-ok': async () => {
    const pw = document.getElementById('mo-pw').value, c = (document.getElementById('mo-code').value || '').trim(), er = document.getElementById('mo-err');
    const body = { password: pw }; if (/\d{6}/.test(c.replace(/\D/g, '')) && c.replace(/\D/g, '').length === 6 && !/[A-Za-z]/.test(c)) body.code = c; else body.recovery_code = c;
    try { await api().fn('/mfa/disable', body); SET.modal(null); toast('Verificação em duas etapas desligada'); }
    catch (e) { er.textContent = (e && e.message) || 'Não deu certo.'; }
  },
  /* ---- desativar / excluir ---- */
  deact: () => SET.modal({ title: 'Desativar conta', body: '<p>Sua conta fica invisível e você será desconectado. Para voltar, é só entrar de novo: ela é reativada na hora. Nada é apagado.</p><label class="sgl" for="da-pw">Sua senha</label><input id="da-pw" class="sinp" type="password" autocomplete="current-password"><p class="smerr" id="da-err" role="alert"></p>', actions: [{ label: 'Cancelar', act: 'modal-close' }, { label: 'Desativar conta', act: 'deact-ok', cls: 'dangersolid' }] }),
  'deact-ok': async () => {
    const er = document.getElementById('da-err');
    try { await api().fn('/account/deactivate', { password: document.getElementById('da-pw').value }); SET.modal(null); api().logout(); }
    catch (e) { er.textContent = (e && e.message) || 'Não deu certo.'; }
  },
  'del-acct': () => SET.modal({ title: 'Excluir conta', body: '<p><b>Isso é permanente.</b> Seu perfil, suas mensagens, fotos e amizades serão apagados. Servidores seus passam para o membro mais antigo (ou somem se estiverem vazios).</p><label class="sgl" for="dl-pw">Sua senha</label><input id="dl-pw" class="sinp" type="password" autocomplete="current-password"><label class="sgl" for="dl-cf">Digite EXCLUIR para confirmar</label><input id="dl-cf" class="sinp" autocomplete="off"><p class="smerr" id="dl-err" role="alert"></p>', actions: [{ label: 'Cancelar', act: 'modal-close' }, { label: 'Excluir para sempre', act: 'del-ok', cls: 'dangersolid' }] }),
  'del-ok': async () => {
    const er = document.getElementById('dl-err');
    try { await api().fn('/account/delete', { password: document.getElementById('dl-pw').value, confirm: document.getElementById('dl-cf').value }); SET.modal(null); api().logout(); }
    catch (e) { er.textContent = (e && e.message) || 'Não deu certo.'; }
  }
});

/* ================================================= DADOS E PRIVACIDADE */
page({ id: 'privacy', label: 'Privacidade e segurança', title: 'Privacidade e segurança', kw: 'dados cópia perfil segurança 2fa autenticação duas etapas google authenticator código qr',
  subs: [{ id: 'dp-sec', label: 'Segurança da conta' }, { id: 'dp-data', label: 'Como a Square usa meus dados' }, { id: 'dp-profile', label: 'Privacidade do perfil' }],
  render() {
    const n = servers().length, first = servers()[0];
    const share = P('act_share') ? (n ? `Você está compartilhando atividade com <b>${esc(first.name)}</b>${n > 1 ? ' e ' + (n - 1) + (n - 1 === 1 ? ' outro servidor' : ' outros servidores') : ''}.` : 'Você ainda não está em nenhum servidor.') : 'Você não está compartilhando atividade.';
    return `${h2('dp-sec', 'Segurança da conta')}
<div class="sgrp"><b class="sgl">Verificação em duas etapas (aplicativo de autenticação)</b><small class="sgd">Proteja sua conta com o Google Authenticator (ou Authy, 1Password etc.). Você escaneia um QR Code <b>uma única vez</b>. Depois disso, em qualquer outro computador, tablet ou celular, dá para entrar na sua conta só com o código de 6 números do aplicativo, pela opção "Entrar com o código do autenticador" na tela de login.</small><button type="button" class="sbtn primary" data-sa="ed-mfa">Ativar ou gerenciar</button></div>
${h2('dp-data', 'Como a Square usa meus dados')}
<div class="sgrp"><b class="sgl">Utilizar dados para fazer a Square funcionar</b><small class="sgd">A Square precisa armazenar e processar alguns dados para te fornecer os serviços básicos, tais como suas mensagens, servidores em que você está e mensagens diretas. Ao usar a Square, você permite que ela forneça estes serviços básicos. Você pode interromper isso ao <a class="lnk" href="#" data-sa="deact">desativar</a> ou <a class="lnk" href="#" data-sa="del-acct">excluir</a> sua conta.</small></div>
<p class="sgd">Hoje a Square não usa anúncios nem ferramentas de análise: estas opções ficam guardadas na sua conta como sua escolha e valerão se esses recursos forem criados.</p>
${tg('dp_improve', 'Utilizar dados para melhorar a Square', 'Permite que a Square use e processe minhas informações para entender e aprimorar seus serviços. <a class="lnk" href="/privacidade" target="_blank" rel="noopener">Saiba mais</a>')}
${tg('dp_personalize', 'Utilizar dados para personalizar minha experiência na Square', 'Permite que a Square utilize informações, como com quem você conversa ou os jogos que joga, para personalizar a Square para você. <a class="lnk" href="/privacidade" target="_blank" rel="noopener">Saiba mais</a>')}
${tg('dp_sponsored_activity', 'Usar minha atividade da Square para personalizar o conteúdo patrocinado', 'Permite que a Square personalize o conteúdo patrocinado, como missões, usando sua atividade na Square, como os jogos que você joga. Se você recusar, ainda poderá ver as missões, mas elas não serão personalizadas.')}
${tg('dp_sponsored_third', 'Usar dados de terceiros para personalizar o conteúdo patrocinado', 'Permite que a Square personalize o conteúdo patrocinado, como missões, usando dados que ela recebe de anunciantes e outros provedores de dados. Se você recusar, ainda poderá ver missões, mas elas não serão personalizadas usando dados de terceiros. <a class="lnk" href="/privacidade" target="_blank" rel="noopener">Saiba mais</a>')}
${tg('dp_public_web', 'Mostrar o conteúdo das minhas mensagens em canais públicos em páginas da web', 'Permita que o conteúdo das mensagens que você envia em canais públicos apareça em páginas da web. Os administradores dos Servidores do Descobrir controlam quais canais podem ser descobertos. Essas mensagens aparecerão exatamente como você as escreveu, mas não mostrarão seu nome de usuário. <a class="lnk" href="/privacidade" target="_blank" rel="noopener">Saiba mais</a>')}
${tg('dp_voice_clips', 'Permitir que minha voz seja gravada nos clipes', 'Permite que sua voz seja incluída quando alguém no mesmo canal de voz usa clipes.')}
${btnRow('Solicitar meus dados', 'Se você precisar de uma cópia dos seus dados pessoais de todo o histórico da sua conta, poderá obtê-la aqui. <a class="lnk" href="/privacidade" target="_blank" rel="noopener">Saiba mais</a> sobre como funciona a solicitação de uma cópia dos seus dados.', 'Solicitar dados', 'export')}
${hr()}
${h2('dp-profile', 'Privacidade do perfil', 'Controle quem pode ver suas informações de perfil — como sua bio e contas conectadas. <a class="lnk" href="/privacidade" target="_blank" rel="noopener">Saiba mais</a>')}
${rd('profile_share', 'Compartilhe meu perfil completo com', '', [['all', 'Amigos e todos os servidores', 'Seu perfil completo é visível para amigos e para qualquer servidor em que você estiver.'], ['small', 'Amigos e servidores pequenos apenas', 'Seu perfil completo é visível para amigos e para qualquer servidor em que você estiver com 200 membros ou menos. Todos os outros veem uma versão limitada.'], ['friends', 'Apenas amigos', 'Seu perfil completo é visível apenas para amigos. O restante vê uma versão limitada.']])}
${tg('share_profile_update', 'Compartilhar quando eu atualizar meu perfil', 'Permita que seus amigos recebam uma notificação quando você atualizar o seu perfil.')}
<p class="srel">Configurações relacionadas</p>
${link('Privacidade nas atividades', 'Controle como sua atividade de jogo e app é compartilhada — o que é visível e quem a vê. ' + share, 'activity', 'activity')}`;
  }
});
SET.acts.export = async () => {
  const a = api(); toast('Preparando seus dados…');
  try {
    const me = a.me && a.me();
    const [msgs, favs, pls] = await Promise.all([
      a.sb('/rest/v1/messages?select=id,channel_id,content,created_at,edited_at,attachment_path&author_id=eq.' + a.myId() + '&order=created_at.desc&limit=5000').catch(() => []),
      a.sb('/rest/v1/music_favorites?select=track_id,track,created_at&limit=1000').catch(() => []),
      a.sb('/rest/v1/playlists?select=id,name,shared,created_at&limit=100').catch(() => [])
    ]);
    const out = { exportado_em: new Date().toISOString(), conta: { id: a.myId(), email: a.email && a.email(), usuario: me && me.user, nome: me && me.name }, servidores: servers().map((s) => ({ id: s.id, nome: s.name })), mensagens_enviadas: msgs, musicas_favoritas: favs, playlists: pls, preferencias: JSON.parse(JSON.stringify(SET.allPrefs ? SET.allPrefs() : {})) };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), l = document.createElement('a');
    l.href = url; l.download = 'meus-dados-square.json'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Download dos seus dados iniciado');
  } catch (e) { toast('Não consegui reunir seus dados agora. Tente de novo.'); }
};

/* ============================================ PERMISSÕES DE MENSAGENS */
const lvl = [['show', 'Mostrar'], ['blur', 'Borrar'], ['block', 'Bloquear']];
page({ id: 'msgs', label: 'Permissões de mensagens', title: 'Permissões de mensagens', kw: 'spam filtro dm amizade pedido',
  subs: [{ id: 'pm-content', label: 'Filtros de conteúdo' }, { id: 'pm-spam', label: 'Filtros de spam' }, { id: 'pm-dm', label: 'Mensagens diretas' }, { id: 'pm-fr', label: 'Pedidos de amizade' }, { id: 'pm-games', label: 'Jogos conectados' }],
  render() {
    loadAge();
    const tab = SET.getState('tab_sens') || 'sx', pre = tab === 'sx' ? 'sx_' : 'gr_';
    const row = (k, label, dis) => `<div class="ssens${dis ? ' dis' : ''}"><b>${label}</b><select class="ssel sm" data-k="${pre}${k}" aria-label="${label}"${dis ? ' disabled' : ''}>${lvl.map((x) => `<option value="${x[0]}">${x[1]}</option>`).join('')}</select></div>`;
    const dis = ageGroup() !== 'adult';
    return `${h2('pm-content', 'Filtros de conteúdo')}
${ageBanner('Algumas configurações só podem ser alteradas se você estiver no grupo de idade adulto. <a class="lnk" href="#" data-sa="age">Saiba mais</a>')}
<b class="sgl">Filtros de conteúdo sensível</b><small class="sgd">Escolha como você quer visualizar imagens detectadas pelos filtros de conteúdo sensível da Square. <a class="lnk" href="/privacidade" target="_blank" rel="noopener">Saiba mais</a></small>
<div class="stabs2"><div class="stabl"><button type="button" class="stab2${tab === 'sx' ? ' on' : ''}" data-sa="tab-sens" data-id="sx">Conteúdo sexual maduro</button><button type="button" class="stab2${tab === 'gr' ? ' on' : ''}" data-sa="tab-sens" data-id="gr">Mídia gráfica</button></div>
<div class="stabr">${row('dm_friends', 'Mensagens diretas de amigos', dis)}${row('dm_others', 'Mensagens diretas de outras pessoas', dis)}${row('server', 'Mensagens em canais do servidor', true)}<small class="sgd">${tab === 'sx' ? 'Ajuda a detectar imagens que podem conter material sexualmente explícito ou sugestivo envolvendo adultos.' : 'Ajuda a detectar imagens que podem conter violência gráfica.'}</small></div></div>
${tg('age_cmds', 'Permite acesso a comandos com restrição de idade de apps em mensagens diretas', 'Permite que pessoas com 18 anos ou mais acessem comandos marcados como restritos por idade nas mensagens diretas. Aplica-se a todos os apps.', { dis })}
${tg('ios_age', 'Permitir acesso a servidores com restrição de idade no iOS', 'Acesse servidores com restrição de idade (18+) em dispositivos iOS, depois de acessá-los no desktop.', { dis })}
<p class="srel">Configurações relacionadas</p>
${link('Aparência', 'Mostrar/ocultar mídia no chat e conteúdo de spoiler', 'look', 'look')}
${hr()}
${h2('pm-spam', 'Filtros de spam')}
${rd('spam', 'Filtrar automaticamente mensagens de spam suspeitas', 'A Square pode filtrar algumas mensagens que contêm spam. Essas mensagens vão para a sua caixa de envio de spam.', [['all', 'Filtrar todos os envios de spam'], ['unknown', 'Filtrar mensagens de desconhecidos (recomendado)'], ['none', 'Não filtrar envios de spam']])}
${hr()}
${h2('pm-dm', 'Permissões de mensagens diretas (DM)')}
<div class="sgrp"><select class="ssel" data-k="dm_scope" aria-label="Servidor"><option value="all">Todos os servidores</option>${servers().map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div>
${dmScopeToggles(dis)}
${ageBanner('Solicitações de mensagens só podem ser desativadas se você estiver no grupo de idade adulto. <a class="lnk" href="#" data-sa="age">Saiba mais</a>')}
${hr()}
${h2('pm-fr', 'Permissões de pedido de amizade', 'Controle quem pode enviar pedidos de amizade e como eles aparecem.')}
<b class="sgl">Permitir pedidos de amizade de…</b>
${tg('fr_all', 'Todos', '')}${tg('fr_fof', 'Amigos de amigos', '')}${tg('fr_server', 'Membros do servidor', 'Membros do servidor só podem enviar pedidos de amizade de servidores onde você também')}
${h2('pm-games', 'Mensagens em jogos conectados', 'Estas são as configurações para jogos que usam a Square para impulsionar atividades sociais.')}
${box('<b>Nenhum jogo conectado</b><small>Quer conectar um jogo à sua conta? <a class="lnk" href="#" data-sa="soon">Saiba mais</a></small>', 'center')}
<p class="srel">Configurações relacionadas</p>
${link('Aplicativos autorizados', 'Gerencie seus jogos em Aplicativos Autorizados', 'apps', 'apps')}`;
  }
});
SET.acts['tab-sens'] = (t) => { SET.setState('tab_sens', t.dataset.id); SET.redraw(); };

/* ============================================================ NOTIFICAÇÕES */
page({ id: 'notif', label: 'Notificações', title: 'Notificações', kw: 'som alerta email badge',
  subs: [{ id: 'nt-over', label: 'Visão geral' }, { id: 'nt-sound', label: 'Sons' }, { id: 'nt-badge', label: 'Insígnias' }, { id: 'nt-mail', label: 'E-mail' }, { id: 'nt-adv', label: 'Avançado' }],
  render() {
    return `${h2('nt-over', 'Visão geral')}
${tg('n_desktop', 'Ativar notificações na área de trabalho', 'Se você deseja configurar notificações por canal ou por servidor individualmente, clique com botão direito no ícone do servidor desejado e selecione “Configurações de notificação”.')}
<b class="sgl">Notifique-me quando…</b>
${tg('n_stream', 'Pessoas que conheço começam a transmitir em pequenos servidores', '')}${tg('n_anniv', 'Um amigo e eu chegamos a um aniversário de amizade', '')}${tg('n_friend_online', 'Amigos ficam online', '')}${tg('n_event', 'Um servidor tem um evento futuro', '')}${tg('n_friend_profile', 'Amigos atualizam o perfil deles', '')}
${hr()}
${h2('nt-sound', 'Sons')}
${tg('n_mute_all', 'Desativar todos os sons de notificação', 'Desativa todos os sons de notificação, incluindo efeitos sonoros de voz e som de vídeo. Suas preferências de som individuais serão salvas e restauradas se você ativar isso.')}
<p class="srel">Configurações relacionadas</p>
${link('Voz e vídeo', 'Habilite/desative sons que tocam quando você está em uma chamada, como silenciar, dessilenciar, desativar áudio e mais.', 'voice', 'voice')}
${hr()}
${h2('nt-badge', 'Insígnias')}
${tg('n_badge', 'Ativar indicador de mensagens não lidas', 'Mostra um indicador vermelho no ícone do aplicativo quando houver mensagens não lidas.')}
${hr()}
${h2('nt-mail', 'E-mail')}
${tg('e_tips', 'E-mails de dicas', 'Receba e-mails com conselhos úteis sobre como usar a Square e informações sobre recursos menos conhecidos.')}
${tg('e_rec', 'E-mails de recomendações', 'Receba e-mails com servidores recomendados e eventos sugeridos.')}
${btnRow('Cancelar inscrição para e-mails de marketing', '', 'Cancelar inscrição', 'unsub', 'dangerghost')}
${hr()}
${h2('nt-adv', 'Avançado')}
${expand('adv-n', 'Mostrar Configurações de Notificação Avançadas', 'Atraso de notificação em dispositivo móvel e muito mais', `${sel('n_delay', 'Atraso de notificação em dispositivo móvel', 'Espera um pouco antes de avisar no celular se você estiver ativo no computador.', [['never', 'Sem atraso'], ['1', '1 minuto'], ['5', '5 minutos'], ['10', '10 minutos']])}${tg('n_preview', 'Mostrar prévia da mensagem nas notificações', 'Quando desligado, a notificação só diz que chegou uma nova mensagem.')}`)}`;
  }
});
SET.acts.unsub = async () => { try { await api().rpc('unsubscribe_marketing'); SET.setP('e_tips', false); SET.setP('e_rec', false); toast('Você não receberá mais e-mails de marketing'); } catch (e) { toast('Não deu certo. Tente de novo.'); } };
SET.onToggle = (k, v) => {
  if (k === 'n_desktop' && v) {
    if (!('Notification' in window)) { SET.setP('n_desktop', false); toast('Este navegador não mostra notificações na área de trabalho.'); return; }
    Notification.requestPermission().then((r) => { if (r !== 'granted') { SET.setP('n_desktop', false); toast('Permita as notificações para este site no navegador.'); } });
  }
  if (k === 'streamer') toast(v ? 'Modo streamer ligado' : 'Modo streamer desligado');
  if (k === 'dm_scope') SET.redraw();
  if (k === 'lang') return;
};

/* ============================================================= PLUS (Square Plus) */
const tickI = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D1D22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>', crossI = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A8A96" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const PERKS = [['Mais poder emoji', 'Empolgue, zoe e mande memes com emojis personalizados em qualquer lugar.', 'face'], ['Vídeo HD', 'Melhor resolução de vídeo para todas as suas transmissões. Transmita aplicativos e jogos em resolução HD impecável.', 'video'], ['1GB Envios', 'Envie o que quiser com um limite de upload expandido de 1GB.', 'upload'], ['Ícones Personalizados do Aplicativo', 'Escolha um ícone para celular e no app do desktop que combine com a sua vibe.', 'icon'], ['Usar sons personalizados', 'Reaja com sons personalizados do painel de efeitos sonoros em todos os canais de voz.', 'sound'], ['Planos de Fundos de Vídeo', 'Faça videochamadas com seus próprios fundos de vídeo.', 'bg'], ['Super-reações ilimitadas', 'Tornamos as super-reações ilimitadas para que você possa desencadear o caos em suas conversas.', 'star'], ['Acesso a figurinhas especiais', 'Use figurinha personalizada em qualquer lugar.', 'sticker'], ['Insígnia de assinante', 'Pegue essa insígnia maneira por ser um assinante.', 'badge']];
const CMP = [['Emojis personalizados em qualquer lugar, inclusive animados', 1, 1], ['Figurinhas personalizadas em qualquer lugar', 1, 1], ['Ícones Personalizados do Aplicativo', 1, 1], ['Super-reações', 1, 1], ['Envio de arquivo maiores', '50 MB', '1 GB'], ['Transmissões em HD', 0, 'Até 4K e 60 fps'], ['2 impulsos + 30% de desconto em impulsos adicionais', 0, 1], ['Avatar animado, faixa e tema de perfil', 0, 1], ['Estilos de nome exibido', 0, 1], ['Perfis personalizados por servidores', 0, 1], ['Preços para membros da loja e itens exclusivos', 0, 1], ['Cores para o seu tema da Square', 0, 1], ['Insígnia Plus no seu perfil', 1, 1], ['Vídeos de fundo personalizados', 1, 1], ['Sons personalizados em qualquer lugar', 0, 1], ['Sons de entrada personalizados', 0, 1], ['Entre em até 200 servidores', 0, 1], ['Mensagens mais longas, de até 4000 caracteres', 0, 1], ['3 Passes de amigo Plus', 0, 1], ['Mantenha as recompensas de decoração de avatar de missão por mais tempo', 0, 1]];
const perkArt = (k) => `<span class="sperk-art a-${k}" aria-hidden="true"></span>`;
const cell = (v) => (v === 1 ? tickI : v === 0 ? crossI : `<b>${esc(v)}</b>`);
const wm = (n, s) => `<span class="swm">${esc(n)}${s ? `<small>${esc(s)}</small>` : ''}</span>`;
page({ id: 'plus', label: 'Square Plus', title: 'Square Plus', icon: 'plus', kw: 'plano assinatura plus',
  render() {
    const ins = (cls) => `<button type="button" class="splus-btn ${cls || ''}" data-sa="pay">Inscrever-se</button>`;
    return `<div class="splus-hero"><span class="spk k1"></span><span class="spk k2"></span><span class="spk k3"></span><h2>DESBLOQUEIE UM MUNDO DE VANTAGENS COM SQUARE PLUS</h2><p>Planos a partir de R$ 8,90/mês. Cancele a qualquer momento</p><div class="splus-actions"><button type="button" class="splus-btn" data-sa="pay">${wm('Inscrever-se')}</button><button type="button" class="splus-btn ghost" data-sa="pay">Presentear Plus</button></div></div>
<div class="splus-plans"><div class="splan b1"><div class="swmw">${wm('SQUARE', 'BASIC')}<p>R$ 8,90 / mês</p></div><ul><li>${tickI}50MB uploads</li><li>${tickI}Emoji personalizado em qualquer lugar</li><li>${tickI}Super-reações ilimitadas</li><li>${tickI}Insígnia Plus especial no seu perfil</li></ul>${ins('out')}</div>
<div class="splan b2"><div class="swmw">${wm('SQUARE', 'PLUS')}<p>R$ 24,99 / mês</p></div><ul><li>${tickI}1GB uploads</li><li>${tickI}Emoji personalizado em qualquer lugar</li><li>${tickI}Super-reações ilimitadas</li><li>${tickI}Transmissão de vídeo em HD</li><li>${tickI}2 impulsos de servidor</li><li>${tickI}Perfis personalizados e muito mais!</li></ul>${ins('solid')}</div></div>
<h3 class="splus-h3">Vantagens Plus favoritas</h3>
<div class="sperks">${PERKS.map((p) => `<div class="sperk">${perkArt(p[2])}<b>${esc(p[0])}</b><small>${esc(p[1])}</small></div>`).join('')}</div>
<h3 class="splus-h3 left">Escolha o plano mais adequado para você.</h3>
<div class="scmp"><div class="scmp-h"><b>Preços e funcionalidades</b>${wm('SQUARE', 'BASIC')}<div class="pop"><em>MAIS POPULAR</em>${wm('SQUARE', 'PLUS')}</div></div>
<div class="scmp-r"><span>Preço</span><b>R$ 8,90/mês</b><b>R$ 24,99/mês</b></div>${CMP.map((r) => `<div class="scmp-r"><span>${esc(r[0])}</span><i>${cell(r[1])}</i><i>${cell(r[2])}</i></div>`).join('')}</div>
<div class="splus-foot"><button type="button" class="splus-btn" data-sa="pay">Inscrever-se</button><button type="button" class="splus-btn ghost" data-sa="pay">Presentear Plus</button></div>`;
  }
});
SET.acts.pay = () => toast('Pagamentos ainda não estão disponíveis na Square.');

/* ============================================================ IMPULSO */
page({ id: 'boost', label: 'Impulso de servidor', title: 'Impulso de servidor', icon: 'boost', kw: 'boost nível servidor',
  render() {
    const sv = servers();
    const gem = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 4v8l-7 8-7-8V6z" fill="#E040A0"/><path d="M12 2l7 4-7 4-7-4z" fill="#F58AC8"/></svg>';
    const tr = (a, b, c, d) => `<div class="sbt-r"><span>${a}</span><b>${b}</b><b>${c}</b><b>${d}</b></div>`;
    const ok = tickI;
    const faq = [['O que é um impulso de servidor?', 'É uma forma de apoiar um servidor e liberar vantagens para todos os membros dele.'], ['Como eu impulsiono um servidor?', 'Quando os impulsos estiverem disponíveis, você escolherá o servidor e confirmará. Ainda não é possível.'], ['Posso impulsionar um servidor várias vezes?', 'Sim, quando os impulsos chegarem à Square, cada impulso extra ajudará o servidor a subir de nível.'], ['Posso continuar impulsionando um servidor depois que ele chegar ao nível 3?', 'Sim. Impulsos extras continuam ajudando o servidor.'], ['O que são “vantagens adicionais” e como diferem dos níveis?', 'São vantagens opcionais que o servidor pode liberar além das dos níveis. Ainda não existem na Square.'], ['Quanto custam as novas vantagens adicionais?', 'Os preços ainda não foram definidos.'], ['As vantagens adicionais estão substituindo o sistema atual de nível dos servidores?', 'Não. Os dois sistemas vão existir lado a lado.'], ['As vantagens adicionais usam impulsos separados do nível do meu servidor?', 'Ainda não foi definido.'], ['As vantagens adicionais são uma compra única, ou precisam de impulsos contínuos?', 'Ainda não foi definido.']];
    return `<div class="sboost-top"><div><h2 class="sh2 big">${gem} Impulsos de servidor</h2><p class="sdesc">Impulsionar um servidor desbloqueia vantagens para todos nesse servidor. Você pode gerenciar seus impulsos aqui (adicionar, remover, cancelar — só não se esqueça do tempo de espera de 7 dias). <a class="lnk" href="#" data-sa="soon">Saiba mais</a></p></div><button type="button" class="svid" data-sa="soon" aria-label="Como os impulsos funcionam? Reproduzir vídeo"><b>Como os impulsos funcionam?</b><span class="play"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="#1D1D22"/></svg></span></button></div>
${sv.length ? `<b class="sgl big">Estes servidores precisam de um impulso</b><div class="sbsl">${sv.slice(0, 10).map((s) => `<div class="sbsv"><span class="stl" style="background:${esc(s.tile || '#C9B8F0')}">${esc(s.ini || '')}</span><span class="stx"><b>${esc(s.name)}</b><small class="sgem">${gem.replace('20', '12')} Nenhum impulso</small></span><button type="button" class="sbtn" data-sa="soon">${gem.replace('20', '14')} Impulsionar esse servidor</button></div>`).join('')}</div>` : ''}
<div class="sbt">${tr('', '', '', '').replace('<span></span><b></b><b></b><b></b>', '<span>Qualidade de áudio</span><b>128kbps</b><b>256kbps</b><b>384kbps</b>')}${tr('Limite de tamanho dos envios', '10MB', '50MB', '100MB')}${tr('Assentos no palco de vídeo', '50', '150', '300')}${tr('Ícone animado do servidor', ok, ok, ok)}${tr('Plano de fundo do convite do servidor', ok, ok, ok)}${tr('Faixa do servidor', crossI, 'Estática', 'Com animação')}${tr('Ícones de cargos personalizados', crossI, ok, ok)}${tr('Link de convite personalizado', crossI, crossI, ok)}</div>
<h3 class="splus-h3 left">Dê um impulso na sua comunidade e seja reconhecido(a)</h3>
<div class="sbcards"><div><span class="bi"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#62626D" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 8l3 1.7v3.6L12 15l-3-1.7V9.7z"/></svg></span>Mostre seu apoio com um ícone na lista de membros</div><div><span class="bi"><svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.4 5.2 5.6.7-4.1 3.9 1 5.6L12 15.6 7.1 18.4l1-5.6L4 8.9l5.6-.7z" fill="#F58AC8"/></svg></span>Desbloqueie uma nova insígnia de perfil que evolui com o tempo</div><div><span class="bi"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#62626D" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><circle cx="12" cy="10" r="2.2"/><path d="M8 16c1-1.8 2.3-2.5 4-2.5s3 .7 4 2.5"/></svg></span>Receba um cargo exclusivo de impulsionador(a)</div><div><span class="bi"><svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" fill="#B8B8C2"/></svg></span>Mostre apoio à sua comunidade</div></div>
<h3 class="splus-h3 left">Perguntas frequentes sobre impulsos</h3>
<div class="sfaq">${faq.map((f, i) => `<div class="sfq"><button type="button" class="sfqh" data-sa="toggle-open" data-id="fq${i}" aria-expanded="${SET.isOpenSec('fq' + i)}"><span>${esc(f[0])}</span><svg class="chev${SET.isOpenSec('fq' + i) ? ' up' : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#33333A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>${SET.isOpenSec('fq' + i) ? `<p>${esc(f[1])}</p>` : ''}</div>`).join('')}</div>`;
  }
});

/* ============================================================ ASSINATURAS / PRESENTES / COBRANÇA */
page({ id: 'subs', label: 'Assinaturas', title: 'Assinaturas', icon: 'subs', kw: 'plano crédito',
  render() {
    return `${h2('sb-a', 'Suas assinaturas', 'Estas são suas assinaturas atuais. Elas são cobradas no mesmo ciclo de cobrança. Você pode alterar qualquer uma delas a qualquer momento.')}
${box(`<span class="sdice">${dice}</span><b>${paid() ? 'Square Plus (concedido pela equipe)' : 'Você não tem assinaturas ativas'}</b>`, 'row')}
${h2('sb-b', 'Crédito de assinatura', 'Quando você aceita um presente enquanto tem uma assinatura ativa, resgata uma promoção ou se aceita um presente diferente da sua assinatura atual, ele aparece aqui como crédito.')}
${box(`<span class="sdice">${dice}</span><b>Você não tem créditos para usar</b>`, 'row')}
<hr class="shr">`;
  }
});
page({ id: 'gifts', label: 'Inventário de presentes', title: 'Inventário de presentes', icon: 'gifts', kw: 'presente gift',
  render() { return `${h2('gf', 'Inventário de presentes', 'Presentes que você recebeu aparecem aqui. Você poderá resgatá-los ou dá-los a um amigo.')}${box(`<span class="sdice">${dice}</span><b>Você não tem presentes para resgatar</b>`, 'row')}`; }
});
page({ id: 'billing', label: 'Cobrança', title: 'Cobrança', icon: 'billing', kw: 'pagamento cartão transações',
  subs: [{ id: 'bl-pay', label: 'Métodos de pagamento' }, { id: 'bl-hist', label: 'Histórico de transações' }],
  render() {
    return `${h2('bl-pay', 'Métodos de pagamento')}<p class="sdesc">País/região: Brasil <span class="sinfo-i" title="Definido pelo idioma do seu navegador">i</span></p>
<div class="srow big"><div class="stx"><b>Nenhum método de pagamento salvo</b><small>Salve um método de pagamento para concluir seus pedidos mais rapidamente</small></div><button type="button" class="sbtn primary" data-sa="pay">Adicionar método de pagamento</button></div>
${hr()}${h2('bl-hist', 'Histórico de transações')}<p class="sdesc">Você ainda não fez nenhuma transação.</p>`;
  }
});

/* ===================================================== ATIVIDADES / APPS / DEV */
page({ id: 'activity', label: 'Privacidade nas atividades', title: 'Privacidade nas atividades', icon: 'activity', kw: 'atividade jogo compartilhar',
  render() {
    const off = SET.getState('actOff') || {};
    return `${h2('ac', 'Privacidade nas atividades', 'Controle como sua atividade de jogo e app é compartilhada — o que é visível e quem a vê.')}
${tg('act_share', 'Compartilhar minha atividade', 'Permite que amigos e servidores vejam o que você está fazendo na Square, como a música que está ouvindo.')}
${servers().length ? `<b class="sgl">Compartilhar atividade com estes servidores</b>${servers().map((s) => `<div class="srow sub"><div class="stx"><b>${esc(s.name)}</b></div><button type="button" class="stg${off[s.id] ? '' : ' on'}" role="switch" aria-checked="${!off[s.id]}" data-sa="act-srv" data-id="${esc(s.id)}" aria-label="${esc(s.name)}"><i></i></button></div>`).join('')}` : ''}`;
  }
});
SET.acts['act-srv'] = (t) => { const off = Object.assign({}, SET.getState('actOff') || {}); const id = t.dataset.id; if (off[id]) delete off[id]; else off[id] = 1; SET.setState('actOff', off); SET.setP('act_off', off); SET.redraw(); };

const APPS = [['Riot Games', '#D32F2F'], ['Battle.net', '#1D6FD8'], ['Bluesky', '#2E8BF0'], ['Letterboxd', '#3D8F4F'], ['PayPal', '#1A3D8F'], ['Reddit', '#E8480C'], ['Steam', '#1B2838'], ['X', '#111'], ['eBay', '#C23A2A'], ['Crunchyroll', '#E8700C'], ['PlayStation', '#1F3FA8'], ['Spotify', '#1DB954'], ['Xbox', '#107C10'], ['Amazon Music', '#25C2D8'], ['Bungie', '#3A4650'], ['Site', '#4A4A5A'], ['Epic Games', '#2A2A32'], ['Facebook', '#1877F2'], ['GitHub', '#24292F'], ['Roblox', '#2A2A32'], ['Twitch', '#7B3FE4'], ['YouTube', '#E02020']];
page({ id: 'apps', label: 'Apps conectados', title: 'Apps conectados', icon: 'apps', kw: 'conexões contas steam spotify',
  subs: [{ id: 'ap-con', label: 'Conexões' }, { id: 'ap-auth', label: 'Aplicativos autorizados' }],
  render() {
    return `${h2('ap-con', 'Conexões', 'Estas são contas de outras plataformas. Conectá-las aqui pode desbloquear novos recursos na Square, como a capacidade de compartilhar o que você está ouvindo atualmente, receber pagamentos de forma segura e muito mais.')}
<b class="sgl">Adicionar uma nova conexão</b>
<div class="sapps">${APPS.map((a) => `<button type="button" class="sapp" data-sa="connect" data-id="${esc(a[0])}" title="${esc(a[0])}" aria-label="Conectar ${esc(a[0])}" style="--c:${a[1]}"><span>${esc(a[0].charAt(0))}</span></button>`).join('')}</div>
<div class="sempty"><b>Sem conexões</b><small>Conecte suas contas para desbloquear integrações especiais da Square</small></div>
${hr()}${h2('ap-auth', 'Aplicativos autorizados', 'Apps que você autorizou a acessar sua conta aparecem aqui.')}
<div class="sempty"><b>Nenhum aplicativo autorizado</b><small>Quando você autorizar um app, ele aparece nesta lista.</small></div>`;
  }
});
SET.acts.connect = (t) => toast('Conectar ' + t.dataset.id + ' ainda não está disponível.');

page({ id: 'dev', label: 'Desenvolvedor', title: 'Desenvolvedor', icon: 'dev', kw: 'api id modo desenvolvedor',
  render() { return `${h2('dv', 'Desenvolvedor', 'Ferramentas para quem constrói em cima da Square.')}${tg('dev_mode', 'Modo desenvolvedor', 'Mostra identificadores (IDs) em locais como o cartão de perfil. Ainda não existe uma API pública da Square.')}`; }
});
})();
