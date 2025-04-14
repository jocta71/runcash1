import mongoose from 'mongoose';
import { connectToDatabase } from '../_db.js';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import { verifyToken } from '../middleware/auth.js';
import axios from 'axios';

// Configurações da API da Hubla
const HUBLA_API_URL = process.env.HUBLA_API_URL || 'https://api.hub.la';
const HUBLA_API_KEY = process.env.HUBLA_API_KEY;

export default async function handler(req, res) {
  // Verificar método
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Método não permitido' 
    });
  }

  try {
    // Verificar autenticação
    const authResult = await verifyToken(req);
    if (!authResult.authenticated) {
      return res.status(401).json({ 
        success: false, 
        message: 'Não autorizado' 
      });
    }

    // Conectar ao banco de dados
    await connectToDatabase();
    
    // Obter dados do usuário autenticado
    const userId = authResult.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Usuário não encontrado' 
      });
    }
    
    // Buscar assinatura atual
    const subscription = await Subscription.findOne({ 
      userId: userId,
      status: 'active'
    });
    
    if (!subscription) {
      return res.status(404).json({ 
        success: false, 
        message: 'Nenhuma assinatura ativa encontrada' 
      });
    }
    
    // Obter motivo do cancelamento do corpo da requisição
    const { reason } = req.body;
    
    // Verificar se a assinatura tem um ID externo
    const hublaSubscriptionId = subscription.externalId;
    
    // Se houver ID externo, tentar cancelar na Hubla
    if (hublaSubscriptionId && HUBLA_API_KEY) {
      try {
        // Cancelar assinatura na Hubla
        const response = await axios.post(
          `${HUBLA_API_URL}/subscriptions/${hublaSubscriptionId}/cancel`,
          { reason: reason || 'Cancelado pelo usuário' },
          {
            headers: {
              'Authorization': `Bearer ${HUBLA_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('Resposta do cancelamento na Hubla:', response.data);
      } catch (hublaError) {
        console.error('Erro ao cancelar assinatura na Hubla:', hublaError);
        // Continuar mesmo com erro na Hubla para garantir cancelamento local
      }
    }
    
    // Atualizar assinatura no banco de dados
    subscription.status = 'canceled';
    subscription.endDate = new Date();
    subscription.autoRenew = false;
    subscription.updatedAt = new Date();
    
    // Adicionar motivo do cancelamento aos metadados
    subscription.metadata = {
      ...subscription.metadata,
      canceledAt: new Date(),
      cancelReason: reason || 'Não especificado'
    };
    
    await subscription.save();
    
    // Retornar sucesso
    return res.status(200).json({
      success: true,
      message: 'Assinatura cancelada com sucesso',
      subscription: {
        id: subscription._id,
        status: subscription.status,
        canceledAt: subscription.metadata.canceledAt
      }
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
} 