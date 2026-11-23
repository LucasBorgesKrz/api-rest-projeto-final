import { ForbiddenError } from '../errors/AppError.js';

/**
 * MIDDLEWARE DE AUTORIZAÇÃO (RBAC) — "você pode fazer isto?"
 * Deve vir DEPOIS do authenticate. Uso: authorize('admin').
 *
 * O perfil é lido do usuário carregado do banco (req.usuario), e não do que
 * está escrito no token: se o perfil de alguém for alterado, vale o perfil atual,
 * não o de quando o token foi emitido.
 *
 * Perfil sem permissão -> 403 Forbidden.
 */
export const authorize =
  (...perfisPermitidos) =>
  (req, _res, next) => {
    if (!req.usuario || !perfisPermitidos.includes(req.usuario.perfil)) {
      return next(new ForbiddenError());
    }
    next();
  };
