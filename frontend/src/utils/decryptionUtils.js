/**
 * Utilitários para descriptografar dados recebidos da API
 * 
 * Este módulo implementa a lógica para descriptografar dados criptografados com Iron
 * transmitidos pela API pública sem autenticação.
 */

import Iron from '@hapi/iron';

// Chave de descriptografia (deve ser mantida segura)
// Na produção, isso deve ser carregado de variáveis de ambiente ou injetado durante o build
const DECRYPTION_KEY = process.env.REACT_APP_DATA_DECRYPTION_KEY || 'runcashh_data_encryption_secret_key_32ch';

/**
 * Descriptografa dados recebidos da API
 * @param {Object} encryptedResponse - Resposta criptografada da API
 * @returns {Promise<any>} - Dados descriptografados
 */
export const decryptApiData = async (encryptedResponse) => {
  try {
    // Verificar se a resposta contém dados criptografados
    if (!encryptedResponse || !encryptedResponse.data || !encryptedResponse._encryption) {
      console.warn('Resposta não está no formato criptografado esperado');
      return encryptedResponse; // Retornar os dados como estão se não forem criptografados
    }

    // Verificar se é o formato de criptografia esperado
    if (encryptedResponse._encryption !== 'Fe26.2') {
      console.warn(`Formato de criptografia não suportado: ${encryptedResponse._encryption}`);
      return encryptedResponse;
    }

    // Descriptografar os dados
    const decrypted = await Iron.unseal(encryptedResponse.data, DECRYPTION_KEY, Iron.defaults);
    
    // Verificar idade dos dados
    const ageMs = Date.now() - decrypted.timestamp;
    if (ageMs > 24 * 60 * 60 * 1000) { // Mais de 24 horas
      console.warn(`Dados muito antigos (${Math.floor(ageMs / 1000 / 60)} minutos), possível replay attack`);
    }
    
    // Retornar os dados descriptografados
    return decrypted.data;
  } catch (error) {
    console.error('Erro ao descriptografar dados:', error);
    throw new Error('Falha ao descriptografar dados da API');
  }
};

/**
 * Wrapper para o fetch que automaticamente descriptografa as respostas
 * @param {string} url - URL para fazer fetch
 * @param {Object} options - Opções do fetch
 * @returns {Promise<any>} - Dados descriptografados
 */
export const fetchAndDecrypt = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    return await decryptApiData(data);
  } catch (error) {
    console.error('Erro ao buscar ou descriptografar dados:', error);
    throw error;
  }
}; 