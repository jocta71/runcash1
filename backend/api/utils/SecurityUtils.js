const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { sanitize } = require('express-mongo-sanitize');
const xss = require('xss');
const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Classe utilitária com funções para verificações de segurança
 */
class SecurityUtils {
  /**
   * Lista de IPs bloqueados (em produção, isso estaria em um banco de dados)
   * @private
   */
  static #blockedIPs = new Set();

  /**
   * Verifica se um IP está bloqueado
   * @param {string} ip - Endereço IP para verificar
   * @returns {boolean} - True se o IP estiver bloqueado
   */
  static isBlockedIP(ip) {
    return this.#blockedIPs.has(ip);
  }

  /**
   * Bloqueia um IP
   * @param {string} ip - Endereço IP para bloquear
   */
  static blockIP(ip) {
    this.#blockedIPs.add(ip);
    
    // Em produção, salvar em banco de dados:
    // await BlockedIP.create({ ip, reason, blockedAt: new Date() });
    
    console.log(`IP bloqueado: ${ip}`);
  }

  /**
   * Remove um IP da lista de bloqueados
   * @param {string} ip - Endereço IP para desbloquear
   */
  static unblockIP(ip) {
    this.#blockedIPs.delete(ip);
    
    // Em produção, remover do banco de dados:
    // await BlockedIP.deleteOne({ ip });
    
    console.log(`IP desbloqueado: ${ip}`);
  }

  /**
   * Sanitiza dados para prevenir XSS (Cross-Site Scripting)
   * @param {any} data - Dados para sanitizar
   * @returns {any} - Dados sanitizados
   */
  static sanitizeData(data) {
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    
    if (data && typeof data === 'object') {
      const sanitized = {};
      
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      
      return sanitized;
    }
    
    return data;
  }

  /**
   * Sanitiza uma string para prevenir XSS
   * @param {string} str - String para sanitizar
   * @returns {string} - String sanitizada
   */
  static sanitizeString(str) {
    if (typeof str !== 'string') {
      return str;
    }
    
    // Usar biblioteca xss para sanitizar
    return xss(str.trim());
  }

