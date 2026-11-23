// Troca o endereço de exemplo pela URL real do deploy em todos os arquivos de documentação.
//
//   node scripts/definir-url.js https://minha-api.onrender.com
//
// Arquivos atualizados: README.md, api.http, docs/APRESENTACAO.md e o ambiente
// de produção da coleção Postman.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLACEHOLDER = 'https://SEU-APP.onrender.com';
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const entrada = process.argv[2];

let url;
try {
  url = new URL(entrada);
  if (url.protocol !== 'https:') throw new Error('use https');
} catch {
  console.error('Uso: node scripts/definir-url.js https://sua-api.onrender.com');
  process.exit(1);
}
const novaUrl = url.origin; // sem barra final nem caminho

for (const arquivo of ['README.md', 'api.http', 'docs/APRESENTACAO.md', 'docs/postman/producao.postman_environment.json']) {
  const caminho = join(raiz, arquivo);
  if (!existsSync(caminho)) continue;
  const texto = readFileSync(caminho, 'utf8');
  const ocorrencias = texto.split(PLACEHOLDER).length - 1;
  writeFileSync(caminho, texto.replaceAll(PLACEHOLDER, novaUrl));
  console.log(`${arquivo}: ${ocorrencias} ocorrência(s) atualizada(s)`);
}
console.log(`\nURL definida: ${novaUrl}  (Swagger: ${novaUrl}/api-docs)`);
