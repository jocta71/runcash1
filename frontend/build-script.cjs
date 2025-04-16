#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Função para executar comandos com saída para console
function runCommand(command) {
  console.log(`Executando comando: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Erro ao executar comando: ${command}`);
    console.error(error);
    return false;
  }
}

// Função principal
function main() {
  console.log("Iniciando processo de build personalizado...");
  
  // Garantir que estamos na pasta frontend
  const currentDir = process.cwd();
  console.log(`Diretório atual: ${currentDir}`);
  
  // Instalar dependências (se ainda não estiverem instaladas)
  console.log("Verificando dependências...");
  if (!runCommand("npm install")) {
    process.exit(1);
  }
  
  // Verificar se a pasta node_modules/vite existe
  const vitePath = path.join(currentDir, 'node_modules', '.bin', 'vite');
  if (!fs.existsSync(vitePath)) {
    console.log("Vite não encontrado em node_modules/.bin, instalando explicitamente...");
    if (!runCommand("npm install vite@latest --no-save")) {
      process.exit(1);
    }
  }
  
  // Executar o build
  console.log("Iniciando build do projeto...");
  if (!runCommand("node ./node_modules/vite/bin/vite.js build")) {
    process.exit(1);
  }
  
  console.log("Build concluído com sucesso!");
  process.exit(0);
}

// Executar o script
main(); 