// API serverless para retornar planos disponíveis
// Esta função será implantada como API no Vercel

export default function handler(req, res) {
  // Permitir apenas método GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido',
      error: 'METHOD_NOT_ALLOWED'
    });
  }

  // Retornar planos disponíveis
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
            'Acesso aos dados de todas as roletas',
            'Histórico de números das roletas',
            'Estatísticas básicas',
            'Exportação de dados CSV'
          ]
        },
        {
          id: 'trimestral',
          nome: 'Plano Trimestral',
          valor: 79.90,
          intervalo: 'trimestral',
          descricao: 'Acesso a recursos premium por 3 meses',
          recursos: [
            'Acesso aos dados de todas as roletas',
            'Histórico de números das roletas',
            'Estatísticas avançadas',
            'Exportação de dados CSV',
            'Alerta de números quentes'
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
            'Acesso aos dados de todas as roletas',
            'Histórico de números das roletas',
            'Estatísticas avançadas',
            'Exportação de dados CSV',
            'Alerta de números quentes',
            'Atualização em tempo real',
            'Análise de padrões com IA',
            'Suporte prioritário'
          ],
          economia: '16% de desconto em relação ao plano mensal'
        }
      ]
    }
  });
} 