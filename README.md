# talherzim-backend

Back-end do **Talherzim** (Node.js + Express + PostgreSQL).

Contrato de autenticação: [`src/openapi.yaml`](src/openapi.yaml).

## Como rodar

```bash
cp .env.example .env
docker compose up -d
npm install
npm start
```

API local: `http://localhost:3000`

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor (padrão 3000) |
| `JWT_SECRET` | Segredo usado para assinar os tokens JWT |
| `JWT_EXPIRES_IN` | Validade do token (ex.: `1h`) |
| `BCRYPT_ROUNDS` | Custo do hash de senha |
| `DATABASE_URL` | Connection string do Postgres (ex.: Neon). Se não definida, o app monta a URL a partir de `DB_HOST`/`DB_USER`/`DB_PASS`/`DB_NAME`/`DB_PORT` |

Depois, aplique o schema no banco:

```bash
npm run migrate
```

## Endpoints (S1-04)

| Método | Rota             | Auth |
| ------ | ---------------- | ---- |
| POST   | `/auth/register` | não  |
| POST   | `/auth/login`    | não  |
| POST   | `/auth/logout`   | sim  |
| GET    | `/auth/me`       | sim  |

Header: `Authorization: Bearer <jwt>`

## Testes

### 1. Testes Unitários (Rápidos e sem Docker)

Cobrem a validação de campos, regras de negócio do `AuthService` com mock de banco e comportamento dos middlewares:

```bash
npm run test:unit
```

_(No Windows PowerShell, caso o script `.ps1` seja bloqueado por política de execução, use `npm.cmd run test:unit`)_

### 2. Testes de Integração

Testam o ciclo completo de autenticação com PostgreSQL (via Testcontainers com Docker ativo ou através da variável `TEST_DATABASE_URL` no `.env`):

```bash
npm run test:integration
```

### 3. Rodar Todos os Testes

```bash
npm test
```

## Dataset e Carga de Receitas (S1-07)

Para importar ou atualizar o dataset estático de receitas (`src/data/receitas.json`) no banco PostgreSQL de forma idempotente:

```bash
npm run seed:recipes
```
## Qualidade de código

```bash
npm run lint     # verifica o código com ESLint
npm run format   # formata o projeto com Prettier
```

> Os testes de integração (`npm run test:integration`) exigem Docker ativo ou a variável `TEST_DATABASE_URL` apontando pra um banco de testes — não incluído neste ambiente por padrão.