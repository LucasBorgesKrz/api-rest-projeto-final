/**
 * Especificação OpenAPI 3.0 da API — servida em /api-docs (Swagger UI) e /api-docs.json.
 * É o "contrato" da API: endpoints, parâmetros, schemas de resposta e a
 * autenticação Bearer JWT (botão "Authorize" no Swagger UI).
 */

const TS = '2026-11-23T10:00:00.000Z';
const erro = (status, codigo, mensagem, detalhes = []) => ({ status, error: codigo, message: mensagem, details: detalhes, timestamp: TS });
const respostaErro = (descricao, exemplo) => ({
  description: descricao,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' }, example: exemplo } },
});
const ref = (nome) => ({ $ref: `#/components/schemas/${nome}` });
const json = (schema, example) => ({ 'application/json': { schema, ...(example ? { example } : {}) } });
const bearer = [{ bearerAuth: [] }];
const idProduto = {
  name: 'id', in: 'path', required: true, description: 'Id numérico do produto', schema: { type: 'integer', minimum: 1, example: 7 },
};

const produtoExemplo = {
  id: 151, nome: 'Notebook Gamer', categoria: 'eletronicos', preco: 4999.9, estoque: 12, ativo: true,
  criadoEm: TS, atualizadoEm: TS, criadoPor: '3f1c2b7e-8a4d-4c1e-9b0a-5d6e7f8a9b0c',
};

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'API Projeto Final',
    version: '1.0.0',
    description: [
      'API REST que integra: **CRUD de produtos**, **paginação, ordenação e filtros**, **autenticação JWT**, **controle de acesso por perfil (RBAC)**, **senhas com hash bcrypt** e **tratamento global de erros** com respostas padronizadas.',
      '',
      '### Como testar rotas protegidas aqui no Swagger',
      '1. Cadastre-se em `POST /register` (ou use a conta admin informada pelo responsável pelo projeto).',
      '2. Faça `POST /login` e copie o valor de `token` da resposta.',
      '3. Clique em **Authorize** (cadeado), cole **só o token** (sem escrever "Bearer") e confirme.',
      '4. Execute as rotas marcadas com cadeado.',
      '',
      '### Quem pode o quê',
      '| Perfil | Pode |',
      '|---|---|',
      '| *sem login* | listar/ver produtos, registrar-se, fazer login |',
      '| `comum` | tudo acima + criar e editar produtos + ver o próprio perfil |',
      '| `admin` | tudo acima + **excluir** produtos + listar/excluir usuários |',
      '',
      '### Códigos de erro',
      '`400` dados inválidos · `401` não autenticado (token ausente/inválido/expirado) · `403` sem permissão (perfil) · `404` não encontrado · `409` conflito (e-mail já cadastrado) · `422` regra de negócio · `429` muitas tentativas · `500` erro interno (mensagem genérica).',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'Servidor atual' }],
  tags: [
    { name: 'Autenticação', description: 'Registro, login e usuário logado' },
    { name: 'Produtos', description: 'CRUD com paginação, ordenação e filtros' },
    { name: 'Administração', description: 'Usuários — somente perfil **admin**' },
    { name: 'Sistema', description: 'Saúde da API' },
  ],

  paths: {
    '/register': {
      post: {
        tags: ['Autenticação'],
        summary: 'Registra um novo usuário (rota pública)',
        description:
          'Cria um usuário com perfil `comum`. A senha é guardada só como hash bcrypt e **nunca** é retornada. ' +
          'Política de senha: 8 a 72 caracteres, com pelo menos uma letra e um número.',
        requestBody: {
          required: true,
          content: json(ref('RegisterRequest'), { nome: 'Maria Silva', email: 'maria@exemplo.com', senha: 'Senha123' }),
        },
        responses: {
          201: {
            description: 'Usuário criado',
            content: json(ref('Usuario'), {
              id: '3f1c2b7e-8a4d-4c1e-9b0a-5d6e7f8a9b0c', nome: 'Maria Silva', email: 'maria@exemplo.com', perfil: 'comum', criadoEm: TS,
            }),
          },
          400: { $ref: '#/components/responses/DadosInvalidos' },
          409: respostaErro(
            'E-mail já cadastrado',
            erro(409, 'USER_ALREADY_EXISTS', 'Já existe um usuário cadastrado com este e-mail.', [{ field: 'email', message: "O e-mail 'maria@exemplo.com' já está em uso." }]),
          ),
          429: { $ref: '#/components/responses/MuitasTentativas' },
        },
      },
    },

    '/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Autentica e devolve um token JWT (rota pública)',
        description:
          'Compara a senha enviada com o hash salvo. Em caso de sucesso devolve um JWT (HS256) cujo payload contém `id` e `perfil`, além de `iat` e `exp`. ' +
          'Use-o nas rotas privadas no cabeçalho `Authorization: Bearer <token>`.',
        requestBody: { required: true, content: json(ref('LoginRequest'), { email: 'maria@exemplo.com', senha: 'Senha123' }) },
        responses: {
          200: { description: 'Login realizado', content: json(ref('LoginResponse')) },
          400: { $ref: '#/components/responses/DadosInvalidos' },
          401: respostaErro(
            'Credenciais incorretas (a mensagem é a mesma para e-mail inexistente e senha errada)',
            erro(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.'),
          ),
          429: { $ref: '#/components/responses/MuitasTentativas' },
        },
      },
    },

    '/perfil': {
      get: {
        tags: ['Autenticação'],
        summary: 'Dados do usuário logado',
        description: 'Qualquer usuário autenticado (`comum` ou `admin`).',
        security: bearer,
        responses: { 200: { description: 'Usuário logado', content: json(ref('Usuario')) }, 401: { $ref: '#/components/responses/NaoAutenticado' } },
      },
    },

    '/produtos': {
      get: {
        tags: ['Produtos'],
        summary: 'Lista produtos com paginação, ordenação e filtros (pública)',
        description:
          'Devolve `data` (itens da página) e `meta` (totais e links HATEOAS `first/prev/next/last` que preservam filtros e ordenação). ' +
          'Parâmetros desconhecidos são ignorados. `limit` acima de 100 é reduzido para 100.',
        parameters: [
          { name: 'page', in: 'query', description: 'Página atual', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', description: 'Itens por página (máx. 100)', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
          { name: 'sort', in: 'query', description: 'Campo de ordenação', schema: { type: 'string', enum: ['id', 'nome', 'categoria', 'preco', 'estoque', 'criadoEm'], default: 'id' } },
          { name: 'order', in: 'query', description: 'Direção da ordenação', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
          { name: 'categoria', in: 'query', description: 'Filtra por categoria (ignora maiúsculas/acentos)', schema: { type: 'string', example: 'eletronicos' } },
          { name: 'ativo', in: 'query', description: 'Filtra por produtos ativos ou inativos', schema: { type: 'boolean' } },
          { name: 'search', in: 'query', description: 'Busca por parte do nome', schema: { type: 'string', maxLength: 100, example: 'notebook' } },
          { name: 'minPrice', in: 'query', description: 'Preço mínimo (inclusivo)', schema: { type: 'number', minimum: 0, example: 100 } },
          { name: 'maxPrice', in: 'query', description: 'Preço máximo (inclusivo)', schema: { type: 'number', minimum: 0, example: 500 } },
        ],
        responses: {
          200: { description: 'Página de produtos', content: json(ref('ListaProdutos')) },
          400: respostaErro(
            'Parâmetro inválido (page=0, sort fora da lista, minPrice > maxPrice...)',
            erro(400, 'VALIDATION_ERROR', 'Os parâmetros fornecidos são inválidos.', [
              { field: 'sort', message: "O parâmetro 'sort' deve ser um destes valores: id, nome, categoria, preco, estoque, criadoEm." },
            ]),
          ),
        },
      },
      post: {
        tags: ['Produtos'],
        summary: 'Cria um produto (autenticado)',
        security: bearer,
        requestBody: {
          required: true,
          content: json(ref('ProdutoCriar'), { nome: 'Notebook Gamer', categoria: 'eletronicos', preco: 4999.9, estoque: 12, ativo: true }),
        },
        responses: {
          201: { description: 'Produto criado (cabeçalho `Location` aponta para ele)', content: json(ref('Produto'), produtoExemplo) },
          400: { $ref: '#/components/responses/DadosInvalidos' },
          401: { $ref: '#/components/responses/NaoAutenticado' },
        },
      },
    },

    '/produtos/{id}': {
      get: {
        tags: ['Produtos'],
        summary: 'Busca um produto pelo id (pública)',
        parameters: [idProduto],
        responses: {
          200: { description: 'Produto', content: json(ref('Produto'), produtoExemplo) },
          400: { $ref: '#/components/responses/DadosInvalidos' },
          404: { $ref: '#/components/responses/ProdutoNaoEncontrado' },
        },
      },
      put: {
        tags: ['Produtos'],
        summary: 'Substitui um produto por completo (autenticado)',
        description: 'Todos os campos são obrigatórios. Para alterar só alguns, use `PATCH`.',
        security: bearer,
        parameters: [idProduto],
        requestBody: {
          required: true,
          content: json(ref('ProdutoSubstituir'), { nome: 'Notebook Gamer Pro', categoria: 'eletronicos', preco: 5499.9, estoque: 8, ativo: true }),
        },
        responses: {
          200: { description: 'Produto atualizado', content: json(ref('Produto')) },
          400: { $ref: '#/components/responses/DadosInvalidos' },
          401: { $ref: '#/components/responses/NaoAutenticado' },
          404: { $ref: '#/components/responses/ProdutoNaoEncontrado' },
        },
      },
      patch: {
        tags: ['Produtos'],
        summary: 'Atualiza parcialmente um produto (autenticado)',
        description: 'Envie apenas os campos a alterar (pelo menos um).',
        security: bearer,
        parameters: [idProduto],
        requestBody: { required: true, content: json(ref('ProdutoAtualizar'), { preco: 4599.9, estoque: 20 }) },
        responses: {
          200: { description: 'Produto atualizado', content: json(ref('Produto')) },
          400: { $ref: '#/components/responses/DadosInvalidos' },
          401: { $ref: '#/components/responses/NaoAutenticado' },
          404: { $ref: '#/components/responses/ProdutoNaoEncontrado' },
        },
      },
      delete: {
        tags: ['Produtos'],
        summary: 'Exclui um produto (somente admin)',
        security: bearer,
        parameters: [idProduto],
        responses: {
          204: { description: 'Produto excluído (sem corpo)' },
          400: { $ref: '#/components/responses/DadosInvalidos' },
          401: { $ref: '#/components/responses/NaoAutenticado' },
          403: { $ref: '#/components/responses/SemPermissao' },
          404: { $ref: '#/components/responses/ProdutoNaoEncontrado' },
        },
      },
    },

    '/usuarios': {
      get: {
        tags: ['Administração'],
        summary: 'Lista todos os usuários (somente admin)',
        security: bearer,
        responses: {
          200: { description: 'Lista de usuários (sem senha)', content: json({ type: 'array', items: ref('Usuario') }) },
          401: { $ref: '#/components/responses/NaoAutenticado' },
          403: { $ref: '#/components/responses/SemPermissao' },
        },
      },
    },

    '/usuarios/{id}': {
      delete: {
        tags: ['Administração'],
        summary: 'Exclui um usuário (somente admin)',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, description: 'UUID do usuário (veja `GET /usuarios`)', schema: { type: 'string', format: 'uuid' } }],
        responses: {
          204: { description: 'Usuário excluído (sem corpo)' },
          400: { $ref: '#/components/responses/DadosInvalidos' },
          401: { $ref: '#/components/responses/NaoAutenticado' },
          403: { $ref: '#/components/responses/SemPermissao' },
          404: respostaErro('Usuário não encontrado', erro(404, 'USER_NOT_FOUND', "Usuário com id '3f1c2b7e-8a4d-4c1e-9b0a-5d6e7f8a9b0c' não foi encontrado.")),
          422: respostaErro('O admin tentou excluir a própria conta', erro(422, 'CANNOT_DELETE_SELF', 'Você não pode excluir a sua própria conta.')),
        },
      },
    },

    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Verifica se a API está no ar',
        responses: { 200: { description: 'OK', content: json({ type: 'object', properties: { status: { type: 'string', example: 'ok' } } }) } },
      },
    },
  },

  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Cole o token retornado por `POST /login` (sem o prefixo "Bearer").',
      },
    },
    responses: {
      DadosInvalidos: respostaErro(
        'Dados inválidos (corpo, parâmetros de rota ou de query)',
        erro(400, 'VALIDATION_ERROR', 'Os dados fornecidos são inválidos.', [
          { field: 'preco', message: 'O preço deve ser maior que 0.' },
          { field: 'categoria', message: 'A categoria deve ser uma destas: eletronicos, livros, moda, casa, esportes.' },
        ]),
      ),
      NaoAutenticado: respostaErro(
        'Não autenticado: token ausente, inválido ou expirado',
        erro(401, 'UNAUTHORIZED', 'Autenticação necessária. Envie o cabeçalho "Authorization: Bearer <token>".'),
      ),
      SemPermissao: respostaErro('Autenticado, mas sem permissão (perfil não é admin)', erro(403, 'FORBIDDEN', 'Você não tem permissão para acessar este recurso.')),
      ProdutoNaoEncontrado: respostaErro('Produto não encontrado', erro(404, 'PRODUCT_NOT_FOUND', "Produto com id '9999' não foi encontrado.")),
      MuitasTentativas: respostaErro('Limite de tentativas excedido (proteção contra força bruta)', erro(429, 'TOO_MANY_REQUESTS', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.')),
    },
    schemas: {
      RegisterRequest: {
        type: 'object',
        required: ['nome', 'email', 'senha'],
        properties: {
          nome: { type: 'string', minLength: 2, maxLength: 100, example: 'Maria Silva' },
          email: { type: 'string', format: 'email', example: 'maria@exemplo.com' },
          senha: { type: 'string', format: 'password', minLength: 8, maxLength: 72, example: 'Senha123', description: 'Pelo menos uma letra e um número.' },
          perfil: { type: 'string', enum: ['comum'], description: "Opcional. Só aceita 'comum'; contas admin não são criadas por esta rota." },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'senha'],
        properties: {
          email: { type: 'string', format: 'email', example: 'maria@exemplo.com' },
          senha: { type: 'string', format: 'password', example: 'Senha123' },
        },
      },
      Usuario: {
        type: 'object',
        description: 'Usuário. A senha (ou seu hash) nunca é retornada.',
        properties: {
          id: { type: 'string', format: 'uuid' },
          nome: { type: 'string' },
          email: { type: 'string', format: 'email' },
          perfil: { type: 'string', enum: ['comum', 'admin'] },
          criadoEm: { type: 'string', format: 'date-time' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'JWT (HS256). Payload: { id, perfil, iat, exp }.', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          tokenType: { type: 'string', example: 'Bearer' },
          expiresIn: { type: 'integer', description: 'Validade do token, em segundos.', example: 3600 },
          usuario: ref('Usuario'),
        },
      },
      Produto: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 151 },
          nome: { type: 'string', example: 'Notebook Gamer' },
          categoria: { type: 'string', enum: ['eletronicos', 'livros', 'moda', 'casa', 'esportes'] },
          preco: { type: 'number', format: 'double', example: 4999.9 },
          estoque: { type: 'integer', example: 12 },
          ativo: { type: 'boolean', example: true },
          criadoEm: { type: 'string', format: 'date-time' },
          atualizadoEm: { type: 'string', format: 'date-time' },
          criadoPor: { type: 'string', format: 'uuid', nullable: true, description: 'Id do usuário que criou (nulo nos produtos de exemplo).' },
        },
      },
      ProdutoCriar: {
        type: 'object',
        required: ['nome', 'categoria', 'preco'],
        properties: {
          nome: { type: 'string', minLength: 2, maxLength: 100, example: 'Notebook Gamer' },
          categoria: { type: 'string', enum: ['eletronicos', 'livros', 'moda', 'casa', 'esportes'] },
          preco: { type: 'number', exclusiveMinimum: true, minimum: 0, maximum: 1000000, description: 'Maior que 0, até 2 casas decimais.', example: 4999.9 },
          estoque: { type: 'integer', minimum: 0, default: 0 },
          ativo: { type: 'boolean', default: true },
        },
      },
      ProdutoSubstituir: {
        type: 'object',
        required: ['nome', 'categoria', 'preco', 'estoque', 'ativo'],
        properties: {
          nome: { type: 'string', minLength: 2, maxLength: 100 },
          categoria: { type: 'string', enum: ['eletronicos', 'livros', 'moda', 'casa', 'esportes'] },
          preco: { type: 'number', exclusiveMinimum: true, minimum: 0, maximum: 1000000 },
          estoque: { type: 'integer', minimum: 0 },
          ativo: { type: 'boolean' },
        },
      },
      ProdutoAtualizar: {
        type: 'object',
        minProperties: 1,
        description: 'Qualquer subconjunto (não vazio) dos campos do produto.',
        properties: {
          nome: { type: 'string', minLength: 2, maxLength: 100 },
          categoria: { type: 'string', enum: ['eletronicos', 'livros', 'moda', 'casa', 'esportes'] },
          preco: { type: 'number', exclusiveMinimum: true, minimum: 0, maximum: 1000000 },
          estoque: { type: 'integer', minimum: 0 },
          ativo: { type: 'boolean' },
        },
      },
      Meta: {
        type: 'object',
        description: 'Metadados de paginação + links HATEOAS (preservam filtros e ordenação).',
        properties: {
          totalItems: { type: 'integer', example: 150 },
          itemsPerPage: { type: 'integer', example: 10 },
          currentPage: { type: 'integer', example: 1 },
          totalPages: { type: 'integer', example: 15 },
          first: { type: 'string', example: '/produtos?page=1&limit=10' },
          prev: { type: 'string', nullable: true, example: null },
          next: { type: 'string', nullable: true, example: '/produtos?page=2&limit=10' },
          last: { type: 'string', example: '/produtos?page=15&limit=10' },
        },
      },
      ListaProdutos: {
        type: 'object',
        properties: { data: { type: 'array', items: ref('Produto') }, meta: ref('Meta') },
      },
      Erro: {
        type: 'object',
        description: 'Formato padrão de TODA resposta de erro da API.',
        properties: {
          status: { type: 'integer', example: 401 },
          error: { type: 'string', example: 'UNAUTHORIZED', description: 'Código estável para o frontend tratar o erro.' },
          message: { type: 'string' },
          details: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};
