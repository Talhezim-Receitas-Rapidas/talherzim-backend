const request = require('supertest');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const { createPool } = require('../db/pool');
const { migrate } = require('../db/migrate');
const { AuthService } = require('../services/authService');
const { createApp } = require('../app');

const JWT_SECRET = 'test-secret-s1-04';

describe('S1-04 autenticação', () => {
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
    app = createApp({ authService, jwtSecret: JWT_SECRET });
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

  async function cadastrar(email = 'usuario@exemplo.com', senha = 'senhaSegura123') {
    return request(app).post('/auth/register').send({ email, senha });
  }

  async function entrar(email = 'usuario@exemplo.com', senha = 'senhaSegura123') {
    return request(app).post('/auth/login').send({ email, senha });
  }

  describe('POST /auth/register', () => {
    it('cria conta com hash bcrypt e devolve id/email', async () => {
      const res = await cadastrar().expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        email: 'usuario@exemplo.com',
      });
      expect(res.body).not.toHaveProperty('senha');
      expect(res.body).not.toHaveProperty('senha_hash');

      const { rows } = await pool.query(
        'SELECT senha_hash FROM usuarios WHERE email = $1',
        ['usuario@exemplo.com']
      );
      expect(rows[0].senha_hash).not.toBe('senhaSegura123');
      expect(rows[0].senha_hash.startsWith('$2')).toBe(true);
    });

    it('normaliza e-mail para minúsculas', async () => {
      const res = await cadastrar('Usuario@Exemplo.com').expect(201);
      expect(res.body.email).toBe('usuario@exemplo.com');
    });

    it('retorna 422 para e-mail inválido', async () => {
      const res = await cadastrar('email-invalido').expect(422);
      expect(res.body.erro).toBe('dados_invalidos');
      expect(res.body.campos).toEqual([
        { campo: 'email', mensagem: 'E-mail inválido.' },
      ]);
    });

    it('retorna 422 para senha curta', async () => {
      const res = await cadastrar('ok@exemplo.com', '123').expect(422);
      expect(res.body.erro).toBe('dados_invalidos');
      expect(res.body.campos[0].campo).toBe('senha');
    });

    it('retorna 409 para e-mail duplicado', async () => {
      await cadastrar().expect(201);
      const res = await cadastrar().expect(409);
      expect(res.body).toEqual({ erro: 'email_duplicado', campos: [] });
    });
  });

  describe('POST /auth/login', () => {
    it('emite JWT e dados do usuário', async () => {
      await cadastrar().expect(201);
      const res = await entrar().expect(200);

      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.usuario.email).toBe('usuario@exemplo.com');
      expect(res.body.usuario).toHaveProperty('id');
    });

    it('retorna 401 para senha errada', async () => {
      await cadastrar().expect(201);
      const res = await entrar('usuario@exemplo.com', 'senhaErrada1').expect(401);
      expect(res.body).toEqual({ erro: 'credenciais_invalidas', campos: [] });
    });

    it('retorna 401 para e-mail inexistente', async () => {
      const res = await entrar('naoexiste@exemplo.com').expect(401);
      expect(res.body.erro).toBe('credenciais_invalidas');
    });
  });

  describe('GET /auth/me', () => {
    it('devolve o dono do token (RNF03)', async () => {
      await cadastrar().expect(201);
      const { body } = await entrar().expect(200);

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${body.token}`)
        .expect(200);

      expect(res.body.email).toBe('usuario@exemplo.com');
      expect(res.body.id).toBe(body.usuario.id);
    });

    it('retorna 401 sem token', async () => {
      const res = await request(app).get('/auth/me').expect(401);
      expect(res.body).toEqual({ erro: 'nao_autenticado', campos: [] });
    });

    it('retorna 401 com token inválido', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);
      expect(res.body).toEqual({ erro: 'token_invalido', campos: [] });
    });
  });

  describe('POST /auth/logout', () => {
    it('encerra a sessão e invalida o token', async () => {
      await cadastrar().expect(201);
      const { body } = await entrar().expect(200);

      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${body.token}`)
        .expect(204);

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${body.token}`)
        .expect(401);
      expect(res.body.erro).toBe('token_invalido');
    });

    it('retorna 401 sem token', async () => {
      const res = await request(app).post('/auth/logout').expect(401);
      expect(res.body.erro).toBe('nao_autenticado');
    });
  });
});
