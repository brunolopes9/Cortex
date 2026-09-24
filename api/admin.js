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
import { disponivel, lerLeads, lerSessoes, lerEstados, guardarEstado, chaveLead } from '../lib/store.js';
import { envelope, remetente, enderecoRemetente, FONTE, SITE } from '../lib/emails.js';

const RESEND = 'https://api.resend.com';

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── Leitura das visitas ─────────────────────────────────────────────

   Tudo o que está aqui existe para responder a duas perguntas: de onde
   vêm estas pessoas, e onde é que as perdemos. Um número que não ajude
   a responder a nenhuma das duas não devia estar no painel.
   ───────────────────────────────────────────────────────────────────── */

/* Não interessa o URL exacto do Instagram; interessa que veio do
   Instagram. As famílias tornam a lista legível quando houver tráfego
   a sério e não sete visitas. */
function familiaDe(origem) {
  const o = String(origem || 'directa').toLowerCase();
  if (/instagram|ig_|\big\b/.test(o)) return 'Instagram';
  if (/facebook|fb|meta/.test(o)) return 'Facebook';
  if (/google|search|organic/.test(o)) return 'Google';
  if (/t\.me|telegram/.test(o)) return 'Telegram';
  if (/whatsapp|wa\.me/.test(o)) return 'WhatsApp';
  if (/tiktok/.test(o)) return 'TikTok';
  if (/youtube|yt/.test(o)) return 'YouTube';
  if (o && o !== 'directa') return 'Outra · ' + o.slice(0, 40);
  return 'Directo';
}

function aparelhoDe(largura) {
  const w = Number(largura) || 0;
  if (!w) return 'Desconhecido';
  if (w < 640) return 'Telemóvel';
  if (w < 1024) return 'Tablet';
  return 'Computador';
}

function temEvento(s, nome, detalhe) {
  return (s.eventos || []).some(function (x) {
    return x.e === nome && (detalhe == null || String(x.d || '').indexOf(detalhe) === 0);
  });
}

function clicou(s, texto) {
  return (s.cliques || []).some(function (c) { return String(c).indexOf(texto) !== -1; });
}

/* As etapas por onde uma visita passa até virar contacto. A ordem é a
   da página, e é por isso que a queda entre duas etapas seguidas diz
   onde é que o site está a perder gente. */
const ETAPAS = [
  ['Entrou no site', function () { return true; }],
  ['Passou do topo', function (s) { return (Number(s.scroll) || 0) >= 20; }],
  ['Começou o vídeo', function (s) { return temEvento(s, 'video', 'inicio'); }],
  ['Chegou à Performance', function (s) { return (s.seccoes || []).indexOf('performance') !== -1; }],
  ['Abriu o formulário', function (s) { return temEvento(s, 'form', 'aberto'); }],
  ['Começou a preencher', function (s) { return temEvento(s, 'form', 'começou'); }],
  ['Deixou o contacto', function (s) { return temEvento(s, 'lead') || s.lead === true; }],
  ['Falou no WhatsApp', function (s) { return clicou(s, 'WhatsApp'); }]
];

