import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { UsuarioRepository } from './repositories/usuario.repository.js';
import { ProdutoRepository } from './repositories/produto.repository.js';
import { criarTokenService } from './services/token.service.js';
import { AuthService } from './services/auth.service.js';
import { UsuarioService } from './services/usuario.service.js';
import { ProdutoService } from './services/produto.service.js';
import { criarAuthenticate } from './middlewares/authenticate.js';
import { criarAuthRouter } from './routes/auth.routes.js';
import { criarUsuariosRouter } from './routes/usuarios.routes.js';
import { criarProdutosRouter } from './routes/produtos.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { TooManyRequestsError } from './errors/AppError.js';
import { openapi } from './openapi.js';

/**
 * Monta a aplicação Express (separada do `listen` para poder ser testada).
 *
 * @param {{ config: object, usuarioRepository?: UsuarioRepository, produtoRepository?: ProdutoRepository }} deps
 */
export const createApp = ({
  config,
  usuarioRepository = new UsuarioRepository(),
  produtoRepository = new ProdutoRepository(),
}) => {
  const app = express();

  const tokenService = criarTokenService({ secret: config.jwtSecret, expiresIn: config.jwtExpiresIn });
  const authService = new AuthService({ repository: usuarioRepository, tokenService, bcryptRounds: config.bcryptRounds });
  const usuarioService = new UsuarioService(usuarioRepository);
  const produtoService = new ProdutoService(produtoRepository);
  const authenticate = criarAuthenticate({ tokenService, repository: usuarioRepository });

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ?? 0); // atrás de proxy (nuvem), enxerga o IP real do cliente
  app.use(helmet()); // cabeçalhos de segurança (HSTS, nosniff, anti-clickjacking...)
  app.use(express.json({ limit: '100kb' }));

  // Documentação Swagger UI (com botão "Authorize" para o Bearer token) + spec em JSON.
  app.get('/api-docs.json', (_req, res) => res.json(openapi));
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openapi, {
      customSiteTitle: 'API Projeto Final – Documentação',
      swaggerOptions: { persistAuthorization: true }, // mantém o token ao recarregar a página
    }),
  );

  // Health check (usado pela plataforma de nuvem para saber se a API está viva).
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Limite de tentativas em /login e /register: protege contra força bruta.
  const { windowMs, max } = config.authRateLimit ?? { windowMs: 15 * 60 * 1000, max: 40 };
  app.use(
    ['/register', '/login'],
    rateLimit({
      windowMs,
      limit: max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, _res, next) => next(new TooManyRequestsError()), // mesmo formato padrão de erro
    }),
  );

  app.use(criarAuthRouter({ authService, authenticate })); // /register, /login, /perfil
  app.use('/usuarios', criarUsuariosRouter({ usuarioService, authenticate })); // somente admin
  app.use('/produtos', criarProdutosRouter({ produtoService, authenticate })); // CRUD

  // A ORDEM IMPORTA: 404 depois de todas as rotas, handler de erros por último.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
