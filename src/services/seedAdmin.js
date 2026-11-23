import bcrypt from 'bcryptjs';

/**
 * Cria a conta administradora inicial a partir das variáveis ADMIN_* do .env.
 * É a única forma de existir um admin: o registro público só cria contas comuns.
 */
export const seedAdmin = async ({ repository, admin, bcryptRounds }) => {
  if (!admin || repository.findByEmail(admin.email.toLowerCase())) return null;
  const senhaHash = await bcrypt.hash(admin.senha, bcryptRounds);
  return repository.create({
    nome: admin.nome,
    email: admin.email.trim().toLowerCase(),
    senhaHash,
    perfil: 'admin',
  });
};
