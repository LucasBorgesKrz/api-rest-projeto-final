import { gerarProdutos } from '../data/produtos.seed.js';

/** Remove acentos e ignora maiúsculas/minúsculas ("Eletrônicos" == "eletronicos"). */
const normalizar = (texto) =>
  texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const comparar = (a, b) =>
  typeof a === 'string' ? a.localeCompare(b, 'pt-BR') : a - b;

/**
 * "Banco de dados" em memória. O método `buscar` faz o que um banco SQL faria:
 *
 *   SELECT * FROM produtos
 *   WHERE categoria = :categoria AND ativo = :ativo
 *     AND nome ILIKE '%' || :search || '%'
 *     AND preco >= :minPrice AND preco <= :maxPrice
 *   ORDER BY :sort :order, id ASC
 *   LIMIT :limit OFFSET :offset;
 *
 *   + SELECT COUNT(*) ... (mesmo WHERE) para o total de itens.
 *
 * Num projeto real, só esta classe seria trocada (Prisma, TypeORM, SQL puro...).
 */
export class ProdutoRepository {
  #produtos;
  #proximoId;

  constructor(produtos = gerarProdutos()) {
    this.#produtos = produtos;
    this.#proximoId = Math.max(0, ...produtos.map((p) => p.id)) + 1;
  }

  findById(id) {
    return this.#produtos.find((p) => p.id === id) ?? null;
  }

  /** INSERT */
  create({ nome, categoria, preco, estoque, ativo, criadoPor }) {
    const agora = new Date().toISOString();
    const produto = { id: this.#proximoId++, nome, categoria, preco, estoque, ativo, criadoEm: agora, atualizadoEm: agora, criadoPor };
    this.#produtos.push(produto);
    return produto;
  }

  /** UPDATE: mescla os campos recebidos no produto existente. @returns o produto atualizado ou null */
  update(id, campos) {
    const indice = this.#produtos.findIndex((p) => p.id === id);
    if (indice === -1) return null;
    const atualizado = { ...this.#produtos[indice], ...campos, atualizadoEm: new Date().toISOString() };
    this.#produtos[indice] = atualizado;
    return atualizado;
  }

  /** DELETE. @returns true se existia e foi removido */
  delete(id) {
    const indice = this.#produtos.findIndex((p) => p.id === id);
    if (indice === -1) return false;
    this.#produtos.splice(indice, 1);
    return true;
  }

  /**
   * @returns {{ itens: object[], total: number }} `total` = itens que casam com os
   * filtros ANTES de paginar (é ele que alimenta totalItems/totalPages).
   */
  buscar({ categoria, ativo, search, minPrice, maxPrice, sort, order, offset, limit }) {
    const categoriaNorm = categoria === undefined ? undefined : normalizar(categoria);
    const searchNorm = search === undefined ? undefined : normalizar(search);

    const filtrados = this.#produtos.filter(
      (p) =>
        (categoriaNorm === undefined || normalizar(p.categoria) === categoriaNorm) &&
        (ativo === undefined || p.ativo === ativo) &&
        (searchNorm === undefined || normalizar(p.nome).includes(searchNorm)) &&
        (minPrice === undefined || p.preco >= minPrice) &&
        (maxPrice === undefined || p.preco <= maxPrice),
    );

    const direcao = order === 'desc' ? -1 : 1;
    // Desempate por id: garante ordem estável (sem itens repetidos/perdidos entre páginas).
    filtrados.sort((a, b) => comparar(a[sort], b[sort]) * direcao || a.id - b.id);

    return { itens: filtrados.slice(offset, offset + limit), total: filtrados.length };
  }
}
