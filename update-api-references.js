/**
 * Este script busca referências aos antigos endpoints do Asaas no código frontend
 * e gera comandos para atualizar para o novo endpoint consolidado (asaas-api)
 * 
 * Como usar:
 * 1. Salve este script na raiz do projeto
 * 2. Execute com: node update-api-references.js
 * 3. Examine e execute os comandos gerados conforme necessário
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Mapeamento de endpoints antigos para novos
const ENDPOINT_MAPPING = {
  'asaas-create-customer': 'path=create-customer',
  'asaas-find-customer': 'path=find-customer',
  'asaas-create-subscription': 'path=create-subscription',
  'asaas-find-subscription': 'path=find-subscription',
  'asaas-cancel-subscription': 'path=cancel-subscription',
  'sync-user-customer': 'path=sync-user-customer'
};

// Caminhos a verificar
const PATHS_TO_CHECK = [
  './frontend/src',
];

// Extensões a verificar
const EXTENSIONS_TO_CHECK = ['.ts', '.tsx', '.js', '.jsx'];

// Função para buscar arquivos recursivamente
function findFiles(dir, extensions, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findFiles(filePath, extensions, fileList);
    } else if (extensions.includes(path.extname(file).toLowerCase())) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Função para verificar e buscar referências
function findReferences() {
  console.log('Procurando referências a endpoints antigos do Asaas...\n');
  
  const allFiles = PATHS_TO_CHECK.reduce((files, dir) => {
    return files.concat(findFiles(dir, EXTENSIONS_TO_CHECK));
  }, []);
  
  console.log(`Encontrados ${allFiles.length} arquivos para verificar.\n`);
  
  let referencesFound = false;
  
  // Verificar cada arquivo
  allFiles.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    let hasReference = false;
    
    // Verificar se há referências a endpoints antigos
    Object.keys(ENDPOINT_MAPPING).forEach(oldEndpoint => {
      if (content.includes(oldEndpoint)) {
        if (!hasReference) {
          console.log(`\nArquivo: ${filePath}`);
          hasReference = true;
          referencesFound = true;
        }
        
        console.log(`  - Encontrada referência a '${oldEndpoint}' - substituir por 'asaas-api?${ENDPOINT_MAPPING[oldEndpoint]}'`);
      }
    });
  });
  
  if (!referencesFound) {
    console.log('Nenhuma referência a endpoints antigos encontrada!');
  }
  
  return referencesFound;
}

// Função principal
function main() {
  console.log('=== Verificador de Referências a Endpoints do Asaas ===\n');
  
  const referencesFound = findReferences();
  
  if (referencesFound) {
    console.log('\nComandos sugeridos para verificar todas as ocorrências:');
    
    Object.keys(ENDPOINT_MAPPING).forEach(oldEndpoint => {
      console.log(`\ngrep -r "${oldEndpoint}" --include="*.{ts,tsx,js,jsx}" ./frontend/src`);
    });
    
    console.log('\nPara substituir manualmente, você pode usar:');
    console.log('Exemplo: sed -i \'s|api/asaas-create-customer|api/asaas-api?path=create-customer|g\' arquivo.tsx');
    
    console.log('\nLembre-se de ajustar a lógica de parâmetros GET vs POST conforme necessário.');
  }
  
  console.log('\n=== Fim da verificação ===');
}

// Executar o script
main(); 