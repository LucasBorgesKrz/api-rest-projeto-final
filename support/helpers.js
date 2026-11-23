// Utilitários compartilhados pelos testes (não contém testes).
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { UsuarioRepository } from '../src/repositories/usuario.repository.js';
import { ProdutoRepository } from '../src/repositories/produto.repository.js';
import { seedAdmin } from '../src/services/seedAdmin.js';

export const SEGREDO = randomBytes(32).toString('hex'); // aleatório a cada execução: nada fixo no código
export const MARIA = { nome: 'Maria Silva', email: 'maria@exemplo.com', senha: 'Senha123' };
// Senha do admin de teste gerada na hora (nenhuma credencial fixa no repositório).
export const ADMIN = { nome: 'Admin', email: 'admin@exemplo.com', senha: `Adm1n-${randomBytes(6).toString('hex')}` };

/** Sobe uma instância isolada da API (repositórios novos) numa porta livre. */
export const criarAmbiente = async (overrides = {}) => {
  const config = {
    ...loadConfig({ JWT_SECRET: SEGREDO, BCRYPT_ROUNDS: '4' }),
    authRateLimit: { windowMs: 60_000, max: 10_000 }, // alto, para não atrapalhar os testes
    ...overrides,
  };
  const usuarios = new UsuarioRepository();
  const produtos = new ProdutoRepository();
  await seedAdmin({ repository: usuarios, admin: ADMIN, bcryptRounds: 4 });

  const server = createApp({ config, usuarioRepository: usuarios, produtoRepository: produtos }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const chamar = async (metodo, caminho, { body, token, cabecalhos } = {}) => {
    const res = await fetch(base + caminho, {
      method: metodo,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...cabecalhos,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const texto = await res.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* 204 ou HTML */ }
    return { status: res.status, body: json, texto, headers: res.headers };
  };

  const registrar = (dados = MARIA) => chamar('POST', '/register', { body: dados });
  const login = async (dados) => (await chamar('POST', '/login', { body: { email: dados.email, senha: dados.senha } })).body;
  const tokenDe = async (dados) => (await login(dados)).token;

  return {
    base, config, usuarios, produtos, chamar, registrar, login, tokenDe,
    fechar: () => new Promise((r) => server.close(r)),
  };
};

/** Todo erro da API deve seguir exatamente este contrato. */
export const assertErro = (res, status, error) => {
  assert.equal(res.status, status);
  assert.deepEqual(Object.keys(res.body).sort(), ['details', 'error', 'message', 'status', 'timestamp']);
  assert.equal(res.body.status, status);
  assert.equal(res.body.error, error);
  assert.equal(typeof res.body.message, 'string');
  assert.ok(Array.isArray(res.body.details));
  assert.ok(!Number.isNaN(Date.parse(res.body.timestamp)));
};

export const produtoValido = { nome: 'Notebook Gamer', categoria: 'eletronicos', preco: 4999.9, estoque: 12, ativo: true };
