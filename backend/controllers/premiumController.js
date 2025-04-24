/**
 * Controller para recursos premium
 * Funções para gerenciar recursos exclusivos de assinantes
 */

const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Alerta = require('../models/Alerta');
const Usuario = require('../models/Usuario');
const Transacao = require('../models/Transacao');
const Investimento = require('../models/Investimento');
const ErrorResponse = require('../utils/errorResponse');
const { gerarRelatorio, exportarParaCSV } = require('../utils/relatoriosUtils');
const { analisarDadosFinanceiros } = require('../utils/analiseDados');
const { obterCotacoes } = require('../services/cotacoesService');

/**
 * Obter relatórios financeiros detalhados
 * @route GET /api/premium/relatorios
 * @access Premium
 */
exports.obterRelatoriosFinanceiros = asyncHandler(async (req, res, next) => {
  const userId = req.usuario.id;
  const { tipo, periodoInicio, periodoFim } = req.query;
  
  // Buscar transações do usuário no período especificado
  const transacoes = await Transacao.find({
    usuario: userId,
    data: { $gte: new Date(periodoInicio), $lte: new Date(periodoFim) }
  });
  
  // Gerar relatório baseado no tipo solicitado
  const relatorio = gerarRelatorio(transacoes, tipo);
  
  res.status(200).json({
    sucesso: true,
    dados: relatorio
  });
});

/**
 * Exportar dados financeiros em formato CSV
 * @route POST /api/premium/exportar
 * @access Premium
 */
exports.exportarDados = asyncHandler(async (req, res, next) => {
  const userId = req.usuario.id;
  const { tipo, formato, filtros } = req.body;
  
  // Buscar dados conforme o tipo solicitado
  let dados;
  switch (tipo) {
    case 'transacoes':
      dados = await Transacao.find({ usuario: userId, ...filtros });
      break;
    case 'investimentos':
      dados = await Investimento.find({ usuario: userId, ...filtros });
      break;
    default:
      return next(new ErrorResponse('Tipo de exportação inválido', 400));
  }
  
  // Gerar arquivo CSV ou Excel
  const arquivoExportado = exportarParaCSV(dados, formato);
  
  res.status(200).json({
    sucesso: true,
    url: arquivoExportado
  });
});

/**
 * Analisar tendências financeiras
 * @route POST /api/premium/tendencias
 * @access Premium
 */
exports.analisarTendencias = asyncHandler(async (req, res, next) => {
  const userId = req.usuario.id;
  const { categorias, periodoInicio, periodoFim } = req.body;
  
  // Buscar transações conforme filtros
  const transacoes = await Transacao.find({
    usuario: userId,
    categoria: { $in: categorias },
    data: { $gte: new Date(periodoInicio), $lte: new Date(periodoFim) }
  });
  
  // Realizar análise de tendências
  const tendencias = analisarDadosFinanceiros(transacoes);
  
  res.status(200).json({
    sucesso: true,
    dados: tendencias
  });
});

/**
 * Obter sugestões de investimento personalizadas
 * @route GET /api/premium/investimentos/sugestoes
 * @access Premium
 */
exports.obterSugestoesInvestimento = asyncHandler(async (req, res, next) => {
  const userId = req.usuario.id;
  
  // Buscar perfil financeiro do usuário
  const usuario = await Usuario.findById(userId);
  const perfilRisco = usuario.perfilInvestidor || 'moderado';
  
  // Buscar investimentos atuais do usuário
  const investimentosAtuais = await Investimento.find({ usuario: userId });
  
  // Algoritmo de recomendação baseado no perfil e investimentos atuais
  const sugestoes = {
    recomendacoes: [
      { tipo: 'Renda Fixa', percentual: perfilRisco === 'conservador' ? 70 : 40, opcoes: ['Tesouro Direto', 'CDB', 'LCI'] },
      { tipo: 'Renda Variável', percentual: perfilRisco === 'arrojado' ? 60 : 30, opcoes: ['Ações', 'FIIs', 'ETFs'] },
      { tipo: 'Internacional', percentual: perfilRisco === 'arrojado' ? 30 : 10, opcoes: ['BDRs', 'Fundos Internacionais'] }
    ],
    analise: 'Baseado no seu perfil e histórico financeiro, estas são as sugestões para diversificação da sua carteira...',
    alertas: investimentosAtuais.length > 0 ? [] : ['Recomendamos iniciar investimentos em renda fixa para formar reserva de emergência']
  };
  
  res.status(200).json({
    sucesso: true,
    dados: sugestoes
  });
});

