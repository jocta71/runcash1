/**
 * Controlador para as rotas de roletas
 * Implementa funções para acesso a dados simulados e reais
 */

// Dados simulados para usuários sem assinatura premium
const dadosRoletasSimulados = [
  {
    id: "roleta-1",
    nome: "Roleta Relâmpago",
    numeros: [5, 12, 7, 32, 19, 21, 0, 25, 17, 34],
    estatisticas: {
      paresPercentual: 40,
      impares: 60,
      vermelhos: 50,
      pretos: 45,
      zero: 5,
      primeiraDuzia: 30,
      segundaDuzia: 30, 
      terceiraDuzia: 35
    }
  },
  {
    id: "roleta-2",
    nome: "Roleta VIP",
    numeros: [18, 7, 22, 9, 31, 15, 28, 3, 26, 0],
    estatisticas: {
      paresPercentual: 50,
      impares: 45,
      vermelhos: 45,
      pretos: 50,
      zero: 5,
      primeiraDuzia: 20,
      segundaDuzia: 40, 
      terceiraDuzia: 35
    }
  }
];

/**
 * Retorna dados básicos simulados de todas as roletas
 */
exports.obterRoletasSimuladas = (req, res) => {
  try {
    // Dados simplificados para listagem
    const dadosSimplificados = dadosRoletasSimulados.map(roleta => ({
      id: roleta.id,
      nome: roleta.nome,
      ultimosNumeros: roleta.numeros.slice(0, 5)
    }));

    return res.status(200).json({
      success: true,
      message: 'Dados simulados das roletas',
      dadosSimulados: true,
      data: dadosSimplificados
    });
  } catch (error) {
    console.error('Erro ao obter roletas simuladas:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter dados das roletas',
      error: 'ERRO_INTERNO'
    });
  }
};

/**
 * Retorna dados detalhados simulados de uma roleta específica
 */
exports.obterRoletaSimuladaPorId = (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar roleta pelo ID
    const roleta = dadosRoletasSimulados.find(r => r.id === id);
    
    if (!roleta) {
      return res.status(404).json({
        success: false,
        message: 'Roleta não encontrada',
        error: 'ROLETA_NAO_ENCONTRADA'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Dados simulados da roleta',
      dadosSimulados: true,
      data: {
        ...roleta,
        mensagem: "Assine o plano Premium para acessar dados reais e históricos completos."
      }
    });
  } catch (error) {
    console.error('Erro ao obter roleta simulada:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter dados da roleta',
      error: 'ERRO_INTERNO'
    });
  }
};

/**
 * Retorna dados reais de todas as roletas (requer assinatura premium)
 */
exports.obterRoletasReais = (req, res) => {
  try {
    // Aqui seria a chamada para a API real de roletas
    // Usando req.assinatura para informações da assinatura do usuário
    
    // Simulando dados reais para exemplo
    const dadosReais = [
      {
        id: "roleta-real-1",
        nome: "Roleta Lightning",
        provider: "Evolution Gaming",
        status: "online",
        ultimosNumeros: [7, 32, 15, 19, 4, 21, 0, 33, 12, 27],
        estatisticasCompletas: {
          // Dados estatísticos completos
        }
      },
      {
        id: "roleta-real-2",
        nome: "Speed Roulette",
        provider: "Pragmatic Play",
        status: "online",
        ultimosNumeros: [5, 18, 7, 29, 31, 14, 36, 0, 26, 9],
        estatisticasCompletas: {
          // Dados estatísticos completos
        }
      }
    ];

    return res.status(200).json({
      success: true,
      message: 'Dados reais das roletas',
      assinatura: {
        id: req.assinatura.id,
        tipo: req.assinatura.tipo,
        status: req.assinatura.status
      },
      data: dadosReais
    });
  } catch (error) {
    console.error('Erro ao obter roletas reais:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter dados reais das roletas',
      error: 'ERRO_INTERNO'
    });
  }
};

/**
 * Retorna dados históricos reais de uma roleta específica (requer assinatura premium)
 */
exports.obterHistoricoRoletaReal = (req, res) => {
  try {
    const { id } = req.params;
    const { limite = 100 } = req.query;
    
    // Aqui seria a chamada para a API real de histórico de roletas
    // usando o ID da roleta e o limite solicitado
    
    // Simulando dados históricos reais para exemplo
    const historicoRoleta = {
      id: id,
      nome: "Roleta Lightning",
      provider: "Evolution Gaming",
      numeros: Array.from({ length: parseInt(limite) }, () => Math.floor(Math.random() * 37)),
      dataHora: Array.from({ length: parseInt(limite) }, (_, i) => 
        new Date(Date.now() - (i * 60000)).toISOString()
      ),
      estatisticasDetalhadas: {
        // Estatísticas detalhadas baseadas nos últimos N resultados
        ocorrenciasNumeros: Array.from({ length: 37 }, (_, i) => ({
          numero: i,
          ocorrencias: Math.floor(Math.random() * 20)
        }))
      }
    };

    return res.status(200).json({
      success: true,
      message: 'Histórico real da roleta',
      assinatura: {
        id: req.assinatura.id,
        tipo: req.assinatura.tipo,
        status: req.assinatura.status
      },
      data: historicoRoleta
    });
  } catch (error) {
    console.error('Erro ao obter histórico real da roleta:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao obter histórico real da roleta',
      error: 'ERRO_INTERNO'
    });
  }
}; 