const express = require('express');
const { criarAuthController } = require('../controllers/authController');

function criarAuthRouter(authService, authenticate) {
  const router = express.Router();
  const controller = criarAuthController(authService);

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.post('/logout', authenticate, controller.logout);
  router.get('/me', authenticate, controller.me);

  return router;
}

module.exports = { criarAuthRouter };
