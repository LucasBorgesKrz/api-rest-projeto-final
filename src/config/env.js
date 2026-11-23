/**
 * Lê e valida a configuração a partir das variáveis de ambiente.
 * Nenhum segredo fica no código: tudo vem do ambiente (.env local ou painel da
 * nuvem). A API se recusa a subir com configuração insegura.
 */

// Mesma política de senha do cadastro (letra + número, 8 a 72 bytes).
const senhaValida = (s) => s.length >= 8 && Buffer.byteLength(s) <= 72 && /[A-Za-z]/.test(s) && /\d/.test(s);

export const loadConfig = (env = process.env) => {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith('troque-')) {
    throw new Error(
      'JWT_SECRET ausente, curto (mínimo 32 caracteres) ou ainda com o valor de exemplo. ' +
        'Rode `npm run setup` ou defina um segredo aleatório no ambiente.',
    );
  }

  const bcryptRounds = Number(env.BCRYPT_ROUNDS) || 10;
  if (bcryptRounds < 4 || bcryptRounds > 15) throw new Error('BCRYPT_ROUNDS deve estar entre 4 e 15.');

  let admin = null;
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    if (env.ADMIN_PASSWORD.startsWith('troque-') || !senhaValida(env.ADMIN_PASSWORD)) {
      throw new Error('ADMIN_PASSWORD inválida: use 8 a 72 caracteres, com letra e número (e não o valor de exemplo).');
    }
    admin = { nome: env.ADMIN_NOME || 'Administrador', email: env.ADMIN_EMAIL, senha: env.ADMIN_PASSWORD };
  }

  return {
    nodeEnv: env.NODE_ENV || 'development',
    port: Number(env.PORT) || 3000,
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '1h',
    bcryptRounds,
    admin,
    // Atrás de proxy/balanceador (Render, Railway...), use TRUST_PROXY=1 para ver o IP real do cliente.
    trustProxy: Number(env.TRUST_PROXY) || 0,
    // Limite de tentativas em /login e /register (proteção contra força bruta).
    authRateLimit: {
      windowMs: (Number(env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000,
      max: Number(env.RATE_LIMIT_AUTH_MAX) || 40,
    },
  };
};
