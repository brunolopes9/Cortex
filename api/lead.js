/* ==========================================================================
   POST /api/lead
   Recebe o formulário de pedido dos relatórios.

   Faz três coisas, por esta ordem de importância:

     1. Manda os relatórios à pessoa. É o que o site promete, e é a única
        parte que ela vê. Se isto falhar, o pedido falha.

     2. Avisa-nos, e diz-nos se o ponto 1 correu bem. Quando não correu,
        o aviso traz o contacto para lhe enviarmos à mão.

     3. Guarda para o painel e, com email e autorização, acrescenta à
        Audience da Resend.

   A chave da Resend vive só aqui, no servidor. Nunca no browser: quem a
   apanhasse podia enviar email em nome do domínio.

   Variáveis de ambiente (Vercel → Settings → Environment Variables):
     RESEND_API_KEY       obrigatória
     MAIL_FROM            remetente. O domínio tem de estar verificado em
                          Resend → Domains. Basta o endereço: o nome que
                          aparece na caixa de entrada é posto aqui.
     MAIL_TO              para onde vão os avisos internos
     SITE_URL             endereço público, para os links dos relatórios
     RESEND_AUDIENCE_ID   opcional; se faltar, a lista é descoberta sozinha
   ========================================================================== */

import { disponivel, guardarLead } from '../lib/store.js';
import { paraCliente, avisoInterno, remetente, enderecoRemetente } from '../lib/emails.js';

const RESEND = 'https://api.resend.com';

/* O ID da lista fica em memória entre pedidos quentes, para não andarmos
   a perguntá-lo à Resend a cada contacto. */
let audienciaEmCache = null;

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
  const deQuem = remetente();
  const responderA = process.env.MAIL_TO || enderecoRemetente();

  /* Sair da lista tem de ser possível a partir do próprio cliente de
     email, sem abrir nada. O Gmail e o Outlook passaram a exigi-lo a
     quem envia em quantidade, e sem isto o correio vai para o lixo. */
  const cabecalhosSaida = {
    'List-Unsubscribe': '<mailto:' + enderecoRemetente() + '?subject=SAIR>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  };

  /* ── 1. Os relatórios, para a pessoa. É o que prometemos. ── */
  let clienteOk = false;
  try {
    const msg = paraCliente(nome, email);
    await resend('/emails', {
      from: deQuem,
      to: [email],
      reply_to: responderA,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: cabecalhosSaida
    }, chave);
    clienteOk = true;
  } catch (e) {
    console.error('email para o cliente falhou:', e.message);
  }

  /* ── 2. O aviso para nós, com o estado do ponto 1. ── */
  let avisoOk = false;
  try {
    const msg = avisoInterno({ nome, telefone, email, consentimento, quando, origem, clienteOk });
    await resend('/emails', {
      from: deQuem,
      to: [process.env.MAIL_TO || 'bruno.miguel.martins.lopes@gmail.com'],
      reply_to: email,
      subject: msg.subject + (clienteOk ? '' : ' — RELATÓRIOS NÃO SAÍRAM'),
      html: msg.html,
      text: msg.text
    }, chave);
    avisoOk = true;
  } catch (e) {
    console.error('aviso interno falhou:', e.message);
  }

  /* Se nada saiu, o contacto perdia-se em silêncio. Melhor dizer ao
     browser que falhou e deixá-lo abrir o WhatsApp. */
  if (!clienteOk && !avisoOk) {
    return res.status(502).json({ ok: false, erro: 'envio' });
  }

  /* ── 3. Guardar para o painel. Se falhar, não estragamos o pedido. ── */
  if (disponivel()) {
    try {
      await guardarLead({
        ts: Date.now(), nome, telefone, email, consentimento, origem,
        pais: limpar(req.headers['x-vercel-ip-country'], 4),
        entregue: clienteOk
      });
    } catch (e) {
      console.error('não consegui guardar o lead:', e.message);
    }
  }

  /* ── 4. Lista de campanhas. Só com autorização. ── */
  let naLista = false;
  if (consentimento) {
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

  return res.status(200).json({ ok: true, entregue: clienteOk, naLista });
}
