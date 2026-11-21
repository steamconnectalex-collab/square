(() => {
'use strict';
const SET = window.SQ_SET;
const { esc, h2, hr, tg, rd, sel, range, btnRow, link, info, expand } = SET;
const api = () => window.SQ_API || {};
const P = SET.P;
const toast = (t) => SET.toast(t);
const page = (o) => SET.pages.push(o);
const paid = () => { const a = api(); return !!(a.plan && a.plan() && a.plan() !== 'free'); };
const servers = () => { const a = api(); return (a.servers && a.servers()) || []; };
const lock = '<svg class="slock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B3B96" stroke-width="2" stroke-linecap="round" aria-label="Square Plus"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>';
const srvOpts = () => [['all', 'Todos os servidores']].concat(servers().map((s) => [s.id, s.name]));
const fxRow = (k, label) => `<div class="srow fx"><div class="stx"><b>${esc(label)}</b><button type="button" class="sinl" data-sa="fx-prev" data-id="${k.replace('fx_', '')}">Prévia do som</button></div><button type="button" class="stg" role="switch" data-k="${k}" aria-checked="false" aria-label="${esc(label)}"><i></i></button></div>`;

/* ======================================================== VOZ E VÍDEO */
const FX_MORE = [['fx_join', 'Entrar no canal de voz'], ['fx_leave', 'Sair do canal de voz'], ['fx_cam_on', 'Câmera ligada'], ['fx_cam_off', 'Câmera desligada'], ['fx_disconnect', 'Voz desconectada']];
page({ id: 'voice', label: 'Voz e vídeo', title: 'Voz e vídeo', kw: 'microfone áudio som volume dispositivo',
  subs: [{ id: 'vc-voice', label: 'Voz' }, { id: 'vc-stream', label: 'Transmissão' }, { id: 'vc-sounds', label: 'Sons' }, { id: 'vc-fx', label: 'Painel de efeitos sonoros' }, { id: 'vc-adv', label: 'Avançado' }],
  render() {
    const din = SET.getState('devIn') || [['default', 'Padrão do sistema']], dout = SET.getState('devOut') || [['default', 'Padrão do sistema']];
    return `${h2('vc-voice', 'Voz')}
${sel('in_device', 'Dispositivo de entrada', '', din)}
${sel('out_device', 'Dispositivo de saída', '', dout)}
${range('out_vol', 'Volume de saída', 'Volume das pessoas que você ouve nos canais de voz.', { min: 0, max: 100, step: 5, fmt: 'pct' })}
${rd('input_profile', 'Perfil de entrada', '', [['isolation', 'Isolamento de Voz', 'Só a sua linda voz: deixe a Square equalizar o ruído'], ['studio', 'Estúdio', 'Áudio puro: microfone aberto e sem processamento'], ['custom', 'Personalizado', 'Modo avançado: me dê todos os botões e mostradores!']])}
${range('sens', 'Sensibilidade de entrada', 'Controla quanto som a Square transmite do seu microfone.', { min: 0, max: 100, cls: 'sens' })}
${sel('noise', 'Supressão de ruído', 'Reduz o ruído de fundo do seu microfone. Fornecido pelo seu navegador.', [['standard', 'Padrão do navegador'], ['off', 'Desativada']])}
${tg('echo', 'Cancelamento de eco', '')}
${tg('ptt', 'Apertar para Falar (limitado)', '')}
${expand('vadv', 'Mostrar Configurações de Voz Avançadas', 'Controle automático do microfone, Detecção de voz avançada e Aviso de Troca de Canal de Voz', `${tg('auto_gain', 'Controle automático do microfone', '')}${tg('adv_vad', 'Detecção de voz avançada', '')}${tg('warn_switch', 'Aviso de Troca de Canal de Voz', '')}`)}
${hr()}
${h2('vc-stream', 'Transmissão')}
${tg('transmit_preview', 'Mostrar Prévias da transmissão', 'Permite que outros vejam uma prévia da sua transmissão antes de se juntarem.')}
${hr()}
${h2('vc-sounds', 'Sons')}
${sel('join_server', 'Escolha um servidor', '', srvOpts())}
<div class="sgrp"><label class="sgl" for="sel-join_sound">Escolha um som ${lock}</label><div class="ssound"><select id="sel-join_sound" class="ssel" data-k="join_sound"><option value="none">Nenhum</option><option value="bell">Campainha</option><option value="drop">Gota</option><option value="pulse">Pulso</option></select><button type="button" class="sbtn sq" data-sa="entry-prev" aria-label="Ouvir o som">${'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#33333A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 0 1 0 6"/></svg>'}</button></div></div>
${hr()}
${h2('vc-fx', 'Painel de efeitos sonoros')}
${range('fx_vol', 'Volume dos efeitos sonoros', 'Controle o volume dos sons para você individualmente. <a class="lnk" href="#" data-sa="soon">Saiba mais sobre o volume dos efeitos sonoros.</a>', { min: 0, max: 100, step: 5, fmt: 'pct' })}
<b class="sgl big">Sons de entrada</b><small class="sgd">Escolha um som dos efeitos sonoros para ser reproduzido automaticamente sempre que você entrar em um canal de voz. <a class="lnk" href="#" data-sa="soon">Saiba mais.</a></small>
${sel('join_server', 'Escolha um servidor', '', srvOpts())}
${fxRow('fx_deaf', 'Desativar áudio')}${fxRow('fx_undeaf', 'Reativar áudio')}${fxRow('fx_mute', 'Silenciar')}${fxRow('fx_unmute', 'Dessilenciar')}
${expand('fxmore', 'Mostrar ' + FX_MORE.length + ' mais sons', 'Câmera ligada, Câmera desligada, Voz desconectada e mais', FX_MORE.map((x) => fxRow(x[0], x[1])).join(''))}
<p class="srel">Configurações relacionadas</p>
${link('Notificações', 'Ativar/desativar sons para novas mensagens e chamadas recebidas.', 'notif', 'notif')}
${hr()}
${h2('vc-adv', 'Avançado')}
${btnRow('Redefinir todas as configurações de Voz e vídeo', 'Voltar ao conjunto padrão das configurações de Voz e vídeo.', 'Redefinir', 'vreset', 'dangerghost')}`;
  },
  after() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices || SET.getState('devLoaded')) return;
    SET.setState('devLoaded', true);
    navigator.mediaDevices.enumerateDevices().then((ds) => {
      const mk = (kind) => [['default', 'Padrão do sistema']].concat(ds.filter((d) => d.kind === kind && d.deviceId && d.deviceId !== 'default').map((d, i) => [d.deviceId, d.label || (kind === 'audioinput' ? 'Microfone ' : 'Saída ') + (i + 1)]));
      SET.setState('devIn', mk('audioinput')); SET.setState('devOut', mk('audiooutput')); SET.redraw();
    }).catch(() => {});
  }
});
SET.acts['fx-prev'] = (t) => SET.fx(t.dataset.id, true);
SET.acts['entry-prev'] = () => { const s = SET.tones[P('join_sound')]; if (!s) { toast('Escolha um som primeiro.'); return; } SET.entrySound(); };
SET.acts.vreset = () => { SET.resetKeys(['in_device', 'out_device', 'out_vol', 'input_profile', 'sens', 'noise', 'echo', 'ptt', 'auto_gain', 'adv_vad', 'warn_switch', 'transmit_preview', 'join_server', 'join_sound', 'fx_vol', 'fx_mute', 'fx_unmute', 'fx_deaf', 'fx_undeaf', 'fx_join', 'fx_leave', 'fx_cam_on', 'fx_cam_off', 'fx_disconnect']); toast('Configurações de voz e vídeo redefinidas'); };

