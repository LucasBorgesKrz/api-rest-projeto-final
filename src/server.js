import dotenv from 'dotenv';
import { loadConfig } from './config/env.js';
import { createApp } from './app.js';
import { UsuarioRepository } from './repositories/usuario.repository.js';
import { seedAdmin } from './services/seedAdmin.js';
import { logger } from './utils/logger.js';

dotenv.config({ quiet: true }); // carrega o .env local (na nuvem, as variáveis já vêm do ambiente)

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`Configuração inválida: ${err.message}`);
  process.exit(1);
}

// Promises rejeitadas fora de uma requisição: registra, não derruba o processo.
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
});

const usuarioRepository = new UsuarioRepository();
const admin = await seedAdmin({ repository: usuarioRepository, admin: config.admin, bcryptRounds: config.bcryptRounds });
if (!config.admin) console.warn('Aviso: ADMIN_EMAIL/ADMIN_PASSWORD não definidos; nenhuma conta admin foi criada.');

const server = createApp({ config, usuarioRepository }).listen(config.port, () => {
  console.log(`API rodando na porta ${config.port} (${config.nodeEnv})`);
  console.log(`Documentação Swagger: /api-docs`);
  if (admin) console.log(`Conta admin pronta: ${admin.email}`);
});

// A nuvem envia SIGTERM ao reiniciar/atualizar: termina as requisições em andamento antes de sair.
const encerrar = (sinal) => {
  console.log(`${sinal} recebido: encerrando...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));
