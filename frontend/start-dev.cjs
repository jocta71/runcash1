const { execSync } = require('child_process');

// Função para executar comandos
function runCommand(command) {
  console.log(`Executando comando: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.log(`Erro ao executar comando: ${command}`);
    console.error(error);
    return false;
  }
}

// Função principal
function main() {
  console.log('Iniciando servidor de desenvolvimento...');
  
  // Verificar dependências
  console.log('Verificando dependências...');
  const depsInstalled = runCommand('npm install');
  
  if (!depsInstalled) {
    console.error('Falha ao instalar dependências. Verifique o log para detalhes.');
    process.exit(1);
  }
  
  // Iniciar servidor de desenvolvimento
  console.log('Iniciando Vite dev server...');
  runCommand('npx vite --port 8080 --host');
}

// Executar script
try {
  main();
} catch (error) {
  console.error('Erro durante a inicialização do servidor:', error);
  process.exit(1);
} 