/* ============================================================ APARÊNCIA */
const ICONS = SET.ICON_COLORS;
page({ id: 'look', label: 'Aparência', title: 'Aparência', kw: 'tema ícone mensagens streamer',
  subs: [{ id: 'lk-theme', label: 'Tema' }, { id: 'lk-icon', label: 'Ícone do aplicativo' }, { id: 'lk-msgs', label: 'Mensagens' }, { id: 'lk-chat', label: 'Caixa de chat' }, { id: 'lk-search', label: 'Buscar' }, { id: 'lk-stream', label: 'Modo streamer' }],
  render() {
    const unlocked = paid();
    const compact = P('chat_display') === 'compact';
    return `${h2('lk-theme', 'Tema')}
${rd('theme', '', '', [['light', 'Claro', 'O visual da Square.'], ['dark', 'Escuro', 'Em breve.']])}
${tg('sync_theme', 'Sincronizar tema em meus dispositivos', '')}
${tg('theme_others', 'Aplicar tema aos perfis de outros usuários', '')}
<p class="srel">Configurações relacionadas</p>
${link('Acessibilidade', 'Altere a saturação de cores, habilite modos de alto contraste e muito mais', 'access', 'access')}
${hr()}
${h2('lk-icon', 'Ícone do aplicativo')}
<div class="sicohead"><p class="sdesc">Altere o ícone da Square (aba do navegador), somente com Square Plus.</p><div class="sicoact"><button type="button" class="sbtn" data-sa="icon-prev">Ícone de prévia</button><button type="button" class="sbtn white" data-sa="pay">${lock} ${unlocked ? 'Square Plus ativo' : 'Desbloquear com Square Plus'}</button></div></div>
<div class="sicons">${ICONS.map((c, i) => `<button type="button" class="sicon" data-k="app_icon" data-v="${i}" ${i && !unlocked ? 'data-lock="1" ' : ''}aria-label="Ícone ${i + 1}" aria-pressed="false">${SET.iconSvg(i)}<span class="chk"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></button>`).join('')}</div>
${hr()}
${h2('lk-msgs', 'Mensagens')}
<b class="sgl">Mostrar imagens, vídeos e memes…</b>
${tg('msg_links', 'Quando publicados como links no chat.', '')}${tg('msg_upload', 'Quando o envio é feito diretamente à Square.', '')}${tg('msg_attach', 'Mostrar anexos e prévia de links', '')}${tg('msg_react', 'Mostrar reações de emoji', '')}
${sel('spoilers', 'Mostrar spoilers', '', [['click', 'Ao clicar'], ['mod', 'Em servidores que modero'], ['always', 'Sempre']])}
${tg('threads_split', 'Abrir tópicos em janela dividida', '')}
<div class="srow"><div class="stx"><b>Mostrar avatares dos usuários</b><small>Para ocultar avatares, acesse <a class="lnk" href="#" data-sa="goto" data-id="access">Acessibilidade</a> e selecione Compacto em Exibição das mensagens de chat.</small></div><button type="button" class="stg${compact ? '' : ' on'}" role="switch" aria-checked="${!compact}" disabled aria-label="Mostrar avatares dos usuários"><i></i></button></div>
${tg('fav_servers', 'Mostrar servidores favoritos <em class="sbeta">BETA</em>'.replace(/<[^>]+>/g, ''), 'Seus favoritos permanecem salvos, mesmo que você desative isso. <a class="lnk" href="#" data-sa="soon">Saiba mais.</a>')}
${hr()}
${h2('lk-chat', 'Caixa de chat')}
${tg('send_btn', 'Mostrar botão de enviar mensagem', '')}
${hr()}
${h2('lk-search', 'Buscar')}
${rd('search_scope', 'Por padrão, buscando nas mensagens diretas…', '', [['selected', 'Busca apenas nas mensagens diretas selecionadas'], ['all', 'Busca em todas as minhas mensagens diretas']])}
${hr()}
${h2('lk-stream', 'Modo streamer')}
${tg('streamer', 'Ativar modo streamer', 'O modo streamer oculta suas informações pessoais para que outros assistindo à sua transmissão não possam vê-las.')}
<b class="sgl">Se o modo streamer estiver habilitado…</b>
${tg('s_hide_personal', 'Ocultar meus dados pessoais, como e-mail, contas conectadas e notas', '')}${tg('s_hide_invite', 'Ocultar links de convite para meus servidores da Square', '')}${tg('s_mute_sfx', 'Desativar todos os efeitos de som', '')}${tg('s_mute_notif', 'Desativar notificações', '')}`;
  }
});
SET.acts['icon-prev'] = () => { const n = (Number(P('app_icon')) || 0); toast('Este é o ícone em uso: ' + (n + 1) + ' de ' + SET.ICON_COLORS.length + '. Veja na aba do navegador.'); };

