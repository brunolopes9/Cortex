/* ==========================================================================
   Autenticação do painel reservado

   Uma palavra-passe, guardada em variável de ambiente, nunca no código.
   Quem acerta recebe um cookie assinado com HMAC-SHA256 — assinado, não
   encriptado: não guarda segredos nenhuns, só diz "esta sessão é válida
   até tal hora" de forma que não se possa forjar sem o segredo.

   Variáveis:
     ADMIN_PASSWORD   a palavra-passe do painel
     ADMIN_SECRET     segredo para assinar o cookie (qualquer texto longo)
   ========================================================================== */

import crypto from 'node:crypto';

const COOKIE = 'cortex_admin';
const DURACAO = 12 * 60 * 60 * 1000; // 12 horas

function segredo() {
  return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
}

function assinar(valor) {
  return crypto.createHmac('sha256', segredo()).update(valor).digest('base64url');
}

/* Comparação em tempo constante. Comparar com === deixa escapar, pelo
   tempo que demora, quantos caracteres iniciais estavam certos. */
function iguais(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

export function passwordCorrecta(tentativa) {
  const certa = process.env.ADMIN_PASSWORD || '';
  if (!certa) return false;
  return iguais(tentativa || '', certa);
}

export function criarCookie() {
  const expira = Date.now() + DURACAO;
  const valor = expira + '.' + assinar(String(expira));
  return COOKIE + '=' + valor +
    '; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=' + Math.floor(DURACAO / 1000);
}

export function limparCookie() {
  return COOKIE + '=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0';
}

export function autenticado(req) {
  if (!segredo()) return false;
  const bruto = req.headers.cookie || '';
  const par = bruto.split(';').map(function (c) { return c.trim(); })
    .find(function (c) { return c.startsWith(COOKIE + '='); });
  if (!par) return false;

  const valor = par.slice(COOKIE.length + 1);
  const corte = valor.lastIndexOf('.');
  if (corte < 1) return false;

  const expira = valor.slice(0, corte);
  const assinatura = valor.slice(corte + 1);
  if (!iguais(assinatura, assinar(expira))) return false;

  return Number(expira) > Date.now();
}
