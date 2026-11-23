import { randomUUID } from 'node:crypto';
import { UserAlreadyExistsError } from '../errors/AppError.js';

/**
 * "Tabela" Usuarios, em memória (reinicia junto com o servidor).
 *
 *   Usuarios
 *   ├── id         UUID, chave primária
 *   ├── nome       texto
 *   ├── email      texto, ÚNICO (sempre minúsculo)
 *   ├── senhaHash  hash bcrypt da senha — a senha em si NUNCA é guardada
 *   ├── perfil     'comum' | 'admin'
 *   └── criadoEm   data ISO
 *
 * Num projeto real, só esta classe seria trocada por um banco (Prisma, TypeORM...).
 */
export class UsuarioRepository {
  #usuarios = new Map();

  /** A unicidade do e-mail é garantida AQUI, de forma atômica (equivale a UNIQUE no banco). */
  create({ nome, email, senhaHash, perfil = 'comum' }) {
    if (this.findByEmail(email)) throw new UserAlreadyExistsError(email);
    const usuario = { id: randomUUID(), nome, email, senhaHash, perfil, criadoEm: new Date().toISOString() };
    this.#usuarios.set(usuario.id, usuario);
    return usuario;
  }

  findById(id) {
    return this.#usuarios.get(id) ?? null;
  }

  findByEmail(email) {
    for (const usuario of this.#usuarios.values()) {
      if (usuario.email === email) return usuario;
    }
    return null;
  }

  findAll() {
    return [...this.#usuarios.values()];
  }

  /** @returns {boolean} true se existia e foi removido */
  delete(id) {
    return this.#usuarios.delete(id);
  }
}
