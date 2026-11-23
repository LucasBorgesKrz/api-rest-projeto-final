import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gerarProdutos } from '../src/data/produtos.seed.js';
import { ADMIN, MARIA, assertErro, criarAmbiente, produtoValido } from '../support/helpers.js';

const TODOS = gerarProdutos();
const ids = (res) => res.body.data.map((p) => p.id);

describe('CRUD de produtos e controle de acesso', () => {
  let a, tokenComum, tokenAdmin;
  before(async () => {
    a = await criarAmbiente();
    await a.registrar();
    tokenComum = await a.tokenDe(MARIA);
    tokenAdmin = await a.tokenDe(ADMIN);
  });
  after(() => a.fechar());

  it('POST sem token -> 401 e nada é criado', async () => {
    assertErro(await a.chamar('POST', '/produtos', { body: produtoValido }), 401, 'UNAUTHORIZED');
    assert.equal((await a.chamar('GET', '/produtos')).body.meta.totalItems, 150);
  });

  it('POST autenticado -> 201, Location, autor registrado, padrões aplicados', async () => {
    const res = await a.chamar('POST', '/produtos', { token: tokenComum, body: { nome: '  Mouse Sem Fio ', categoria: 'ELETRONICOS', preco: 89.9 } });
    assert.equal(res.status, 201);
    assert.equal(res.body.id, 151); // próximo id depois dos 150 de exemplo
    assert.equal(res.body.nome, 'Mouse Sem Fio'); // trim
    assert.equal(res.body.categoria, 'eletronicos'); // normalizado
    assert.equal(res.body.estoque, 0);
    assert.equal(res.body.ativo, true);
    assert.equal(res.body.criadoPor, a.usuarios.findByEmail(MARIA.email).id);
    assert.equal(res.headers.get('location'), '/produtos/151');
    assert.equal((await a.chamar('GET', '/produtos/151')).body.nome, 'Mouse Sem Fio');
  });

  it('POST com dados inválidos -> 400 com details por campo (e nada é criado)', async () => {
    const antes = (await a.chamar('GET', '/produtos')).body.meta.totalItems;
    const res = await a.chamar('POST', '/produtos', {
      token: tokenComum,
      body: { nome: 'X', categoria: 'brinquedos', preco: -5, estoque: 1.5, ativo: 'sim' },
    });
    assertErro(res, 400, 'VALIDATION_ERROR');
    assert.deepEqual(res.body.details.map((d) => d.field).sort(), ['ativo', 'categoria', 'estoque', 'nome', 'preco']);
    assert.equal((await a.chamar('GET', '/produtos')).body.meta.totalItems, antes);
  });

  it('POST: campos obrigatórios, preço com 3 casas e corpo ausente -> 400', async () => {
    assertErro(await a.chamar('POST', '/produtos', { token: tokenComum, body: {} }), 400, 'VALIDATION_ERROR');
    assertErro(await a.chamar('POST', '/produtos', { token: tokenComum, body: { ...produtoValido, preco: 10.999 } }), 400, 'VALIDATION_ERROR');
    assertErro(await a.chamar('POST', '/produtos', { token: tokenComum }), 400, 'VALIDATION_ERROR');
  });

  it('GET /produtos/:id: existente 200; inexistente 404; id inválido 400', async () => {
    assert.equal((await a.chamar('GET', '/produtos/7')).body.id, 7);
    assertErro(await a.chamar('GET', '/produtos/99999'), 404, 'PRODUCT_NOT_FOUND');
    assertErro(await a.chamar('GET', '/produtos/abc'), 400, 'VALIDATION_ERROR');
  });

  it('PUT substitui por completo (200); exige todos os campos; 404 se não existe', async () => {
    const novo = { nome: 'Teclado Novo', categoria: 'eletronicos', preco: 250, estoque: 3, ativo: false };
    const res = await a.chamar('PUT', '/produtos/10', { token: tokenComum, body: novo });
    assert.equal(res.status, 200);
    assert.deepEqual({ ...res.body, id: undefined, criadoEm: undefined, atualizadoEm: undefined, criadoPor: undefined }, { ...novo, id: undefined, criadoEm: undefined, atualizadoEm: undefined, criadoPor: undefined });
    assert.notEqual(res.body.atualizadoEm, null);
    assertErro(await a.chamar('PUT', '/produtos/10', { token: tokenComum, body: { nome: 'Só nome' } }), 400, 'VALIDATION_ERROR');
    assertErro(await a.chamar('PUT', '/produtos/99999', { token: tokenComum, body: novo }), 404, 'PRODUCT_NOT_FOUND');
    assertErro(await a.chamar('PUT', '/produtos/10', { body: novo }), 401, 'UNAUTHORIZED');
  });

  it('PATCH altera só os campos enviados; corpo vazio -> 400; 404 se não existe', async () => {
    const antes = (await a.chamar('GET', '/produtos/20')).body;
    const res = await a.chamar('PATCH', '/produtos/20', { token: tokenComum, body: { preco: 77.5 } });
    assert.equal(res.status, 200);
    assert.equal(res.body.preco, 77.5);
    assert.equal(res.body.nome, antes.nome); // intacto
    assert.equal(res.body.categoria, antes.categoria);
    assertErro(await a.chamar('PATCH', '/produtos/20', { token: tokenComum, body: {} }), 400, 'VALIDATION_ERROR');
    assertErro(await a.chamar('PATCH', '/produtos/99999', { token: tokenComum, body: { preco: 1 } }), 404, 'PRODUCT_NOT_FOUND');
  });

  it('DELETE: sem token 401; comum 403 (produto continua existindo); admin 204; depois 404', async () => {
    assertErro(await a.chamar('DELETE', '/produtos/30'), 401, 'UNAUTHORIZED');
    assertErro(await a.chamar('DELETE', '/produtos/30', { token: tokenComum }), 403, 'FORBIDDEN');
    assert.equal((await a.chamar('GET', '/produtos/30')).status, 200);

    const apagado = await a.chamar('DELETE', '/produtos/30', { token: tokenAdmin });
    assert.equal(apagado.status, 204);
    assert.equal(apagado.texto, '');
    assertErro(await a.chamar('GET', '/produtos/30'), 404, 'PRODUCT_NOT_FOUND');
    assertErro(await a.chamar('DELETE', '/produtos/30', { token: tokenAdmin }), 404, 'PRODUCT_NOT_FOUND');
    assertErro(await a.chamar('DELETE', '/produtos/abc', { token: tokenAdmin }), 400, 'VALIDATION_ERROR');
  });

  it('403 vem antes da validação: comum não descobre nada com um id inválido', async () => {
    assertErro(await a.chamar('DELETE', '/produtos/abc', { token: tokenComum }), 403, 'FORBIDDEN');
  });
});

