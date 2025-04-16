#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Função para executar comandos
function runCommand(command) {
  console.log(`Executando comando: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.log(`Erro ao executar comando: ${command}`);
    throw error;
  }
}

// Função principal
function main() {
  console.log('Iniciando processo de build personalizado...');
  console.log(`Diretório atual: ${process.cwd()}`);
  
  // Verificar dependências
  console.log('Verificando dependências...');
  runCommand('npm install');
  
  // Verificar e instalar react-bootstrap se necessário
  try {
    require.resolve('react-bootstrap');
    console.log('react-bootstrap já está instalado');
  } catch (e) {
    console.log('Instalando react-bootstrap...');
    runCommand('npm install react-bootstrap');
  }
  
  // Executar build
  console.log('Iniciando build do projeto...');
  runCommand('node ./node_modules/vite/bin/vite.js build');
  
  // Copiar arquivos estáticos importantes 
  console.log('Copiando arquivos estáticos importantes...');
  
  // Garantir que os diretórios existam
  fs.mkdirSync(path.join(process.cwd(), 'dist', 'img'), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), 'dist', 'sounds'), { recursive: true });
  
  // Copiar favicon se existir
  try {
    if (fs.existsSync(path.join(process.cwd(), 'public', 'favicon.ico'))) {
      fs.copyFileSync(
        path.join(process.cwd(), 'public', 'favicon.ico'),
        path.join(process.cwd(), 'dist', 'favicon.ico')
      );
    }
  } catch (error) {
    console.log('Aviso: Não foi possível copiar favicon.ico');
  }
  
  console.log('Build concluído com sucesso!');
}

// Executar script
try {
  main();
} catch (error) {
  console.error('Erro durante o processo de build:', error);
  process.exit(1);
} 