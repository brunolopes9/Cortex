/* ==========================================================================
   Os emails que saem daqui.

   São dois, com públicos opostos:

     paraCliente()   o que a pessoa recebe. É o que prometemos no site,
                     por isso tem de chegar à caixa de entrada e tem de
                     parecer escrito por gente.

     avisoInterno()  o que nos chega a nós. Só precisa de ser legível e
                     rápido de ler no telemóvel.

   Decisões que explicam o desenho:

   Fundo claro, não escuro. O Outlook e o Hotmail desenham email com o
   motor do Word: fundos escuros partem-se, as bordas saem a branco e o
   resultado fica pior do que não ter desenho nenhum.

   Tabelas e estilos em linha. Não é código antigo por descuido — é a
   única coisa que o Outlook desenha bem.

   Os relatórios vão em ligação, não em anexo. Juntos pesam 17,5 MB, que
   depois de codificados passam a cerca de 23 MB. O Hotmail rejeita ou
   atira para o lixo quase tudo nessa dimensão — era justamente isso que
   queríamos deixar de acontecer.
   ========================================================================== */

export const SITE = (process.env.SITE_URL || 'https://www.cortexautomationai.com').replace(/\/+$/, '');
const TRADES = process.env.TRADES_URL ||
  'https://drive.google.com/file/d/1WOmFFLdu6T02zZPMgdrlaCQ1e_dKw8KH/view?usp=sharing';
const ZAP = process.env.WHATSAPP || '351933938716';

/* Um email sem nome à frente do endereço chega à caixa de entrada como
   "contacto@..." — parece automático e conta contra nós nos filtros. */
export function remetente() {
  const m = process.env.MAIL_FROM || 'onboarding@resend.dev';
  return m.includes('<') ? m : 'Cortex Automation <' + m + '>';
}

export function enderecoRemetente() {
  const m = process.env.MAIL_FROM || 'onboarding@resend.dev';
  return (m.match(/<([^>]+)>/) || [null, m])[1];
}

export function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Um verde mais fundo que o do site: sobre branco, o #2EE08A não tem
   contraste que chegue para texto nem para botão. */
const VERDE = '#0E9F63';
const TINTA = '#15181C';
const CINZA = '#5C646E';
const FRACO = '#8A9199';
const LINHA = '#E4E7EA';
export const FONTE = '-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif';

/* O mesmo cartão branco para toda a correspondência que sai daqui: quem
   já recebeu um reconhece o seguinte antes de ler o assunto. */
export function envelope(interior, preheader) {
  return '<!doctype html><html lang="pt"><head><meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>Cortex Automation</title></head>' +
'<body style="margin:0;padding:0;background:#F4F6F7">' +
(preheader
  ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(preheader) +
    '&#8199;&#65279;'.repeat(60) + '</div>'
  : '') +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6F7">' +
'<tr><td align="center" style="padding:28px 14px">' +
'<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" ' +
'style="width:100%;max-width:600px;background:#ffffff;border-radius:14px">' +
'<tr><td style="padding:26px 30px 0">' +
'<p style="margin:0;font:600 15px/1 ' + FONTE + ';letter-spacing:-.01em;color:' + TINTA + '">' +
'Cortex&nbsp;Automation</p></td></tr>' +
'<tr><td style="padding:22px 30px 0">' + interior + '</td></tr>' +
'<tr><td style="padding:28px 30px 30px">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
'<tr><td style="border-top:1px solid ' + LINHA + ';padding-top:18px">' +
'<p style="margin:0 0 10px;font:12px/1.6 ' + FONTE + ';color:' + FRACO + '">' +
'Negociar com alavancagem envolve risco de perda de capital. Rentabilidade passada não ' +
'garante rentabilidade futura.</p>' +
'<p style="margin:0;font:12px/1.6 ' + FONTE + ';color:' + FRACO + '">' +
'Recebe este email porque autorizou o contacto em ' +
'<a href="' + SITE + '" style="color:' + FRACO + '">cortexautomationai.com</a>. ' +
'<a href="mailto:' + esc(enderecoRemetente()) + '?subject=SAIR" style="color:' + FRACO + '">' +
'Não quero receber mais nada</a>.</p>' +
'</td></tr></table></td></tr>' +
'</table></td></tr></table></body></html>';
}

function botao(href, texto) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td style="border-radius:8px;background:' + VERDE + '">' +
    '<a href="' + esc(href) + '" style="display:inline-block;padding:12px 22px;' +
    'font:600 14px/1 ' + FONTE + ';color:#ffffff;text-decoration:none">' +
    esc(texto) + '</a></td></tr></table>';
}

