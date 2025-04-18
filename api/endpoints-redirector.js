// Arquivo para redirecionar as chamadas dos endpoints antigos para os novos
// Isso evita que seja necessário atualizar todas as chamadas no frontend imediatamente

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Obter o caminho da API que está sendo acessado
  const apiPath = req.url?.split('?')[0] || '';
  console.log(`Redirecionando endpoint: ${apiPath}`);
  
  // Mapear os endpoints antigos para ações nas novas APIs consolidadas
  let redirectUrl = '';
  let queryParams = new URLSearchParams(req.query);
  
  // Remover o path original da query, caso esteja presente
  queryParams.delete('path');
  
  // Mapear endpoints antigos para novos
  switch (apiPath) {
    // Asaas endpoints
    case '/api/asaas-create-subscription':
      redirectUrl = '/api/asaas?action=create-subscription';
      break;
    case '/api/asaas-create-customer':
      redirectUrl = '/api/asaas?action=create-customer';
      break;
    case '/api/asaas-find-customer':
      redirectUrl = '/api/asaas?action=find-customer';
      break;
    case '/api/asaas-find-subscription':
      redirectUrl = '/api/asaas?action=find-subscription';
      break;
    case '/api/asaas-cancel-subscription':
      redirectUrl = '/api/asaas?action=cancel-subscription';
      break;
    case '/api/asaas-find-payment':
      redirectUrl = '/api/asaas?action=find-payment';
      break;
    case '/api/asaas-pix-qrcode':
      redirectUrl = '/api/asaas?action=pix-qrcode';
      break;
    case '/api/asaas-webhook':
      redirectUrl = '/api/asaas?action=webhook';
      break;
    case '/api/check-payment-status':
      redirectUrl = '/api/asaas?action=check-payment-status';
      break;
    case '/api/regenerate-pix-code':
      redirectUrl = '/api/asaas?action=regenerate-pix-code';
      break;
      
    // User endpoints
    case '/api/user':
      redirectUrl = '/api/user-api?action=user-data';
      break;
    case '/api/user-subscriptions':
      redirectUrl = '/api/user-api?action=user-subscriptions';
      break;
      
    default:
      return res.status(404).json({
        success: false,
        error: 'Endpoint não encontrado'
      });
  }
  
  // Adicionar os parâmetros da URL original
  const finalUrl = `${redirectUrl}${queryParams.toString() ? '&' + queryParams.toString() : ''}`;
  
  console.log(`Redirecionando para: ${finalUrl}`);
  
  // Fazer o proxy da requisição para o novo endpoint
  // Por simplicidade, apenas retornamos a URL para onde redirecionar
  return res.status(307).json({
    success: true,
    redirectUrl: finalUrl,
    message: 'Este endpoint está obsoleto. Por favor, atualize para o novo padrão de API.'
  });
}; 