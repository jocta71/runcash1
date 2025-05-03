/**
 * Script personalizado para inicializar o servidor no Railway
 * Este script verifica e instala dependências críticas antes de iniciar o servidor
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== RunCash Server Launcher ===');
console.log('Diretório atual:', process.cwd());

// Verificar dependências críticas
console.log('Verificando dependências críticas...');

// Lista de dependências críticas que precisam ser verificadas
const criticalDeps = [
  'express',
  'http-proxy-middleware',
  'socket.io',
  'mongodb',
  'bcrypt',
  'jsonwebtoken'
];

// Verificar e instalar dependências ausentes
let missingDeps = [];

for (const dep of criticalDeps) {
  try {
    require.resolve(dep);
    console.log(`Dependência ${dep} já está instalada.`);
  } catch (e) {
    console.log(`Dependência ${dep} não encontrada.`);
    missingDeps.push(dep);
  }
}

// Instalar dependências ausentes
if (missingDeps.length > 0) {
  console.log(`Instalando dependências ausentes: ${missingDeps.join(', ')}`);
  try {
    execSync(`npm install ${missingDeps.join(' ')} --save`, { stdio: 'inherit' });
    console.log('Dependências instaladas com sucesso!');
  } catch (error) {
    console.error('Erro ao instalar dependências:', error);
    process.exit(1);
  }
} else {
  console.log('Todas as dependências críticas estão instaladas.');
}

// Iniciar o servidor
console.log('Iniciando servidor...');
try {
  require('./index.js');
} catch (error) {
  console.error('Erro ao iniciar o servidor:', error);
  process.exit(1);
} 