function cartao(numero, titulo, descricao, href, accao, nota) {
  return '<tr><td style="padding:0 0 14px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="border:1px solid ' + LINHA + ';border-radius:10px"><tr><td style="padding:20px 22px">' +
    '<p style="margin:0 0 5px;font:600 11px/1 ' + FONTE + ';letter-spacing:.1em;color:' + VERDE + '">' +
    'RELATÓRIO ' + numero + '</p>' +
    '<p style="margin:0 0 6px;font:600 17px/1.3 ' + FONTE + ';color:' + TINTA + '">' + esc(titulo) + '</p>' +
    '<p style="margin:0 0 16px;font:14px/1.6 ' + FONTE + ';color:' + CINZA + '">' + esc(descricao) + '</p>' +
    botao(href, accao) +
    (nota ? '<p style="margin:12px 0 0;font:13px/1.5 ' + FONTE + ';color:' + FRACO + '">' + esc(nota) + '</p>' : '') +
    '</td></tr></table></td></tr>';
}

/* ── O email do cliente ─────────────────────────────────────────────── */
export function paraCliente(nome, email) {
  const primeiro = esc(String(nome || '').split(/\s+/)[0] || 'Olá');
  const remetente = process.env.MAIL_FROM_EMAIL || 'contacto@cortexautomationai.com';

  const html =
'<!doctype html><html lang="pt"><head><meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>Os seus relatórios</title></head>' +
'<body style="margin:0;padding:0;background:#F4F6F7">' +

/* A linha que aparece na lista de emails, ao lado do assunto. Fica
   escondida dentro da mensagem. Os espaços invisíveis no fim impedem
   que o cliente de email vá buscar texto do cabeçalho para a completar. */
'<div style="display:none;max-height:0;overflow:hidden;opacity:0">' +
'Os três relatórios completos, prontos a abrir.' +
'&#8199;&#65279;'.repeat(60) + '</div>' +

'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6F7">' +
'<tr><td align="center" style="padding:28px 14px">' +
'<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" ' +
'style="width:100%;max-width:600px;background:#ffffff;border-radius:14px">' +

'<tr><td style="padding:26px 30px 0">' +
'<p style="margin:0;font:600 15px/1 ' + FONTE + ';letter-spacing:-.01em;color:' + TINTA + '">' +
'Cortex&nbsp;Automation</p></td></tr>' +

'<tr><td style="padding:22px 30px 0">' +
'<h1 style="margin:0 0 12px;font:700 25px/1.25 ' + FONTE + ';letter-spacing:-.02em;color:' + TINTA + '">' +
primeiro + ', aqui estão os seus relatórios.</h1>' +
'<p style="margin:0;font:15px/1.65 ' + FONTE + ';color:' + CINZA + '">' +
'São os três documentos completos, sem resumos e sem nada retirado. ' +
'Abrem no telemóvel e no computador.</p></td></tr>' +

'<tr><td style="padding:24px 30px 0">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +

cartao('1', 'Performance Overview',
  'A tecnologia por trás do sistema, os resultados ano a ano e a conta real desde Fevereiro de 2026.',
  SITE + '/assets/relatorio-performance.pdf', 'Abrir relatório', 'PDF · 10 MB') +

cartao('2', 'Resultados Trimestrais',
  'Cada trimestre em detalhe, de 2024 a 2026, com o mês a mês por trás de cada número.',
  SITE + '/assets/relatorio-trimestral.pdf', 'Abrir relatório', 'PDF · 7,5 MB') +

cartao('3', 'Histórico de Trades',
  'Todas as operações, uma a uma, desde o primeiro dia. É o documento que permite verificar tudo o resto.',
  TRADES, 'Abrir no Google Drive',
  'Ficheiro grande, vários GB. Descarregue com Wi-Fi e com espaço livre no aparelho.') +

'</table></td></tr>' +

/* Esta nota vai aqui e não no rodapé: é a informação que muda a leitura
   de tudo o que está nos relatórios, e no rodapé ninguém a lia. */
'<tr><td style="padding:8px 30px 0">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
'style="background:#F5F8F7;border-radius:10px"><tr><td style="padding:18px 20px">' +
'<p style="margin:0;font:14px/1.6 ' + FONTE + ';color:' + CINZA + '">' +
'<b style="color:' + TINTA + '">Antes de ler:</b> os resultados de 2024, 2025 e Janeiro de 2026 são ' +
'teste histórico sobre dados reais de mercado. A conta real começou em Fevereiro de 2026 e está ' +
'identificada como tal nos relatórios. Rentabilidade passada não garante rentabilidade futura.' +
'</p></td></tr></table></td></tr>' +

'<tr><td style="padding:26px 30px 0">' +
'<p style="margin:0 0 15px;font:15px/1.65 ' + FONTE + ';color:' + CINZA + '">' +
'Se ficar com dúvidas depois de ler, responda a este email ou fale connosco directamente. ' +
'Respondemos sempre.</p>' +
botao('https://wa.me/' + ZAP, 'Falar no WhatsApp') +
'</td></tr>' +

'<tr><td style="padding:28px 30px 30px">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
'<tr><td style="border-top:1px solid ' + LINHA + ';padding-top:18px">' +
'<p style="margin:0 0 10px;font:12px/1.6 ' + FONTE + ';color:' + FRACO + '">' +
'Negociar com alavancagem envolve risco de perda de capital. Os relatórios mostram os períodos ' +
'negativos e a maior queda registada. Leia-os antes de decidir seja o que for.</p>' +
'<p style="margin:0;font:12px/1.6 ' + FONTE + ';color:' + FRACO + '">' +
'Recebeu este email porque pediu os relatórios em ' +
'<a href="' + SITE + '" style="color:' + FRACO + '">cortexautomationai.com</a>. ' +
'<a href="mailto:' + esc(remetente) + '?subject=SAIR" style="color:' + FRACO + '">' +
'Não quero receber mais nada</a>.</p>' +
'</td></tr></table></td></tr>' +

'</table></td></tr></table></body></html>';

  /* A versão em texto não é um extra. Uma mensagem só com HTML é dos
     sinais que mais pesa contra quem envia — e há quem leia assim. */
  const texto =
primeiro + ', aqui estão os seus relatórios.\n\n' +
'São os três documentos completos, sem resumos e sem nada retirado.\n\n' +
'1. PERFORMANCE OVERVIEW (PDF, 10 MB)\n' +
'   A tecnologia, os resultados ano a ano e a conta real desde Fevereiro de 2026.\n' +
'   ' + SITE + '/assets/relatorio-performance.pdf\n\n' +
'2. RESULTADOS TRIMESTRAIS (PDF, 7,5 MB)\n' +
'   Cada trimestre em detalhe, de 2024 a 2026.\n' +
'   ' + SITE + '/assets/relatorio-trimestral.pdf\n\n' +
'3. HISTÓRICO DE TRADES (ficheiro grande, vários GB)\n' +
'   Todas as operações, uma a uma, desde o primeiro dia.\n' +
'   ' + TRADES + '\n\n' +
'ANTES DE LER\n' +
'Os resultados de 2024, 2025 e Janeiro de 2026 são teste histórico sobre dados reais\n' +
'de mercado. A conta real começou em Fevereiro de 2026 e está identificada como tal\n' +
'nos relatórios. Rentabilidade passada não garante rentabilidade futura.\n\n' +
'Dúvidas? Responda a este email ou fale connosco: https://wa.me/' + ZAP + '\n\n' +
'---\n' +
'Negociar com alavancagem envolve risco de perda de capital.\n' +
'Recebeu este email porque pediu os relatórios em ' + SITE + '\n' +
'Para deixar de receber, responda com a palavra SAIR.\n';

  return {
    subject: 'Os seus três relatórios, ' + (String(nome || '').split(/\s+/)[0] || 'aqui estão'),
    html: html,
    text: texto
  };
}

