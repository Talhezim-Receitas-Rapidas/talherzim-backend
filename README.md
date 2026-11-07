# talherzim-backend

Back-end do **Talherzim** (Node.js + Express + PostgreSQL).

Contrato de autenticação, despensa e receitas em [`src/openapi.yaml`](src/openapi.yaml).

As rotas de despensa e receitas estão conectadas ao servidor. A sugestão combina PostgreSQL e dataset local e consulta a TheMealDB para ingredientes sem receita local. O detalhe externo traduz ingredientes, quantidades e preparo para português com MyMemory e salva a tradução no PostgreSQL.

Consulte o [contrato das rotas e a configuração](https://github.com/Talhezim-Receitas-Rapidas/talherzim-documentation/blob/main/docs/consulta-externa.md) e as [alterações da consulta externa](https://github.com/Talhezim-Receitas-Rapidas/talherzim-documentation/blob/main/docs/alteracoes-consulta-externa.md).

## Como rodar

```bash
cp .env.example .env
docker compose up -d
npm ci
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
| `DATABASE_URL` | Connection string do Postgres. Se ausente, usa `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` e `POSTGRES_PORT` |
| `FRONTEND_ORIGIN` | Origem permitida pelo CORS, com padrão `http://localhost:5173` |
| `THEMEALDB_API_KEY` | Chave da TheMealDB. Padrão `1` para desenvolvimento e uso educacional |

Depois, aplique o schema no banco:

```bash
npm run migrate
```

## Endpoints

| Método | Rota             | Auth |
| ------ | ---------------- | ---- |
| POST   | `/auth/register` | não  |
| POST   | `/auth/login`    | não  |
| POST   | `/auth/logout`   | sim  |
| GET    | `/auth/me`       | sim  |
| GET    | `/ingredientes` | sim |
| POST   | `/ingredientes` | sim |
| PUT    | `/ingredientes/:id` | sim |
| DELETE | `/ingredientes/:id` | sim |
| GET    | `/receitas/sugeridas?busca=pepino` | sim |
| GET    | `/receitas/:id` | sim |

Header: `Authorization: Bearer <jwt>`

A sugestão retorna `{ receitas, avisos, despensaVazia }`. `busca` é opcional. IDs externos usam o prefixo `externa-`. O contrato formal está em `src/openapi.yaml` e o fluxo da consulta externa está detalhado na documentação indicada acima.

Ao iniciar, o servidor cria também `traducoes_receitas` de forma idempotente. Em uma instalação existente, reinicie o backend ou execute `npm run migrate`. Não há dependências npm adicionais para a integração. As consultas externas usam `fetch` e `AbortSignal.timeout` do Node.js. Use Node.js 22 ou superior.

## Testes

### 1. Testes Unitários (Rápidos e sem Docker)

Cobrem autenticação, sugestões locais e externas, falhas do provedor, tradução, cache e tratamento dos textos retornados.

```bash
npm run test:unit
```

As integrações de autenticação, despensa e receitas são executadas com `npm run test:integration`. Use Docker ou defina `TEST_DATABASE_URL` para um banco exclusivo de testes. As suítes removem dados das tabelas desse banco entre os cenários. `npm test` executa todas as suítes.

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
