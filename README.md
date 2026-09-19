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

## Endpoints (S1-04)

| Método | Rota | Auth |
|---|---|---|
| POST | `/auth/register` | não |
| POST | `/auth/login` | não |
| POST | `/auth/logout` | sim |
| GET | `/auth/me` | sim |

Header: `Authorization: Bearer <jwt>`

## Testes

### 1. Testes Unitários (Rápidos e sem Docker)
Cobrem a validação de campos, regras de negócio do `AuthService` com mock de banco e comportamento dos middlewares:

```bash
npm run test:unit
```

*(No Windows PowerShell, caso o script `.ps1` seja bloqueado por política de execução, use `npm.cmd run test:unit`)*

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
