/* ==========================================================================
   POST /api/track
   Recebe o resumo de uma visita quando a pessoa sai da página.

   O que guardamos e porquê:
     origem     de onde veio (Instagram, campanha, pesquisa, directo)
     duracao    quanto tempo esteve
     scroll     até onde desceu, em percentagem
     saida      em que secção estava quando saiu
     seccoes    por que secções passou
     cliques    que botões carregou
     ecra       largura, para saber se é telemóvel ou computador
     pais       dado pela Vercel, sem tocar no IP

   O que NÃO guardamos: IP, cookies, identificadores que sigam a pessoa
   entre sites ou entre visitas. O id da sessão vive na aba e morre com
   ela. É por isso que isto não precisa de consentimento prévio.
   ========================================================================== */

import { disponivel, guardarSessao } from '../lib/store.js';

function limpar(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 200);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  /* Nunca falhamos por causa disto: uma estatística perdida não vale
     um erro na consola de quem está a visitar o site. */
  if (!disponivel()) return res.status(200).json({ ok: true, guardado: false });

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  d = d || {};

  try {
    await guardarSessao({
      ts: Date.now(),
      origem: limpar(d.origem, 200) || 'directa',
      entrada: limpar(d.entrada, 160),
      duracao: Math.max(0, Math.min(Number(d.duracao) || 0, 7200)),
      scroll: Math.max(0, Math.min(Number(d.scroll) || 0, 100)),
      saida: limpar(d.saida, 60),
      seccoes: Array.isArray(d.seccoes) ? d.seccoes.slice(0, 20).map(function (s) { return limpar(s, 40); }) : [],
      cliques: Array.isArray(d.cliques) ? d.cliques.slice(0, 30).map(function (c) { return limpar(c, 60); }) : [],
      ecra: Math.max(0, Math.min(Number(d.ecra) || 0, 9999)),
      pais: limpar(req.headers['x-vercel-ip-country'], 4),
      lead: d.lead === true
    });
  } catch (e) {
    console.error('track falhou:', e.message);
  }

  return res.status(200).json({ ok: true });
}
