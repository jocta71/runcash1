/**
 * Script para instalar as dependências necessárias para o SSE
 * 
 * Este script verifica se as dependências necessárias estão instaladas
 * e as instala caso não estejam.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[INSTALL-SSE] Verificando dependências para SSE...');

// Lista de dependências necessárias
const dependencies = [
  '@hapi/iron',
  'express',
  'mongodb'
];

// Verificar se o package.json existe
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('[INSTALL-SSE] package.json não encontrado. Criando um básico...');
  
  const basicPackageJson = {
    name: "runcash-backend",
    version: "1.0.0",
    description: "Backend para RunCash com suporte a SSE",
    main: "index.js",
    scripts: {
      "start": "node index.js",
      "test": "echo \"Error: no test specified\" && exit 1"
    },
    author: "RunCash Team",
    license: "UNLICENSED",
    dependencies: {}
  };
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(basicPackageJson, null, 2));
}

// Ler o package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.dependencies = packageJson.dependencies || {};

// Verificar quais dependências precisam ser instaladas
const missingDependencies = dependencies.filter(dep => {
  try {
    require(dep);
    console.log(`[INSTALL-SSE] ✅ ${dep} já está instalado.`);
    return false;
  } catch (err) {
    if (!packageJson.dependencies[dep]) {
      console.log(`[INSTALL-SSE] ❌ ${dep} não está instalado.`);
      return true;
    } else {
      console.log(`[INSTALL-SSE] ⚠️ ${dep} está no package.json mas deu erro ao importar. Tentando reinstalar...`);
      return true;
    }
  }
});

// Instalar dependências faltantes
if (missingDependencies.length > 0) {
  console.log(`[INSTALL-SSE] Instalando ${missingDependencies.length} dependências...`);
  
  try {
    // Usar npm ou yarn, dependendo do que estiver disponível
    const npmLockPath = path.join(__dirname, 'package-lock.json');
    const yarnLockPath = path.join(__dirname, 'yarn.lock');
    
    let installCommand = '';
    
    if (fs.existsSync(yarnLockPath)) {
      console.log('[INSTALL-SSE] Usando yarn para instalar dependências...');
      installCommand = `yarn add ${missingDependencies.join(' ')}`;
    } else {
      console.log('[INSTALL-SSE] Usando npm para instalar dependências...');
      installCommand = `npm install ${missingDependencies.join(' ')}`;
    }
    
    console.log(`[INSTALL-SSE] Executando: ${installCommand}`);
    execSync(installCommand, { stdio: 'inherit', cwd: __dirname });
    console.log('[INSTALL-SSE] ✅ Dependências instaladas com sucesso!');
  } catch (err) {
    console.error('[INSTALL-SSE] ❌ Erro ao instalar dependências:', err.message);
    console.error('[INSTALL-SSE] Tentando instalar uma por uma...');
    
    // Tentar instalar uma por uma
    missingDependencies.forEach(dep => {
      try {
        console.log(`[INSTALL-SSE] Instalando ${dep}...`);
        execSync(`npm install ${dep}`, { stdio: 'inherit', cwd: __dirname });
        console.log(`[INSTALL-SSE] ✅ ${dep} instalado com sucesso!`);
      } catch (err) {
        console.error(`[INSTALL-SSE] ❌ Erro ao instalar ${dep}:`, err.message);
      }
    });
  }
} else {
  console.log('[INSTALL-SSE] ✅ Todas as dependências necessárias já estão instaladas!');
}

console.log('[INSTALL-SSE] Verificação de dependências concluída.');

// Verificar se o fix-sse-integration.js existe
const fixSSEPath = path.join(__dirname, 'fix-sse-integration.js');
if (!fs.existsSync(fixSSEPath)) {
  console.error('[INSTALL-SSE] ❌ Arquivo fix-sse-integration.js não encontrado.');
  console.error('[INSTALL-SSE] Certifique-se de que o arquivo foi criado na raiz do backend.');
} else {
  console.log('[INSTALL-SSE] ✅ Arquivo fix-sse-integration.js encontrado.');
}

// Saída final
console.log('[INSTALL-SSE] Instalação das dependências do SSE concluída!');
console.log('[INSTALL-SSE] Para ativar o SSE, reinicie o servidor.'); 