/**
 * Configurar alertas personalizados
 * @route POST /api/premium/alertas
 * @access Premium
 */
exports.configurarAlertas = asyncHandler(async (req, res, next) => {
  const userId = req.usuario.id;
  const { tipo, condicao, valor, notificacao } = req.body;
  
  // Criar novo alerta
  const alerta = await Alerta.create({
    usuario: userId,
    tipo,
    condicao,
    valor,
    notificacao,
    ativo: true
  });
  
  res.status(201).json({
    sucesso: true,
    dados: alerta
  });
});

/**
 * Listar alertas configurados
 * @route GET /api/premium/alertas
 * @access Premium
 */
exports.listarAlertas = asyncHandler(async (req, res, next) => {
  const userId = req.usuario.id;
  
  // Buscar alertas do usuário
  const alertas = await Alerta.find({ usuario: userId });
  
  res.status(200).json({
    sucesso: true,
    contagem: alertas.length,
    dados: alertas
  });
});

/**
 * Atualizar alerta específico
 * @route PUT /api/premium/alertas/:id
 * @access Premium
 */
exports.atualizarAlerta = asyncHandler(async (req, res, next) => {
  const alertaId = req.params.id;
  const userId = req.usuario.id;
  
  // Buscar alerta existente
  let alerta = await Alerta.findById(alertaId);
  
  // Verificar se alerta existe
  if (!alerta) {
    return next(new ErrorResponse(`Alerta com id ${alertaId} não encontrado`, 404));
  }
  
  // Verificar se alerta pertence ao usuário
  if (alerta.usuario.toString() !== userId) {
    return next(new ErrorResponse('Não autorizado a modificar este alerta', 403));
  }
  
  // Atualizar alerta
  alerta = await Alerta.findByIdAndUpdate(alertaId, req.body, {
    new: true,
    runValidators: true
  });
  
  res.status(200).json({
    sucesso: true,
    dados: alerta
  });
});

/**
 * Remover alerta específico
 * @route DELETE /api/premium/alertas/:id
 * @access Premium
 */
exports.removerAlerta = asyncHandler(async (req, res, next) => {
  const alertaId = req.params.id;
  const userId = req.usuario.id;
  
  // Buscar alerta existente
  const alerta = await Alerta.findById(alertaId);
  
  // Verificar se alerta existe
  if (!alerta) {
    return next(new ErrorResponse(`Alerta com id ${alertaId} não encontrado`, 404));
  }
  
  // Verificar se alerta pertence ao usuário
  if (alerta.usuario.toString() !== userId) {
    return next(new ErrorResponse('Não autorizado a remover este alerta', 403));
  }
  
  // Remover alerta
  await alerta.remove();
  
  res.status(200).json({
    sucesso: true,
    dados: {}
  });
});

/**
 * Obter dados financeiros em tempo real
 * @route GET /api/premium/tempo-real
 * @access Premium
 */
exports.obterDadosTempoReal = asyncHandler(async (req, res, next) => {
  const { ativos } = req.query;
  
  // Buscar cotações em tempo real
  const cotacoes = await obterCotacoes(ativos.split(','));
  
  res.status(200).json({
    sucesso: true,
    timestamp: new Date(),
    dados: cotacoes
  });
});

/**
 * Obter estratégias de planejamento financeiro
 * @route GET /api/premium/planejamento
 * @access Premium
 */
exports.obterEstrategiasPlanejamento = asyncHandler(async (req, res, next) => {
  const userId = req.usuario.id;
  
  // Buscar perfil do usuário
  const usuario = await Usuario.findById(userId);
  
  // Gerar estratégias personalizadas com base no perfil
  const estrategias = {
    curto_prazo: {
      titulo: 'Estratégias de Curto Prazo (1 ano)',
      acoes: [
        'Estabelecer fundo de emergência de 6 meses de despesas',
        'Liquidar dívidas de alto custo',
        'Organizar orçamento mensal detalhado'
      ]
    },
    medio_prazo: {
      titulo: 'Estratégias de Médio Prazo (1-5 anos)',
      acoes: [
        'Diversificar investimentos em múltiplas classes de ativos',
        'Estabelecer metas para aquisições significativas',
        'Aumentar contribuições para aposentadoria'
      ]
    },
    longo_prazo: {
      titulo: 'Estratégias de Longo Prazo (5+ anos)',
      acoes: [
        'Criar plano de independência financeira',
        'Desenvolver estratégia de proteção patrimonial',
        'Planejar sucessão e herança'
      ]
    }
  };
  
  res.status(200).json({
    sucesso: true,
    dados: estrategias
  });
});

