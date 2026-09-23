/* Função de diagnóstico: sem imports, sem dependências.
   Se esta responder e as outras não, o problema está nos imports. */
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    node: process.version,
    temResend: Boolean(process.env.RESEND_API_KEY),
    temRedis: Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    temAdminPw: Boolean(process.env.ADMIN_PASSWORD),
    temAdminSecret: Boolean(process.env.ADMIN_SECRET),
    mailFrom: process.env.MAIL_FROM || '(por definir)',
    mailTo: process.env.MAIL_TO ? 'definido' : '(por definir)'
  });
}