/* ======================================================== ACESSIBILIDADE */
page({ id: 'access', label: 'Acessibilidade', title: 'Acessibilidade', kw: 'zoom fonte saturação movimento leitor tela',
  subs: [{ id: 'ac-text', label: 'Legibilidade do texto' }, { id: 'ac-dens', label: 'Densidade visual' }, { id: 'ac-color', label: 'Cor e contraste' }, { id: 'ac-motion', label: 'Movimento Reduzido' }, { id: 'ac-audio', label: 'Áudio e leitor de tela' }],
  render() {
    const pct = (a, b, v) => ((v - a) / (b - a)) * 100;
    return `${h2('ac-text', 'Legibilidade do texto')}
${range('chat_fs', 'Tamanho do texto no chat', 'Ajuste o tamanho das letras nas mensagens.', { min: 12, max: 24, step: 2, fmt: 'px', ticks: ['12px', '14px', '16px', '18px', '20px', '22px', '24px'] })}
${range('zoom', 'Zoom do aplicativo', 'Aumenta ou diminui tudo na tela.', { min: 75, max: 150, step: 25, fmt: 'pct', ticks: ['75%', '100%', '125%', '150%'] })}
${hr()}
${h2('ac-dens', 'Densidade visual')}
${rd('side_density', 'Espaçamento das listas', '', [['compact', 'Compacto'], ['default', 'Padrão'], ['roomy', 'Espaçoso']])}
${rd('chat_display', 'Exibição das mensagens de bate-papo', 'Mude a aparência das mensagens de bate-papo.', [['default', 'Padrão'], ['compact', 'Compacto']])}
${range('group_gap', 'Espaço entre grupos de mensagens', 'Ajuste o espaçamento entre grupos de mensagens.', { min: 0, max: 24, step: 4, fmt: 'px', ticks: [['0px', 0], ['4px', pct(0, 24, 4)], ['8px', pct(0, 24, 8)], ['16px', pct(0, 24, 16)], ['24px', 100]] })}
${hr()}
${h2('ac-color', 'Cor e contraste')}
${range('saturation', 'Saturação', 'Reduza a saturação de cores dentro do app para pessoas com sensibilidade a cores. Isso não afeta a saturação de imagem, vídeo, cores dos cargos ou outros conteúdos de usuário.', { min: 0, max: 100, step: 10, fmt: 'pct', ticks: ['0%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'] })}
<small class="sgd">Em formulários, menus e configurações, as opções de ligar/desligar terão ícones.</small>
<p class="srel">Configurações relacionadas</p>
${link('Aparência', 'Alterar o tema do seu aplicativo', 'look', 'look')}
${hr()}
${h2('ac-motion', 'Movimento Reduzido')}
${tg('reduce_motion', 'Ativar movimento reduzido', 'Reduz a quantidade e a intensidade de animações, efeitos de cursor e outros efeitos de movimento. <a class="lnk" href="#" data-sa="soon">Saiba mais.</a>')}
${tg('sync_motion', 'Sincronizar com computador', '')}
${range('notif_ms', 'Duração mínima da notificação', 'Mantenha notificações na tela por pelo menos, no mínimo, este intervalo. Notificações que permanecem por mais tempo não serão afetadas.', { min: 3, max: 20, step: 1, fmt: 's', ticks: [['3s', 0], ['5s', pct(3, 20, 5)], ['10s', pct(3, 20, 10)], ['15s', pct(3, 20, 15)], ['20s', 100]] })}
${tg('play_gifs', 'Reproduzir GIFs quando a Square estiver em primeiro plano', '')}
${tg('play_emoji', 'Reproduzir emojis animados.', '')}
${rd('stickers', 'Jogar animações de figurinha', '', [['always', 'Animar sempre'], ['hover', 'Animar ao interagir', 'No cliente de área de trabalho, figurinhas são animadas quando focadas ou quando o cursor passa sobre elas. Em clientes móveis, as figurinhas se animam com um toque longo.'], ['never', 'Nunca animar']])}
${hr()}
${h2('ac-audio', 'Áudio e leitor de tela')}
${range('tts_rate', 'Taxa de texto-para-voz', 'Controle a velocidade em que o texto é lido em voz alta ao usar o Falar Mensagem ou outras funcionalidades de texto-para-voz.', { min: 0.5, max: 3, step: 0.25, fmt: 'x', marks: true, ends: ['Mais devagar', 'Mais rápido'] })}
<button type="button" class="sbtn primary sm" data-sa="tts-prev">▶ Prévia</button>
${tg('img_desc', 'Mostrar descrições de imagens', 'Descrições de imagens são usadas para descrever as imagens para leitores de tela.')}
${tg('plain_input', 'Use entrada de chat padrão', 'Desativa a maioria dos recursos de chat, mas funciona melhor com leitores de tela.')}`;
  }
});
SET.fmt.s = (v) => v + 's';
SET.acts['tts-prev'] = () => {
  if (!('speechSynthesis' in window)) { toast('Este navegador não lê texto em voz alta.'); return; }
  const u = new SpeechSynthesisUtterance('Esta é uma prévia da leitura em voz alta da Square.'); u.lang = 'pt-BR'; u.rate = Number(P('tts_rate')) || 1;
  window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
};

