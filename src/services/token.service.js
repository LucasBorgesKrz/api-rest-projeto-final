import jwt from 'jsonwebtoken';
import { ExpiredTokenError, InvalidTokenError } from '../errors/AppError.js';

const ALGORITMO = 'HS256';

/**
 * Gera e verifica tokens JWT.
 *
 * O algoritmo é FIXADO em HS256 na verificação. Sem isso, um atacante poderia
 * enviar um token com `"alg": "none"` (sem assinatura) e ser aceito.
 */
export const criarTokenService = ({ secret, expiresIn }) => ({
  /** Payload: id do usuário e perfil (mais `iat` e `exp`, adicionados automaticamente). */
  gerar(usuario) {
    const token = jwt.sign({ id: usuario.id, perfil: usuario.perfil }, secret, {
      algorithm: ALGORITMO,
      expiresIn,
    });
    const { iat, exp } = jwt.decode(token);
    return { token, expiresIn: exp - iat };
  },

  verificar(token) {
    try {
      return jwt.verify(token, secret, { algorithms: [ALGORITMO] });
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw new ExpiredTokenError();
      throw new InvalidTokenError(); // assinatura inválida, malformado, alg diferente, etc.
    }
  },
});
