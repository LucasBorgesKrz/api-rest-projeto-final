import { InvalidTokenError, MissingTokenError } from '../errors/AppError.js';

/**
 * MIDDLEWARE DE AUTENTICAÇÃO — "quem é você?"
 *
 * 1. Lê o cabeçalho  Authorization: Bearer <token>
 * 2. Verifica assinatura e validade (expiração) do JWT
 * 3. Confirma que o usuário do token ainda existe e o carrega em `req.usuario`
 *
 * Falhou em qualquer passo -> 401 e a rota privada NÃO é executada.
 */
export const criarAuthenticate =
  ({ tokenService, repository }) =>
  (req, _res, next) => {
    const cabecalho = req.headers.authorization;
    if (!cabecalho) return next(new MissingTokenError());

    const partes = /^Bearer\s+(\S+)$/i.exec(cabecalho);
    if (!partes) {
      return next(new InvalidTokenError('Cabeçalho Authorization inválido. Use o formato: Bearer <token>.'));
    }

    let payload;
    try {
      payload = tokenService.verificar(partes[1]);
    } catch (err) {
      return next(err);
    }

    // O token pode ser válido e o usuário ter sido excluído depois: nesse caso, negado.
    const usuario = typeof payload.id === 'string' ? repository.findById(payload.id) : null;
    if (!usuario) return next(new InvalidTokenError('Token inválido: o usuário não existe mais.'));

    req.usuario = usuario;
    next();
  };
