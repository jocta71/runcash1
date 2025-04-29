// Serviço para gerenciamento de cache
// Usando armazenamento em memória para desenvolvimento, em produção considere Redis

// Cache em memória (para desenvolvimento)
const memoryCache = new Map();

/**
 * Salva dados no cache
 * @param {string} key - Chave do cache
 * @param {Object} data - Dados a serem armazenados
 * @param {number} ttlSeconds - Tempo de vida em segundos (padrão: 5 minutos)
 */
async function saveToCache(key, data, ttlSeconds = 300) {
  try {
    const expiry = Date.now() + (ttlSeconds * 1000);
    
    memoryCache.set(key, {
      data,
      expiry
    });
    
    return true;
  } catch (error) {
    console.error(`[Cache] Erro ao salvar no cache (${key}):`, error);
    return false;
  }
}

/**
 * Recupera dados do cache
 * @param {string} key - Chave do cache
 * @returns {Object|null} - Dados armazenados ou null se expirado/não existir
 */
async function getFromCache(key) {
  try {
    const cached = memoryCache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Verificar se está expirado
    if (cached.expiry < Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    
    return cached.data;
  } catch (error) {
    console.error(`[Cache] Erro ao recuperar do cache (${key}):`, error);
    return null;
  }
}

/**
 * Remove item do cache
 * @param {string} key - Chave do cache
 */
async function removeFromCache(key) {
  try {
    memoryCache.delete(key);
    return true;
  } catch (error) {
    console.error(`[Cache] Erro ao remover do cache (${key}):`, error);
    return false;
  }
}

/**
 * Verifica se um timestamp está expirado
 * @param {string} timestamp - Timestamp ISO string
 * @param {number} maxAgeSeconds - Idade máxima em segundos
 * @returns {boolean} - true se expirado, false caso contrário
 */
function isExpired(timestamp, maxAgeSeconds = 300) {
  if (!timestamp) return true;
  
  const date = new Date(timestamp);
  const now = new Date();
  const ageMs = now - date;
  
  return ageMs > (maxAgeSeconds * 1000);
}

module.exports = {
  saveToCache,
  getFromCache,
  removeFromCache,
  isExpired
}; 