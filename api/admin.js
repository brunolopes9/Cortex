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
    const html = corpo.split(/\n{2,}/).map(function (p) {
      return '<p style="margin:0 0 14px">' + esc(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');

    let enviados = 0, falhados = 0;
    for (let i = 0; i < destinos.length; i += 20) {
      const lote = destinos.slice(i, i + 20);
      await Promise.all(lote.map(async function (p) {
        try {
          const r = await fetch(RESEND + '/emails', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + chave, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: process.env.MAIL_FROM || 'Cortex Automation <onboarding@resend.dev>',
              to: [p.email],
              reply_to: process.env.MAIL_TO || undefined,
              subject: assunto,
              html:
                '<div style="font:15px/1.65 system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px">' +
                (p.nome ? '<p style="margin:0 0 14px">Olá ' + esc(p.nome) + ',</p>' : '') +
                html +
                '<p style="margin:26px 0 0;font-size:12px;color:#888;border-top:1px solid #eee;padding-top:14px">' +
                'Recebe este email porque autorizou o contacto no site da Cortex Automation. ' +
                'Para deixar de receber, responda a este email com a palavra SAIR.</p></div>'
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
