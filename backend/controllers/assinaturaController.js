const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const getDb = require('../services/database');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Configurações do Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Mapeia os IDs dos planos para os IDs correspondentes no Asaas
const PLANO_PARA_ASAAS = {
  'mensal': 'plano-mensal-id',
  'trimestral': 'plano-trimestral-id',
  'anual': 'plano-anual-id'
};

/**
 * Lista todos os planos disponíveis
 */
const listarPlanos = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Planos disponíveis recuperados com sucesso',
      data: {
        planos: [
          {
            id: 'mensal',
            nome: 'Plano Mensal',
            valor: 29.90,
            intervalo: 'mensal',
            descricao: 'Acesso a recursos premium por 1 mês',
            recursos: [
              'Acesso a todas as roletas disponíveis',
              'Estatísticas em tempo real',
              'Histórico de números das últimas 24 horas',
              'Suporte via e-mail'
            ]
          },
          {
            id: 'trimestral',
            nome: 'Plano Trimestral',
            valor: 79.90,
            intervalo: 'trimestral',
            descricao: 'Acesso a recursos premium por 3 meses',
            recursos: [
              'Acesso a todas as roletas disponíveis',
              'Estatísticas em tempo real',
              'Histórico de números das últimas 72 horas',
              'Análise de padrões e tendências',
              'Suporte prioritário via e-mail'
            ],
            economia: '11% de desconto em relação ao plano mensal'
          },
          {
            id: 'anual',
            nome: 'Plano Anual',
            valor: 299.90,
            intervalo: 'anual',
            descricao: 'Acesso a recursos premium por 12 meses',
            recursos: [
              'Acesso a todas as roletas disponíveis',
              'Estatísticas em tempo real',
              'Histórico de números ilimitado',
              'Análise avançada de padrões e tendências',
              'Alertas personalizados',
              'Suporte prioritário via e-mail e WhatsApp',
              'Acesso antecipado a novas funcionalidades'
            ],
            economia: '16% de desconto em relação ao plano mensal'
          }
        ]
      }
    });
  } catch (error) {
    console.error('Erro ao listar planos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao recuperar planos',
      error: error.message
    });
  }
};

/**
 * Obtém o status da assinatura atual do usuário
 */
const obterStatus = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const db = await getDb();
    
    // Buscar usuário no banco de dados
    const usuario = await db.collection('usuarios').findOne({ _id: usuarioId });
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
        error: 'USER_NOT_FOUND'
      });
    }
    
    // Se o usuário não tiver um customerID no Asaas, retornar sem assinatura
    if (!usuario.asaasCustomerId) {
      return res.status(200).json({
        success: true,
        message: 'Informações da assinatura recuperadas com sucesso',
        data: {
          possuiAssinatura: false,
          status: 'sem assinatura',
          instrucoes: 'Para acessar recursos premium, você precisa adquirir uma assinatura.'
        }
      });
    }
    
    // Consultar API do Asaas para verificar assinatura
    const response = await axios.get(
      `${ASAAS_API_URL}/subscriptions?customer=${usuario.asaasCustomerId}`, 
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    );
    
    // Verificar se a consulta retornou assinaturas
    if (!response.data || !response.data.data || response.data.data.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Informações da assinatura recuperadas com sucesso',
        data: {
          possuiAssinatura: false,
          status: 'sem assinatura',
          instrucoes: 'Para acessar recursos premium, você precisa adquirir uma assinatura.'
        }
      });
    }
    
    // Verificar se há alguma assinatura válida (ACTIVE, RECEIVED ou CONFIRMED)
    const activeSubscription = response.data.data.find(sub => 
      sub.status === 'ACTIVE' || 
      sub.status === 'active' || 
      sub.status === 'RECEIVED' || 
      sub.status === 'CONFIRMED'
    );
    
    if (!activeSubscription) {
      return res.status(200).json({
        success: true,
        message: 'Informações da assinatura recuperadas com sucesso',
        data: {
          possuiAssinatura: false,
          status: 'inativa',
          instrucoes: 'Sua assinatura está inativa. Para voltar a acessar recursos premium, reative sua assinatura.'
        }
      });
    }
    
    // Calcular dias restantes
    const dataFim = new Date(activeSubscription.nextDueDate);
    const dataAtual = new Date();
    const diasRestantes = Math.ceil((dataFim - dataAtual) / (1000 * 60 * 60 * 24));
    
    // Mapear o plano da assinatura para o formato interno
    const planoMap = {
      'monthly': 'mensal',
      'quarterly': 'trimestral',
      'yearly': 'anual'
    };
    
    // Retornar informações da assinatura ativa
    return res.status(200).json({
      success: true,
      message: 'Informações da assinatura recuperadas com sucesso',
      data: {
        possuiAssinatura: true,
        status: activeSubscription.status.toLowerCase(),
        plano: planoMap[activeSubscription.cycle] || activeSubscription.cycle,
        dataInicio: activeSubscription.dateCreated,
        validade: activeSubscription.nextDueDate,
        renovacaoAutomatica: true,
        diasRestantes: diasRestantes,
        id: activeSubscription.id
      }
    });
  } catch (error) {
    console.error('Erro ao obter status da assinatura:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao recuperar informações da assinatura',
      error: error.message
    });
  }
};

