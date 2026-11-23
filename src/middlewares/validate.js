import { ValidationError } from '../errors/AppError.js';

/**
 * Valida req[source] com Zod. Se falhar, lança ValidationError (400) e a
 * requisição não chega ao serviço/banco. Se passar, req[source] recebe os
 * dados já convertidos (ex.: "10" -> 10) e com valores padrão aplicados.
 *
 * @param {import('zod').ZodType} schema
 * @param {'body' | 'params' | 'query'} source
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(new ValidationError(details));
    }

    if (source === 'query') {
      // No Express 5, `req.query` é um getter (somente leitura): redefinimos a propriedade.
      Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true, enumerable: true });
    } else {
      req[source] = result.data;
    }
    next();
  };
