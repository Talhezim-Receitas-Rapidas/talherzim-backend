const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validarCredenciais } = require('../http/validacaoAuth');
const { AuthService, AuthError } = require('../services/authService');
const { criarAuthenticate, autorizarUsuario } = require('../middleware/authenticate');
const { enviarErro } = require('../http/erro');

describe('Testes Unitários - S1-04 Autenticação', () => {
  describe('validarCredenciais', () => {
    it('deve validar com sucesso e normalizar o email para minúsculo', () => {
      const resultado = validarCredenciais({
        email: 'Teste.Usuario@Exemplo.COM',
        senha: 'senhaForte123',
      });

      expect(resultado.valido).toBe(true);
      expect(resultado.campos).toEqual([]);
      expect(resultado.email).toBe('teste.usuario@exemplo.com');
      expect(resultado.senha).toBe('senhaForte123');
    });

    it('deve reprovar email inválido', () => {
      const resultado = validarCredenciais({
        email: 'email-invalido',
        senha: 'senhaForte123',
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.campos).toContainEqual({
        campo: 'email',
        mensagem: 'E-mail inválido.',
      });
    });

    it('deve reprovar senha com menos de 8 caracteres', () => {
      const resultado = validarCredenciais({
        email: 'teste@exemplo.com',
        senha: '123',
      });

      expect(resultado.valido).toBe(false);
      expect(resultado.campos).toContainEqual({
        campo: 'senha',
        mensagem: 'A senha deve ter ao menos 8 caracteres.',
      });
    });

    it('deve tratar body ausente ou inválido', () => {
      const resultado = validarCredenciais(null);
      expect(resultado.valido).toBe(false);
      expect(resultado.campos.length).toBe(2);
    });
  });

  describe('AuthService (com pool mockado)', () => {
    let mockPool;
    let authService;
    let tokensRevogados;
    const config = {
      jwtSecret: 'chave-teste-jwt',
      jwtExpiresIn: '1h',
      bcryptRounds: 4,
    };

    beforeEach(() => {
      mockPool = {
        query: jest.fn(),
      };
      tokensRevogados = new Set();
      authService = new AuthService(mockPool, config, tokensRevogados);
    });

    describe('registrar', () => {
      it('deve registrar usuário com hash de senha', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 'user-uuid-1', email: 'novo@exemplo.com' }],
        });

        const usuario = await authService.registrar('novo@exemplo.com', 'senhaSegura123');

        expect(usuario).toEqual({ id: 'user-uuid-1', email: 'novo@exemplo.com' });
        expect(mockPool.query).toHaveBeenCalledTimes(1);
        const [queryText, queryParams] = mockPool.query.mock.calls[0];
        expect(queryText).toContain('INSERT INTO usuarios');
        expect(queryParams[0]).toBe('novo@exemplo.com');
        expect(queryParams[1]).not.toBe('senhaSegura123');
        expect(queryParams[1].startsWith('$2')).toBe(true);
      });

      it('deve lançar AuthError 409 quando o email já existe (code 23505)', async () => {
        const dbError = new Error('unique violation');
        dbError.code = '23505';
        mockPool.query.mockRejectedValueOnce(dbError);

        await expect(
          authService.registrar('jaexiste@exemplo.com', 'senhaSegura123'),
        ).rejects.toThrow(AuthError);
      });

      it('deve propagar outros erros desconhecidos do banco', async () => {
        const genericError = new Error('falha de conexão');
        mockPool.query.mockRejectedValueOnce(genericError);

        await expect(authService.registrar('erro@exemplo.com', 'senhaSegura123')).rejects.toThrow(
          'falha de conexão',
        );
      });
    });

    describe('login', () => {
      it('deve autenticar e retornar token JWT e dados do usuário', async () => {
        const hash = await bcrypt.hash('minhaSenha123', config.bcryptRounds);
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 'user-uuid-2', email: 'login@exemplo.com', senha_hash: hash }],
        });

        const sessao = await authService.login('login@exemplo.com', 'minhaSenha123');

        expect(sessao.usuario).toEqual({ id: 'user-uuid-2', email: 'login@exemplo.com' });
        expect(typeof sessao.token).toBe('string');
        const payload = jwt.verify(sessao.token, config.jwtSecret);
        expect(payload.sub).toBe('user-uuid-2');
        expect(payload.email).toBe('login@exemplo.com');
        expect(payload.jti).toBeDefined();
      });

      it('deve lançar 401 se o usuário não for encontrado', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await expect(authService.login('naoexiste@exemplo.com', 'senha1234')).rejects.toThrow(
          new AuthError('credenciais_invalidas', 401),
        );
      });

      it('deve lançar 401 se a senha for inválida', async () => {
        const hash = await bcrypt.hash('senhaCorreta123', config.bcryptRounds);
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 'user-uuid-3', email: 'senha@exemplo.com', senha_hash: hash }],
        });

        await expect(authService.login('senha@exemplo.com', 'senhaErrada123')).rejects.toThrow(
          new AuthError('credenciais_invalidas', 401),
        );
      });
    });

    describe('logout e tokenRevogado', () => {
      it('deve revogar o token adicionando o jti aos revogados', () => {
        expect(authService.tokenRevogado('jti-123')).toBe(false);
        authService.logout({ jti: 'jti-123' });
        expect(authService.tokenRevogado('jti-123')).toBe(true);
      });
    });

    describe('buscarPorId', () => {
      it('deve retornar usuário se encontrado', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [{ id: 'uuid-1', email: 'busca@exemplo.com' }],
        });

        const usuario = await authService.buscarPorId('uuid-1');
        expect(usuario).toEqual({ id: 'uuid-1', email: 'busca@exemplo.com' });
      });

      it('deve retornar null se não encontrado', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        const usuario = await authService.buscarPorId('uuid-inexistente');
        expect(usuario).toBeNull();
      });
    });
  });

  describe('middleware authenticate', () => {
    let authService;
    let authenticate;
    const jwtSecret = 'segredo-mid';

    beforeEach(() => {
      authService = {
        tokenRevogado: jest.fn().mockReturnValue(false),
        buscarPorId: jest.fn(),
      };
      authenticate = criarAuthenticate(authService, jwtSecret);
    });

    function mockRes() {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    }

    it('deve rejeitar requisição sem header authorization', async () => {
      const req = { headers: {} };
      const res = mockRes();
      const next = jest.fn();

      await authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ erro: 'nao_autenticado', campos: [] });
      expect(next).not.toHaveBeenCalled();
    });

    it('deve rejeitar formato de header inválido', async () => {
      const req = { headers: { authorization: 'Basic 12345' } };
      const res = mockRes();
      const next = jest.fn();

      await authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ erro: 'nao_autenticado', campos: [] });
    });

    it('deve rejeitar token revogado', async () => {
      const token = jwt.sign({ sub: 'user-1', jti: 'revogado-1' }, jwtSecret);
      authService.tokenRevogado.mockReturnValueOnce(true);

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ erro: 'token_invalido', campos: [] });
    });

    it('deve autorizar com sucesso e popular req.usuario', async () => {
      const token = jwt.sign({ sub: 'user-1', email: 'u@e.com', jti: 'jti-ok' }, jwtSecret);
      authService.buscarPorId.mockResolvedValueOnce({ id: 'user-1', email: 'u@e.com' });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      await authenticate(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.usuario).toEqual({ id: 'user-1', email: 'u@e.com' });
      expect(req.tokenPayload.sub).toBe('user-1');
    });
  });

  describe('autorizarUsuario', () => {
    it('deve retornar true quando req.usuario.id confere com recursoUsuarioId', () => {
      expect(autorizarUsuario({ usuario: { id: 'abc' } }, 'abc')).toBe(true);
    });

    it('deve retornar false quando req.usuario.id difere do recursoUsuarioId', () => {
      expect(autorizarUsuario({ usuario: { id: 'abc' } }, 'def')).toBe(false);
    });
  });

  describe('UsuarioModel', () => {
    const { UsuarioModel } = require('../models/usuarioModel');
    let mockPool;

    beforeEach(() => {
      mockPool = { query: jest.fn() };
    });

    it('criar deve inserir e retornar o registro criado', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: '123', email: 'a@b.com' }] });
      const res = await UsuarioModel.criar(mockPool, 'a@b.com', 'hash123');
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO usuarios'), [
        'a@b.com',
        'hash123',
      ]);
      expect(res).toEqual({ id: '123', email: 'a@b.com' });
    });

    it('buscarPorEmail deve retornar null se usuário não existir', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const res = await UsuarioModel.buscarPorEmail(mockPool, 'inexistente@b.com');
      expect(res).toBeNull();
    });

    it('buscarPorId deve retornar o registro se encontrado', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'id-1', email: 'a@b.com' }] });
      const res = await UsuarioModel.buscarPorId(mockPool, 'id-1');
      expect(res).toEqual({ id: 'id-1', email: 'a@b.com' });
    });
  });

  describe('AuthController', () => {
    const { criarAuthController } = require('../controllers/authController');
    let mockAuthService;
    let controller;

    beforeEach(() => {
      mockAuthService = {
        registrar: jest.fn(),
        login: jest.fn(),
        logout: jest.fn(),
      };
      controller = criarAuthController(mockAuthService);
    });

    function mockResponse() {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      res.send = jest.fn().mockReturnValue(res);
      return res;
    }

    it('register deve retornar 201 com dados do usuário', async () => {
      const req = { body: { email: 'novo@teste.com', senha: 'senhaForte123' } };
      const res = mockResponse();
      mockAuthService.registrar.mockResolvedValueOnce({ id: 'u-1', email: 'novo@teste.com' });

      await controller.register(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 'u-1', email: 'novo@teste.com' });
    });

    it('register deve retornar 422 se dados forem inválidos', async () => {
      const req = { body: { email: 'invalido', senha: '123' } };
      const res = mockResponse();

      await controller.register(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ erro: 'dados_invalidos' }));
    });

    it('logout deve retornar status 204', () => {
      const req = { tokenPayload: { jti: 'jti-1' } };
      const res = mockResponse();

      controller.logout(req, res);
      expect(mockAuthService.logout).toHaveBeenCalledWith({ jti: 'jti-1' });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('me deve retornar status 200 com id e email', () => {
      const req = { usuario: { id: 'usr-1', email: 'me@teste.com' } };
      const res = mockResponse();

      controller.me(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ id: 'usr-1', email: 'me@teste.com' });
    });
  });
});
