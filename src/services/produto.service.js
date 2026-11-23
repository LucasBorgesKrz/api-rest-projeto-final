import { ProductNotFoundError } from '../errors/AppError.js';

/** Regras de negócio de produtos (CRUD + listagem paginada). */
export class ProdutoService {
  constructor(repository) {
    this.repository = repository;
  }

  /** Recebe a query JÁ validada e devolve só a "fatia" pedida + o total. */
  listar({ page, limit, sort = 'id', order = 'asc', ...filtros }) {
    return this.repository.buscar({ ...filtros, sort, order, offset: (page - 1) * limit, limit });
  }

  buscarPorId(id) {
    const produto = this.repository.findById(id);
    if (!produto) throw new ProductNotFoundError(id);
    return produto;
  }

  /** O autor do produto é o usuário autenticado que o criou. */
  criar(dados, usuario) {
    return this.repository.create({ ...dados, criadoPor: usuario.id });
  }

  /** Serve para PUT (todos os campos) e PATCH (só alguns): mescla e salva. */
  atualizar(id, campos) {
    const atualizado = this.repository.update(id, campos);
    if (!atualizado) throw new ProductNotFoundError(id);
    return atualizado;
  }

  remover(id) {
    if (!this.repository.delete(id)) throw new ProductNotFoundError(id);
  }
}
