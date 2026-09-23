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
     MAIL_TO              para onde vão os avisos
     MAIL_FROM            remetente. O domínio tem de estar verificado em
                          Resend → Domains; a caixa de correio não precisa
                          de existir. Sem domínio verificado, usar
                          onboarding@resend.dev — que só consegue enviar
                          para o email da própria conta Resend.
     RESEND_AUDIENCE_ID   opcional. Se faltar, a lista é descoberta
                          sozinha — o painel da Resend já não mostra o ID.
   ========================================================================== */

import { disponivel, guardarLead } from './_store.js';

const RESEND = 'https://api.resend.com';

/* O ID da lista fica em memória entre pedidos quentes, para não andarmos
   a perguntá-lo à Resend a cada contacto. */
let audienciaEmCache = null;

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
    method: corpo ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + chave, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(caminho + ' devolveu ' + r.status + ': ' + texto.slice(0, 300));
  return texto ? JSON.parse(texto) : {};
}

/* O painel novo da Resend já não mostra o ID da lista, por isso
   perguntamos-lho. Se a variável estiver preenchida, manda ela. */
async function descobrirAudiencia(chave) {
  if (process.env.RESEND_AUDIENCE_ID) return process.env.RESEND_AUDIENCE_ID;
  if (audienciaEmCache) return audienciaEmCache;
  try {
    const r = await resend('/audiences', null, chave);
    const lista = (r && (r.data || r.audiences)) || [];
    if (lista.length) {
      audienciaEmCache = lista[0].id;
      return audienciaEmCache;
    }
    /* Conta sem nenhuma lista ainda: criamos a primeira. */
    const nova = await resend('/audiences', { name: 'Cortex Automation' }, chave);
    if (nova && nova.id) {
      audienciaEmCache = nova.id;
      return audienciaEmCache;
    }
  } catch (e) {
    console.error('não consegui descobrir a Audience:', e.message);
  }
  return null;
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
  if (!emailValido(email)) falhas.push('email');
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

  /* ── 2. Guardar para o painel. Se falhar, não estragamos o pedido. ── */
  if (disponivel()) {
    try {
      await guardarLead({
        ts: Date.now(), nome, telefone, email, consentimento, origem,
        pais: limpar(req.headers['x-vercel-ip-country'], 4)
      });
    } catch (e) {
      console.error('não consegui guardar o lead:', e.message);
    }
  }

  /* ── 3. Lista de campanhas. Só com email E autorização.
         Se falhar, não estragamos o pedido: o contacto já chegou acima. ── */
  let naLista = false;
  if (email && consentimento) {
    try {
      const audiencia = await descobrirAudiencia(chave);
      if (audiencia) {
        await resend('/audiences/' + audiencia + '/contacts', {
          email, first_name: primeiro, last_name: ultimo, unsubscribed: false
        }, chave);
        naLista = true;
      }
    } catch (e) {
      console.error('Audience falhou:', e.message);
    }
  }

  return res.status(200).json({ ok: true, naLista });
}
