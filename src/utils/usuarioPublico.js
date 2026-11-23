/**
 * Único ponto que decide o que de um usuário pode sair pela API.
 * É uma lista de campos PERMITIDOS (e não "remova a senha"): se um dia surgir
 * um campo novo sensível no modelo, ele não vaza por esquecimento.
 * A senha (nem o hash dela) nunca é retornada.
 */
export const usuarioPublico = ({ id, nome, email, perfil, criadoEm }) => ({ id, nome, email, perfil, criadoEm });