/**
 * Simular cenários financeiros personalizados
 * @route POST /api/premium/simulacao
 * @access Premium
 */
exports.simularCenarios = asyncHandler(async (req, res, next) => {
  const { valores, taxas, periodo, cenarios } = req.body;
  
  // Realizar simulações financeiras com base nos parâmetros
  const resultados = cenarios.map(cenario => {
    // Cálculo de simulação para cada cenário
    const simulacao = {
      nome: cenario.nome,
      descricao: cenario.descricao,
      resultados: {
        valorFinal: calcularValorFuturo(valores.inicial, valores.aportes, taxas.rendimento, periodo),
        ganhos: calcularGanhos(valores.inicial, valores.aportes, taxas.rendimento, periodo),
        impostos: calcularImpostos(valores.inicial, valores.aportes, taxas.rendimento, periodo, taxas.impostos),
        inflacao: calcularEfeitoInflacao(valores.inicial, valores.aportes, taxas.rendimento, periodo, taxas.inflacao)
      },
      grafico: gerarDadosGrafico(valores.inicial, valores.aportes, taxas.rendimento, periodo)
    };
    return simulacao;
  });
  
  res.status(200).json({
    sucesso: true,
    dados: resultados
  });
});

/**
 * Criar ticket de suporte prioritário
 * @route POST /api/premium/suporte
 * @access Premium
 */
exports.criarTicketSuporte = asyncHandler(async (req, res, next) => {
  const userId = req.usuario.id;
  const { assunto, mensagem, prioridade } = req.body;
  
  // Criar ticket de suporte com prioridade premium
  const ticket = {
    id: `PREMIUM-${Date.now()}`,
    usuario: userId,
    assunto,
    mensagem,
    prioridade: prioridade || 'alta',
    status: 'aberto',
    dataCriacao: new Date(),
    tempoPrevisto: '24 horas'
  };
  
  // Aqui enviaria o ticket para o sistema de suporte
  
  res.status(201).json({
    sucesso: true,
    mensagem: 'Ticket de suporte prioritário criado com sucesso',
    dados: ticket
  });
});

// Funções auxiliares para os cálculos financeiros
function calcularValorFuturo(valorInicial, aporteMensal, taxa, meses) {
  const taxaMensal = taxa / 100 / 12;
  let valorFinal = valorInicial * Math.pow(1 + taxaMensal, meses);
  
  if (aporteMensal > 0) {
    valorFinal += aporteMensal * ((Math.pow(1 + taxaMensal, meses) - 1) / taxaMensal);
  }
  
  return parseFloat(valorFinal.toFixed(2));
}

function calcularGanhos(valorInicial, aporteMensal, taxa, meses) {
  const valorFinal = calcularValorFuturo(valorInicial, aporteMensal, taxa, meses);
  const totalInvestido = valorInicial + (aporteMensal * meses);
  return parseFloat((valorFinal - totalInvestido).toFixed(2));
}

function calcularImpostos(valorInicial, aporteMensal, taxa, meses, taxaImposto) {
  const ganhos = calcularGanhos(valorInicial, aporteMensal, taxa, meses);
  return parseFloat((ganhos * (taxaImposto / 100)).toFixed(2));
}

function calcularEfeitoInflacao(valorInicial, aporteMensal, taxa, meses, inflacao) {
  const valorFinal = calcularValorFuturo(valorInicial, aporteMensal, taxa, meses);
  const valorAjustado = valorFinal / Math.pow(1 + (inflacao / 100 / 12), meses);
  return parseFloat(valorAjustado.toFixed(2));
}

function gerarDadosGrafico(valorInicial, aporteMensal, taxa, meses) {
  const dados = [];
  let valorAcumulado = valorInicial;
  let totalInvestido = valorInicial;
  
  for (let i = 0; i <= meses; i++) {
    if (i > 0) {
      valorAcumulado = valorAcumulado * (1 + taxa / 100 / 12) + aporteMensal;
      totalInvestido += aporteMensal;
    }
    
    dados.push({
      mes: i,
      valorAcumulado: parseFloat(valorAcumulado.toFixed(2)),
      totalInvestido: parseFloat(totalInvestido.toFixed(2)),
      rendimento: parseFloat((valorAcumulado - totalInvestido).toFixed(2))
    });
  }
  
  return dados;
}

/**
 * Função utilitária para degradar dados baseado em nível de degradação e tipo de plano
 */
