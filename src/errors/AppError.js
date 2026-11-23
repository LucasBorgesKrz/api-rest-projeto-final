/**
 * Exceções da aplicação. Todo AppError carrega status HTTP, código (campo
 * `error` da resposta) e uma mensagem segura para o cliente; o Global Exception
 * Handler converte em JSON padronizado.
 */
export class AppError extends Error {
  constructor({ status, code, message, details = [] }) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ---------- Genéricos (4xx) ----------

export class ValidationError extends AppError {
  constructor(details) {
    super({ status: 400, code: 'VALIDATION_ERROR', message: 'Os dados fornecidos são inválidos.', details });
  }
}

export class RouteNotFoundError extends AppError {
  constructor(method, path) {
    super({ status: 404, code: 'ROUTE_NOT_FOUND', message: `Rota não encontrada: ${method} ${path}` });
  }
}

export class TooManyRequestsError extends AppError {
  constructor() {
    super({
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    });
  }
}

// ---------- Autenticação: 401 = "não sei quem você é" ----------

export class MissingTokenError extends AppError {
  constructor() {
    super({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Autenticação necessária. Envie o cabeçalho "Authorization: Bearer <token>".',
    });
  }
}

export class InvalidTokenError extends AppError {
  constructor(message = 'Token inválido.') {
    super({ status: 401, code: 'INVALID_TOKEN', message });
  }
}

export class ExpiredTokenError extends AppError {
  constructor() {
    super({ status: 401, code: 'TOKEN_EXPIRED', message: 'Token expirado. Faça login novamente.' });
  }
}

/** Mesma mensagem para "e-mail não existe" e "senha errada" (evita descobrir e-mails cadastrados). */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super({ status: 401, code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' });
  }
}

// ---------- Autorização: 403 = "sei quem você é, mas você não pode" ----------

export class ForbiddenError extends AppError {
  constructor() {
    super({ status: 403, code: 'FORBIDDEN', message: 'Você não tem permissão para acessar este recurso.' });
  }
}

// ---------- Regras de negócio ----------

export class UserAlreadyExistsError extends AppError {
  constructor(email) {
    super({
      status: 409,
      code: 'USER_ALREADY_EXISTS',
      message: 'Já existe um usuário cadastrado com este e-mail.',
      details: [{ field: 'email', message: `O e-mail '${email}' já está em uso.` }],
    });
  }
}

export class UserNotFoundError extends AppError {
  constructor(id) {
    super({ status: 404, code: 'USER_NOT_FOUND', message: `Usuário com id '${id}' não foi encontrado.` });
  }
}

export class CannotDeleteSelfError extends AppError {
  constructor() {
    super({ status: 422, code: 'CANNOT_DELETE_SELF', message: 'Você não pode excluir a sua própria conta.' });
  }
}

export class ProductNotFoundError extends AppError {
  constructor(id) {
    super({ status: 404, code: 'PRODUCT_NOT_FOUND', message: `Produto com id '${id}' não foi encontrado.` });
  }
}
