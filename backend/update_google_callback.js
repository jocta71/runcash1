/**
 * Script para verificar e atualizar a URL de callback do Google
 * Este arquivo é executado durante a inicialização para garantir que o callback do Google
 * esteja configurado corretamente com base na URL atual do serviço.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

console.log('[GoogleAuth] Verificando configuração do callback do Google...');

// Obter a URL do serviço (Railway provê esta variável)
const serviceUrl = process.env.RAILWAY_URL || process.env.RAILWAY_STATIC_URL;

if (!serviceUrl) {
  console.warn('[GoogleAuth] URL do serviço não encontrada, não é possível atualizar o callback URL');
  process.exit(0);
}

// URL atual do callback do Google
const currentCallbackUrl = process.env.GOOGLE_CALLBACK_URL;

// Construir a URL de callback correta baseada na nova estrutura
const correctCallbackUrl = `${serviceUrl}/api/auth/google/callback`;

console.log('[GoogleAuth] URL de serviço detectada:', serviceUrl);
console.log('[GoogleAuth] URL de callback atual:', currentCallbackUrl);
console.log('[GoogleAuth] URL de callback correta:', correctCallbackUrl);

// Se o callback atual não estiver correto, exibimos uma mensagem informativa
if (currentCallbackUrl !== correctCallbackUrl) {
  console.log('\n=== ATENÇÃO: CONFIGURAÇÃO DE AUTENTICAÇÃO GOOGLE ===');
  console.log('A URL de callback do Google precisa ser atualizada no Railway:');
  console.log(`GOOGLE_CALLBACK_URL="${correctCallbackUrl}"`);
  console.log('\nAlém disso, verifique se a configuração no Console de API do Google também foi atualizada.');
  console.log('URL para o Console de API Google: https://console.cloud.google.com/apis/credentials');
  console.log('========================================================\n');
}

// Exportar a função para ser usado pelo index.js
module.exports = {
  getCorrectGoogleCallbackUrl: () => correctCallbackUrl
}; 