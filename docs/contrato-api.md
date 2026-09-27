# Contrato da API do Talherzim

Este documento descreve os endpoints da API do Talherzim, incluindo os novos endpoints de receitas.

## Autenticação

As rotas protegidas exigem o header `Authorization` com um token JWT no formato `Bearer`:

```http
Authorization: Bearer <token>
```

## Endpoints

### GET /receitas/sugeridas
Lista receitas sugeridas com base na despensa do usuário.

**Autenticação:** Obrigatória

**Respostas:**

- `200`: Lista de receitas sugeridas.
  - Cada receita contém:
    - `id` (UUID)
    - `nome` (string)
    - `modo_preparo` (string)
    - `imagem_url` (string, pode ser null)
    - `fonte` (string: "spoonacular" ou "estatico")
    - `fonte_id` (string)
    - `criado_em` (string, formato date-time)
    - `ingredientes` (array de strings)

- `401`: Não autenticado.
- `500`: Erro interno.

### GET /receitas/{id}
Obtém detalhe de uma receita pelo ID.

**Autenticação:** Obrigatória

**Parâmetros de caminho:**

- `id` (UUID, obrigatório): ID da receita.

**Respostas:**

- `200`: Detalhe da receita.
  - Mesmo formato da lista de receitas acima.

- `401`: Não autenticado.
- `404`: Receita não encontrada.
- `500`: Erro interno.

## Formato de Erro

Todos os erros da API seguem o envelope JSON:

```json
{
  "erro": "codigo_estavel",
  "campos": [
    { "campo": "string", "mensagem": "string" }
  ]
}
```

Onde `erro` é um código estável em snake_case e `campos` contém erros de validação (vazio para outros tipos de erro).

## Segurança

- Senhas nunca são retornadas nas respostas e são armazenadas com hash bcrypt.
- Cada usuário só acessa os próprios dados.

## Licença

Distribuído sob a licença MIT.
