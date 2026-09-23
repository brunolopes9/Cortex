/* ==========================================================================
   POST /api/lead
   Recebe o formulário de pedido dos relatórios.

   Faz duas coisas, por esta ordem de importância:

     1. Avisa-nos por email, sempre. É o que garante que nenhum contacto
        se perde — incluindo os que só deixam telemóvel e por isso não
        podem entrar numa lista de email.

     2. Se a pessoa deixou email e autorizou contacto, acrescenta-a à
        Audience da Resend. É de lá que saem as campanhas.

   A chave da Resend vive só aqui, no servidor. Nunca no browser: quem
   a apanhasse podia enviar email em nome do domínio.

   Variáveis de ambiente (Vercel → Settings → Environment Variables):
     RESEND_API_KEY       obrigatória
     RESEND_AUDIENCE_ID   opcional — sem ela, só envia o aviso
     MAIL_TO              para onde vão os avisos
     MAIL_FROM            remetente verificado em Resend → Domains
   ========================================================================== */

const RESEND = 'https://api.resend.com';

/* Escapar antes de meter seja o que for dentro do HTML do email.
   Os valores vêm de um formulário público: não se confia neles. */
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function limpar(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 200);
}

/* Aceita formatos portugueses e internacionais sem ser esquisito:
   9 a 15 dígitos, com ou sem indicativo, espaços e traços à vontade. */
function telefoneValido(v) {
  const so = v.replace(/[^\d]/g, '');
  return so.length >= 9 && so.length <= 15;
}

function emailValido(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

async function resend(caminho, corpo, chave) {
  const r = await fetch(RESEND + caminho, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + chave, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(caminho + ' devolveu ' + r.status + ': ' + texto.slice(0, 300));
  return texto ? JSON.parse(texto) : {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, erro: 'method_not_allowed' });
  }

  const chave = process.env.RESEND_API_KEY;
  if (!chave) {
    console.error('RESEND_API_KEY não está definida');
    return res.status(500).json({ ok: false, erro: 'config' });
  }

  let dados = req.body;
  if (typeof dados === 'string') {
    try { dados = JSON.parse(dados); } catch { dados = {}; }
  }
  dados = dados || {};

  /* Armadilha para robôs: é um campo escondido que nenhuma pessoa
     preenche. Respondemos 200 para o robô não perceber que falhou. */
  if (limpar(dados.website)) return res.status(200).json({ ok: true });

  const nome = limpar(dados.nome, 120);
  const telefone = limpar(dados.telefone, 40);
  const email = limpar(dados.email, 160).toLowerCase();
  const consentimento = dados.consentimento === true || dados.consentimento === 'on';
  const origem = limpar(dados.origem, 300);

  const falhas = [];
  if (nome.length < 2) falhas.push('nome');
  if (!telefoneValido(telefone)) falhas.push('telefone');
  if (email && !emailValido(email)) falhas.push('email');
  if (falhas.length) return res.status(400).json({ ok: false, erro: 'validacao', campos: falhas });

  const quando = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
  const primeiro = nome.split(/\s+/)[0] || nome;
  const ultimo = nome.split(/\s+/).slice(1).join(' ');

  /* ── 1. Aviso para nós. Se isto falhar, o pedido falha. ── */
  try {
    await resend('/emails', {
      from: process.env.MAIL_FROM || 'Cortex Automation <onboarding@resend.dev>',
      to: [process.env.MAIL_TO || 'bruno.miguel.martins.lopes@gmail.com'],
      reply_to: email || undefined,
      subject: 'Novo contacto: ' + nome + (email ? '' : ' (sem email)'),
      html:
        '<h2 style="margin:0 0 14px;font:600 18px system-ui">Pedido dos relatórios</h2>' +
        '<table style="border-collapse:collapse;font:14px/1.6 system-ui">' +
        '<tr><td style="padding:4px 14px 4px 0;color:#666">Nome</td><td><b>' + esc(nome) + '</b></td></tr>' +
        '<tr><td style="padding:4px 14px 4px 0;color:#666">Telemóvel</td><td><b><a href="https://wa.me/' +
          esc(telefone.replace(/[^\d]/g, '')) + '">' + esc(telefone) + '</a></b></td></tr>' +
        '<tr><td style="padding:4px 14px 4px 0;color:#666">Email</td><td>' +
          (email ? '<a href="mailto:' + esc(email) + '">' + esc(email) + '</a>' : '<i>não indicou</i>') + '</td></tr>' +
        '<tr><td style="padding:4px 14px 4px 0;color:#666">Campanhas</td><td>' +
          (consentimento ? 'autorizou' : 'não autorizou') + '</td></tr>' +
        '<tr><td style="padding:4px 14px 4px 0;color:#666">Quando</td><td>' + esc(quando) + '</td></tr>' +
        '<tr><td style="padding:4px 14px 4px 0;color:#666">Origem</td><td>' + esc(origem || 'directa') + '</td></tr>' +
        '</table>' +
        (email && consentimento
          ? '<p style="font:13px system-ui;color:#0a7">Entrou na lista de campanhas.</p>'
          : '<p style="font:13px system-ui;color:#a60">Não entra na lista de campanhas' +
            (email ? ' — não autorizou.' : ' — não deixou email.') + '</p>')
    }, chave);
  } catch (e) {
    console.error('aviso por email falhou:', e.message);
    return res.status(502).json({ ok: false, erro: 'envio' });
  }

  /* ── 2. Lista de campanhas. Só com email E autorização.
         Se falhar, não estragamos o pedido: o contacto já chegou acima. ── */
  const audiencia = process.env.RESEND_AUDIENCE_ID;
  let naLista = false;
  if (email && consentimento && audiencia) {
    try {
      await resend('/audiences/' + audiencia + '/contacts', {
        email, first_name: primeiro, last_name: ultimo, unsubscribed: false
      }, chave);
      naLista = true;
    } catch (e) {
      console.error('Audience falhou:', e.message);
    }
  }

  return res.status(200).json({ ok: true, naLista });
}
