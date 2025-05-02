/**
 * API serverless para status de assinatura (Vercel)
 * Proxy para redirecionar para API do backend
 */

import axios from 'axios';

export default async function handler(req, res) {
  // Verificar se é uma solicitação GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Método não permitido'
    });
  }

  try {
    // Se estiver executando em ambiente de desenvolvimento, usar localhost
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

    // Fazer a chamada para o backend
    const response = await axios.get(`${backendUrl}/api/subscription/status`, {
      headers: {
        // Passar o token de autenticação se existir
        ...(req.headers.authorization && { 
          'Authorization': req.headers.authorization 
        })
      }
    });

    // Retornar os dados do backend
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Erro ao verificar status da assinatura:', error);
    
    // Se houver resposta do backend com erro, passar adiante
    if (error.response) {
      return res.status(error.response.status || 500).json(error.response.data);
    }
    
    // Caso contrário, retornar erro genérico
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status da assinatura',
      error: error.message
    });
  }
} 