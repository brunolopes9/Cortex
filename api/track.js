/* ==========================================================================
   POST /api/track
   Recebe o resumo de uma visita quando a pessoa sai da página.

   O que guardamos e porquê:
     vid        número ao acaso guardado no browser dela. Serve para
                separar sete visitas de sete pessoas de sete visitas da
                mesma pessoa — sem isso os números não querem dizer nada
     visitas    a quantas vezes vai, e se é a primeira
     origem     de onde veio (Instagram, campanha, pesquisa, directo)
     utm        a etiqueta exacta da campanha, quando existe
     duracao    quanto tempo esteve
     scroll     até onde desceu, em percentagem
     saida      em que secção estava quando saiu
     seccoes    por que secções passou
     tempos     quanto tempo ficou em cada uma
     cliques    que botões carregou
     eventos    o percurso por ordem, com a hora de cada passo
     ecra       largura e altura, para separar telemóvel de computador
     pais       dado pela Vercel, sem tocar no IP

   O que NÃO guardamos: IP, nome, email, nem identificadores que sigam a
   pessoa para outros sites. O número do browser é nosso e só nosso, e
   não se cruza com os contactos: nenhuma visita fica ligada a um nome.
   ========================================================================== */

import { disponivel, guardarSessao } from '../lib/store.js';

function limpar(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 200);
}

function numero(v, max) {
  return Math.max(0, Math.min(Number(v) || 0, max));
}

/* Os objectos vêm de fora: aceitamos só as chaves que esperamos, com o
   tamanho que esperamos. Sem isto, bastava um pedido feito à mão com um
   objecto enorme para encher a base de dados. */
function mapa(o, maxChaves, maxValor) {
  const saida = {};
  if (!o || typeof o !== 'object') return saida;
  let n = 0;
  for (const k of Object.keys(o)) {
    if (n++ >= maxChaves) break;
    saida[limpar(k, 40)] = typeof o[k] === 'number' ? numero(o[k], maxValor) : limpar(o[k], 60);
  }
  return saida;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  /* Nunca falhamos por causa disto: uma estatística perdida não vale um
     erro na consola de quem está a visitar o site. */
  if (!disponivel()) return res.status(200).json({ ok: true, guardado: false });

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  d = d || {};

  try {
    await guardarSessao({
      ts: Date.now(),
      vid: limpar(d.vid, 32),
      visitas: numero(d.visitas, 9999),
      novo: d.novo === true,
      origem: limpar(d.origem, 200) || 'directa',
      utm: mapa(d.utm, 5, 0),
      entrada: limpar(d.entrada, 160),
      duracao: numero(d.duracao, 7200),
      scroll: numero(d.scroll, 100),
      saida: limpar(d.saida, 60),
      seccoes: Array.isArray(d.seccoes) ? d.seccoes.slice(0, 20).map(s => limpar(s, 40)) : [],
      tempos: mapa(d.tempos, 20, 3600),
      cliques: Array.isArray(d.cliques) ? d.cliques.slice(0, 30).map(c => limpar(c, 60)) : [],
      eventos: Array.isArray(d.eventos) ? d.eventos.slice(0, 60).map(x => ({
        t: numero(x && x.t, 7200),
        e: limpar(x && x.e, 40),
        d: limpar(x && x.d, 60)
      })) : [],
      ecra: numero(d.ecra, 9999),
      altura: numero(d.altura, 9999),
      pais: limpar(req.headers['x-vercel-ip-country'], 4),
      lead: d.lead === true
    });
  } catch (e) {
    console.error('track falhou:', e.message);
  }

  return res.status(200).json({ ok: true });
}
