/**
 * Teste para descriptografia de dados no formato Iron
 * Execute com: npx ts-node test-crypto.ts
 */

import { cryptoService, setAccessKey } from './utils/crypto-utils';

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

async function testDecryption() {
  try {
    console.log("=== TESTE DE DESCRIPTOGRAFIA ===");
    
    // Configurar a chave de acesso para teste
    console.log("Configurando chave de acesso...");
    
    // Você pode testar com diferentes chaves
    const testKeys = [
      'mcs128i123xcxvc-testkey-production-v1',  // Chave padrão usada em setupAccessKey
      'runcash-production-key-v1',              // Tente esta chave alternativa
      'api-access-key-2025-v1',                 // Outra alternativa
      '1b9ee4ee7956b9f7aebcea1947a690b7'       // Hash do próprio cabeçalho como chave
    ];
    
    // Testar cada chave
    for (const key of testKeys) {
      console.log(`\nTestando com chave: ${key}`);
      setAccessKey(key);
      
      try {
        // Teste 1: Descriptografar objeto completo
        console.log("\n--- Teste 1: Descriptografar objeto completo ---");
        const result1 = await cryptoService.processEncryptedData(encryptedData);
        console.log("Resultado:", JSON.stringify(result1, null, 2));
        console.log("✅ Sucesso com o objeto completo!");
      } catch (e) {
        console.log("❌ Falha ao descriptografar objeto completo:", e.message);
      }
      
      try {
        // Teste 2: Descriptografar apenas o campo encryptedData
        console.log("\n--- Teste 2: Descriptografar apenas encryptedData ---");
        const result2 = await cryptoService.decryptData(encryptedData.encryptedData);
        console.log("Resultado:", JSON.stringify(result2, null, 2));
        console.log("✅ Sucesso com encryptedData!");
      } catch (e) {
        console.log("❌ Falha ao descriptografar encryptedData:", e.message);
      }
      
      try {
        // Teste 3: Descriptografar formato de 3 partes
        console.log("\n--- Teste 3: Descriptografar formato de 3 partes ---");
        const result3 = await cryptoService.decryptData(ironThreeParts);
        console.log("Resultado:", JSON.stringify(result3, null, 2));
        console.log("✅ Sucesso com formato de 3 partes!");
      } catch (e) {
        console.log("❌ Falha ao descriptografar formato de 3 partes:", e.message);
      }
    }
    
  } catch (error) {
    console.error("Erro no teste:", error);
  }
}

// Executar o teste
testDecryption().then(() => {
  console.log("\nTestes concluídos.");
}).catch(err => {
  console.error("Erro ao executar testes:", err);
}); 