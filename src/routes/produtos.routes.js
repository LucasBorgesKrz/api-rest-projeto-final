import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { authorize } from '../middlewares/authorize.js';
import {
  atualizarProdutoSchema,
  criarProdutoSchema,
  idParamSchema,
  listarProdutosQuerySchema,
  substituirProdutoSchema,
} from '../schemas/produto.schema.js';
import { montarMeta } from '../utils/paginacao.js';

/**
 * CRUD de /produtos (recurso no plural; filtros e paginação via query params).
 *
 *   GET    /produtos         pública         lista com paginação, ordenação e filtros
 *   GET    /produtos/:id     pública         detalhe
 *   POST   /produtos         autenticado     cria                    (401 sem token)
 *   PUT    /produtos/:id     autenticado     substitui por completo
 *   PATCH  /produtos/:id     autenticado     atualiza parcialmente
 *   DELETE /produtos/:id     somente admin   exclui                  (403 se não for admin)
 *
 * Ordem dos middlewares: authenticate (401) -> authorize (403) -> validação (400) -> ação (404...).
 */
export const criarProdutosRouter = ({ produtoService, authenticate }) => {
  const router = Router();

  router.get('/', validate(listarProdutosQuerySchema, 'query'), (req, res) => {
    const { page, limit, sort, order, ...filtros } = req.query;
    const { itens, total } = produtoService.listar(req.query);

    res.json({
      data: itens,
      meta: montarMeta({
        totalItems: total,
        page,
        limit,
        caminho: req.baseUrl, // "/produtos"
        extras: { sort, order, ...filtros }, // mantidos nos links first/prev/next/last
      }),
    });
  });

  router.get('/:id', validate(idParamSchema, 'params'), (req, res) => {
    res.json(produtoService.buscarPorId(req.params.id));
  });

  router.post('/', authenticate, validate(criarProdutoSchema), (req, res) => {
    const produto = produtoService.criar(req.body, req.usuario);
    res.status(201).location(`${req.baseUrl}/${produto.id}`).json(produto);
  });

  router.put('/:id', authenticate, validate(idParamSchema, 'params'), validate(substituirProdutoSchema), (req, res) => {
    res.json(produtoService.atualizar(req.params.id, req.body));
  });

  router.patch('/:id', authenticate, validate(idParamSchema, 'params'), validate(atualizarProdutoSchema), (req, res) => {
    res.json(produtoService.atualizar(req.params.id, req.body));
  });

  router.delete('/:id', authenticate, authorize('admin'), validate(idParamSchema, 'params'), (req, res) => {
    produtoService.remover(req.params.id);
    res.status(204).end();
  });

  return router;
};
