module.exports = (req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Definir o conteúdo como HTML
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  // Retornar a página HTML completa
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teste de Integração Asaas</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {
      background-color: #f8f9fa;
      padding-top: 2rem;
    }
    .container {
      max-width: 1000px;
    }
    h1 {
      color: #0d6efd;
      margin-bottom: 1.5rem;
    }
    .card {
      margin-bottom: 1.5rem;
      box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
    }
    .card-header {
      background-color: #f1f8ff;
      font-weight: bold;
    }
    pre {
      background-color: #f8f9fa;
      padding: 1rem;
      border-radius: 0.25rem;
      overflow-x: auto;
    }
    .alert-info {
      background-color: #e8f4f8;
      border-color: #b8e8fb;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="text-center mb-4">Teste de Integração Asaas</h1>
    
    <div class="alert alert-info">
      <h4 class="alert-heading">Informações da API</h4>
      <p>Esta página permite testar as APIs de integração com o Asaas:</p>
      <ul>
        <li><code>/api/asaas-create-customer</code> - Criação de clientes</li>
        <li><code>/api/asaas-create-subscription</code> - Criação de assinaturas</li>
        <li><code>/api/asaas-find-payment</code> - Consulta de pagamentos</li>
        <li><code>/api/asaas-pix-qrcode</code> - Obtenção de QR Code PIX</li>
        <li><code>/api/asaas-webhook</code> - Recebimento de notificações</li>
      </ul>
    </div>

    <div class="row">
      <!-- Criar Cliente -->
      <div class="col-md-6 mb-4">
        <div class="card">
          <div class="card-header">Criar Cliente</div>
          <div class="card-body">
            <form id="create-customer-form">
              <div class="mb-3">
                <label for="name" class="form-label">Nome Completo</label>
                <input type="text" class="form-control" id="name" required>
              </div>
              <div class="mb-3">
                <label for="email" class="form-label">Email</label>
                <input type="email" class="form-control" id="email" required>
              </div>
              <div class="mb-3">
                <label for="cpf" class="form-label">CPF (apenas números)</label>
                <input type="text" class="form-control" id="cpf" required maxlength="11">
              </div>
              <div class="mb-3">
                <label for="phone" class="form-label">Telefone (apenas números)</label>
                <input type="text" class="form-control" id="phone" required>
              </div>
              <button type="submit" class="btn btn-primary">Criar Cliente</button>
            </form>
            <div id="customer-result" class="mt-3"></div>
          </div>
        </div>
      </div>
      
      <!-- Criar Assinatura -->
      <div class="col-md-6 mb-4">
        <div class="card">
          <div class="card-header">Criar Assinatura</div>
          <div class="card-body">
            <form id="create-subscription-form">
              <div class="mb-3">
                <label for="customerId" class="form-label">ID do Cliente</label>
                <input type="text" class="form-control" id="customerId" required>
              </div>
              <div class="mb-3">
                <label for="planId" class="form-label">ID do Plano</label>
                <input type="text" class="form-control" id="planId" placeholder="basic" value="basic">
              </div>
              <div class="mb-3">
                <label for="subscriptionValue" class="form-label">Valor da Assinatura</label>
                <input type="number" class="form-control" id="subscriptionValue" value="99.90" required>
              </div>
              
              <h5 class="mt-4 mb-3">Dados do Cartão de Crédito</h5>
              <div class="mb-3">
                <label for="holderName" class="form-label">Nome no Cartão</label>
                <input type="text" class="form-control" id="holderName" required>
              </div>
              <div class="mb-3">
                <label for="cardNumber" class="form-label">Número do Cartão</label>
                <input type="text" class="form-control" id="cardNumber" required placeholder="4111111111111111">
              </div>
              <div class="row">
                <div class="col-md-4 mb-3">
                  <label for="expiryMonth" class="form-label">Mês</label>
                  <input type="text" class="form-control" id="expiryMonth" required placeholder="12" maxlength="2">
                </div>
                <div class="col-md-4 mb-3">
                  <label for="expiryYear" class="form-label">Ano</label>
                  <input type="text" class="form-control" id="expiryYear" required placeholder="2030" maxlength="4">
                </div>
                <div class="col-md-4 mb-3">
                  <label for="ccv" class="form-label">CCV</label>
                  <input type="text" class="form-control" id="ccv" required placeholder="123" maxlength="4">
                </div>
              </div>
              
              <h5 class="mt-4 mb-3">Dados do Titular</h5>
              <div class="mb-3">
                <label for="holderEmail" class="form-label">Email do Titular</label>
                <input type="email" class="form-control" id="holderEmail" required>
              </div>
              <div class="mb-3">
                <label for="holderCpfCnpj" class="form-label">CPF do Titular</label>
                <input type="text" class="form-control" id="holderCpfCnpj" required maxlength="11">
              </div>
              <div class="mb-3">
                <label for="holderPostalCode" class="form-label">CEP</label>
                <input type="text" class="form-control" id="holderPostalCode" required placeholder="12345678" maxlength="8">
              </div>
              <div class="mb-3">
                <label for="holderAddressNumber" class="form-label">Número</label>
                <input type="text" class="form-control" id="holderAddressNumber" required placeholder="123">
              </div>
              <div class="mb-3">
                <label for="holderPhone" class="form-label">Telefone</label>
                <input type="text" class="form-control" id="holderPhone" required placeholder="11999998888">
              </div>
              
              <button type="submit" class="btn btn-primary">Criar Assinatura</button>
            </form>
            <div id="subscription-result" class="mt-3"></div>
          </div>
        </div>
      </div>
      
      <!-- Verificar Pagamento -->
      <div class="col-md-6 mb-4">
        <div class="card">
          <div class="card-header">Verificar Pagamento</div>
          <div class="card-body">
            <form id="check-payment-form">
              <div class="mb-3">
                <label for="paymentId" class="form-label">ID do Pagamento</label>
                <input type="text" class="form-control" id="paymentId" required>
              </div>
              <button type="submit" class="btn btn-primary">Verificar</button>
            </form>
            <div id="payment-result" class="mt-3"></div>
          </div>
        </div>
      </div>
      
      <!-- Gerar QR Code PIX -->
      <div class="col-md-6 mb-4">
        <div class="card">
          <div class="card-header">Gerar QR Code PIX</div>
          <div class="card-body">
            <form id="pix-qrcode-form">
              <div class="mb-3">
                <label for="pixPaymentId" class="form-label">ID do Pagamento</label>
                <input type="text" class="form-control" id="pixPaymentId" required>
              </div>
              <button type="submit" class="btn btn-primary">Gerar QR Code</button>
            </form>
            <div id="pix-result" class="mt-3"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Criar Cliente
    document.getElementById('create-customer-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const resultDiv = document.getElementById('customer-result');
      resultDiv.innerHTML = '<div class="alert alert-info">Processando...</div>';
      
      try {
        const response = await fetch('/api/asaas-create-customer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            cpfCnpj: document.getElementById('cpf').value,
            phone: document.getElementById('phone').value,
            userId: 'test-user'
          }),
        });
        
        const data = await response.json();
        
        if (data.error) {
          resultDiv.innerHTML = \`<div class="alert alert-danger">\${data.error}</div>\`;
        } else {
          document.getElementById('customerId').value = data.customerId || data.id;
          resultDiv.innerHTML = \`
            <div class="alert alert-success">Cliente criado com sucesso!</div>
            <div>
              <strong>ID do Cliente:</strong> \${data.customerId || data.id}<br>
              <button class="btn btn-sm btn-outline-secondary mt-2" onclick="copyToClipboard('\${data.customerId || data.id}')">
                Copiar ID
              </button>
            </div>
          \`;
        }
      } catch (error) {
        resultDiv.innerHTML = \`<div class="alert alert-danger">Erro: \${error.message}</div>\`;
      }
    });
    
    // Criar Assinatura
    document.getElementById('create-subscription-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const resultDiv = document.getElementById('subscription-result');
      resultDiv.innerHTML = '<div class="alert alert-info">Processando...</div>';
      
      try {
        const response = await fetch('/api/asaas-create-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerId: document.getElementById('customerId').value,
            planId: document.getElementById('planId').value,
            value: parseFloat(document.getElementById('subscriptionValue').value),
            billingType: 'CREDIT_CARD',
            // Dados do cartão
            holderName: document.getElementById('holderName').value,
            cardNumber: document.getElementById('cardNumber').value,
            expiryMonth: document.getElementById('expiryMonth').value,
            expiryYear: document.getElementById('expiryYear').value,
            ccv: document.getElementById('ccv').value,
            // Dados do titular
            holderEmail: document.getElementById('holderEmail').value,
            holderCpfCnpj: document.getElementById('holderCpfCnpj').value,
            holderPostalCode: document.getElementById('holderPostalCode').value,
            holderAddressNumber: document.getElementById('holderAddressNumber').value,
            holderPhone: document.getElementById('holderPhone').value
          }),
        });
        
        const data = await response.json();
        
        if (data.error) {
          resultDiv.innerHTML = \`<div class="alert alert-danger">\${data.error}</div>\`;
        } else {
          const paymentId = data.subscription?.lastTransactionId || data.paymentId;
          if (paymentId) {
            document.getElementById('paymentId').value = paymentId;
            document.getElementById('pixPaymentId').value = paymentId;
          }
          
          resultDiv.innerHTML = \`
            <div class="alert alert-success">Assinatura criada com sucesso!</div>
            <div>
              <strong>ID da Assinatura:</strong> \${data.subscription?.id || data.subscriptionId}<br>
              \${paymentId ? \`<strong>ID do Pagamento:</strong> \${paymentId}<br>\` : ''}
              <button class="btn btn-sm btn-outline-secondary mt-2" onclick="copyToClipboard('\${paymentId}')">
                Copiar ID do Pagamento
              </button>
            </div>
          \`;
        }
      } catch (error) {
        resultDiv.innerHTML = \`<div class="alert alert-danger">Erro: \${error.message}</div>\`;
      }
    });
    
    // Verificar Pagamento
    document.getElementById('check-payment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const resultDiv = document.getElementById('payment-result');
      resultDiv.innerHTML = '<div class="alert alert-info">Processando...</div>';
      
      try {
        const paymentId = document.getElementById('paymentId').value;
        const response = await fetch(\`/api/asaas-find-payment?paymentId=\${paymentId}\`);
        const data = await response.json();
        
        if (data.error) {
          resultDiv.innerHTML = \`<div class="alert alert-danger">\${data.error}</div>\`;
        } else {
          let statusClass = 'info';
          if (data.payment.status === 'CONFIRMED' || data.payment.status === 'RECEIVED') {
            statusClass = 'success';
          } else if (data.payment.status === 'OVERDUE' || data.payment.status === 'REFUNDED') {
            statusClass = 'warning';
          }
          
          resultDiv.innerHTML = \`
            <div class="alert alert-\${statusClass}">
              Status do Pagamento: <strong>\${data.payment.status}</strong>
            </div>
            <pre>\${JSON.stringify(data.payment, null, 2)}</pre>
          \`;
        }
      } catch (error) {
        resultDiv.innerHTML = \`<div class="alert alert-danger">Erro: \${error.message}</div>\`;
      }
    });
    
    // Gerar QR Code PIX
    document.getElementById('pix-qrcode-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const resultDiv = document.getElementById('pix-result');
      resultDiv.innerHTML = '<div class="alert alert-info">Processando...</div>';
      
      try {
        const paymentId = document.getElementById('pixPaymentId').value;
        const response = await fetch(\`/api/asaas-pix-qrcode?paymentId=\${paymentId}\`);
        const data = await response.json();
        
        if (data.error) {
          resultDiv.innerHTML = \`<div class="alert alert-danger">\${data.error}</div>\`;
        } else {
          resultDiv.innerHTML = \`
            <div class="alert alert-success">QR Code gerado com sucesso!</div>
            <div class="text-center">
              <img src="\${data.qrCodeImage}" alt="QR Code PIX" class="img-fluid mb-3" style="max-width: 250px"><br>
              <textarea class="form-control mb-2" rows="3" readonly>\${data.qrCodeText}</textarea>
              <button class="btn btn-sm btn-outline-secondary" onclick="copyToClipboard('\${data.qrCodeText}')">
                Copiar Código PIX
              </button>
            </div>
          \`;
        }
      } catch (error) {
        resultDiv.innerHTML = \`<div class="alert alert-danger">Erro: \${error.message}</div>\`;
      }
    });
    
    // Função para copiar para a área de transferência
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text)
        .then(() => alert('Copiado para a área de transferência!'))
        .catch(err => console.error('Erro ao copiar: ', err));
    }
  </script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
  
  res.status(200).send(html);
}; 