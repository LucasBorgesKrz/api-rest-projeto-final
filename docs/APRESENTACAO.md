# Roteiro da apresentação (pitch de 10 minutos)

**API em produção:** https://api-projeto-final-45mx.onrender.com  ·  **Swagger:** https://api-projeto-final-45mx.onrender.com/api-docs

## Antes de começar (faça 10 minutos antes)

- [ ] **Aquecer a API:** abra `https://api-projeto-final-45mx.onrender.com/health`. No plano gratuito a API "dorme" após ~15 min parada e a 1ª requisição leva de 30 a 60 s.
- [ ] Abrir em abas prontas: Swagger (`/api-docs`), repositório no GitHub, `docs/evidencias/` e a coleção importada no Postman/Insomnia.
- [ ] Ter à mão o **e-mail e a senha do admin** (variáveis `ADMIN_EMAIL` / `ADMIN_PASSWORD` do Render). A senha **não** está no repositório: não a mostre em tela.
- [ ] Combinar o fallback: se a internet cair, rodar `npm start` local e usar os prints de `docs/evidencias/`.
- [ ] **Não demonstrar erro 500.** Mostre só erros planejados: 400, 401, 403, 404, 409.

## Linha do tempo

| Tempo | Bloco | O que falar / mostrar |
| ----- | ----- | --------------------- |
| 0:00 – 1:00 | **Abertura** | O que é: API REST de produtos com usuários, login e perfis. Stack: Node.js, Express 5, Zod, JWT, bcrypt, Swagger. Objetivo: juntar tudo do semestre em um projeto pronto para produção. |
| 1:00 – 3:00 | **Arquitetura** | Mostrar o diagrama abaixo. Fluxo de uma requisição: rota → middlewares (autenticação 401, autorização 403, validação 400) → serviço (regras de negócio) → repositório. Qualquer erro cai em **um único handler global**, que responde sempre no mesmo formato. |
| 3:00 – 7:00 | **Demo ao vivo no Swagger (produção)** | Roteiro passo a passo na próxima seção. |
| 7:00 – 8:30 | **Segurança** | Senha com **bcrypt** (hash irreversível, com salt); `JWT_SECRET` só em variável de ambiente; token com `id` e `perfil`; RBAC; login com mensagem igual para e-mail inexistente e senha errada; limite de tentativas (429); Helmet; nada de stack trace na resposta. |
| 8:30 – 9:30 | **Qualidade** | 45 testes automatizados (`npm test`), coleção Postman com 27 requisições e 103 asserções (`npm run test:collection`), evidências em `docs/evidencias`, varredura automática de segredos no repositório. |
| 9:30 – 10:00 | **Fechamento** | Reflexão: "funciona na minha máquina" ≠ "pronto para produção". Documentação + testes + deploy. Próximos passos: banco de dados real (PostgreSQL), refresh token, CI/CD. |

## Diagrama (para o slide ou a lousa)

```
 Cliente (Swagger / Postman / Frontend)
        │  HTTPS
        ▼
 ┌──────────────────────────── Express ────────────────────────────┐
 │ Helmet → JSON parser → Rate limit (/login, /register)           │
 │                                                                 │
 │ Rotas ─► authenticate (JWT → 401) ─► authorize (perfil → 403)   │
 │          ─► validate (Zod → 400) ─► Serviço ─► Repositório      │
 │                                                                 │
 │ 404 (rota inexistente)  ─►  Global Exception Handler            │
 │ Qualquer erro           ─►  { status, error, message,           │
 │                               details, timestamp }              │
 └─────────────────────────────────────────────────────────────────┘
```

## Roteiro da demo (3:00 – 7:00)

1. **Swagger no ar** (`/api-docs`): mostrar a lista de endpoints, os cadeados nas rotas protegidas e a tabela "quem pode o quê".
2. `GET /produtos` com `page=1&limit=3&categoria=eletronicos&sort=preco&order=desc` → **200**. Apontar o `meta` (totais) e os links `next`/`last` (HATEOAS).
3. `POST /produtos` **sem login** → **401**. Mostrar o JSON de erro padronizado.
4. `POST /register` (e-mail novo) → **201**. Destacar: **a resposta não tem senha**.
5. `POST /login` → **200**. Copiar o `token`. (Opcional: colar em jwt.io para mostrar `id` e `perfil` no payload.)
6. Botão **Authorize** → colar o token → agora `POST /produtos` → **201**.
7. `DELETE /produtos/{id}` com esse usuário comum → **403 Forbidden** (perfil errado).
8. `POST /login` com o **admin** → Authorize com o token do admin → `DELETE /produtos/{id}` → **204**.
9. `GET /produtos/999999` → **404**; `POST /produtos` com preço negativo → **400** (mostrar `details` por campo).

## Perguntas que o professor pode fazer (e respostas curtas)

- **Por que bcrypt e não SHA-256?** SHA é rápido demais (bom para atacante). O bcrypt é lento de propósito e tem salt, o que torna a força bruta cara.
- **O JWT pode ser revogado?** Não antes de expirar (é *stateless*). Por isso expira em 1 h e a API confere se o usuário ainda existe. Em produção: access token curto + refresh token.
- **Por que 401 e 403 são diferentes?** 401: não sei quem você é (sem token/ inválido). 403: sei quem você é, mas seu perfil não permite.
- **Como alguém vira admin?** Só pelo seed (`ADMIN_EMAIL`/`ADMIN_PASSWORD`). O registro público só cria `comum`; mandar `perfil: "admin"` retorna 400.
- **Onde ficam os dados?** Em memória (reiniciam com o servidor). O acesso passa por repositórios; trocar por PostgreSQL altera só essa camada.
- **E se o JWT_SECRET vazar?** Qualquer um forjaria tokens. Por isso ele só existe no ambiente, é gerado aleatório, e a API recusa subir com segredo fraco. Se vazar: trocar o segredo (invalida todos os tokens).
- **Por que a 1ª requisição demorou?** Plano gratuito da nuvem hiberna a API após inatividade; por isso o aquecimento antes.
