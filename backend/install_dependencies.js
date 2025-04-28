/**
 * Script para instalar todas as dependências necessárias
 * Isso inclui as dependências do diretório principal e do diretório api
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=== RunCash Dependency Installer ===');
console.log('Diretório atual:', process.cwd());

// Instalar dependências no diretório principal
console.log('\nInstalando dependências no diretório principal...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependências do diretório principal instaladas com sucesso');
} catch (err) {
  console.error('❌ Erro ao instalar dependências no diretório principal:', err.message);
}

// Verificar se o diretório api existe
const apiDir = path.join(process.cwd(), 'api');
if (fs.existsSync(apiDir)) {
  // Verificar se o package.json existe no diretório api
  const apiPackageJson = path.join(apiDir, 'package.json');
  if (fs.existsSync(apiPackageJson)) {
    console.log('\nInstalando dependências no diretório api...');
    try {
      execSync('cd api && npm install', { stdio: 'inherit' });
      console.log('✅ Dependências do diretório api instaladas com sucesso');
    } catch (err) {
      console.error('❌ Erro ao instalar dependências no diretório api:', err.message);
    }
  } else {
    console.log('\n⚠️ package.json não encontrado no diretório api');
  }
} else {
  console.log('\n⚠️ Diretório api não encontrado');
}

// Verificar instalação de dependências críticas
console.log('\nVerificando dependências críticas...');
const criticalDependencies = ['cookie-parser', 'express', 'mongoose', 'mongodb'];

criticalDependencies.forEach(dep => {
  try {
    require.resolve(dep);
    console.log(`✅ ${dep} instalado e disponível`);
  } catch (e) {
    console.log(`⚠️ ${dep} não encontrado, tentando instalar...`);
    try {
      execSync(`npm install ${dep} --save`, { stdio: 'inherit' });
      console.log(`✅ ${dep} instalado com sucesso`);
    } catch (installErr) {
      console.error(`❌ Erro ao instalar ${dep}:`, installErr.message);
    }
  }
});

console.log('\n=== Instalação de dependências concluída ==='); 