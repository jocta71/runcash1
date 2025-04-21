#!/usr/bin/env node

/**
 * Script para contar o número de funções serverless no projeto
 * Executar com: node scripts/count-serverless-functions.js
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Diretórios a serem verificados para funções serverless
const API_DIRECTORIES = [
  'api',
  'api/ai',
  'api/delete-notification',
  'api/config'
];

// Extensões de arquivo que contam como funções serverless
const SERVERLESS_EXTENSIONS = ['.js', '.ts'];

// Arquivos a serem ignorados (não contados como funções)
const IGNORED_FILES = [
  'package.json',
  'package-lock.json',
  'README.md',
  'tsconfig.json'
];

async function countFunctionsInDirectory(directory) {
  try {
    if (!fs.existsSync(directory)) {
      return [];
    }

    const files = await readdir(directory);
    const functions = [];

    for (const file of files) {
      // Ignorar arquivos especificados
      if (IGNORED_FILES.includes(file)) {
        continue;
      }

      const filePath = path.join(directory, file);
      const fileStat = await stat(filePath);

      // É um diretório
      if (fileStat.isDirectory()) {
        // Subdiretorios contam como namespaces na Vercel, cada arquivo JS dentro
        // deles conta como uma função serverless separada
        const subdirectoryFunctions = await countFunctionsInDirectory(filePath);
        functions.push(...subdirectoryFunctions);
      } 
      // É um arquivo com extensão válida
      else if (SERVERLESS_EXTENSIONS.includes(path.extname(file))) {
        functions.push(filePath);
      }
    }

    return functions;
  } catch (error) {
    console.error(`Erro ao contar funções em ${directory}:`, error);
    return [];
  }
}

async function main() {
  console.log('🔍 Contando funções serverless no projeto...');
  
  let allFunctions = [];
  
  for (const directory of API_DIRECTORIES) {
    const functions = await countFunctionsInDirectory(directory);
    allFunctions.push(...functions);
  }
  
  // Remover duplicados
  allFunctions = [...new Set(allFunctions)];
  
  console.log('\n📊 Resumo de funções serverless:');
  console.log(`Total de funções: ${allFunctions.length}`);
  
  // Verificar se está dentro do limite do plano Hobby
  const HOBBY_LIMIT = 12;
  if (allFunctions.length <= HOBBY_LIMIT) {
    console.log(`✅ Seu projeto está dentro do limite do plano Hobby (${allFunctions.length}/${HOBBY_LIMIT}).`);
  } else {
    console.log(`⚠️ Seu projeto excede o limite do plano Hobby (${allFunctions.length}/${HOBBY_LIMIT})!`);
    console.log('   Você precisará consolidar mais funções ou atualizar para o plano Pro.');
  }
  
  // Listar todas as funções encontradas
  console.log('\n📑 Lista de funções encontradas:');
  allFunctions.forEach((func, index) => {
    console.log(`${index + 1}. ${func}`);
  });
  
  // Sugestões se estiver acima do limite
  if (allFunctions.length > HOBBY_LIMIT) {
    console.log('\n💡 Possíveis soluções:');
    console.log('1. Consolidar mais endpoints em funções unificadas (recomendado)');
    console.log('2. Atualizar para o plano Pro da Vercel');
    console.log('3. Verificar se há arquivos que não são realmente endpoints');
  }
}

// Executar o script
main().catch(error => {
  console.error('Erro inesperado:', error);
  process.exit(1);
}); 