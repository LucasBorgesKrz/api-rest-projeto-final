import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { authorize } from '../middlewares/authorize.js';
import { idParamSchema } from '../schemas/auth.schema.js';

/**
 * Rotas administrativas de /usuarios — TODAS exigem login e perfil "admin".
 * Ordem dos middlewares: authenticate (401) -> authorize (403) -> validação -> handler.
 */
export const criarUsuariosRouter = ({ usuarioService, authenticate }) => {
  const router = Router();

  router.use(authenticate, authorize('admin'));

  router.get('/', (_req, res) => {
    res.json(usuarioService.listar());
  });

  router.delete('/:id', validate(idParamSchema, 'params'), (req, res) => {
    usuarioService.remover(req.params.id, req.usuario);
    res.status(204).end();
  });

  return router;
};