  /**
   * Verifica se um ID do MongoDB é válido
   * @param {string} id - ID para verificar
   * @returns {boolean} - True se o ID for válido
   */
  static isValidMongoId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }

  /**
   * Gera um hash SHA-256 para uma string
   * @param {string} data - Dados para gerar hash
   * @returns {string} - Hash SHA-256 em formato hexadecimal
   */
  static generateHash(data) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  /**
   * Compara um hash com dados para verificar igualdade
   * @param {string} hash - Hash para comparar
   * @param {string} data - Dados originais
   * @returns {boolean} - True se o hash corresponder aos dados
   */
  static compareHash(hash, data) {
    const generatedHash = this.generateHash(data);
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(generatedHash, 'hex')
    );
  }

  /**
   * Gera um token seguro com comprimento específico
   * @param {number} [bytes=32] - Número de bytes (tamanho)
   * @returns {string} - Token seguro em formato hexadecimal
   */
  static generateSecureToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Cria um middleware de limitação de taxa para proteção contra ataques de força bruta
   * @param {Object} options - Opções para o limitador
   * @returns {Function} - Middleware de limitação de taxa
   */
  static createRateLimiter(options) {
    return rateLimit({
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutos por padrão
      max: options.max || 100, // 100 requisições por IP por janela por padrão
      message: options.message || 'Muitas requisições deste IP, tente novamente mais tarde',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res, next, options) => {
        // Registrar tentativa de ataque
        console.warn(`Possível ataque: IP ${req.ip} excedeu limite`);
        
        // Em produção, monitorar padrões para bloqueio permanente:
        // if (exceedsThreshold) this.blockIP(req.ip);
        
        res.status(429).json({
          success: false,
          message: options.message
        });
      }
    });
  }

  /**
   * Detecta caracteres suspeitos em entrada do usuário
   * @param {string} input - Entrada para verificar
   * @returns {boolean} - True se contiver caracteres suspeitos
   */
  static hasSuspiciousPatterns(input) {
    if (typeof input !== 'string') return false;
    
    // Verificar padrões de injeção SQL
    const sqlPatterns = /('(''|[^'])*')|(\)\s*OR\s*)|(\s*OR\s*\()|(\s*AND\s*\()|(\)\s*AND\s*)|(\s*UNION\s*ALL\s*)|(\s*SELECT\s*)|(\s*DROP\s*)/i;
    
    // Verificar padrões de XSS
    const xssPatterns = /<script|<img[^>]+onerror|javascript:|on\w+=/i;
    
    // Verificar padrões de NoSQL injection
    const noSqlPatterns = /\{\s*\$\w+\s*:/;
    
    return sqlPatterns.test(input) || xssPatterns.test(input) || noSqlPatterns.test(input);
  }

  /**
   * Middleware para sanitizar campos de requisição
   * @returns {Function} Middleware Express
   */
  static sanitizeMiddleware() {
    return (req, res, next) => {
      if (req.body) {
        req.body = this.sanitizeData(req.body);
      }
      if (req.params) {
        req.params = this.sanitizeData(req.params);
      }
      if (req.query) {
        req.query = this.sanitizeData(req.query);
      }
      next();
    };
  }

  /**
   * Gera um hash seguro para senha usando PBKDF2
   * @param {String} password - Senha para gerar hash
   * @param {String} salt - Salt para uso no hash, ou undefined para gerar novo
   * @returns {Object} Objeto com hash e salt
   */
  static async hashPassword(password, existingSalt) {
    return new Promise((resolve, reject) => {
      try {
        const salt = existingSalt || crypto.randomBytes(16).toString('hex');
        
        crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
          if (err) {
            return reject(err);
          }
          resolve({
            hash: derivedKey.toString('hex'),
            salt
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Verifica se uma senha corresponde ao hash armazenado
   * @param {String} password - Senha a verificar
   * @param {String} hash - Hash armazenado
   * @param {String} salt - Salt utilizado
   * @returns {Boolean} true se a senha corresponde
   */
  static async verifyPassword(password, hash, salt) {
    const { hash: verifyHash } = await this.hashPassword(password, salt);
    return verifyHash === hash;
  }

  /**
   * Valida uma senha contra regras de segurança
   * @param {String} password - Senha a validar
   * @returns {Object} Objeto com status e mensagem
   */
  static validatePasswordStrength(password) {
    if (!password || password.length < 8) {
      return { valid: false, message: 'A senha deve ter pelo menos 8 caracteres' };
    }
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return { 
        valid: false, 
        message: 'A senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais' 
      };
    }
    
    return { valid: true, message: 'Senha válida' };
  }

  /**
   * Middleware para verificar segurança de origem das requisições
   * @returns {Function} Middleware Express
   */
  static corsSecurityCheck() {
    return (req, res, next) => {
      const origin = req.headers.origin;
      const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',') 
        : ['http://localhost:3000'];
      
      // Verificar CORS
      if (origin && !allowedOrigins.includes(origin)) {
        console.warn(`Tentativa de acesso de origem não permitida: ${origin}`);
        return res.status(403).json({
          success: false,
          message: 'Origem da requisição não permitida'
        });
      }
      
      next();
    };
  }

  /**
   * Sanitiza parâmetros da requisição para evitar injeção de código
   * @param {Object} params - Parâmetros a serem sanitizados
   * @returns {Object} - Parâmetros sanitizados
   */
  static sanitizeParams(params) {
    const sanitized = {};
    
    for (const key in params) {
      if (params.hasOwnProperty(key)) {
        // Converte para string e remove caracteres perigosos
        const value = params[key];
        
        if (typeof value === 'string') {
          // Remove tags HTML, scripts e caracteres de escape
          sanitized[key] = value
            .replace(/<[^>]*>/g, '')
            .replace(/[\\$'"]/g, (match) => '\\' + match);
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeParams(value);
        } else {
          sanitized[key] = value;
        }
      }
    }
    
    return sanitized;
  }

  /**
   * Verifica se os dados parecem suspeitos (possível ataque)
   * @param {Object} data - Dados a serem verificados
   * @returns {Boolean} - Verdadeiro se os dados parecerem suspeitos
   */
  static isSuspiciousData(data) {
    if (!data) return false;

    // Verifica padrões de código malicioso nas strings
    const suspiciousPatterns = [
      /script/i,
      /eval\(/i,
      /<iframe/i,
      /document\.cookie/i,
      /window\.location/i,
      /\$\{/i,
      /\{\{/i,
      /\}\}/i,
      /object Object/i,
      /\[\object Object\]/i,
      /undefined/i,
      /null/i,
      /NaN/i,
      /Infinity/i,
      /%00/i,
      /%0d/i,
      /%0a/i
    ];

    // Verifica cada campo dos dados
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const value = data[key];
        
        if (typeof value === 'string') {
          // Verifica se a string contém algum padrão suspeito
          for (const pattern of suspiciousPatterns) {
            if (pattern.test(value)) {
              logger.warn(`Padrão suspeito detectado: ${pattern.toString()} em ${key}`);
              return true;
            }
          }
          
          // Verifica se a string é muito longa (possível payload de ataque)
          if (value.length > 5000) {
            logger.warn(`String muito longa detectada em ${key}: ${value.length} caracteres`);
            return true;
          }
        } else if (typeof value === 'object' && value !== null) {
          // Verifica recursivamente objetos aninhados
          if (this.isSuspiciousData(value)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Remove dados sensíveis de um objeto antes de enviá-lo na resposta
   * @param {Object} data - Dados a serem limpos
   * @returns {Object} - Dados sem informações sensíveis
   */
  static removeSensitiveData(data) {
    if (!data) return data;
    
    // Se for um array, mapeia cada item
    if (Array.isArray(data)) {
      return data.map(item => this.removeSensitiveData(item));
    }
    
    // Se não for um objeto, retorna diretamente
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    // Cria uma cópia para não modificar o original
    const sanitized = { ...data };
    
    // Lista de campos sensíveis a serem removidos
    const sensitiveFields = [
      'secretSettings',
      'adminNotes',
      'password',
      'token',
      'apiKey',
      'secret',
      'salt',
      '__v',
      '_id' // Substitui por id
    ];
    
    // Remove campos sensíveis
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        delete sanitized[field];
      }
    });
    
    // Converte _id para id se necessário
    if (data._id && !sanitized.id) {
      sanitized.id = data._id.toString();
    }
    
    // Processa campos aninhados
    for (const key in sanitized) {
      if (sanitized.hasOwnProperty(key) && typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.removeSensitiveData(sanitized[key]);
      }
    }
    
    return sanitized;
  }

  /**
   * Registra tentativa de acesso não autorizado
   * @param {String} userId - ID do usuário
   * @param {String} resource - Recurso que o usuário tentou acessar
   * @param {Object} req - Objeto de requisição do Express
   */
  static logSecurityEvent(userId, resource, req) {
    const eventData = {
      userId: userId || 'anônimo',
      resource,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl
    };
    
    logger.warn(`Evento de segurança: Acesso não autorizado a ${resource} por ${eventData.userId}`, eventData);
  }
}

module.exports = SecurityUtils; 