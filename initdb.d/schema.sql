-- Talherzim | Organizador de Receitas com Sugestão por Ingredientes Disponíveis
-- Schema PostgreSQL — task #2 (Modelagem de Banco de Dados)
-- Baseado no documento de levantamento de requisitos (RF01-RF11, RNF06, RNF07)

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- necessário para gen_random_uuid()

-- =========================================================
-- USUARIOS (RF01, RF02, RNF02)
-- =========================================================
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    senha_hash      VARCHAR(255) NOT NULL,
    criado_em       TIMESTAMP NOT NULL DEFAULT now()
);

-- =========================================================
-- INGREDIENTES (RF03, RF04, RF05, RF11)
-- Despensa do usuário — cada item pertence a um único usuário
-- =========================================================
CREATE TABLE ingredientes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome            VARCHAR(150) NOT NULL,
    quantidade      NUMERIC(10,2),
    unidade         VARCHAR(20),
    criado_em       TIMESTAMP NOT NULL DEFAULT now(),
    atualizado_em   TIMESTAMP NOT NULL DEFAULT now()
);

-- =========================================================
-- RECEITAS (RF06-RF10, RNF07)
-- Persistidas para servir de contingência quando a API externa
-- (Spoonacular) estiver indisponível, e para permitir o
-- ranqueamento (RF07) com consultas SQL simples
-- =========================================================
CREATE TABLE receitas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(200) NOT NULL,
    modo_preparo    TEXT,
    imagem_url      VARCHAR(500),
    fonte           VARCHAR(20) NOT NULL DEFAULT 'estatico', -- 'spoonacular' | 'estatico'
    fonte_id        VARCHAR(100), -- id externo, evita duplicar ao sincronizar com a API
    criado_em       TIMESTAMP NOT NULL DEFAULT now()
);

-- =========================================================
-- RECEITA_INGREDIENTES
-- Tabela associativa: ingredientes que compõem cada receita.
-- Guardado como texto (nome_ingrediente) e não como FK para
-- ingredientes.id, pois a receita não pertence a um usuário —
-- ela é comparada contra a despensa de qualquer usuário.
-- =========================================================
CREATE TABLE receita_ingredientes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receita_id          UUID NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
    nome_ingrediente    VARCHAR(150) NOT NULL
);

-- =========================================================
-- ÍNDICES
-- =========================================================
-- Acelera "listar despensa do usuário" (RF05) e o JOIN do matching (RF06/RF07)
CREATE INDEX idx_ingredientes_usuario_id ON ingredientes(usuario_id);

-- Comparação de nomes é case-insensitive: buscamos por lower(nome)
CREATE INDEX idx_ingredientes_nome ON ingredientes(lower(nome));
CREATE INDEX idx_receita_ingredientes_nome ON receita_ingredientes(lower(nome_ingrediente));

-- Acelera "buscar todos os ingredientes de uma receita" (RF07/RF10)
CREATE INDEX idx_receita_ingredientes_receita_id ON receita_ingredientes(receita_id);

-- Evita duplicar receita importada duas vezes da mesma fonte
CREATE UNIQUE INDEX idx_receitas_fonte_fonte_id ON receitas(fonte, fonte_id) WHERE fonte_id IS NOT NULL;
