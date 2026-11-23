import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ADMIN, MARIA, SEGREDO, assertErro, criarAmbiente } from '../support/helpers.js';

let a; // ambiente
beforeEach(async () => { a = await criarAmbiente(); });
afterEach(() => a.fechar());

const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

describe('Cadastro (POST /register) e hash de senha', () => {
  it('cria usuário (201) com perfil comum e NÃO retorna senha nem hash', async () => {
    const res = await a.registrar();
    assert.equal(res.status, 201);
    assert.deepEqual(Object.keys(res.body).sort(), ['criadoEm', 'email', 'id', 'nome', 'perfil']);
    assert.equal(res.body.perfil, 'comum');
    assert.doesNotMatch(res.texto, /senha|hash|\$2[aby]\$|Senha123/i);
  });

  it('salva a senha como hash bcrypt (nunca em texto plano), com salt diferente por usuário', async () => {
    await a.registrar();
    await a.registrar({ ...MARIA, email: 'outra@exemplo.com' });
    const h1 = a.usuarios.findByEmail('maria@exemplo.com').senhaHash;
    const h2 = a.usuarios.findByEmail('outra@exemplo.com').senhaHash;
    assert.match(h1, /^\$2[aby]\$\d{2}\$.{53}$/);
    assert.notEqual(h1, MARIA.senha);
    assert.notEqual(h1, h2);
    assert.equal(await bcrypt.compare(MARIA.senha, h1), true);
    assert.equal(await bcrypt.compare('Outra123', h1), false);
  });

  it('e-mail único (409), inclusive com maiúsculas/espaços; cadastros simultâneos geram só 1 usuário', async () => {
    await a.registrar();
    assertErro(await a.registrar({ ...MARIA, email: '  MARIA@Exemplo.com ' }), 409, 'USER_ALREADY_EXISTS');
    const corrida = await Promise.all(Array.from({ length: 5 }, () => a.registrar({ ...MARIA, email: 'corrida@exemplo.com' })));
    assert.equal(corrida.filter((r) => r.status === 201).length, 1);
    assert.equal(corrida.filter((r) => r.status === 409).length, 4);
  });

  it('valida entrada (400 com details por campo): e-mail, senha fraca, nome ausente', async () => {
    const res = await a.registrar({ email: 'nao-e-email', senha: 'curta' });
    assertErro(res, 400, 'VALIDATION_ERROR');
    const campos = res.body.details.map((d) => d.field);
    for (const c of ['nome', 'email', 'senha']) assert.ok(campos.includes(c), c);
    for (const senha of ['somenteletras', '1234567890', 'a1'.repeat(40)]) {
      assertErro(await a.registrar({ ...MARIA, senha }), 400, 'VALIDATION_ERROR');
    }
  });

  it('NÃO permite se cadastrar como admin (escalada de privilégio)', async () => {
    const res = await a.registrar({ ...MARIA, perfil: 'admin' });
    assertErro(res, 400, 'VALIDATION_ERROR');
    assert.equal(a.usuarios.findByEmail(MARIA.email), null);
  });
});