/* ============================================================== SISTEMA */
const K = (...a) => a;
const nav1 = [['Navegar entre servidores', K('CTRL', 'ALT', '↑'), K('CTRL', 'ALT', '↓')], ['Navegar entre canais', K('ALT', '↑'), K('ALT', '↓')], ['Voltar ou avançar no histórico de páginas', K('ALT', '←'), K('ALT', '→')], ['Navegar entre canais não lidos', K('ALT', 'SHIFT', '↑'), K('ALT', 'SHIFT', '↓')], ['Navegar entre canais com menções não lidas', K('CTRL', 'SHIFT', 'ALT', '↑'), K('CTRL', 'SHIFT', 'ALT', '↓')], ['Navegar para ligação atual', K('CTRL', 'SHIFT', 'ALT', 'V')], ['Alterne entre o último servidor e mensagens diretas', K('CTRL', 'ALT', '→')], ['Ativar/desativar busca rápida', K('CTRL', 'K')], ['Criar ou entrar em um servidor', K('CTRL', 'SHIFT', 'N')]];
const nav2 = [['Marcar como não lido', K('ALT', 'ENTER')], ['Focalizar área de texto', K('ESC')], ['Marcar servidor como lido', K('SHIFT', 'ESC')], ['Marcar canal como lido', K('ESC')], ['Criar um grupo privado', K('CTRL', 'SHIFT', 'T')], ['Criar um tópico', K('CTRL', 'SHIFT', 'ALT', 'N')], ['Abrir/fechar mural de fixações', K('CTRL', 'P')], ['Abrir/fechar mural da caixa de entrada', K('CTRL', 'I')], ['Marcar canais da caixa de entrada como lidos', K('CTRL', 'SHIFT', 'E')], ['Ativar/Desativar lista de membros do canal ou chat de texto nos canais de voz', K('CTRL', 'U')]];
const dnd = [['Começar Arraste e Solte', K('CTRL', 'D')], ['Mover', K('↑'), K('↓')], ['Soltar item', K('SPACEBAR'), K('ENTER')], ['Cancelar', K('ESC')]];
const chat = [['Alternar painel de som', K('CTRL', 'SHIFT', 'B')]];
const misc = [['Obter ajuda', K('CTRL', 'SHIFT', 'H')], ['Buscar', K('CTRL', 'F')], ['Abrir menu contextual', K('SHIFT', 'F10')]];
const shGroup = (rows) => `<div class="sksl">${rows.map((r) => `<div class="sks"><span>${esc(r[0])}</span><span class="skc">${r.slice(1).map((c) => `<span class="skk">${c.map((k) => `<kbd>${esc(k)}</kbd>`).join('')}</span>`).join('')}</span></div>`).join('')}</div>`;
page({ id: 'system', label: 'Sistema', title: 'Sistema', kw: 'atalhos teclado',
  subs: [{ id: 'sy-custom', label: 'Atalhos do teclado personalizados' }, { id: 'sy-std', label: 'Atalhos padrão' }],
  render() {
    return `${h2('sy-custom', 'Atalhos do teclado personalizados')}
<h3 class="sh3">Navegação</h3>${shGroup(nav1)}${shGroup(nav2)}
${hr()}
${h2('sy-std', 'Atalhos padrão')}
<h3 class="sh3">Arraste e solte</h3><small class="sgd">Estes atalhos funcionam quando um item arrastável estiver em foco</small>${shGroup(dnd)}
<h3 class="sh3">Chat</h3>${shGroup(chat)}
<h3 class="sh3">Diversos</h3>${shGroup(misc)}`;
  }
});

