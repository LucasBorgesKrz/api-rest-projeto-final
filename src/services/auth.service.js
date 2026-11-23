import bcrypt from 'bcryptjs';
import { InvalidCredentialsError, UserAlreadyExistsError } from '../errors/AppError.js';
import { usuarioPublico } from '../utils/usuarioPublico.js';

export class AuthService {
  constructor({ repository, tokenService, bcryptRounds }) {
    this.repository = repository;
    this.tokenService = tokenService;
    this.bcryptRounds = bcryptRounds;
    // Hash "de mentira", usado quando o e-mail não existe, para o login levar o
    // mesmo tempo com e sem usuário (evita descobrir e-mails pelo tempo de resposta).
    this.hashFalso = bcrypt.hashSync('senha-que-nunca-sera-usada', bcryptRounds);
  }

  /** POST /register — cria SEMPRE um usuário de perfil 'comum'. */
  async registrar({ nome, email, senha }) {
    if (this.repository.findByEmail(email)) throw new UserAlreadyExistsError(email);

    // Hash de mão única (bcrypt, com salt aleatório embutido). A senha original é descartada.
    const senhaHash = await bcrypt.hash(senha, this.bcryptRounds);
    const usuario = this.repository.create({ nome, email, senhaHash, perfil: 'comum' });
    return usuarioPublico(usuario);
  }

  /** POST /login — compara a senha enviada com o hash salvo e emite o JWT. */
  async login({ email, senha }) {
    const usuario = this.repository.findByEmail(email);
    const senhaConfere = await bcrypt.compare(senha, usuario?.senhaHash ?? this.hashFalso);

    if (!usuario || !senhaConfere) throw new InvalidCredentialsError();

    const { token, expiresIn } = this.tokenService.gerar(usuario);
    return { token, tokenType: 'Bearer', expiresIn, usuario: usuarioPublico(usuario) };
  }
}
