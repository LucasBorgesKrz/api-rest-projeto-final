import { AppError, RouteNotFoundError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (req, _res, next) => {
  next(new RouteNotFoundError(req.method, req.originalUrl));
};

const buildErrorBody = ({ status, code, message, details = [] }) => ({
  status,
  error: code,
  message,
  details,
  timestamp: new Date().toISOString(),
});

const normalizeKnownError = (err) => {
  if (err.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'O corpo da requisição não é um JSON válido.' };
  }
  if (err.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'O corpo da requisição excede o tamanho máximo permitido.' };
  }
  return null;
};

/** GLOBAL EXCEPTION HANDLER (registrado por último). */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let payload;
  if (err instanceof AppError) {
    payload = { status: err.status, code: err.code, message: err.message, details: err.details };
  } else {
    payload = normalizeKnownError(err);
  }

  if (!payload) {
    logger.error('Erro interno não tratado', err, { method: req.method, url: req.originalUrl });
    payload = {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno no servidor. Tente novamente mais tarde.',
    };
  }

  // Exigido pelo padrão HTTP (RFC 7235): 401 informa qual esquema de autenticação usar.
  if (payload.status === 401) res.set('WWW-Authenticate', 'Bearer');

  res.status(payload.status).json(buildErrorBody(payload));
};
