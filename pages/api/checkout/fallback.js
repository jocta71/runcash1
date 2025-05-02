/**
 * API fallback para criação de checkout quando o backend estiver indisponível
 * Retorna uma URL simulada para processo de checkout
 */

/**
 * Handler para criar um checkout simulado
 * 
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
export default async function handler(req, res) {
  // Verificar se o método da requisição é POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Método não permitido. Utilize POST.'
    });
  }
  
  // Extrair dados da requisição
  const { planId, value, billingCycle } = req.body;
  
  // Validar dados obrigatórios
  if (!planId) {
    return res.status(400).json({
      success: false,
      message: 'O ID do plano é obrigatório'
    });
  }
  
  // Simular processamento
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Gerar ID de checkout simulado
  const checkoutId = `sim-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  
  // Retornar dados do checkout simulado
  return res.status(200).json({
    success: true,
    message: 'Checkout simulado criado com sucesso',
    checkoutId,
    checkoutUrl: `/api/checkout/simulation?checkoutId=${checkoutId}&planId=${planId}`
  });
  
  // Opção alternativa: retornar HTML diretamente
  /*
  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Redirecionando para checkout...</title>
        <meta http-equiv="refresh" content="0;url=/api/checkout/simulation?checkoutId=${checkoutId}&planId=${planId}">
      </head>
      <body>
        <p>Redirecionando para checkout simulado...</p>
        <script>
          window.location.href = "/api/checkout/simulation?checkoutId=${checkoutId}&planId=${planId}";
        </script>
      </body>
    </html>
  `);
  */
} 