const degradeContentForNonPremium = (data, options = { 
  hasAccess: false, 
  planType: 'FREE', 
  degradationLevel: 70
}) => {
  // Se usuário tem acesso ou degradação é zero, retornar dados completos
  if (options.hasAccess || options.degradationLevel <= 0) {
    return data;
  }

  try {
    // Para arrays, limitar número de itens
    if (Array.isArray(data)) {
      // Calcular fator de limitação baseado no nível de degradação
      const limitFactor = 1 - options.degradationLevel / 100;
      // Garantir pelo menos um item para visualização
      const limitCount = Math.max(1, Math.floor(data.length * limitFactor));
      
      // Para planos diferentes, aplicar níveis diferentes de limitação
      switch(options.planType) {
        case 'BASIC':
          // Básico mostra um pouco mais
          return data.slice(0, Math.min(limitCount * 2, data.length));
        case 'FREE':
        default:
          // Free mostra apenas o mínimo
          return data.slice(0, limitCount);
      }
    }
    
    // Para objetos, simplificar estrutura
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const result = { ...data };
      
      // Aplicar regras de degradação específicas por tipo de objeto
      // Se tiver propriedade premium ou dados sensíveis, remover ou ofuscar
      if (result.details || result.fullData) {
        delete result.details;
        delete result.fullData;
        result.isPremiumRestricted = true;
      }
      
      // Marcar como versão degradada
      result.degraded = true;
      result.upgradeMessage = "Faça upgrade para ver os dados completos";
      
      return result;
    }
    
    // Para outros tipos, retornar como está
    return data;
  } catch (error) {
    console.error('Erro ao degradar conteúdo:', error);
    return {
      error: 'Versão limitada disponível',
      degraded: true
    };
  }
};

/**
 * Obter dados com degradação adaptativa para não-assinantes
 * @route GET /api/premium/content/:contentId
 * @access Público com degradação para não-assinantes
 */
exports.getDegradedContent = asyncHandler(async (req, res, next) => {
  const { contentId } = req.params;
  
  // Verificar parâmetros de degradação e acesso
  const hasAccess = req.query.hasAccess === 'true';
  const planType = req.query.planType || 'FREE';
  const degradationLevel = parseInt(req.query.degradationLevel || '70', 10);
  
  // Obter dados completos do banco de dados
  let content;
  
  try {
    // Aqui seria a lógica real para buscar os dados
    // Exemplo para demonstração:
    switch(contentId) {
      case 'stats':
        content = {
          title: 'Estatísticas detalhadas',
          lastUpdate: new Date(),
          data: [
            { date: '2023-01-01', value: 125, details: 'Detalhe premium 1' },
            { date: '2023-01-02', value: 230, details: 'Detalhe premium 2' },
            { date: '2023-01-03', value: 190, details: 'Detalhe premium 3' },
            { date: '2023-01-04', value: 340, details: 'Detalhe premium 4' },
            { date: '2023-01-05', value: 410, details: 'Detalhe premium 5' }
          ],
          summary: {
            total: 1295,
            average: 259,
            detailedAnalysis: 'Análise detalhada premium'
          }
        };
        break;
      case 'recommendations':
        content = [
          { id: 1, name: 'Recomendação Premium 1', confidence: 0.95, details: 'Dados exclusivos 1' },
          { id: 2, name: 'Recomendação Premium 2', confidence: 0.88, details: 'Dados exclusivos 2' },
          { id: 3, name: 'Recomendação Premium 3', confidence: 0.82, details: 'Dados exclusivos 3' },
          { id: 4, name: 'Recomendação Premium 4', confidence: 0.78, details: 'Dados exclusivos 4' },
          { id: 5, name: 'Recomendação Premium 5', confidence: 0.75, details: 'Dados exclusivos 5' },
          { id: 6, name: 'Recomendação Premium 6', confidence: 0.71, details: 'Dados exclusivos 6' },
          { id: 7, name: 'Recomendação Premium 7', confidence: 0.69, details: 'Dados exclusivos 7' }
        ];
        break;
      default:
        return next(new ErrorResponse('Conteúdo não encontrado', 404));
    }
    
    // Degradar os dados conforme nível de acesso
    const processedContent = degradeContentForNonPremium(content, {
      hasAccess,
      planType,
      degradationLevel
    });
    
    return res.status(200).json({
      success: true,
      premiumAccess: hasAccess,
      data: processedContent
    });
    
  } catch (error) {
    console.error(`Erro ao recuperar conteúdo ${contentId}:`, error);
    return next(new ErrorResponse('Erro ao buscar dados', 500));
  }
}); 