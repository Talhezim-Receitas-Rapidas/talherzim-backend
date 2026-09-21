#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
SERVICE="${SERVICE:-db}"
DB_USER="${POSTGRES_USER:-talherzim}"
DB_NAME="${POSTGRES_DB:-appdb}"
TIMEOUT="${TIMEOUT:-60}"   # segundos

echo "==> Subindo containers com $COMPOSE_FILE"
docker compose -f "$COMPOSE_FILE" up -d --build

cleanup() {
  echo "==> Derrubando containers"
  docker compose -f "$COMPOSE_FILE" down -v
}
trap cleanup EXIT

echo "==> Aguardando container '$SERVICE' ficar healthy (timeout ${TIMEOUT}s)"
elapsed=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose -f "$COMPOSE_FILE" ps -q "$SERVICE")" 2>/dev/null || echo "starting")" = "healthy" ]; do
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo "ERRO: container '$SERVICE' não ficou healthy em ${TIMEOUT}s"
    docker compose -f "$COMPOSE_FILE" logs "$SERVICE"
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
  echo "  ... aguardando (${elapsed}s)"
done
echo "OK: container '$SERVICE' está healthy"

echo "==> Testando conexão e query no banco"
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
  psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null
echo "OK: conexão com usuário '$DB_USER' e database '$DB_NAME' funcionou"

echo "==> Verificando tabelas criadas pelo schema.sql"
TABLES=$(docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
  psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")

if [ "$TABLES" -lt 1 ]; then
  echo "ERRO: nenhuma tabela encontrada em public"
  exit 1
fi
echo "OK: $TABLES tabela(s) encontrada(s) em public"

echo "==> Validando role do banco"
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
  psql -U "$DB_USER" -d "$DB_NAME" -c "\du" | grep -q "$DB_USER"
echo "OK: role '$DB_USER' existe"

echo "==> Verificando logs por erros fatais"
if docker compose -f "$COMPOSE_FILE" logs "$SERVICE" 2>&1 | grep -E "FATAL|PANIC"; then
  echo "ERRO: encontrados erros fatais no log do Postgres"
  exit 1
fi
echo "OK: nenhum erro fatal no log"

echo ""
echo "TODOS OS TESTES PASSARAM"