describe('Listagem: paginação, ordenação, filtros e links (GET /produtos)', () => {
  let a;
  before(async () => { a = await criarAmbiente(); });
  after(() => a.fechar());

  it('padrão: página 1, 10 itens, meta completo (150 itens, 15 páginas)', async () => {
    const res = await a.chamar('GET', '/produtos');
    assert.equal(res.status, 200);
    assert.deepEqual(ids(res), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(res.body.meta, {
      totalItems: 150, itemsPerPage: 10, currentPage: 1, totalPages: 15,
      first: '/produtos?page=1&limit=10', prev: null, next: '/produtos?page=2&limit=10', last: '/produtos?page=15&limit=10',
    });
  });

  it('devolve só a fatia pedida; páginas consecutivas não repetem nem perdem itens', async () => {
    assert.deepEqual(ids(await a.chamar('GET', '/produtos?page=3&limit=20')), Array.from({ length: 20 }, (_, i) => 41 + i));
    const vistos = [];
    for (let page = 1; page <= 15; page++) vistos.push(...ids(await a.chamar('GET', `/produtos?page=${page}&limit=10&sort=categoria`)));
    assert.equal(new Set(vistos).size, 150);
  });

  it('limit acima do máximo vira 100; page além da última -> 200 com data vazio', async () => {
    const grande = await a.chamar('GET', '/produtos?limit=9999999');
    assert.equal(grande.body.data.length, 100);
    assert.equal(grande.body.meta.itemsPerPage, 100);
    const alem = await a.chamar('GET', '/produtos?page=99');
    assert.equal(alem.status, 200);
    assert.deepEqual(alem.body.data, []);
    assert.equal(alem.body.meta.prev, '/produtos?page=15&limit=10');
  });

  it('page/limit inválidos -> 400 com o campo certo', async () => {
    for (const [query, campo] of [['page=0', 'page'], ['page=abc', 'page'], ['page=1.5', 'page'], ['limit=0', 'limit'], ['limit=-5', 'limit'], ['page=1&page=2', 'page']]) {
      const res = await a.chamar('GET', `/produtos?${query}`);
      assertErro(res, 400, 'VALIDATION_ERROR');
      assert.equal(res.body.details[0].field, campo, query);
    }
  });

  it('ordenação: preco desc; sort fora da lista branca e order inválido -> 400', async () => {
    const res = await a.chamar('GET', '/produtos?sort=preco&order=desc&limit=100');
    const precos = res.body.data.map((p) => p.preco);
    assert.deepEqual(precos, [...precos].sort((x, y) => y - x));
    assertErro(await a.chamar('GET', '/produtos?sort=senha'), 400, 'VALIDATION_ERROR');
    assertErro(await a.chamar('GET', '/produtos?order=cima'), 400, 'VALIDATION_ERROR');
  });

  it('filtros categoria (sem acento/maiúscula), ativo, search e combinação', async () => {
    const eletro = await a.chamar('GET', `/produtos?categoria=${encodeURIComponent('ELETRÔNICOS')}&limit=100`);
    assert.equal(eletro.body.meta.totalItems, TODOS.filter((p) => p.categoria === 'eletronicos').length);

    const ativos = await a.chamar('GET', '/produtos?ativo=true&limit=100');
    assert.equal(ativos.body.meta.totalItems, TODOS.filter((p) => p.ativo).length);
    assertErro(await a.chamar('GET', '/produtos?ativo=talvez'), 400, 'VALIDATION_ERROR');

    const busca = await a.chamar('GET', '/produtos?search=TECLADO%20mecanico&limit=100');
    assert.equal(busca.body.meta.totalItems, TODOS.filter((p) => p.nome.startsWith('Teclado Mecânico')).length);

    const esperado = TODOS.filter((p) => p.categoria === 'eletronicos' && p.ativo).sort((x, y) => y.preco - x.preco || x.id - y.id);
    const combinado = await a.chamar('GET', '/produtos?categoria=eletronicos&ativo=true&sort=preco&order=desc&limit=5');
    assert.equal(combinado.body.meta.totalItems, esperado.length);
    assert.deepEqual(ids(combinado), esperado.slice(0, 5).map((p) => p.id));
  });

  it('filtro de intervalo minPrice/maxPrice (inclusivo) e validações', async () => {
    const esperado = TODOS.filter((p) => p.preco >= 100 && p.preco <= 500);
    const res = await a.chamar('GET', '/produtos?minPrice=100&maxPrice=500&limit=100');
    assert.equal(res.body.meta.totalItems, esperado.length);
    assert.ok(res.body.data.every((p) => p.preco >= 100 && p.preco <= 500));
    for (const query of ['minPrice=500&maxPrice=100', 'minPrice=-5', 'maxPrice=abc']) {
      assertErro(await a.chamar('GET', `/produtos?${query}`), 400, 'VALIDATION_ERROR');
    }
  });

  it('links HATEOAS preservam filtros e ordenação; seguir `next` percorre tudo', async () => {
    const res = await a.chamar('GET', '/produtos?categoria=moda&ativo=true&sort=preco&order=desc&minPrice=50&page=2&limit=5');
    for (const nome of ['first', 'prev', 'next', 'last']) {
      const url = new URL(res.body.meta[nome], 'http://x');
      assert.equal(url.pathname, '/produtos');
      for (const [chave, valor] of [['categoria', 'moda'], ['ativo', 'true'], ['sort', 'preco'], ['order', 'desc'], ['minPrice', '50'], ['limit', '5']]) {
        assert.equal(url.searchParams.get(chave), valor, `${nome}.${chave}`);
      }
    }
    let url = '/produtos?limit=40&sort=preco';
    const vistos = [];
    while (url) {
      const pagina = await a.chamar('GET', url);
      vistos.push(...ids(pagina));
      url = pagina.body.meta.next;
    }
    assert.equal(new Set(vistos).size, 150);
  });

  it('filtro sem resultados -> 200, data vazio, totalPages 0', async () => {
    const res = await a.chamar('GET', '/produtos?categoria=inexistente');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
    assert.equal(res.body.meta.totalPages, 0);
  });
});
