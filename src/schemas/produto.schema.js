import { z } from 'zod';

export const LIMITE_PADRAO = 10;
export const LIMITE_MAXIMO = 100;
export const CAMPOS_ORDENAVEIS = ['id', 'nome', 'categoria', 'preco', 'estoque', 'criadoEm'];
export const CATEGORIAS = ['eletronicos', 'livros', 'moda', 'casa', 'esportes'];

// ======================= Query de GET /produtos =======================

const unico = (campo) => `O parâmetro '${campo}' deve ser informado uma única vez, como texto.`;

/** Inteiro >= 1 vindo da query string ("10" -> 10). Rejeita "abc", "0", "-1", "1.5", "". */
const inteiroPositivo = (campo) =>
  z
    .string({ error: unico(campo) })
    .regex(/^\d+$/, `O parâmetro '${campo}' deve ser um número inteiro maior ou igual a 1.`)
    .transform(Number)
    .pipe(
      z
        .number()
        .min(1, `O parâmetro '${campo}' deve ser um número inteiro maior ou igual a 1.`)
        .max(Number.MAX_SAFE_INTEGER, `O parâmetro '${campo}' é grande demais.`),
    );

/** Número decimal >= 0 vindo da query string ("99.90" -> 99.9). */
const decimalNaoNegativo = (campo) =>
  z
    .string({ error: unico(campo) })
    .regex(/^\d+(\.\d+)?$/, `O parâmetro '${campo}' deve ser um número maior ou igual a 0 (use ponto como separador decimal).`)
    .transform(Number);

/**
 * Parâmetros desconhecidos são ignorados; todos são opcionais.
 *  - page, limit            paginação (limit > 100 é reduzido para 100)
 *  - sort, order            ordenação (sort só aceita campos da lista branca)
 *  - categoria, ativo, search     filtros
 *  - minPrice, maxPrice           filtro de intervalo (inclusivo)
 */
export const listarProdutosQuerySchema = z
  .object({
    page: inteiroPositivo('page').default(1),
    limit: inteiroPositivo('limit')
      .transform((n) => Math.min(n, LIMITE_MAXIMO)) // proteção contra ?limit=9999999
      .default(LIMITE_PADRAO),

    // Sem default de propósito: assim sabemos se o cliente os informou (usado nos links).
    sort: z
      .enum(CAMPOS_ORDENAVEIS, {
        error: `O parâmetro 'sort' deve ser um destes valores: ${CAMPOS_ORDENAVEIS.join(', ')}.`,
      })
      .optional(),
    order: z
      .string({ error: unico('order') })
      .toLowerCase()
      .pipe(z.enum(['asc', 'desc'], { error: "O parâmetro 'order' deve ser 'asc' ou 'desc'." }))
      .optional(),

    categoria: z.string({ error: unico('categoria') }).trim().min(1, "O parâmetro 'categoria' não pode ser vazio.").optional(),
    ativo: z
      .string({ error: unico('ativo') })
      .toLowerCase()
      .pipe(z.enum(['true', 'false'], { error: "O parâmetro 'ativo' deve ser 'true' ou 'false'." }))
      .transform((v) => v === 'true')
      .optional(),
    search: z
      .string({ error: unico('search') })
      .trim()
      .min(1, "O parâmetro 'search' não pode ser vazio.")
      .max(100, "O parâmetro 'search' deve ter no máximo 100 caracteres.")
      .optional(),

    minPrice: decimalNaoNegativo('minPrice').optional(),
    maxPrice: decimalNaoNegativo('maxPrice').optional(),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    path: ['minPrice'],
    message: "O parâmetro 'minPrice' não pode ser maior que 'maxPrice'.",
  });

export const idParamSchema = z.object({
  id: z
    .string()
    .regex(/^\d+$/, 'O id deve ser um número inteiro positivo.')
    .transform(Number)
    .pipe(z.number().min(1, 'O id deve ser um número inteiro positivo.').max(Number.MAX_SAFE_INTEGER, 'O id é grande demais.')),
});

// ======================= Corpo de POST / PUT / PATCH =======================

const obrigatorioOu = (mensagemTipo) => (issue) =>
  issue.input === undefined ? 'Campo obrigatório.' : mensagemTipo;

const erroCorpo = (issue) =>
  issue.input === undefined
    ? 'O corpo da requisição é obrigatório (envie um JSON com Content-Type: application/json).'
    : 'O corpo da requisição deve ser um objeto JSON.';

const duasCasas = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

const campos = {
  nome: z
    .string({ error: obrigatorioOu('O nome deve ser um texto.') })
    .trim()
    .min(2, 'O nome deve ter pelo menos 2 caracteres.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.'),
  categoria: z
    .string({ error: obrigatorioOu('A categoria deve ser um texto.') })
    .trim()
    .toLowerCase()
    .pipe(z.enum(CATEGORIAS, { error: `A categoria deve ser uma destas: ${CATEGORIAS.join(', ')}.` })),
  preco: z
    .number({ error: obrigatorioOu('O preço deve ser um número.') })
    .positive('O preço deve ser maior que 0.')
    .max(1_000_000, 'O preço deve ser no máximo 1.000.000.')
    .refine(duasCasas, 'O preço deve ter no máximo 2 casas decimais.'),
  estoque: z
    .number({ error: obrigatorioOu('O estoque deve ser um número.') })
    .int('O estoque deve ser um número inteiro.')
    .min(0, 'O estoque não pode ser negativo.')
    .max(1_000_000, 'O estoque deve ser no máximo 1.000.000.'),
  ativo: z.boolean({ error: obrigatorioOu('O campo ativo deve ser true ou false.') }),
};

/** POST /produtos — nome, categoria e preço obrigatórios; estoque (0) e ativo (true) opcionais. */
export const criarProdutoSchema = z.object(
  { ...campos, estoque: campos.estoque.default(0), ativo: campos.ativo.default(true) },
  { error: erroCorpo },
);

/** PUT /produtos/:id — substituição completa: todos os campos obrigatórios. */
export const substituirProdutoSchema = z.object(campos, { error: erroCorpo });

/** PATCH /produtos/:id — atualização parcial: pelo menos um campo. */
export const atualizarProdutoSchema = z
  .object(campos, { error: erroCorpo })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Envie pelo menos um campo para atualizar.' });
