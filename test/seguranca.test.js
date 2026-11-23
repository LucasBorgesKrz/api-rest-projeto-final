import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { loadConfig } from '../src/config/env.js';
import { openapi } from '../src/openapi.js';
import { ADMIN, MARIA, assertErro, criarAmbiente } from '../support/helpers.js';

const RAIZ = join(import.meta.dirname, '..');

describe('Tratamento global de erros', () => {
  it('rota inexistente 404, JSON inválido 400, formato padrão', async () => {
    const a = await criarAmbiente();
    assertErro(await a.chamar('GET', '/nao-existe'), 404, 'ROUTE_NOT_FOUND');
    const res = await fetch(`${a.base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ "email": ' });
    assertErro({ status: res.status, body: await res.json() }, 400, 'INVALID_JSON');
    await a.fechar();
  });

  it('erro interno -> 500 genérico (sem vazar nada), é logado, e a API segue de pé', async () => {
    const a = await criarAmbiente();
    const log = mock.method(console, 'error', () => {});
    mock.method(a.produtos, 'buscar', () => { throw new Error('ECONNREFUSED 10.0.0.5:5432 SELECT * FROM produtos'); });
    const res = await a.chamar('GET', '/produtos');
    assertErro(res, 500, 'INTERNAL_SERVER_ERROR');
    assert.equal(res.body.message, 'Erro interno no servidor. Tente novamente mais tarde.');
    assert.doesNotMatch(res.texto, /ECONNREFUSED|SELECT|10\.0\.|stack/i);
    assert.equal(log.mock.callCount(), 1);
    assert.match(JSON.parse(log.mock.calls[0].arguments[0]).stack, /Error/);
    mock.restoreAll();
    assert.equal((await a.chamar('GET', '/health')).status, 200);
    await a.fechar();
  });
});

describe('Endurecimento para produção', () => {
  it('Helmet: cabeçalhos de segurança presentes e sem x-powered-by', async () => {
    const a = await criarAmbiente();
    const { headers } = await a.chamar('GET', '/health');
    assert.equal(headers.get('x-powered-by'), null);
    assert.equal(headers.get('x-content-type-options'), 'nosniff');
    assert.ok(headers.get('strict-transport-security'));
    assert.ok(headers.get('content-security-policy'));
    await a.fechar();
  });

  it('limite de tentativas em /login e /register: excedeu -> 429 no formato padrão', async () => {
    const a = await criarAmbiente({ authRateLimit: { windowMs: 60_000, max: 3 } });
    const tentativa = () => a.chamar('POST', '/login', { body: { email: MARIA.email, senha: 'Errada123' } });
    for (let i = 0; i < 3; i++) assert.equal((await tentativa()).status, 401);
    const bloqueada = await tentativa();
    assertErro(bloqueada, 429, 'TOO_MANY_REQUESTS');
    // o limite vale também para /register (mesmo contador), e não afeta as demais rotas
    assertErro(await a.registrar(), 429, 'TOO_MANY_REQUESTS');
    assert.equal((await a.chamar('GET', '/produtos')).status, 200);
    await a.fechar();
  });
});

describe('Documentação Swagger/OpenAPI', () => {
  it('/api-docs serve o Swagger UI e /api-docs.json é uma spec OpenAPI 3 válida', async () => {
    const a = await criarAmbiente();
    const html = await fetch(`${a.base}/api-docs/`);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /swagger-ui/i);
    const spec = await a.chamar('GET', '/api-docs.json');
    assert.equal(spec.body.openapi, '3.0.3');
    await SwaggerParser.validate(structuredClone(openapi));
    await a.fechar();
  });

  it('documenta todos os endpoints, o Bearer JWT, e não expõe senha nos schemas de resposta', () => {
    assert.deepEqual(Object.keys(openapi.paths).sort(), ['/health', '/login', '/perfil', '/produtos', '/produtos/{id}', '/register', '/usuarios', '/usuarios/{id}']);
    const bearer = openapi.components.securitySchemes.bearerAuth;
    assert.equal(bearer.scheme, 'bearer');
    assert.equal(bearer.bearerFormat, 'JWT');
    for (const [rota, metodo] of [['/perfil', 'get'], ['/produtos', 'post'], ['/produtos/{id}', 'put'], ['/produtos/{id}', 'patch'], ['/produtos/{id}', 'delete'], ['/usuarios', 'get'], ['/usuarios/{id}', 'delete']]) {
      assert.ok(openapi.paths[rota][metodo].security, `${metodo.toUpperCase()} ${rota} deve declarar segurança`);
    }
    for (const [rota, metodo] of [['/register', 'post'], ['/login', 'post'], ['/produtos', 'get'], ['/produtos/{id}', 'get']]) {
      assert.equal(openapi.paths[rota][metodo].security, undefined, `${metodo.toUpperCase()} ${rota} é público`);
    }
    assert.equal(openapi.components.schemas.Usuario.properties.senha, undefined);
  });
});

describe('Configuração segura (variáveis de ambiente)', () => {
  const forte = 'x'.repeat(48);

  it('recusa JWT_SECRET ausente, curto ou o valor de exemplo', () => {
    for (const JWT_SECRET of [undefined, '', 'curto', 'troque-este-valor-por-um-segredo-aleatorio']) {
      assert.throws(() => loadConfig({ JWT_SECRET }), /JWT_SECRET/);
    }
  });

  it('recusa ADMIN_PASSWORD fraca ou de exemplo; aceita uma forte', () => {
    for (const ADMIN_PASSWORD of ['curta1', 'somenteletras', '12345678', 'troque-esta-senha-do-admin1']) {
      assert.throws(() => loadConfig({ JWT_SECRET: forte, ADMIN_EMAIL: 'a@b.com', ADMIN_PASSWORD }), /ADMIN_PASSWORD/);
    }
    const c = loadConfig({ JWT_SECRET: forte, ADMIN_EMAIL: 'a@b.com', ADMIN_PASSWORD: 'Forte1234' });
    assert.equal(c.admin.email, 'a@b.com');
    assert.equal(c.bcryptRounds, 10);
    assert.equal(c.jwtExpiresIn, '1h');
  });
});

describe('Nenhum segredo no repositório (code review automatizado)', () => {
  const IGNORAR = new Set(['node_modules', '.git', 'package-lock.json']);
  const arquivos = (dir) =>
    readdirSync(dir).flatMap((nome) => {
      if (IGNORAR.has(nome)) return [];
      const caminho = join(dir, nome);
      return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
    });
  // Arquivos que VÃO para o Git: tudo, menos o .env local (que o .gitignore protege).
  const rastreaveis = () => arquivos(RAIZ).filter((f) => relative(RAIZ, f) !== '.env' && !/\.(png|gif|jpg)$/i.test(f));

  it('.env está no .gitignore e .env.example só tem valores de exemplo', () => {
    const gitignore = readFileSync(join(RAIZ, '.gitignore'), 'utf8');
    assert.match(gitignore, /^\.env$/m);
    const exemplo = readFileSync(join(RAIZ, '.env.example'), 'utf8');
    assert.match(exemplo, /^JWT_SECRET=troque-/m);
    assert.match(exemplo, /^ADMIN_PASSWORD=troque-/m);
  });

  it('nenhum arquivo versionável contém JWT real, segredo hexadecimal longo ou senha fixa', () => {
    const problemas = [];
    for (const arquivo of rastreaveis()) {
      const texto = readFileSync(arquivo, 'utf8');
      const nome = relative(RAIZ, arquivo);
      if (/eyJ[\w-]{15,}\.[\w-]{15,}\.[\w-]{10,}/.test(texto)) problemas.push(`${nome}: parece um JWT completo`);
      if (/\b[0-9a-f]{64,}\b/i.test(texto)) problemas.push(`${nome}: sequência hexadecimal longa (segredo?)`);
      if (/^(JWT_SECRET|ADMIN_PASSWORD)=(?!troque-)\S+/m.test(texto)) problemas.push(`${nome}: valor real em JWT_SECRET/ADMIN_PASSWORD`);
      // Senha de demonstração da atividade anterior (montada em partes para este arquivo não se acusar).
      if (texto.includes(['Admin', '12345'].join('@'))) problemas.push(`${nome}: senha de admin fixa`);
    }
    assert.deepEqual(problemas, []);
  });

  it('o código-fonte lê o segredo do ambiente (nunca de um literal)', () => {
    const tokenService = readFileSync(join(RAIZ, 'src/services/token.service.js'), 'utf8');
    assert.doesNotMatch(tokenService, /sign\([^)]*,\s*['"`]/); // sign(payload, 'literal') seria segredo no código
    const app = readFileSync(join(RAIZ, 'src/app.js'), 'utf8');
    assert.match(app, /config\.jwtSecret/);
    assert.ok(existsSync(join(RAIZ, 'src/config/env.js')));
  });
});
