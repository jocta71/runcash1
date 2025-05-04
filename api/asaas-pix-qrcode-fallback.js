// API de fallback para QR code PIX
// Este endpoint sempre retorna um QR code válido para fins de testes

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Resposta para solicitações preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Método não permitido' 
    });
  }

  try {
    // Mock de QR code PIX - Esta é uma imagem real de QR code codificada em Base64
    // QR code aponta para um endereço de teste que não é válido para pagamentos reais
    const mockQrCode = {
      // QR Code que aponta para https://example.com/pix-test
      encodedImage: "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",
      payload: "00020101021226800014br.gov.bcb.pix2558example.com/pix-test5204000053039865802BR5925TESTE PIX SOMENTE TESTE6009SAO PAULO62070503***6304E2CA",
      expirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutos
    };

    // Log para depuração
    console.log('Fornecendo QR code PIX mockado de fallback');

    // Retornar resposta com QR code mockado
    return res.status(200).json({
      success: true,
      qrCode: mockQrCode,
      payment: {
        id: req.query.paymentId || 'fallback-payment-id',
        value: 49.90,
        status: 'PENDING',
        dueDate: new Date().toISOString(),
        description: 'Pagamento de teste (fallback)'
      }
    });
  } catch (error) {
    console.error('Erro no endpoint de fallback de QR code PIX:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno no servidor de fallback',
      message: error.message
    });
  }
}; 