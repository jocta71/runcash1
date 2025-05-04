/**
 * Utilitário para lidar com a decodificação de dados de roletas
 * Compatível com o formato criptografado usado na API
 */

import Iron from '@hapi/iron';

// Chave de decodificação - deve ser a mesma usada no backend
const DECRYPTION_KEY = process.env.NEXT_PUBLIC_DATA_DECRYPTION_KEY || 'runcashh_data_encryption_secret_key_32ch';

/**
 * Decodifica os dados criptografados das roletas
 * @param {string} encryptedData - Dados criptografados recebidos da API
 * @returns {Promise<object>} - Dados decodificados
 */
export async function decryptRouletteData(encryptedData) {
  try {
    // Verificar se os dados estão no formato esperado
    if (!encryptedData || !encryptedData.data || !encryptedData.event) {
      console.error('Formato de dados inválido:', encryptedData);
      throw new Error('Formato de dados inválido');
    }

    // Extrair os dados criptografados
    const cryptedString = encryptedData.data;
    
    // Remover o prefixo Fe26_ e o hash aleatório
    const cleanData = cryptedString.replace(/^Fe26_[a-f0-9]{16}/, '');
    
    // Decodificar usando Iron
    const decrypted = await Iron.unseal(cleanData, DECRYPTION_KEY, Iron.defaults);
    
    // Retornar os dados originais
    return decrypted.data;
  } catch (error) {
    console.error('Erro ao decodificar dados de roleta:', error);
    throw new Error('Falha ao decodificar dados da roleta');
  }
}

/**
 * Processa a resposta da API e decodifica se necessário
 * @param {object} response - Resposta da API
 * @returns {Promise<object>} - Dados processados
 */
export async function processRouletteResponse(response) {
  try {
    // Verificar se a resposta possui o indicador de criptografia
    if (response && response.event === 'update' && response.data) {
      // Dados criptografados, decodificar
      return await decryptRouletteData(response);
    }
    
    // Dados não criptografados, retornar como estão
    return response;
  } catch (error) {
    console.error('Erro ao processar resposta de roleta:', error);
    // Em caso de erro, retornar dados originais
    return response;
  }
}

/**
 * Hook para WebSocket que processa mensagens em tempo real
 * @param {string} message - Mensagem recebida do WebSocket
 * @returns {Promise<object>} - Dados processados
 */
export async function processWebSocketMessage(message) {
  try {
    // Tentar analisar a mensagem como JSON
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    
    // Verificar se parece com o formato criptografado
    if (data && data.event === 'update' && data.data) {
      return await decryptRouletteData(data);
    }
    
    // Retornar dados como estão
    return data;
  } catch (error) {
    console.error('Erro ao processar mensagem WebSocket:', error);
    return null;
  }
}

export default {
  decryptRouletteData,
  processRouletteResponse,
  processWebSocketMessage
}; 