describe('Login (POST /login) e rota protegida (GET /perfil)', () => {
  it('login devolve JWT com id e perfil no payload, expiração e sem dados sensíveis', async () => {
    const criado = (await a.registrar()).body;
    const res = await a.chamar('POST', '/login', { body: { email: MARIA.email, senha: MARIA.senha } });
    assert.equal(res.status, 200);
    assert.equal(res.body.tokenType, 'Bearer');
    assert.equal(res.body.expiresIn, 3600);
    assert.doesNotMatch(res.texto, /senhaHash|\$2[aby]\$/);
    const payload = jwt.verify(res.body.token, SEGREDO, { algorithms: ['HS256'] });
    assert.equal(payload.id, criado.id);
    assert.equal(payload.perfil, 'comum');
    assert.equal(payload.exp - payload.iat, 3600);
    assert.equal(payload.senha, undefined);
  });

  it('senha errada e e-mail inexistente dão a MESMA resposta 401', async () => {
    await a.registrar();
    const errada = await a.chamar('POST', '/login', { body: { email: MARIA.email, senha: 'Errada123' } });
    const semUsuario = await a.chamar('POST', '/login', { body: { email: 'ninguem@exemplo.com', senha: 'Errada123' } });
    assertErro(errada, 401, 'INVALID_CREDENTIALS');
    assertErro(semUsuario, 401, 'INVALID_CREDENTIALS');
    assert.equal(errada.body.message, semUsuario.body.message);
    assert.equal(errada.headers.get('www-authenticate'), 'Bearer');
  });

  it('GET /perfil: com token 200; sem token 401', async () => {
    await a.registrar();
    const ok = await a.chamar('GET', '/perfil', { token: await a.tokenDe(MARIA) });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.email, MARIA.email);
    assert.doesNotMatch(ok.texto, /senha|hash/i);
    assertErro(await a.chamar('GET', '/perfil'), 401, 'UNAUTHORIZED');
  });

  it('cabeçalho mal formado, token lixo ou adulterado -> 401 INVALID_TOKEN', async () => {
    await a.registrar();
    const token = await a.tokenDe(MARIA);
    for (const valor of [token, `Basic ${token}`, 'Bearer', 'Bearer a b']) {
      assertErro(await a.chamar('GET', '/perfil', { cabecalhos: { Authorization: valor } }), 401, 'INVALID_TOKEN');
    }
    const adulterado = token.slice(0, -4) + (token.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    for (const t of ['abc.def.ghi', 'lixo', adulterado]) {
      assertErro(await a.chamar('GET', '/perfil', { token: t }), 401, 'INVALID_TOKEN');
    }
  });

  it('token expirado -> 401 TOKEN_EXPIRED', async () => {
    const { body: u } = await a.registrar();
    const expirado = jwt.sign({ id: u.id, perfil: 'comum' }, SEGREDO, { algorithm: 'HS256', expiresIn: -10 });
    assertErro(await a.chamar('GET', '/perfil', { token: expirado }), 401, 'TOKEN_EXPIRED');
  });

  it('token forjado (outro segredo) ou com alg "none" -> 401', async () => {
    const { body: u } = await a.registrar();
    const forjado = jwt.sign({ id: u.id, perfil: 'admin' }, 'segredo-do-atacante-segredo-do-atacante', { algorithm: 'HS256' });
    assertErro(await a.chamar('GET', '/perfil', { token: forjado }), 401, 'INVALID_TOKEN');
    const semAssinatura = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ id: u.id, perfil: 'admin' })}.`;
    assertErro(await a.chamar('GET', '/perfil', { token: semAssinatura }), 401, 'INVALID_TOKEN');
  });

  it('token de usuário excluído deixa de funcionar', async () => {
    const { body: u } = await a.registrar();
    const tokenMaria = await a.tokenDe(MARIA);
    await a.chamar('DELETE', `/usuarios/${u.id}`, { token: await a.tokenDe(ADMIN) });
    assertErro(await a.chamar('GET', '/perfil', { token: tokenMaria }), 401, 'INVALID_TOKEN');
  });
});

describe('RBAC em /usuarios (somente admin)', () => {
  it('sem token 401; comum 403 (e nada é excluído); admin 200/204', async () => {
    const { body: alvo } = await a.registrar();
    assertErro(await a.chamar('GET', '/usuarios'), 401, 'UNAUTHORIZED');

    const tokenComum = await a.tokenDe(MARIA);
    assertErro(await a.chamar('GET', '/usuarios', { token: tokenComum }), 403, 'FORBIDDEN');
    assertErro(await a.chamar('DELETE', `/usuarios/${alvo.id}`, { token: tokenComum }), 403, 'FORBIDDEN');
    assert.ok(a.usuarios.findById(alvo.id));

    const tokenAdmin = await a.tokenDe(ADMIN);
    const lista = await a.chamar('GET', '/usuarios', { token: tokenAdmin });
    assert.equal(lista.status, 200);
    assert.doesNotMatch(lista.texto, /senha|hash|\$2[aby]\$/i);
    assert.equal((await a.chamar('DELETE', `/usuarios/${alvo.id}`, { token: tokenAdmin })).status, 204);
    assert.equal(a.usuarios.findById(alvo.id), null);
  });

  it('admin: id inexistente 404, id inválido 400, excluir a si mesmo 422', async () => {
    const tokenAdmin = await a.tokenDe(ADMIN);
    const adminId = a.usuarios.findByEmail(ADMIN.email).id;
    assertErro(await a.chamar('DELETE', '/usuarios/3f1c2b7e-8a4d-4c1e-9b0a-5d6e7f8a9b0c', { token: tokenAdmin }), 404, 'USER_NOT_FOUND');
    assertErro(await a.chamar('DELETE', '/usuarios/abc', { token: tokenAdmin }), 400, 'VALIDATION_ERROR');
    assertErro(await a.chamar('DELETE', `/usuarios/${adminId}`, { token: tokenAdmin }), 422, 'CANNOT_DELETE_SELF');
  });

  it('perfil "admin" escrito num token válido NÃO basta: vale o perfil real do usuário', async () => {
    const { body: u } = await a.registrar();
    const inflado = jwt.sign({ id: u.id, perfil: 'admin' }, SEGREDO, { algorithm: 'HS256', expiresIn: '1h' });
    assertErro(await a.chamar('GET', '/usuarios', { token: inflado }), 403, 'FORBIDDEN');
  });

  it('o único admin é o do seed: o registro público nunca cria admin', async () => {
    await a.registrar();
    const admins = a.usuarios.findAll().filter((u) => u.perfil === 'admin');
    assert.equal(admins.length, 1);
    assert.equal(admins[0].email, ADMIN.email);
  });
});
