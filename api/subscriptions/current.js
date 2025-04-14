import { connectToDatabase } from '../_db.js';
import { User } from '../models/User.js';
import { Subscription } from '../models/Subscription.js';
import { verifyToken } from '../middleware/auth.js';

export default async function handler(req, res) {
  // Verificar método
  if (req.method !== 'GET') {
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
      return res.status(200).json({
        success: true,
        subscription: null,
        message: 'Nenhuma assinatura ativa encontrada'
      });
    }
    
    // Retornar dados da assinatura
    return res.status(200).json({
      success: true,
      subscription: {
        id: subscription._id,
        planId: subscription.planId,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew
      }
    });
  } catch (error) {
    console.error('Erro ao buscar assinatura atual:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
} 