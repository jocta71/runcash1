/**
 * Arquivo de inicialização para o Railway
 * 
 * Este arquivo é um wrapper simples que garante que o index.js
 * seja executado no diretório correto, independentemente de onde
 * o comando de inicialização é executado.
 */

const path = require('path');
const { spawn } = require('child_process');

console.log('=== RunCash Server Launcher ===');
console.log('Diretório atual:', process.cwd());

// Determinar o caminho absoluto para o arquivo index.js
let indexPath = path.resolve(__dirname, 'index.js');

console.log('Caminho para index.js:', indexPath);
console.log('Verificando se o arquivo existe...');

// Verificar se o arquivo existe
const fs = require('fs');
if (fs.existsSync(indexPath)) {
  console.log('Arquivo index.js encontrado! Iniciando servidor...');
  
  // Executar o arquivo index.js
  const nodeProcess = spawn('node', [indexPath], {
    stdio: 'inherit'
  });
  
  nodeProcess.on('close', (code) => {
    console.log(`Processo node encerrado com código ${code}`);
    process.exit(code);
  });
} else {
  console.error('ERRO: Arquivo index.js não encontrado em:', indexPath);
  console.error('Diretório atual contém os seguintes arquivos:');
  
  try {
    const files = fs.readdirSync(process.cwd());
    files.forEach(file => {
      console.error(`- ${file}`);
    });
  } catch (err) {
    console.error('Erro ao listar arquivos:', err);
  }
  
  process.exit(1);
} 