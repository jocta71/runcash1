/**
 * Arquivo de inicialização para o Railway
 * 
 * Este arquivo é um wrapper simples que garante que o index.js
 * seja executado no diretório correto, independentemente de onde
 * o comando de inicialização é executado.
 */

const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');

console.log('=== RunCash Server Launcher ===');
console.log('Diretório atual:', process.cwd());

// Verificar se as dependências estão instaladas
function checkAndInstallDependencies() {
  console.log('Verificando dependências...');
  
  // Verificar dependências no diretório principal
  try {
    require('cookie-parser');
    console.log('cookie-parser já está instalado no diretório principal');
  } catch (err) {
    console.log('Dependência faltante: cookie-parser, instalando...');
    try {
      execSync('npm install cookie-parser --save', { stdio: 'inherit' });
      console.log('cookie-parser instalado com sucesso');
    } catch (installErr) {
      console.error('Erro ao instalar cookie-parser:', installErr);
    }
  }
  
  // Verificar se o diretório api existe
  if (fs.existsSync(path.join(process.cwd(), 'api'))) {
    console.log('Verificando dependências do diretório api...');
    
    // Verificar se package.json existe no diretório api
    const apiPackageJsonPath = path.join(process.cwd(), 'api', 'package.json');
    if (fs.existsSync(apiPackageJsonPath)) {
      try {
        // Instalar dependências no diretório api se necessário
        execSync('cd api && npm install', { stdio: 'inherit' });
        console.log('Dependências do diretório api instaladas com sucesso');
      } catch (apiInstallErr) {
        console.error('Erro ao instalar dependências no diretório api:', apiInstallErr);
      }
    } else {
      console.log('package.json não encontrado no diretório api, não é possível instalar dependências específicas');
    }
  }
}

// Executar verificação de dependências
checkAndInstallDependencies();

// Determinar o caminho absoluto para o arquivo index.js
let indexPath = path.resolve(__dirname, 'index.js');

console.log('Caminho para index.js:', indexPath);
console.log('Verificando se o arquivo existe...');

// Verificar se o arquivo existe
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