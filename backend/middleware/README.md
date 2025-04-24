# Middleware de Verificação de Assinatura

Este módulo fornece middlewares para verificar se um usuário possui uma assinatura ativa no sistema. Estes middlewares são úteis para proteger rotas premium e funcionalidades que exigem um plano de assinatura específico.

## Funções Disponíveis

### `verificarAssinatura`

Middleware que verifica se o usuário autenticado possui uma assinatura ativa. Retorna erro 403 caso o usuário não tenha uma assinatura ativa.

```javascript
const { verificarAssinatura } = require('../middleware/assinaturaMiddleware');

// Proteger uma rota com verificação de assinatura
router.get('/conteudo-premium', verificarAssinatura, controller.obterConteudo);
```

### `verificarPlano(planosPermitidos)`

Middleware que verifica se o usuário possui um plano específico entre os planos permitidos. Útil para restringir acesso a certas funcionalidades a planos específicos.

```javascript
const { verificarPlano } = require('../middleware/assinaturaMiddleware');

// Permitir apenas planos premium e empresarial
router.get('/conteudo-vip', verificarPlano(['premium', 'empresarial']), controller.obterConteudoVIP);

// Permitir apenas plano empresarial
router.get('/conteudo-empresarial', verificarPlano(['empresarial']), controller.obterConteudoEmpresarial);
```

### `adicionarInfoAssinatura`

Middleware que adiciona informações da assinatura à requisição sem bloquear o acesso. Útil para personalizar conteúdo com base no plano do usuário sem bloquear o acesso.

```javascript
const { adicionarInfoAssinatura } = require('../middleware/assinaturaMiddleware');

// Aplicar middleware para adicionar informações da assinatura
router.get('/pagina-inicial', adicionarInfoAssinatura, controller.obterPaginaInicial);
```

## Exemplo de Uso em Rotas

```javascript
const express = require('express');
const router = express.Router();
const { proteger } = require('../middlewares/authMiddleware');
const { verificarPlano, adicionarInfoAssinatura } = require('../middleware/assinaturaMiddleware');

// Rota pública - não requer autenticação nem assinatura
router.get('/publico', controller.rotaPublica);

// Rota que requer autenticação mas não assinatura
// Adiciona informações da assinatura se existir
router.get('/autenticado', 
  proteger, 
  adicionarInfoAssinatura, 
  controller.rotaAutenticada
);

// Rota que requer assinatura ativa (qualquer plano)
router.get('/assinante', 
  proteger, 
  verificarAssinatura, 
  controller.rotaAssinante
);

// Rota que requer plano premium ou empresarial
router.get('/premium', 
  proteger, 
  verificarPlano(['premium', 'empresarial']), 
  controller.rotaPremium
);

// Rota que requer plano empresarial
router.get('/empresarial', 
  proteger, 
  verificarPlano(['empresarial']), 
  controller.rotaEmpresarial
);

module.exports = router;
```

## Informações importantes

Os middlewares esperam que haja um middleware de autenticação anterior que adicione as informações do usuário em `req.usuario`. Se você está usando o middleware de autenticação customizado, ele já faz isso.

Quando um usuário autenticado com assinatura ativa acessa uma rota protegida, os middlewares adicionam as informações da assinatura em `req.assinatura`. Você pode usar essas informações nos seus controladores para personalizar o comportamento da sua aplicação. 