export function resumir(sessoes) {
  const origens = {}, saidas = {}, seccoes = {}, cliques = {}, dias = {};
  const tempoSeccao = {}, campanhas = {}, aparelhos = {}, video = {};
  const pessoas = new Set(), simulacoes = [];
  let tempoTotal = 0, scrollTotal = 0, novos = 0;

  for (const s of sessoes) {
    if (s.vid) pessoas.add(s.vid);
    if (s.novo) novos++;

    const familia = familiaDe(s.origem);
    if (!origens[familia]) origens[familia] = { visitas: 0, leads: 0, tempo: 0 };
    origens[familia].visitas++;
    origens[familia].tempo += Number(s.duracao) || 0;
    const virouLead = temEvento(s, 'lead') || s.lead === true;
    if (virouLead) origens[familia].leads++;

    /* Uma campanha só conta como campanha se trouxe etiqueta. Sem
       etiqueta não há como saber qual anúncio a trouxe. */
    const u = s.utm || {};
    if (u.campaign || u.source) {
      const nome = [u.source, u.campaign, u.content].filter(Boolean).join(' · ');
      if (!campanhas[nome]) campanhas[nome] = { visitas: 0, leads: 0, medium: u.medium || '' };
      campanhas[nome].visitas++;
      if (virouLead) campanhas[nome].leads++;
    }

    const ap = aparelhoDe(s.ecra);
    if (!aparelhos[ap]) aparelhos[ap] = { visitas: 0, leads: 0, scroll: 0 };
    aparelhos[ap].visitas++;
    aparelhos[ap].scroll += Number(s.scroll) || 0;
    if (virouLead) aparelhos[ap].leads++;

    if (s.saida) saidas[s.saida] = (saidas[s.saida] || 0) + 1;
    for (const x of s.seccoes || []) seccoes[x] = (seccoes[x] || 0) + 1;
    for (const c of s.cliques || []) cliques[c] = (cliques[c] || 0) + 1;
    for (const [k, v] of Object.entries(s.tempos || {})) {
      if (!tempoSeccao[k]) tempoSeccao[k] = { total: 0, n: 0 };
      tempoSeccao[k].total += Number(v) || 0;
      tempoSeccao[k].n++;
    }

    for (const ev of s.eventos || []) {
      if (ev.e === 'video' && ev.d) video[ev.d] = (video[ev.d] || 0) + 1;
      if (ev.e === 'simulador' && ev.d) simulacoes.push(ev.d);
    }

    tempoTotal += Number(s.duracao) || 0;
    scrollTotal += Number(s.scroll) || 0;

    const dia = new Date(s.ts || Date.now()).toISOString().slice(0, 10);
    dias[dia] = (dias[dia] || 0) + 1;
  }

  const n = sessoes.length || 1;
  const ordenar = function (o) {
    return Object.entries(o).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 14);
  };

  /* O funil. Cada etapa traz quantos lá chegaram e que percentagem dos
     da etapa anterior isso representa — é a queda entre duas etapas
     seguidas que aponta o problema, não o número absoluto. */
  const funil = [];
  let anterior = 0;
  for (const [nome, passa] of ETAPAS) {
    const quantos = sessoes.filter(passa).length;
    funil.push({
      nome,
      quantos,
      doTotal: sessoes.length ? Math.round(quantos / sessoes.length * 100) : 0,
      daAnterior: anterior ? Math.round(quantos / anterior * 100) : null
    });
    anterior = quantos;
  }

  const comTaxa = function (o) {
    return Object.entries(o).map(function (par) {
      const v = par[1];
      return {
        nome: par[0],
        visitas: v.visitas,
        leads: v.leads,
        taxa: v.visitas ? Math.round(v.leads / v.visitas * 100) : 0,
        tempo: v.tempo != null ? Math.round(v.tempo / v.visitas) : null,
        scroll: v.scroll != null ? Math.round(v.scroll / v.visitas) : null,
        medium: v.medium
      };
    }).sort(function (a, b) { return b.visitas - a.visitas; }).slice(0, 14);
  };

  return {
    visitas: sessoes.length,
    pessoas: pessoas.size || null,
    novos,
    recorrentes: sessoes.length - novos,
    tempoMedio: Math.round(tempoTotal / n),
    scrollMedio: Math.round(scrollTotal / n),
    telemovelPct: Math.round((aparelhos['Telemóvel'] ? aparelhos['Telemóvel'].visitas : 0) / n * 100),
    funil,
    origens: comTaxa(origens),
    campanhas: comTaxa(campanhas),
    aparelhos: comTaxa(aparelhos),
    saidas: ordenar(saidas),
    seccoes: ordenar(seccoes),
    cliques: ordenar(cliques),
    video: ordenar(video),
    simulacoes: simulacoes.slice(-40),
    tempoSeccao: Object.entries(tempoSeccao)
      .map(function (p) { return [p[0], Math.round(p[1].total / p[1].n)]; })
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 14),
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
        ok: true, semArmazenamento: true, leads: [], sessoes: [], resumo: resumir([]),
        aviso: 'Falta ligar a base de dados. Vercel → Storage → Upstash Redis (plano gratuito). ' +
               'Até lá, os contactos continuam a chegar por email mas não ficam guardados aqui.'
      });
    }
    try {
      const [leads, sessoes, estados] = await Promise.all([
        lerLeads(2000), lerSessoes(5000), lerEstados()
      ]);

      /* O estado comercial vive à parte da lista de contactos; juntamo-lo
         aqui para o painel receber cada contacto já completo. */
      const comEstado = leads.map(function (l) {
        const e = estados[chaveLead(l)] || {};
        return Object.assign({}, l, {
          chave: chaveLead(l),
          estado: e.estado || 'Novo',
          nota: e.nota || ''
        });
      });

      return res.status(200).json({
        ok: true,
        leads: comEstado,
        /* As sessões completas só das mais recentes: são para ver o
           percurso de cada uma, e ninguém percorre quinhentas. */
        sessoes: sessoes.slice(0, 120),
        resumo: resumir(sessoes)
      });
    } catch (e) {
      console.error('dados:', e.message);
      return res.status(500).json({ ok: false, erro: 'Não consegui ler os dados.' });
    }
  }

  /* ── estado de um contacto ── */
  if (accao === 'estado') {
    const permitidos = ['Novo', 'Contactado', 'Interessado', 'Cliente', 'Perdido'];
    const chave = String(d.chave || '').slice(0, 220);
    const estado = String(d.estado || 'Novo');
    if (!chave) return res.status(400).json({ ok: false, erro: 'Falta o contacto.' });
    if (permitidos.indexOf(estado) === -1) {
      return res.status(400).json({ ok: false, erro: 'Estado desconhecido.' });
    }
    try {
      await guardarEstado(chave, {
        estado,
        nota: String(d.nota == null ? '' : d.nota).slice(0, 600),
        ts: Date.now()
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('estado:', e.message);
      return res.status(500).json({ ok: false, erro: 'Não consegui guardar.' });
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
