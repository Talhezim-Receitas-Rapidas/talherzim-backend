-- Talherzim | Schema PostgreSQL (docs/schema.sql)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingredientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome VARCHAR(150) NOT NULL,
  quantidade NUMERIC(10,2),
  unidade VARCHAR(20),
  criado_em TIMESTAMP NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(200) NOT NULL,
  modo_preparo TEXT,
  imagem_url VARCHAR(500),
  fonte VARCHAR(20) NOT NULL DEFAULT 'estatico',
  fonte_id VARCHAR(100),
  criado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receita_ingredientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receita_id UUID NOT NULL REFERENCES receitas(id) ON DELETE CASCADE,
  nome_ingrediente VARCHAR(150) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ingredientes_usuario_id ON ingredientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ingredientes_nome ON ingredientes(lower(nome));
CREATE INDEX IF NOT EXISTS idx_receita_ingredientes_nome ON receita_ingredientes(lower(nome_ingrediente));
CREATE INDEX IF NOT EXISTS idx_receita_ingredientes_receita_id ON receita_ingredientes(receita_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_receitas_fonte_fonte_id ON receitas(fonte, fonte_id) WHERE fonte_id IS NOT NULL;
