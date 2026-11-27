const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../app');

const JWT_SECRET = 'test-secret-receitas-http';
const USUARIO_ID = 'usuario-1';

function criarPool() {
  return {
    query: jest.fn(async (sql) => {
      if (sql.includes('FROM ingredientes')) {
        return { rows: [{ nome: 'Ovo' }] };
      }

      if (sql.includes('FROM receitas')) {
        return {
          rows: [
            {
              id: 'receita-1',
              nome: 'Omelete',
              modo_preparo: '1. Bata os ovos.\n2. Frite.',
              imagem_url: null,
              fonte: 'estatico',
              fonte_id: 'estatico-001',
              criado_em: new Date().toISOString(),
              total_ingredientes: 1,
              correspondencias: 1,
              ingredientes: ['ovo'],
            },
          ],
        };
      }

      return { rows: [] };
    }),
  };
}

function criarApp() {
  return createApp({
    authService: {
      tokenRevogado: () => false,
      buscarPorId: async () => ({ id: USUARIO_ID, email: 'usuario@exemplo.com' }),
    },
    despensaService: {},
    jwtSecret: JWT_SECRET,
    pool: criarPool(),
    corsOrigins: ['http://localhost:5173'],
  });
}

describe('GET /receitas/sugeridas (HTTP)', () => {
  test('exige autenticação', async () => {
    const resposta = await request(criarApp()).get('/receitas/sugeridas');

    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({ erro: 'nao_autenticado', campos: [] });
  });

  test('retorna receitas ranqueadas com correspondências e total de ingredientes', async () => {
    const token = jwt.sign({ sub: USUARIO_ID, jti: 'jti-1' }, JWT_SECRET);

    const resposta = await request(criarApp())
      .get('/receitas/sugeridas')
      .set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual([
      expect.objectContaining({
        id: 'receita-1',
        nome: 'Omelete',
        correspondencias: 1,
        total_ingredientes: 1,
        ingredientes: ['ovo'],
      }),
    ]);
  });
});
