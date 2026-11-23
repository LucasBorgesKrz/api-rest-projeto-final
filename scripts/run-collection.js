// Roda a coleção de testes do Postman (docs/postman) com o Newman, pelo terminal.
//
//   npm run test:collection
//       Sobe a API em memória (com um admin temporário e segredos aleatórios), roda a
//       coleção contra ela e encerra. Não precisa de .env nem de servidor aberto.
//
//   npm run test:collection -- https://SEU-APP.onrender.com
//       Roda a coleção contra uma API já publicada. Informe o admin dela pelas variáveis
//       de ambiente ADMIN_EMAIL e ADMIN_PASSWORD (podem estar no seu .env local).
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';
import newman from 'newman';

dotenv.config({ quiet: true });

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const colecao = join(raiz, 'docs/postman/api-projeto-final.postman_collection.json');
const alvoRemoto = process.argv[2];

let baseUrl;
let adminEmail;
let adminSenha;
let encerrarServidor = async () => {};

if (alvoRemoto) {
  baseUrl = alvoRemoto.replace(/\/+$/, '');
  adminEmail = process.env.ADMIN_EMAIL;
  adminSenha = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminSenha) {
    console.error('Para testar uma API remota, defina ADMIN_EMAIL e ADMIN_PASSWORD (do admin dela) no ambiente ou no .env.');
    process.exit(1);
  }
  console.log(`Testando a API publicada em ${baseUrl}`);
} else {
  // Servidor local temporário, isolado, com credenciais geradas na hora.
  const { createApp } = await import('../src/app.js');
  const { loadConfig } = await import('../src/config/env.js');
  const { UsuarioRepository } = await import('../src/repositories/usuario.repository.js');
  const { seedAdmin } = await import('../src/services/seedAdmin.js');

  adminEmail = 'admin@exemplo.com';
  adminSenha = `Adm1n-${randomBytes(6).toString('hex')}`;
  const config = loadConfig({
    JWT_SECRET: randomBytes(32).toString('hex'),
    BCRYPT_ROUNDS: '4',
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminSenha,
  });
  const usuarioRepository = new UsuarioRepository();
  await seedAdmin({ repository: usuarioRepository, admin: config.admin, bcryptRounds: config.bcryptRounds });

  const server = createApp({ config, usuarioRepository }).listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  encerrarServidor = () => new Promise((r) => server.close(r));
  console.log(`API temporária em ${baseUrl}`);
}

const ambiente = {
  values: [
    { key: 'baseUrl', value: baseUrl, enabled: true },
    { key: 'adminEmail', value: adminEmail, enabled: true },
    { key: 'adminSenha', value: adminSenha, enabled: true },
  ],
};

newman.run({ collection: colecao, environment: ambiente, reporters: ['cli'], color: 'off' }, async (erro, resumo) => {
  await encerrarServidor();
  if (erro) {
    console.error(erro);
    process.exit(1);
  }
  const falhas = resumo.run.failures.length;
  console.log(falhas === 0 ? '\nColeção OK: todos os testes passaram.' : `\n${falhas} teste(s) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
});
