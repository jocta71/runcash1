/**
 * Ponto de entrada da aplicação
 * Carrega variáveis de ambiente e inicializa o servidor
 */

// Carrega variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importa o servidor de webhook
require('./webhook-server');

// Log da inicialização
console.log(`
 _____               _    _           _     _____                          
|  _  |___ ___ ___ _| |  | |_ ___ ___| |_  |   __|___ ___ _ _ ___ ___ ___ 
|     |_ -| .'| .'| . |  |   | -_| . | '_| |__   | -_|  _| | | -_|  _|_ -|
|__|__|___|__,|__,|___|  |_|_|___|___|_,_| |_____|___|_|  \\_/|___|_| |___|
                                                                         
Servidor de Webhook Asaas - Versão ${require('../../package.json').version}
`);