/* ======================================================= IDIOMA E HORÁRIO */
const flag = (cc) => cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
const LANGS = [['bg', 'bg', 'Български', 'Búlgaro'], ['cs', 'cz', 'Čeština', 'Tcheco'], ['da', 'dk', 'Dansk', 'Dinamarquês'], ['de', 'de', 'Deutsch', 'Alemão'], ['el', 'gr', 'Ελληνικά', 'Grego'], ['en-GB', 'gb', 'English (UK)', 'Inglês (Reino Unido)'], ['en-US', 'us', 'English (US)', 'Inglês (EUA)'], ['es-ES', 'es', 'Español', 'Espanhol'], ['es-419', 'mx', 'Español (América Latina)', 'Espanhol (América Latina)'], ['fi', 'fi', 'Suomi', 'Finlandês'], ['fr', 'fr', 'Français', 'Francês'], ['hi', 'in', 'हिंदी', 'Hindi'], ['hr', 'hr', 'Hrvatski', 'Croata'], ['hu', 'hu', 'Magyar', 'Húngaro'], ['it', 'it', 'Italiano', 'Italiano'], ['ja', 'jp', '日本語', 'Japonês'], ['ko', 'kr', '한국어', 'Coreano'], ['lt', 'lt', 'Lietuviškai', 'Lituano'], ['nl', 'nl', 'Nederlands', 'Holandês'], ['no', 'no', 'Norsk', 'Norueguês'], ['pl', 'pl', 'Polski', 'Polonês'], ['pt-BR', 'br', 'Português do Brasil', 'Português, Brasil'], ['ro', 'ro', 'Română', 'Romeno'], ['ru', 'ru', 'Русский', 'Russo'], ['sv', 'se', 'Svenska', 'Sueco'], ['th', 'th', 'ไทย', 'Tailandês'], ['tr', 'tr', 'Türkçe', 'Turco'], ['uk', 'ua', 'Українська', 'Ucraniano'], ['vi', 'vn', 'Tiếng Việt', 'Vietnamita'], ['zh-CN', 'cn', '中文', 'Chinês'], ['zh-TW', 'tw', '繁體中文', 'Chinês (Taiwan)']];
page({ id: 'lang', label: 'Idioma e Horário', title: 'Idioma e Horário', kw: 'idioma língua hora 12 24',
  render() {
    const cur = LANGS.find((l) => l[0] === P('lang')) || LANGS[21], open = !!SET.langOpen;
    const chev = `<svg class="chev${open ? ' up' : ''}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#33333A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
    return `<div class="sgrp"><b class="sgl big">Selecione um idioma</b><small class="sgd">Escolha o idioma que você quer que a Square exiba.</small>
<div class="slang"><button type="button" class="slangb${open ? ' open' : ''}" data-sa="lang-toggle" aria-haspopup="listbox" aria-expanded="${open}"><span class="fl">${flag(cur[1])}</span><span class="n">${esc(cur[2])}</span><span class="e">${open ? '' : esc(cur[3])}</span>${chev}</button>${open ? `<div class="slangl" role="listbox" id="slangl" tabindex="-1">${LANGS.map((l) => `<button type="button" role="option" class="slango${l[0] === cur[0] ? ' on' : ''}" aria-selected="${l[0] === cur[0]}" data-sa="lang-pick" data-id="${l[0]}"><span class="fl">${flag(l[1])}</span><span class="n">${esc(l[2])}</span><span class="e">${esc(l[3])}</span>${l[0] === cur[0] ? '<svg class="ck" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D1D22" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</button>`).join('')}</div>` : ''}</div></div>
${rd('time_fmt', 'Formato de tempo', '', [['auto', 'Auto'], ['12', '12 horas'], ['24', '24 horas']])}`;
  },
  after(root) { const l = root.querySelector('#slangl'); if (l) { const on = l.querySelector('.on'); if (on) l.scrollTop = Math.max(0, on.offsetTop - 80); } }
});
SET.acts['lang-toggle'] = () => { SET.langOpen = !SET.langOpen; SET.redraw(); };
SET.acts['lang-pick'] = (t) => {
  SET.langOpen = false;
  if (t.dataset.id !== 'pt-BR') { SET.redraw(); toast('A Square só está disponível em português do Brasil por enquanto.'); return; }
  SET.setP('lang', 'pt-BR'); SET.redraw();
};
})();
