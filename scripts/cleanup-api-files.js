#!/usr/bin/env node

/**
 * Script para remover arquivos de API duplicados após a migração para endpoints unificados
 * Executar com: node scripts/cleanup-api-files.js
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const unlink = promisify(fs.unlink);
const exists = promisify(fs.access).bind(null, fs.constants.F_OK).then(() => true).catch(() => false);

// Lista de arquivos a serem removidos
const FILES_TO_REMOVE = [
  // Arquivos de assinatura agora em subscription-operations.js
  'api/asaas-create-subscription.js',
  'api/asaas-find-subscription.js',
  'api/asaas-cancel-subscription.js',
  
  // Arquivos Asaas agora em asaas-operations.js
  'api/asaas-find-customer.js',
  'api/asaas-create-customer.js',
  'api/asaas-find-payment.js',
  'api/asaas-pix-qrcode.js',
  'api/regenerate-pix-code.js',
  
  // Arquivos de autenticação agora em auth-operations.js
  'api/auth-update-user.js',
];

async function main() {
  console.log('🧹 Iniciando limpeza de arquivos duplicados...');
  
  let removedCount = 0;
  
  for (const filePath of FILES_TO_REMOVE) {
    const fullPath = path.resolve(process.cwd(), filePath);
    
    if (await exists(fullPath)) {
      try {
        // Criar backup antes de remover
        const backupPath = `${fullPath}.bak`;
        fs.copyFileSync(fullPath, backupPath);
        
        // Remover arquivo
        await unlink(fullPath);
        
        console.log(`✅ Removido: ${filePath} (backup em ${path.basename(backupPath)})`);
        removedCount++;
      } catch (error) {
        console.error(`❌ Erro ao remover ${filePath}:`, error.message);
      }
    } else {
      console.log(`⚠️ Arquivo não encontrado: ${filePath}`);
    }
  }
  
  if (removedCount > 0) {
    console.log(`\n✨ Concluído! ${removedCount} arquivos foram removidos com sucesso.`);
    console.log('   Backups foram criados com extensão .bak caso seja necessário restaurar.');
  } else {
    console.log('\n⚠️ Nenhum arquivo foi removido.');
  }
}

// Verificar se é para executar diretamente
if (require.main === module) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('⚠️ Esta operação irá remover arquivos duplicados de API. Continuar? (s/n): ', (answer) => {
    if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim') {
      main().catch(console.error).finally(() => readline.close());
    } else {
      console.log('Operação cancelada.');
      readline.close();
    }
  });
} else {
  module.exports = { FILES_TO_REMOVE };
} 