/**
 * Processa uma nova assinatura usando o Asaas
 */
const processarAssinatura = async (req, res) => {
  try {
    const { planoId, cartao, customer } = req.body;
    const usuarioId = req.usuario.id;
    
    // Validar dados recebidos
    if (!planoId || !cartao || !customer) {
      return res.status(400).json({
        success: false,
        message: 'Dados incompletos para processamento da assinatura',
        error: 'INCOMPLETE_DATA'
      });
    }
    
    // Verificar se o plano existe
    const planos = ['mensal', 'trimestral', 'anual'];
    if (!planos.includes(planoId)) {
      return res.status(400).json({
        success: false,
        message: 'Plano inválido',
        error: 'INVALID_PLAN'
      });
    }
    
    const db = await getDb();
    
    // Buscar usuário no banco de dados
    const usuario = await db.collection('usuarios').findOne({ _id: usuarioId });
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
        error: 'USER_NOT_FOUND'
      });
    }
    
    // Se o usuário já tiver uma assinatura ativa, cancelar primeiro
    if (usuario.asaasCustomerId) {
      try {
        // Buscar assinaturas ativas do cliente
        const activeSubscriptionsResponse = await axios.get(
          `${ASAAS_API_URL}/subscriptions?customer=${usuario.asaasCustomerId}&status=ACTIVE`, 
          {
            headers: {
              'access_token': ASAAS_API_KEY
            }
          }
        );
        
        if (activeSubscriptionsResponse.data && 
            activeSubscriptionsResponse.data.data && 
            activeSubscriptionsResponse.data.data.length > 0) {
          // Cancelar cada assinatura ativa
          for (const subscription of activeSubscriptionsResponse.data.data) {
            await axios.delete(
              `${ASAAS_API_URL}/subscriptions/${subscription.id}`, 
              {
                headers: {
                  'access_token': ASAAS_API_KEY
                }
              }
            );
          }
        }
      } catch (cancelError) {
        console.error('Erro ao cancelar assinaturas existentes:', cancelError);
        // Continuar mesmo se houver erro no cancelamento
      }
    }
    
    // Mapear plano para ciclo de assinatura no Asaas
    const cicloMap = {
      'mensal': 'MONTHLY',
      'trimestral': 'QUARTERLY',
      'anual': 'YEARLY'
    };
    
    // Mapear valores por plano
    const valorMap = {
      'mensal': 29.90,
      'trimestral': 79.90,
      'anual': 299.90
    };
    
    // Definir nome do plano
    const nomeMap = {
      'mensal': 'Plano Mensal RunCash',
      'trimestral': 'Plano Trimestral RunCash',
      'anual': 'Plano Anual RunCash'
    };
    
    let customerId = usuario.asaasCustomerId;
    
    // Se o usuário não tiver um customer ID no Asaas, criar um novo cliente
    if (!customerId) {
      try {
        const createCustomerResponse = await axios.post(
          `${ASAAS_API_URL}/customers`, 
          {
            name: usuario.nome || 'Usuário RunCash',
            cpfCnpj: customer.cpfCnpj,
            email: customer.email,
            mobilePhone: usuario.telefone || null,
            externalReference: usuarioId
          },
          {
            headers: {
              'access_token': ASAAS_API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );
        
        customerId = createCustomerResponse.data.id;
        
        // Atualizar o usuário com o customer ID
        await db.collection('usuarios').updateOne(
          { _id: usuarioId },
          { $set: { asaasCustomerId: customerId } }
        );
      } catch (createCustomerError) {
        console.error('Erro ao criar cliente no Asaas:', createCustomerError.response?.data || createCustomerError);
        return res.status(500).json({
          success: false,
          message: 'Erro ao criar cliente no Asaas',
          error: createCustomerError.response?.data?.errors || createCustomerError.message
        });
      }
    }
    
    // Criar assinatura
    try {
      const createSubscriptionData = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        nextDueDate: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0], // Amanhã
        value: valorMap[planoId],
        cycle: cicloMap[planoId],
        description: nomeMap[planoId],
        creditCard: {
          holderName: cartao.holderName,
          number: cartao.number,
          expiryMonth: cartao.expiryMonth,
          expiryYear: cartao.expiryYear,
          ccv: cartao.ccv
        },
        creditCardHolderInfo: {
          name: cartao.holderName,
          email: customer.email,
          cpfCnpj: customer.cpfCnpj
        }
      };
      
      const createSubscriptionResponse = await axios.post(
        `${ASAAS_API_URL}/subscriptions`, 
        createSubscriptionData,
        {
          headers: {
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Atualizar o status de assinatura do usuário no banco de dados
      await db.collection('usuarios').updateOne(
        { _id: usuarioId },
        { 
          $set: { 
            assinatura: {
              id: createSubscriptionResponse.data.id,
              status: createSubscriptionResponse.data.status,
              plano: planoId,
              dataInicio: new Date(),
              dataFim: new Date(createSubscriptionResponse.data.nextDueDate)
            } 
          }
        }
      );
      
      // Gerar novo token JWT com informações de assinatura atualizadas
      const token = jwt.sign(
        { 
          id: usuarioId, 
          email: usuario.email, 
          nome: usuario.nome,
          asaasCustomerId: customerId,
          assinatura: {
            status: 'active',
            plano: planoId
          }
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );
      
      return res.status(200).json({
        success: true,
        message: 'Assinatura processada com sucesso',
        data: {
          subscription: {
            id: createSubscriptionResponse.data.id,
            status: createSubscriptionResponse.data.status,
            plano: planoId,
            dataInicio: new Date(),
            dataProximoVencimento: new Date(createSubscriptionResponse.data.nextDueDate)
          },
          token
        }
      });
    } catch (createSubscriptionError) {
      console.error('Erro ao criar assinatura no Asaas:', createSubscriptionError.response?.data || createSubscriptionError);
      return res.status(500).json({
        success: false,
        message: 'Erro ao processar pagamento',
        error: createSubscriptionError.response?.data?.errors || createSubscriptionError.message
      });
    }
  } catch (error) {
    console.error('Erro ao processar assinatura:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao processar assinatura',
      error: error.message
    });
  }
};

/**
 * Cancela uma assinatura existente
 */
const cancelarAssinatura = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const db = await getDb();
    
    // Buscar usuário no banco de dados
    const usuario = await db.collection('usuarios').findOne({ _id: usuarioId });
    
    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
        error: 'USER_NOT_FOUND'
      });
    }
    
    // Se o usuário não tiver um customerID no Asaas, retornar erro
    if (!usuario.asaasCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'Usuário não possui assinatura para cancelar',
        error: 'NO_SUBSCRIPTION'
      });
    }
    
    // Buscar assinaturas ativas do cliente
    const activeSubscriptionsResponse = await axios.get(
      `${ASAAS_API_URL}/subscriptions?customer=${usuario.asaasCustomerId}&status=ACTIVE`, 
      {
        headers: {
          'access_token': ASAAS_API_KEY
        }
      }
    );
    
    if (!activeSubscriptionsResponse.data || 
        !activeSubscriptionsResponse.data.data || 
        activeSubscriptionsResponse.data.data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma assinatura ativa encontrada',
        error: 'NO_ACTIVE_SUBSCRIPTION'
      });
    }
    
    // Cancelar cada assinatura ativa
    for (const subscription of activeSubscriptionsResponse.data.data) {
      await axios.delete(
        `${ASAAS_API_URL}/subscriptions/${subscription.id}`, 
        {
          headers: {
            'access_token': ASAAS_API_KEY
          }
        }
      );
    }
    
    // Atualizar o status de assinatura do usuário no banco de dados
    await db.collection('usuarios').updateOne(
      { _id: usuarioId },
      { 
        $set: { 
          assinatura: {
            status: 'cancelada',
            dataFim: new Date()
          } 
        }
      }
    );
    
    // Gerar novo token JWT com informações de assinatura atualizadas
    const token = jwt.sign(
      { 
        id: usuarioId, 
        email: usuario.email, 
        nome: usuario.nome,
        asaasCustomerId: usuario.asaasCustomerId,
        assinatura: {
          status: 'cancelada'
        }
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Assinatura cancelada com sucesso',
      data: {
        status: 'cancelada',
        dataFim: new Date()
      },
      token
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao cancelar assinatura',
      error: error.message
    });
  }
};

module.exports = {
  listarPlanos,
  obterStatus,
  processarAssinatura,
  cancelarAssinatura
}; 