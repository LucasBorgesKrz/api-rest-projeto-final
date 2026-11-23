import { z } from 'zod';

export const PERFIS = ['comum', 'admin'];

const obrigatorioOu = (mensagemTipo) => (issue) =>
  issue.input === undefined ? 'Campo obrigatório.' : mensagemTipo;

const erroCorpo = (issue) =>
  issue.input === undefined
    ? 'O corpo da requisição é obrigatório (envie um JSON com Content-Type: application/json).'
    : 'O corpo da requisição deve ser um objeto JSON.';

const email = z
  .string({ error: obrigatorioOu('O e-mail deve ser um texto.') })
  .trim()
  .toLowerCase()
  .max(254, 'O e-mail deve ter no máximo 254 caracteres.')
  .pipe(z.email('O formato do e-mail está incorreto.'));

/**
 * Política de senha. O limite de 72 BYTES existe porque o bcrypt só considera
 * os 72 primeiros bytes: senhas maiores seriam silenciosamente truncadas.
 */
const senhaForte = z
  .string({ error: obrigatorioOu('A senha deve ser um texto.') })
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .refine((s) => Buffer.byteLength(s, 'utf8') <= 72, 'A senha deve ter no máximo 72 bytes.')
  .refine((s) => /[A-Za-z]/.test(s), 'A senha deve conter pelo menos uma letra.')
  .refine((s) => /\d/.test(s), 'A senha deve conter pelo menos um número.');

export const registerSchema = z.object(
  {
    nome: z
      .string({ error: obrigatorioOu('O nome deve ser um texto.') })
      .trim()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(100, 'O nome deve ter no máximo 100 caracteres.'),
    email,
    senha: senhaForte,
    // Registro público só cria contas comuns. Aceitar "admin" aqui seria uma
    // escalada de privilégio: qualquer pessoa se cadastraria como administradora.
    perfil: z
      .literal('comum', {
        error: "O registro público só permite o perfil 'comum'. Contas 'admin' não podem ser criadas por esta rota.",
      })
      .optional(),
  },
  { error: erroCorpo },
);

export const loginSchema = z.object(
  {
    email,
    senha: z
      .string({ error: obrigatorioOu('A senha deve ser um texto.') })
      .min(1, 'A senha é obrigatória.')
      .max(128, 'A senha é longa demais.'),
  },
  { error: erroCorpo },
);

export const idParamSchema = z.object({
  id: z.uuid({ error: 'O id deve ser um UUID válido.' }),
});
