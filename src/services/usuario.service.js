import { CannotDeleteSelfError, UserNotFoundError } from '../errors/AppError.js';
import { usuarioPublico } from '../utils/usuarioPublico.js';

/** Operações administrativas sobre usuários (as rotas que as usam exigem perfil admin). */
export class UsuarioService {
  constructor(repository) {
    this.repository = repository;
  }

  listar() {
    return this.repository.findAll().map(usuarioPublico);
  }

  remover(id, solicitante) {
    if (id === solicitante.id) throw new CannotDeleteSelfError();
    if (!this.repository.delete(id)) throw new UserNotFoundError(id);
  }
}
