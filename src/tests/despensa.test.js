const request = require('supertest');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const { createPool } = require('../db/pool');
const { migrate } = require('../db/migrate');
const { AuthService } = require('../services/authService');
const { DespensaService } = require('../services/despensaService');
const { createApp } = require('../app');

const JWT_SECRET = 'test-secret-crud-ingredientes';

describe('CRUD de Ingredientes', () => {
  let container;
  let pool;
  let app;

  beforeAll(async () => {
    require('dotenv').config();
    const testDbUri = process.env.TEST_DATABASE_URL;

    if (testDbUri) {
      pool = createPool(testDbUri);
    } else {
      container = await new PostgreSqlContainer('postgres:15-alpine')
        .withDatabase('talherzim_test')
        .withUsername('talherzim')
        .withPassword('talherzim123')
        .start();
      pool = createPool(container.getConnectionUri());
    }

    await migrate(pool);

    const config = {
      jwtSecret: JWT_SECRET,
      jwtExpiresIn: '1h',
      bcryptRounds: 4,
    };
    const authService = new AuthService(pool, config, new Set());
    const despensaService = new DespensaService(pool);
    app = createApp({ authService, despensaService, jwtSecret: JWT_SECRET });
  }, 120000);

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM usuarios');
  });

  async function criarUsuarioELogar(email) {
    await request(app).post('/auth/register').send({ email, senha: 'senhaSegura123' });
    const { body } = await request(app)
      .post('/auth/login')
      .send({ email, senha: 'senhaSegura123' });
    return body.token;
  }

  describe('POST /ingredientes', () => {
    it('cria ingrediente vinculado ao usuário autenticado', async () => {
      const token = await criarUsuarioELogar('a@exemplo.com');

      const res = await request(app)
        .post('/ingredientes')
        .set('Authorization', `Bearer ${token}`)
        .send({ nome: 'Tomate', quantidade: 3, unidade: 'un' })
        .expect(201);

      expect(res.body.nome).toBe('Tomate');
      expect(res.body).toHaveProperty('usuario_id');
      expect(res.body).toHaveProperty('id');
    });

    it('retorna 422 quando nome não é enviado', async () => {
      const token = await criarUsuarioELogar('a@exemplo.com');

      const res = await request(app)
        .post('/ingredientes')
        .set('Authorization', `Bearer ${token}`)
        .send({ quantidade: 3 })
        .expect(422);

      expect(res.body.erro).toBe('dados_invalidos');
    });

    it('retorna 401 sem token', async () => {
      await request(app).post('/ingredientes').send({ nome: 'Tomate' }).expect(401);
    });
  });

  describe('GET /ingredientes', () => {
    it('lista apenas os ingredientes do usuário autenticado', async () => {
      const tokenA = await criarUsuarioELogar('a@exemplo.com');
      const tokenB = await criarUsuarioELogar('b@exemplo.com');

      await request(app)
        .post('/ingredientes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ nome: 'Tomate', quantidade: 1, unidade: 'un' });
      await request(app)
        .post('/ingredientes')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ nome: 'Cebola', quantidade: 2, unidade: 'un' });

      const res = await request(app)
        .get('/ingredientes')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].nome).toBe('Tomate');
    });
  });

  describe('Isolamento entre usuários (RNF03)', () => {
    it('usuário B não consegue atualizar ingrediente do usuário A', async () => {
      const tokenA = await criarUsuarioELogar('a@exemplo.com');
      const tokenB = await criarUsuarioELogar('b@exemplo.com');

      const criado = await request(app)
        .post('/ingredientes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ nome: 'Tomate', quantidade: 1, unidade: 'un' });

      const res = await request(app)
        .put(`/ingredientes/${criado.body.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ nome: 'Tomate hackeado', quantidade: 99, unidade: 'un' })
        .expect(403);

      expect(res.body.erro).toBe('acesso_negado');
    });

    it('usuário B não consegue remover ingrediente do usuário A', async () => {
      const tokenA = await criarUsuarioELogar('a@exemplo.com');
      const tokenB = await criarUsuarioELogar('b@exemplo.com');

      const criado = await request(app)
        .post('/ingredientes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ nome: 'Tomate', quantidade: 1, unidade: 'un' });

      const res = await request(app)
        .delete(`/ingredientes/${criado.body.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);

      expect(res.body.erro).toBe('acesso_negado');
    });
  });

  describe('PUT /ingredientes/:id', () => {
    it('atualiza um ingrediente existente', async () => {
      const token = await criarUsuarioELogar('a@exemplo.com');
      const criado = await request(app)
        .post('/ingredientes')
        .set('Authorization', `Bearer ${token}`)
        .send({ nome: 'Tomate', quantidade: 1, unidade: 'un' });

      const res = await request(app)
        .put(`/ingredientes/${criado.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ nome: 'Tomate italiano', quantidade: 5, unidade: 'un' })
        .expect(200);

      expect(res.body.nome).toBe('Tomate italiano');
    });

    it('retorna 404 para ingrediente inexistente', async () => {
      const token = await criarUsuarioELogar('a@exemplo.com');

      await request(app)
        .put('/ingredientes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .send({ nome: 'Qualquer', quantidade: 1, unidade: 'un' })
        .expect(404);
    });
  });

  describe('DELETE /ingredientes/:id', () => {
    it('remove um ingrediente existente', async () => {
      const token = await criarUsuarioELogar('a@exemplo.com');
      const criado = await request(app)
        .post('/ingredientes')
        .set('Authorization', `Bearer ${token}`)
        .send({ nome: 'Tomate', quantidade: 1, unidade: 'un' });

      await request(app)
        .delete(`/ingredientes/${criado.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const lista = await request(app)
        .get('/ingredientes')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(lista.body).toHaveLength(0);
    });
  });
});