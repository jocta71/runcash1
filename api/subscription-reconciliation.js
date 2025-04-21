// Sistema de Reconciliação de Assinaturas
// Este script verifica e corrige inconsistências entre o banco de dados local 
// e a plataforma de pagamentos Asaas

const { MongoClient } = require('mongodb');
const axios = require('axios');

/**
 * Função principal para reconciliar assinaturas
 */
module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas aceitar solicitações POST com autenticação adequada
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verificar autenticação para este endpoint administrativo
  const apiKey = req.headers['x-api-key'] || '';
  if (apiKey !== process.env.ADMIN_API_KEY) {
    console.warn('Tentativa de acesso não autorizado à reconciliação de assinaturas');
    return res.status(401).json({ error: 'Não autorizado' });
  }

  let client;
  const reconciliationResults = {
    processed: 0,
    updated: 0,
    errors: 0,
    details: []
  };

  try {
    // Configuração do cliente MongoDB
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME || 'runcash');
    const subscriptionsCollection = db.collection('subscriptions');

    // Configuração da API do Asaas
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || 'sandbox';
    const API_URL = ASAAS_ENVIRONMENT === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    if (!ASAAS_API_KEY) {
      return res.status(500).json({ 
        success: false,
        error: 'Chave de API do Asaas não configurada' 
      });
    }

    // Configuração do cliente HTTP para Asaas
    const apiClient = axios.create({
      baseURL: API_URL,
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json',
      }
    });

    // Buscar assinaturas locais
    console.log('Iniciando reconciliação de assinaturas...');
    
    // Limite para processamento em lotes (evitar sobrecarga)
    const limit = req.body.limit || 100;
    const subscriptions = await subscriptionsCollection
      .find({})
      .limit(limit)
      .toArray();

    console.log(`Processando ${subscriptions.length} assinaturas`);

    // Processar cada assinatura
    for (const subscription of subscriptions) {
      reconciliationResults.processed++;
      
      try {
        // Buscar dados atualizados na API do Asaas
        console.log(`Verificando assinatura ${subscription.subscription_id}`);
        const asaasResponse = await apiClient.get(`/subscriptions/${subscription.subscription_id}`);
        
        if (!asaasResponse || !asaasResponse.data) {
          throw new Error('Resposta inválida da API do Asaas');
        }

        const asaasSubscription = asaasResponse.data;
        
        // Verificar se há diferenças entre os dados locais e da API
        if (
          subscription.status !== asaasSubscription.status ||
          subscription.next_due_date !== asaasSubscription.nextDueDate
        ) {
          // Atualizar registro local
          console.log(`Atualizando assinatura ${subscription.subscription_id}: ${subscription.status} -> ${asaasSubscription.status}`);
          
          await subscriptionsCollection.updateOne(
            { subscription_id: subscription.subscription_id },
            {
              $set: {
                status: asaasSubscription.status,
                next_due_date: asaasSubscription.nextDueDate,
                value: asaasSubscription.value,
                last_reconciliation: new Date(),
                updated_at: new Date()
              },
              $push: {
                reconciliation_log: {
                  timestamp: new Date(),
                  previous_status: subscription.status,
                  new_status: asaasSubscription.status,
                  source: 'reconciliation'
                }
              }
            }
          );
          
          reconciliationResults.updated++;
          reconciliationResults.details.push({
            subscription_id: subscription.subscription_id,
            action: 'updated',
            previous_status: subscription.status,
            new_status: asaasSubscription.status
          });
        } else {
          // Apenas registrar verificação
          await subscriptionsCollection.updateOne(
            { subscription_id: subscription.subscription_id },
            {
              $set: {
                last_reconciliation: new Date()
              }
            }
          );
        }
        
        // Se assinatura está ativa, verificar pagamentos recentes
        if (asaasSubscription.status === 'ACTIVE') {
          // Buscar pagamentos recentes desta assinatura
          const paymentsResponse = await apiClient.get('/payments', {
            params: { subscription: subscription.subscription_id }
          });
          
          if (paymentsResponse && paymentsResponse.data && paymentsResponse.data.data) {
            const payments = paymentsResponse.data.data;
            
            // Atualizar os pagamentos mais recentes
            for (const payment of payments) {
              await db.collection('payments').updateOne(
                { payment_id: payment.id },
                {
                  $set: {
                    status: payment.status,
                    value: payment.value,
                    net_value: payment.netValue,
                    due_date: payment.dueDate,
                    payment_date: payment.paymentDate,
                    updated_at: new Date(),
                    last_reconciliation: new Date()
                  }
                },
                { upsert: true }
              );
            }
          }
        }
      } catch (error) {
        console.error(`Erro ao reconciliar assinatura ${subscription.subscription_id}:`, error.message);
        reconciliationResults.errors++;
        reconciliationResults.details.push({
          subscription_id: subscription.subscription_id,
          action: 'error',
          error: error.message
        });
        
        // Registrar erro, mas continuar com outras assinaturas
        await subscriptionsCollection.updateOne(
          { subscription_id: subscription.subscription_id },
          {
            $set: {
              last_reconciliation_error: error.message,
              last_reconciliation_attempt: new Date()
            }
          }
        );
      }
    }

    // Registrar execução da reconciliação
    await db.collection('admin_logs').insertOne({
      type: 'subscription_reconciliation',
      results: reconciliationResults,
      timestamp: new Date()
    });

    console.log('Reconciliação concluída:', reconciliationResults);
    
    return res.status(200).json({
      success: true,
      reconciliation: reconciliationResults
    });
  } catch (error) {
    console.error('Erro durante reconciliação de assinaturas:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Erro durante reconciliação',
      message: error.message
    });
  } finally {
    // Fechar a conexão com o MongoDB
    if (client) {
      await client.close();
    }
  }
}; 