/**
 * Serviço de criptografia da aplicação
 * Este arquivo cria e exporta o objeto cryptoService para uso na aplicação
 */

import { 
  hasAccessKey, 
  setAccessKey, 
  clearAccessKey, 
  addAccessKeyToHeaders, 
  decryptData, 
  processApiResponse, 
  processEncryptedData 
} from './crypto-utils';

// Objeto de serviço de criptografia
const cryptoService = {
  hasAccessKey,
  setAccessKey,
  clearAccessKey,
  addAccessKeyToHeaders,
  decryptData,
  processApiResponse,
  processEncryptedData
};

// Exportação do serviço
export { cryptoService }; 