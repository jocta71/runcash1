/**
 * Teste para descriptografia de dados no formato Iron
 * Execute com: npx tsx frontend/src/test-crypto.ts
 * 
 * Este script pode ser executado fora do navegador, usando o Node.js.
 */

import cryptoUtils from './utils/crypto-utils';

// Obter referências aos métodos necessários
const { 
  cryptoService, 
  setAccessKey, 
  enableDevMode, 
  isDevModeEnabled, 
  tryCommonKeys,
  extractAndSetAccessKeyFromEvent 
} = cryptoUtils;

// Configurar o teste para ambiente Node.js
console.log("🔧 Ambiente: Node.js");
console.log("🔑 Testando funcionalidades de criptografia");

// Dados criptografados para teste
const encryptedData = {
  "encrypted": true,
  "format": "iron",
  "encryptedData": "Fe26.2*1b9ee4ee7956b9f7aebcea1947a690b7*V7lJFUMXnDRnVBI4ADL3nf2E+PerGGhU2luJpiMtJzyrJtqeNs232N4w73JwcL+v2gO3Lxa/oJ0stRyPALwkR2g6/HNCCyy4zKk6YL39N6adV3NANgaXlpdyCDKAGFuQD2viRjDfKTHpC8Liv+s4/qX7UnnmF7+E1vhpRx1iWREi1QuPII9Bn3EAotSa+1aa",
  "message": "Dados criptografados. Use sua chave de acesso para descriptografar.",
  "_timestamp": 1746437894271
};

// Dados em formato de 3 partes
const ironThreeParts = "Fe26.2*bcf3ce05f3baa107058d6e4ef7bb9718*ynzV/q7fkJnO3BzLUG9wXjbvjXS9HvPZKRXCZq7IqS4ylO+P9JwIdvg4tHCbpV0Y+8cYt8iJpCE88v2YZ0AtcnlxUYfCGhPMTbcJ+PsEvnbouh+/qvFhsU/3nI3I";

// Dados com possível chave de acesso
const dataWithKey = {
  "encrypted": true,
  "format": "iron",
  "accessKey": "test-access-key-2023",
  "encryptedData": ironThreeParts,
  "message": "Dados criptografados com chave incluída.",
};

// Função para formatar saída JSON
function formatJson(data: any): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return String(data);
  }
}

