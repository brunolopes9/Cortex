/* ==========================================================================
   /api/admin — tudo o que o painel reservado precisa.

   Uma função só, com uma acção no corpo do pedido, em vez de meia dúzia
   de ficheiros quase iguais. Todas as acções excepto o login exigem
   sessão válida.

     entrar      troca a palavra-passe por um cookie assinado
     sair        apaga o cookie
     dados       contactos + visitas + resumo
     campanha    envia email a quem autorizou
   ========================================================================== */

import { autenticado, passwordCorrecta, criarCookie, limparCookie } from '../lib/auth.js';
import { disponivel, lerLeads, lerSessoes } from '../lib/store.js';
import { envelope, remetente, enderecoRemetente, FONTE, SITE } from '../lib/emails.js';

const RESEND = 'https://api.resend.com';

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── Resumo das visitas ────────────────────────────────────────────── */
function resumir(sessoes) {
  const origens = {}, saidas = {}, seccoes = {}, cliques = {}, dias = {};
  let tempoTotal = 0, scrollTotal = 0, telemovel = 0;

  for (const s of sessoes) {
    /* Agrupamos a origem em famílias: não interessa o URL exacto do
       Instagram, interessa que veio do Instagram. */
    const o = String(s.origem || 'directa').toLowerCase();
    let familia = 'Directo';
    if (/instagram|ig_|\big\b/.test(o)) familia = 'Instagram';
    else if (/facebook|fb|meta/.test(o)) familia = 'Facebook';
    else if (/google|search|organic/.test(o)) familia = 'Google';
    else if (/t\.me|telegram/.test(o)) familia = 'Telegram';
    else if (/whatsapp|wa\.me/.test(o)) familia = 'WhatsApp';
    else if (/tiktok/.test(o)) familia = 'TikTok';
    else if (/youtube|yt/.test(o)) familia = 'YouTube';
    else if (o && o !== 'directa') familia = 'Outra · ' + o.slice(0, 40);
    origens[familia] = (origens[familia] || 0) + 1;

    if (s.saida) saidas[s.saida] = (saidas[s.saida] || 0) + 1;
    for (const x of s.seccoes || []) seccoes[x] = (seccoes[x] || 0) + 1;
    for (const c of s.cliques || []) cliques[c] = (cliques[c] || 0) + 1;

    tempoTotal += Number(s.duracao) || 0;
    scrollTotal += Number(s.scroll) || 0;
    if ((Number(s.ecra) || 0) < 760) telemovel++;

    const dia = new Date(s.ts || Date.now()).toISOString().slice(0, 10);
    dias[dia] = (dias[dia] || 0) + 1;
  }

  const n = sessoes.length || 1;
  const ordenar = function (o) {
    return Object.entries(o).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12);
  };

  return {
    visitas: sessoes.length,
    tempoMedio: Math.round(tempoTotal / n),
    scrollMedio: Math.round(scrollTotal / n),
    telemovelPct: Math.round(telemovel / n * 100),
    origens: ordenar(origens),
    saidas: ordenar(saidas),
    seccoes: ordenar(seccoes),
    cliques: ordenar(cliques),
    dias: Object.entries(dias).sort().slice(-30)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  d = d || {};
  const accao = String(d.accao || '');

  /* ── entrar ── */
  if (accao === 'entrar') {
    if (!process.env.ADMIN_PASSWORD) {
      return res.status(500).json({ ok: false, erro: 'Falta a variável ADMIN_PASSWORD na Vercel.' });
    }
    /* Um atraso curto torna a força bruta impraticável sem incomodar
       quem sabe a palavra-passe. */
    await new Promise(function (r) { setTimeout(r, 600); });
    if (!passwordCorrecta(d.password)) {
      return res.status(401).json({ ok: false, erro: 'Palavra-passe errada.' });
    }
    res.setHeader('Set-Cookie', criarCookie());
    return res.status(200).json({ ok: true });
  }

  /* ── daqui para baixo, só com sessão ── */
  if (!autenticado(req)) return res.status(401).json({ ok: false, erro: 'sessao' });

  if (accao === 'sair') {
    res.setHeader('Set-Cookie', limparCookie());
    return res.status(200).json({ ok: true });
  }

  /* ── dados ── */
  if (accao === 'dados') {
    if (!disponivel()) {
      return res.status(200).json({
        ok: true, semArmazenamento: true, leads: [], resumo: resumir([]),
        aviso: 'Falta ligar a base de dados. Vercel → Storage → Upstash Redis (plano gratuito). ' +
               'Até lá, os contactos continuam a chegar por email mas não ficam guardados aqui.'
      });
    }
    try {
      const [leads, sessoes] = await Promise.all([lerLeads(2000), lerSessoes(5000)]);
      return res.status(200).json({ ok: true, leads, resumo: resumir(sessoes) });
    } catch (e) {
      console.error('dados:', e.message);
      return res.status(500).json({ ok: false, erro: 'Não consegui ler os dados.' });
    }
  }

  /* ── diagnostico ──────────────────────────────────────────────────
     Responde a uma pergunta só: porque é que o email não chegou?
     Não envia nada e não revela nenhuma chave — só diz o que está
     ligado, o que falta e o que a Resend responde a quem pergunta. */
  if (accao === 'diagnostico') {
    const env = function (n) { return Boolean(process.env[n]); };
    const d2 = {
      variaveis: {
        RESEND_API_KEY: env('RESEND_API_KEY'),
        MAIL_FROM: process.env.MAIL_FROM || null,
        MAIL_TO: process.env.MAIL_TO || null,
        ADMIN_PASSWORD: env('ADMIN_PASSWORD'),
        ADMIN_SECRET: env('ADMIN_SECRET'),
        KV_REST_API_URL: env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL'),
        KV_REST_API_TOKEN: env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN')
      },
      baseDados: { ligada: disponivel(), leituraOk: null, contactos: null },
      resend: { chaveValida: null, erro: null, dominios: [], remetenteOk: null }
    };

    /* A base de dados: não basta ter as variáveis, tem de responder. */
    if (disponivel()) {
      try {
        const l = await lerLeads(1);
        d2.baseDados.leituraOk = true;
        d2.baseDados.contactos = l.length;
      } catch (e) {
        d2.baseDados.leituraOk = false;
        d2.baseDados.erro = e.message.slice(0, 160);
      }
    }

    /* A Resend: perguntamos pelos domínios. É um pedido de leitura —
       diz-nos de uma vez se a chave ainda serve e se o domínio do
       remetente está mesmo verificado. */
    const k = process.env.RESEND_API_KEY;
    if (!k) {
      d2.resend.erro = 'RESEND_API_KEY não está definida.';
    } else {
      try {
        const r = await fetch(RESEND + '/domains', {
          headers: { Authorization: 'Bearer ' + k }
        });
        const txt = await r.text();
        if (r.status === 401 || r.status === 403) {
          d2.resend.chaveValida = false;
          d2.resend.erro = 'A Resend recusou a chave (' + r.status + '). Foi revogada ou está mal copiada.';
        } else if (!r.ok) {
          d2.resend.chaveValida = false;
          d2.resend.erro = 'A Resend devolveu ' + r.status + ': ' + txt.slice(0, 200);
        } else {
          d2.resend.chaveValida = true;
          const lista = (JSON.parse(txt || '{}').data) || [];
          d2.resend.dominios = lista.map(function (x) {
            return { nome: x.name, estado: x.status, regiao: x.region || '' };
          });
          /* O remetente só funciona se o domínio dele estiver verificado. */
          const from = process.env.MAIL_FROM || '';
          const dom = (from.match(/@([^\s>]+)/) || [])[1] || '';
          if (!from) d2.resend.remetenteOk = null;
          else if (!dom) d2.resend.remetenteOk = false;
          else {
            const achado = lista.find(function (x) { return x.name === dom; });
            d2.resend.remetenteOk = Boolean(achado && achado.status === 'verified');
            d2.resend.remetenteDominio = dom;
          }
        }
      } catch (e) {
        d2.resend.chaveValida = false;
        d2.resend.erro = 'Não consegui falar com a Resend: ' + e.message.slice(0, 160);
      }
    }

    return res.status(200).json({ ok: true, diag: d2 });
  }

  /* ── campanha ── */
  if (accao === 'campanha') {
    const chave = process.env.RESEND_API_KEY;
    if (!chave) return res.status(500).json({ ok: false, erro: 'Falta a RESEND_API_KEY.' });

    const assunto = String(d.assunto || '').trim();
    const corpo = String(d.corpo || '').trim();
    if (assunto.length < 3 || corpo.length < 10) {
      return res.status(400).json({ ok: false, erro: 'Assunto e mensagem são obrigatórios.' });
    }

    let destinos = [];
    try {
      const leads = await lerLeads(2000);
      const vistos = new Set();
      for (const l of leads) {
        if (!l.email || !l.consentimento) continue;
        const e = String(l.email).toLowerCase();
        if (vistos.has(e)) continue;
        vistos.add(e);
        destinos.push({ email: e, nome: (l.nome || '').split(/\s+/)[0] || '' });
      }
    } catch (e) {
      return res.status(500).json({ ok: false, erro: 'Não consegui ler a lista de contactos.' });
    }

    if (!destinos.length) return res.status(400).json({ ok: false, erro: 'Ninguém na lista autorizou o envio de campanhas.' });

    /* Um email por pessoa, para o nome entrar na mensagem e para que
       ninguém veja o endereço de ninguém. Em lotes, para não esbarrar
       nos limites da Resend. */
    const paragrafos = corpo.split(/\n{2,}/).map(function (p) {
      return '<p style="margin:0 0 15px;font:15px/1.65 ' + FONTE + ';color:#5C646E">' +
        esc(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');

    const deQuem = remetente();
    const endereco = enderecoRemetente();

    /* Sem estes cabeçalhos, o Gmail e o Outlook atiram campanhas para o
       lixo — passaram a exigi-los a quem envia para muita gente. */
    const cabecalhosSaida = {
      'List-Unsubscribe': '<mailto:' + endereco + '?subject=SAIR>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    };

    let enviados = 0, falhados = 0;
    for (let i = 0; i < destinos.length; i += 20) {
      const lote = destinos.slice(i, i + 20);
      await Promise.all(lote.map(async function (p) {
        try {
          const r = await fetch(RESEND + '/emails', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + chave, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: deQuem,
              to: [p.email],
              reply_to: process.env.MAIL_TO || endereco,
              subject: assunto,
              headers: cabecalhosSaida,
              html: envelope(
                (p.nome ? '<p style="margin:0 0 15px;font:15px/1.65 ' + FONTE + ';color:#15181C">Olá ' +
                  esc(p.nome) + ',</p>' : '') + paragrafos),
              /* A versão em texto conta a favor de quem envia, e há quem
                 leia o email assim mesmo. */
              text: (p.nome ? 'Olá ' + p.nome + ',\n\n' : '') + corpo +
                '\n\n---\nRecebe este email porque autorizou o contacto em ' + SITE + '\n' +
                'Para deixar de receber, responda com a palavra SAIR.\n'
            })
          });
          if (r.ok) enviados++; else falhados++;
        } catch { falhados++; }
      }));
    }

    return res.status(200).json({ ok: true, enviados, falhados, total: destinos.length });
  }

  return res.status(400).json({ ok: false, erro: 'acção desconhecida' });
}
