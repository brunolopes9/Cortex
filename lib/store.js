/* ==========================================================================
   Armazenamento — Redis pela API REST da Upstash

   Escolhi Redis e não uma base de dados com tabelas porque aqui não há
   nada para consultar de forma complicada: é uma lista de contactos por
   ordem de chegada e um punhado de contadores. LPUSH é atómico, portanto
   dois formulários submetidos ao mesmo segundo não se atropelam.

   Provisionar: Vercel → Storage → Upstash Redis (tem plano gratuito).
   A integração injecta as variáveis sozinha. Aceitamos os dois nomes
   que a Vercel já usou ao longo do tempo.

   Sem Redis configurado nada rebenta: disponivel() devolve false e quem
   chama segue sem guardar. Os contactos continuam a chegar por email.
   ========================================================================== */

const URL_BASE =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  '';

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  '';

export function disponivel() {
  return Boolean(URL_BASE && TOKEN);
}

/* A API REST da Upstash aceita o comando como segmentos do caminho.
   Passamos o corpo em JSON para não ter de escapar nada à mão. */
async function comando(partes) {
  if (!disponivel()) throw new Error('Redis não configurado');
  const r = await fetch(URL_BASE, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(partes)
  });
  const texto = await r.text();
  if (!r.ok) throw new Error('Redis ' + r.status + ': ' + texto.slice(0, 200));
  const j = texto ? JSON.parse(texto) : {};
  if (j.error) throw new Error('Redis: ' + j.error);
  return j.result;
}

/* ── Contactos ────────────────────────────────────────────────────── */

const LISTA = 'cortex:leads';

export async function guardarLead(lead) {
  await comando(['LPUSH', LISTA, JSON.stringify(lead)]);
  /* Guardamos os 5000 mais recentes. Chega e sobra, e evita que a
     lista cresça sem limite se algum robô passar pelas defesas. */
  await comando(['LTRIM', LISTA, 0, 4999]);
}

export async function lerLeads(limite) {
  const linhas = await comando(['LRANGE', LISTA, 0, (limite || 1000) - 1]);
  return (linhas || []).map(function (l) {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

export async function contarLeads() {
  return (await comando(['LLEN', LISTA])) || 0;
}

/* ── Visitas ──────────────────────────────────────────────────────── */

const SESSOES = 'cortex:sessoes';

export async function guardarSessao(s) {
  await comando(['LPUSH', SESSOES, JSON.stringify(s)]);
  await comando(['LTRIM', SESSOES, 0, 9999]);
}

export async function lerSessoes(limite) {
  const linhas = await comando(['LRANGE', SESSOES, 0, (limite || 2000) - 1]);
  return (linhas || []).map(function (l) {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}