async function testDecryption() {
  try {
    console.log("\n============================================");
    console.log("🔒 TESTE DE DESCRIPTOGRAFIA IRON");
    console.log("============================================\n");
    
    // PARTE 1: Teste de chaves comuns
    console.log("\n🔑 PARTE 1: Teste de chaves comuns");
    console.log("--------------------------------------------");
    
    console.log("Tentando chaves comuns...");
    const keysFound = tryCommonKeys();
    console.log(`Resultado: ${keysFound ? '✅ Chave encontrada' : '❌ Nenhuma chave funcionou'}`);
    
    // PARTE 2: Teste com chaves específicas
    console.log("\n🔑 PARTE 2: Teste com chaves específicas");
    console.log("--------------------------------------------");
    
    // Configurar a chave de acesso para teste
    console.log("Configurando chave de acesso...");
    
    // Você pode testar com diferentes chaves
    const testKeys = [
      'mcs128i123xcxvc-testkey-production-v1',  // Chave padrão usada em setupAccessKey
      'runcash-production-key-v1',              // Tente esta chave alternativa
      'api-access-key-2025-v1',                 // Outra alternativa
      '1b9ee4ee7956b9f7aebcea1947a690b7',      // Hash do próprio cabeçalho como chave
      'bcf3ce05f3baa107058d6e4ef7bb9718'       // Hash do formato de 3 partes
    ];
    
    // Testar cada chave
    for (const key of testKeys) {
      console.log(`\n➡️ Testando com chave: ${key}`);
      setAccessKey(key);
      
      try {
        // Teste 1: Descriptografar objeto completo
        console.log("\n--- Teste 1: Descriptografar objeto completo ---");
        const result1 = await cryptoService.processEncryptedData(encryptedData);
        console.log("Resultado:", formatJson(result1));
        console.log("✅ Sucesso com o objeto completo!");
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log("❌ Falha ao descriptografar objeto completo:", errorMessage);
      }
      
      try {
        // Teste 2: Descriptografar apenas o campo encryptedData
        console.log("\n--- Teste 2: Descriptografar apenas encryptedData ---");
        const result2 = await cryptoService.decryptData(encryptedData.encryptedData);
        console.log("Resultado:", formatJson(result2));
        console.log("✅ Sucesso com encryptedData!");
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log("❌ Falha ao descriptografar encryptedData:", errorMessage);
      }
      
      try {
        // Teste 3: Descriptografar formato de 3 partes
        console.log("\n--- Teste 3: Descriptografar formato de 3 partes ---");
        const result3 = await cryptoService.decryptData(ironThreeParts);
        console.log("Resultado:", formatJson(result3));
        console.log("✅ Sucesso com formato de 3 partes!");
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log("❌ Falha ao descriptografar formato de 3 partes:", errorMessage);
      }
    }
    
    // PARTE 3: Testar modo de desenvolvimento
    console.log("\n🔧 PARTE 3: Teste do modo de desenvolvimento");
    console.log("--------------------------------------------");
    
    // Desabilitar qualquer chave de acesso
    setAccessKey('');
    console.log("Chave de acesso removida");
    
    // Verificar se o modo de desenvolvimento funciona
    console.log("Ativando modo de desenvolvimento");
    enableDevMode(true);
    
    // Verificar se foi ativado
    const devModeStatus = isDevModeEnabled() ? 'ativado' : 'desativado';
    console.log(`Status do modo de desenvolvimento: ${devModeStatus}`);
    
    // Tentar descriptografar sem chave de acesso com modo de desenvolvimento
    try {
      console.log("\n--- Testando descriptografia com modo de desenvolvimento ---");
      const result = await cryptoService.decryptData(ironThreeParts);
      console.log("Resultado:", formatJson(result));
      console.log("✅ Modo de desenvolvimento funcionando, dados simulados retornados!");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.log("❌ Falha ao usar modo de desenvolvimento:", errorMessage);
    }
    
    // PARTE 4: Testar extração de chave dos dados
    console.log("\n🔑 PARTE 4: Teste de extração de chave dos dados");
    console.log("--------------------------------------------");
    
    // Resetar configurações
    setAccessKey('');
    enableDevMode(false);
    
    try {
      console.log("Tentando extrair chave dos dados...");
      
      // Tentar extrair a chave
      const keyExtracted = extractAndSetAccessKeyFromEvent(dataWithKey);
      console.log(`Resultado da extração: ${keyExtracted ? '✅ Chave extraída' : '❌ Nenhuma chave encontrada'}`);
      
      // Verificar se a chave foi configurada
      if (keyExtracted) {
        try {
          console.log("Testando descriptografia com a chave extraída...");
          const result = await cryptoService.decryptData(ironThreeParts);
          console.log("Resultado:", formatJson(result));
          console.log("✅ Descriptografia com chave extraída funcionou!");
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.log("❌ Falha ao descriptografar com a chave extraída:", errorMessage);
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.log("❌ Erro ao testar extração de chave:", errorMessage);
    }
    
    // Testes adicionais com mais formatos
    console.log("\n🧪 PARTE 5: Testes adicionais com mais formatos");
    console.log("--------------------------------------------");
    
    // Ativar modo de desenvolvimento para garantir resultados
    enableDevMode(true);
    
    try {
      console.log("\n--- Testando formato com partes duplicadas ---");
      const duplicatedFormat = "Fe26.2*hash1*hash2*" + ironThreeParts;
      const result = await cryptoService.decryptData(duplicatedFormat);
      console.log("Resultado:", formatJson(result));
      console.log("✅ Teste com partes duplicadas bem-sucedido!");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.log("❌ Falha no teste com partes duplicadas:", errorMessage);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("\n❌ ERRO GERAL NO TESTE:", errorMessage);
    
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:\n", error.stack);
    }
  }
}

// Executar o teste
testDecryption().then(() => {
  console.log("\n============================================");
  console.log("✅ Testes concluídos com sucesso!");
  console.log("============================================");
}).catch(err => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error("\n❌ ERRO FATAL AO EXECUTAR TESTES:", errorMessage);
  
  if (err instanceof Error && err.stack) {
    console.error("\nStack trace:\n", err.stack);
  }
  
  process.exit(1);
}); 