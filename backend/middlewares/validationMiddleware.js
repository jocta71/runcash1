/**
 * Middleware para validação de dados de entrada
 * Utiliza o Joi para validar dados antes de processá-los
 */

const Joi = require('joi');

/**
 * Cria um middleware de validação a partir de um esquema Joi
 * 
 * @param {Object} schema - Esquema Joi para validação
 * @param {String} property - Propriedade da requisição a ser validada (body, params, query)
 * @returns {Function} Middleware de validação
 */
exports.validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const data = req[property];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Dados de entrada inválidos',
        errors: errorMessages
      });
    }

    // Substituir dados com valores validados e sanitizados
    req[property] = value;
    next();
  };
};

/**
 * Esquemas comuns de validação para reuso
 */
exports.schemas = {
  // Esquema para ID numérico
  id: Joi.object({
    id: Joi.number().integer().positive().required()
  }),
  
  // Esquema para validação de usuário (registro)
  userRegistration: Joi.object({
    nome: Joi.string().min(3).max(100).required(),
    email: Joi.string().email().required(),
    senha: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
      .messages({
        'string.pattern.base': 'A senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número',
        'string.min': 'A senha deve ter no mínimo 8 caracteres'
      }),
    confirmarSenha: Joi.string().valid(Joi.ref('senha')).required()
      .messages({ 'any.only': 'As senhas não conferem' }),
  }),
  
  // Esquema para validação de login
  userLogin: Joi.object({
    email: Joi.string().email().required(),
    senha: Joi.string().required()
  }),
  
  // Esquema para validação de assinatura
  subscription: Joi.object({
    plano: Joi.string().valid('mensal', 'anual', 'vitalicio').required(),
    metodoPagamento: Joi.string().required()
  }),
  
  // Esquema para validação de produto
  product: Joi.object({
    nome: Joi.string().min(3).max(100).required(),
    preco: Joi.number().positive().required(),
    descricao: Joi.string().max(500).optional(),
    categoria: Joi.string().required(),
    estoque: Joi.number().integer().min(0).default(0)
  }),
  
  // Esquema para busca paginada
  pagination: Joi.object({
    pagina: Joi.number().integer().min(1).default(1),
    limite: Joi.number().integer().min(1).max(100).default(10),
    ordenar: Joi.string().optional(),
    direcao: Joi.string().valid('asc', 'desc').default('asc')
  }),

  // Schema para validação de login
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'O email fornecido é inválido',
      'string.empty': 'O email é obrigatório',
      'any.required': 'O email é obrigatório'
    }),
    senha: Joi.string().min(6).required().messages({
      'string.min': 'A senha deve ter pelo menos 6 caracteres',
      'string.empty': 'A senha é obrigatória',
      'any.required': 'A senha é obrigatória'
    })
  }),

  // Schema para cadastro de usuário
  registro: Joi.object({
    nome: Joi.string().min(3).required().messages({
      'string.min': 'O nome deve ter pelo menos 3 caracteres',
      'string.empty': 'O nome é obrigatório',
      'any.required': 'O nome é obrigatório'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'O email fornecido é inválido',
      'string.empty': 'O email é obrigatório',
      'any.required': 'O email é obrigatório'
    }),
    senha: Joi.string().min(6).required().messages({
      'string.min': 'A senha deve ter pelo menos 6 caracteres',
      'string.empty': 'A senha é obrigatória',
      'any.required': 'A senha é obrigatória'
    }),
    confirmarSenha: Joi.string().valid(Joi.ref('senha')).required().messages({
      'any.only': 'As senhas não coincidem',
      'any.required': 'A confirmação de senha é obrigatória'
    })
  }),

  // Schema para parâmetros numéricos
  id: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      'number.base': 'O ID deve ser um número',
      'number.integer': 'O ID deve ser um número inteiro',
      'number.positive': 'O ID deve ser um número positivo',
      'any.required': 'O ID é obrigatório'
    })
  }),

  // Schema para alteração de assinatura
  assinatura: Joi.object({
    plano: Joi.string().valid('mensal', 'anual', 'vitalicio').required().messages({
      'any.only': 'O plano deve ser mensal, anual ou vitalicio',
      'string.empty': 'O plano é obrigatório',
      'any.required': 'O plano é obrigatório'
    }),
    metodoPagamento: Joi.string().valid('cartao', 'pix', 'boleto').required().messages({
      'any.only': 'O método de pagamento deve ser cartao, pix ou boleto',
      'string.empty': 'O método de pagamento é obrigatório',
      'any.required': 'O método de pagamento é obrigatório'
    })
  })
};

/**
 * Cria validadores para parâmetros comuns
 */
exports.validators = {
  // Validação de ID em parâmetros de rota
  validateId: exports.validate(exports.schemas.id, 'params'),
  
  // Validação de login
  validateLogin: exports.validate(exports.schemas.userLogin),
  
  // Validação de registro
  validateRegistration: exports.validate(exports.schemas.userRegistration),
  
  // Validação de parâmetros de paginação
  validatePagination: exports.validate(exports.schemas.pagination, 'query')
};

/**
 * Middleware para validar IDs em parâmetros de rota
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Função para passar para o próximo middleware
 */
exports.validateId = (req, res, next) => {
  const { error } = exports.schemas.id.validate({ id: parseInt(req.params.id) });
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'ID inválido',
      error: error.details[0].message
    });
  }
  
  next();
};

/**
 * Middleware para validar tokens na requisição
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Função para passar para o próximo middleware
 */
exports.validateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token não fornecido',
      error: 'ERROR_NO_TOKEN'
    });
  }
  
  // Aqui apenas verificamos a presença do token, a validação completa é feita no authMiddleware
  next();
};

/**
 * Sanitiza os dados de entrada para evitar injeção de código
 * @param {Object} req - Objeto de requisição
 * @param {Object} res - Objeto de resposta
 * @param {Function} next - Função para passar para o próximo middleware
 */
exports.sanitizarEntrada = (req, res, next) => {
  // Exemplo de sanitização simples - em produção use bibliotecas como sanitize-html
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Sanitiza strings para evitar XSS
        req.body[key] = req.body[key]
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
    });
  }
  
  next();
}; 