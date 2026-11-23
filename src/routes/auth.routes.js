import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';
import { usuarioPublico } from '../utils/usuarioPublico.js';

/**
 * Rotas de autenticação.
 *   POST /register   pública
 *   POST /login      pública
 *   GET  /perfil     privada (qualquer usuário autenticado)
 */
export const criarAuthRouter = ({ authService, authenticate }) => {
  const router = Router();

  router.post('/register', validate(registerSchema), async (req, res) => {
    res.status(201).json(await authService.registrar(req.body));
  });

  router.post('/login', validate(loginSchema), async (req, res) => {
    res.json(await authService.login(req.body));
  });

  router.get('/perfil', authenticate, (req, res) => {
    res.json(usuarioPublico(req.usuario));
  });

  return router;
};
