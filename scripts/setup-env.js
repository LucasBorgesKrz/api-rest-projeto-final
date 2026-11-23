// Cria o arquivo .env a partir do .env.example, com valores ALEATÓRIOS gerados na hora
// (JWT_SECRET e a senha do admin local), se ele ainda não existir.
// Roda antes de `npm start` / `npm run dev`. Não faz nada em produção: lá as
// variáveis vêm do painel da nuvem, nunca de um arquivo.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

if (process.env.NODE_ENV === 'production') process.exit(0);

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, '.env');

if (!existsSync(destino)) {
  const modelo = readFileSync(join(raiz, '.env.example'), 'utf8');
  const segredo = randomBytes(48).toString('hex');
  // Senha aleatória que cumpre a política (letras + números); o sufixo garante os dois tipos.
  const senhaAdmin = `${randomBytes(9).toString('base64url')}a1`;

  writeFileSync(
    destino,
    modelo
      .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${segredo}`)
      .replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${senhaAdmin}`),
  );

  const email = /^ADMIN_EMAIL=(.*)$/m.exec(modelo)?.[1] ?? 'admin@exemplo.com';
  console.log('Arquivo .env criado com valores aleatórios (ele NÃO vai para o GitHub).');
  console.log(`Conta admin local -> e-mail: ${email} | senha: ${senhaAdmin}  (também salva no .env)`);
}
