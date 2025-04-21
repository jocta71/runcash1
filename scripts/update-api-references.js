#!/usr/bin/env node

/**
 * Script para ajudar a identificar e substituir referências às antigas APIs no frontend
 * Executar com: node scripts/update-api-references.js
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

// Mapeamento de APIs antigas para novas
const API_MAPPING = {
  // Assinatura
  '/api/asaas-create-subscription': '/api/subscription-operations?operation=create',
  '/api/asaas-find-subscription': '/api/subscription-operations?operation=find',
  '/api/asaas-cancel-subscription': '/api/subscription-operations?operation=cancel',
  
  // Asaas
  '/api/asaas-find-customer': '/api/asaas-operations?operation=find-customer',
  '/api/asaas-create-customer': '/api/asaas-operations?operation=create-customer',
  '/api/asaas-find-payment': '/api/asaas-operations?operation=find-payment',
  '/api/asaas-pix-qrcode': '/api/asaas-operations?operation=pix-qrcode',
  '/api/regenerate-pix-code': '/api/asaas-operations?operation=regenerate-pix',
  
  // Autenticação
  '/api/auth-update-user': '/api/auth-operations?operation=update-user',
};

// Diretórios a serem verificados
const DIRECTORIES_TO_CHECK = [
  'frontend/src',
  'pages',
  'components'
];

// Extensões de arquivos a serem verificados
const FILE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

// Função para verificar se uma API está sendo usada em um arquivo
async function checkFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const findings = [];

    for (const [oldApi, newApi] of Object.entries(API_MAPPING)) {
      if (content.includes(oldApi)) {
        findings.push({ oldApi, newApi, filePath });
      }
    }

    return findings;
  } catch (error) {
    console.error(`Erro ao verificar o arquivo ${filePath}:`, error);
    return [];
  }
}

// Função para buscar arquivos recursivamente
async function findFiles(directory) {
  try {
    const files = await readdir(directory);
    let results = [];

    for (const file of files) {
      const filePath = path.join(directory, file);
      const fileStat = await stat(filePath);

      if (fileStat.isDirectory()) {
        // Ignorar node_modules e .git
        if (file !== 'node_modules' && file !== '.git' && file !== 'build' && file !== 'dist') {
          const subResults = await findFiles(filePath);
          results = [...results, ...subResults];
        }
      } else if (FILE_EXTENSIONS.includes(path.extname(file))) {
        results.push(filePath);
      }
    }

    return results;
  } catch (error) {
    console.error(`Erro ao buscar arquivos em ${directory}:`, error);
    return [];
  }
}

// Função para substituir referências em um arquivo
async function replaceInFile(filePath, findings) {
  try {
    let content = await readFile(filePath, 'utf8');
    let modified = false;

    for (const { oldApi, newApi } of findings) {
      // Caso 1: URL em string simples com aspas simples
      content = content.replace(new RegExp(`'${oldApi}'`, 'g'), `'${newApi}'`);
      
      // Caso 2: URL em string simples com aspas duplas
      content = content.replace(new RegExp(`"${oldApi}"`, 'g'), `"${newApi}"`);
      
      // Caso 3: URL em template literal
      content = content.replace(new RegExp(`\`${oldApi}\``, 'g'), `\`${newApi}\``);
      
      // Caso 4: Fetch ou axios com URL
      content = content.replace(new RegExp(`fetch\\(('|"|)\/?${oldApi}('|"|)`, 'g'), `fetch($1${newApi}$2`);
      content = content.replace(new RegExp(`axios\\.(?:get|post|put|delete)\\(('|"|)\/?${oldApi}('|"|)`, 'g'), 
                              (match, p1, p2) => match.replace(`${p1}${oldApi}${p2}`, `${p1}${newApi}${p2}`));
      
      modified = true;
    }

    if (modified) {
      await writeFile(filePath, content, 'utf8');
      console.log(`✅ Alterações aplicadas em: ${filePath}`);
    }
  } catch (error) {
    console.error(`Erro ao substituir no arquivo ${filePath}:`, error);
  }
}

// Função principal
async function main() {
  console.log('🔍 Iniciando busca por referências às APIs antigas...');
  
  let allFiles = [];
  for (const directory of DIRECTORIES_TO_CHECK) {
    try {
      if (fs.existsSync(directory)) {
        const files = await findFiles(directory);
        allFiles = [...allFiles, ...files];
      }
    } catch (error) {
      console.error(`Diretório ${directory} não encontrado.`);
    }
  }
  
  console.log(`🔎 Verificando ${allFiles.length} arquivos...`);
  
  const findings = {};
  let totalFindings = 0;
  
  // Verificar todos os arquivos
  for (const filePath of allFiles) {
    const fileFindings = await checkFile(filePath);
    if (fileFindings.length > 0) {
      findings[filePath] = fileFindings;
      totalFindings += fileFindings.length;
    }
  }
  
  // Mostrar resultados
  if (totalFindings === 0) {
    console.log('✨ Nenhuma referência às APIs antigas encontrada!');
    return;
  }
  
  console.log(`\n📊 Encontradas ${totalFindings} referências às APIs antigas em ${Object.keys(findings).length} arquivos:`);
  
  for (const [filePath, fileFindings] of Object.entries(findings)) {
    console.log(`\n📄 ${filePath}:`);
    for (const { oldApi, newApi } of fileFindings) {
      console.log(`   - Substituir: ${oldApi} -> ${newApi}`);
    }
  }
  
  // Perguntar se deseja fazer as substituições
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('\n🔄 Deseja aplicar as substituições? (s/n): ', async (answer) => {
    if (answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim') {
      console.log('\n🔄 Aplicando substituições...');
      
      for (const [filePath, fileFindings] of Object.entries(findings)) {
        await replaceInFile(filePath, fileFindings);
      }
      
      console.log('\n✅ Substituições concluídas com sucesso!');
    } else {
      console.log('\n❌ Operação cancelada pelo usuário.');
    }
    
    readline.close();
  });
}

// Executar o script
main().catch(error => {
  console.error('Erro inesperado:', error);
  process.exit(1);
}); 