/* ── O aviso que nos chega a nós ─────────────────────────────────────── */
export function avisoInterno(d) {
  const tel = String(d.telefone || '').replace(/[^\d]/g, '');
  const linha = function (rotulo, valor) {
    return '<tr>' +
      '<td style="padding:7px 16px 7px 0;font:13px/1.5 ' + FONTE + ';color:' + CINZA + ';white-space:nowrap">' +
      rotulo + '</td>' +
      '<td style="padding:7px 0;font:14px/1.5 ' + FONTE + ';color:' + TINTA + '">' + valor + '</td></tr>';
  };

  const html =
'<div style="font:14px/1.6 ' + FONTE + ';color:' + TINTA + ';max-width:520px">' +
'<p style="margin:0 0 16px;font:600 17px/1.3 ' + FONTE + '">' + esc(d.nome) + ' pediu os relatórios.</p>' +
'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">' +
linha('Telemóvel', '<a href="https://wa.me/' + esc(tel) + '" style="color:' + VERDE + ';font-weight:600">' +
  esc(d.telefone) + '</a>') +
linha('Email', '<a href="mailto:' + esc(d.email) + '" style="color:' + VERDE + '">' + esc(d.email) + '</a>') +
linha('Campanhas', d.consentimento ? 'autorizou' : 'não autorizou') +
linha('Quando', esc(d.quando)) +
linha('Origem', esc(d.origem || 'directa')) +
'</table>' +
'<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid ' + LINHA + ';font:13px/1.5 ' + FONTE + ';color:' + CINZA + '">' +
(d.clienteOk
  ? 'Os relatórios já seguiram para o email dele.'
  : '<b style="color:#C4462F">Os relatórios não chegaram a sair.</b> Envie-lhos à mão.') +
'</p></div>';

  const texto =
d.nome + ' pediu os relatórios.\n\n' +
'Telemóvel: ' + d.telefone + '\n' +
'Email: ' + d.email + '\n' +
'Campanhas: ' + (d.consentimento ? 'autorizou' : 'não autorizou') + '\n' +
'Quando: ' + d.quando + '\n' +
'Origem: ' + (d.origem || 'directa') + '\n\n' +
(d.clienteOk ? 'Os relatórios já seguiram para o email dele.'
             : 'ATENÇÃO: os relatórios não chegaram a sair. Envie-lhos à mão.') + '\n';

  return { subject: 'Novo contacto: ' + d.nome, html: html, text: texto };
}
