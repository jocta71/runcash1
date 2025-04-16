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
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { padding: 20px; }
    .container { max-width: 1200px; }
    .card { margin-bottom: 20px; }
    .result-container { 
      background-color: #f8f9fa; 
      border-radius: 5px; 
      padding: 15px; 
      margin-top: 20px;
      overflow-wrap: break-word;
    }
    .qr-code-container {
      text-align: center;
      margin: 20px 0;
    }
    .qr-code-image {
      max-width: 250px;
      margin: auto;
    }
    .copy-button {
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="text-center text-primary mb-4">Teste de Integração Asaas</h1>
    
    <div class="card">
      <div class="card-header bg-info text-white">
        <h5 class="mb-0">Informações da API</h5>
      </div>
      <div class="card-body bg-light">
        <p>Esta página permite testar as APIs de integração com o Asaas:</p>
        <ul>
          <li><code>/api/asaas-create-customer</code> - Criação de clientes</li>
          <li><code>/api/asaas-create-subscription</code> - Criação de assinaturas</li>
          <li><code>/api/asaas-find-payment</code> - Consulta de pagamentos</li>
          <li><code>/api/asaas-pix-qrcode</code> - Obtenção de QR Code PIX</li>
          <li><code>/api/asaas-subscription-payments</code> - Listar pagamentos de uma assinatura</li>
          <li><code>/api/asaas-webhook</code> - Recebimento de notificações</li>
        </ul>
      </div>
    </div>

    <div class="row">
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Criar Cliente</h5>
          </div>
          <div class="card-body">
            <form id="customerForm">
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
                <input type="text" class="form-control" id="cpf" maxlength="11" required>
              </div>
              <div class="mb-3">
                <label for="phone" class="form-label">Telefone (apenas números)</label>
                <input type="text" class="form-control" id="phone">
              </div>
              <button type="submit" class="btn btn-primary">Criar Cliente</button>
            </form>
            <div id="customerResult" class="result-container mt-3" style="display: none;"></div>
          </div>
        </div>
      </div>
      
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Criar Assinatura</h5>
          </div>
          <div class="card-body">
            <form id="subscriptionForm">
              <div class="mb-3">
                <label for="customerId" class="form-label">ID do Cliente</label>
                <input type="text" class="form-control" id="customerId" required>
              </div>
              <div class="mb-3">
                <label for="planId" class="form-label">ID do Plano</label>
                <input type="text" class="form-control" id="planId" value="basic" required>
              </div>
              <div class="mb-3">
                <label for="value" class="form-label">Valor da Assinatura</label>
                <input type="number" class="form-control" id="value" step="0.01" value="99.90" required>
              </div>
              
              <div class="mb-3">
                <label class="form-label">Método de Pagamento</label>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="billingType" id="billingTypePix" value="PIX" checked>
                  <label class="form-check-label" for="billingTypePix">PIX</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="billingType" id="billingTypeCard" value="CREDIT_CARD">
                  <label class="form-check-label" for="billingTypeCard">Cartão de Crédito</label>
                </div>
              </div>
              
              <div id="cardDataSection" style="display: none;">
                <h6 class="mt-4 mb-3">Dados do Cartão de Crédito</h6>
                <div class="mb-3">
                  <label for="holderName" class="form-label">Nome no Cartão</label>
                  <input type="text" class="form-control" id="holderName">
                </div>
                <div class="mb-3">
                  <label for="cardNumber" class="form-label">Número do Cartão</label>
                  <input type="text" class="form-control" id="cardNumber">
                </div>
                <div class="row">
                  <div class="col">
                    <label for="expiryMonth" class="form-label">Mês</label>
                    <input type="text" class="form-control" id="expiryMonth" maxlength="2">
                  </div>
                  <div class="col">
                    <label for="expiryYear" class="form-label">Ano</label>
                    <input type="text" class="form-control" id="expiryYear" maxlength="4">
                  </div>
                  <div class="col">
                    <label for="ccv" class="form-label">CCV</label>
                    <input type="text" class="form-control" id="ccv" maxlength="3">
                  </div>
                </div>
                
                <h6 class="mt-4 mb-3">Dados do Titular</h6>
                <div class="mb-3">
                  <label for="holderEmail" class="form-label">Email do Titular</label>
                  <input type="email" class="form-control" id="holderEmail">
                </div>
                <div class="mb-3">
                  <label for="holderCpfCnpj" class="form-label">CPF do Titular</label>
                  <input type="text" class="form-control" id="holderCpfCnpj" maxlength="11">
                </div>
                <div class="mb-3">
                  <label for="holderPostalCode" class="form-label">CEP</label>
                  <input type="text" class="form-control" id="holderPostalCode">
                </div>
                <div class="mb-3">
                  <label for="holderAddressNumber" class="form-label">Número</label>
                  <input type="text" class="form-control" id="holderAddressNumber">
                </div>
                <div class="mb-3">
                  <label for="holderPhone" class="form-label">Telefone</label>
                  <input type="text" class="form-control" id="holderPhone">
                </div>
              </div>
              
              <button type="submit" class="btn btn-primary">Criar Assinatura</button>
            </form>
            <div id="subscriptionResult" class="result-container mt-3" style="display: none;"></div>
            
            <div id="pixQrCodeSection" style="display: none;" class="mt-4">
              <h6 class="text-center">QR Code PIX</h6>
              <div class="qr-code-container">
                <img id="pixQrCodeImage" src="" alt="QR Code PIX" class="qr-code-image">
                <div class="mt-2">
                  <p id="pixExpirationDate" class="text-muted"></p>
                  <textarea id="pixQrCodeText" class="form-control mb-2" rows="3" readonly></textarea>
                  <button id="copyPixCodeButton" class="btn btn-sm btn-outline-primary copy-button">Copiar Código PIX</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="row mt-4">
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Consultar Pagamentos da Assinatura</h5>
          </div>
          <div class="card-body">
            <form id="subscriptionPaymentsForm">
              <div class="mb-3">
                <label for="subscriptionId" class="form-label">ID da Assinatura</label>
                <input type="text" class="form-control" id="subscriptionId" required>
              </div>
              <button type="submit" class="btn btn-primary">Consultar Pagamentos</button>
            </form>
            <div id="subscriptionPaymentsResult" class="result-container mt-3" style="display: none;"></div>
          </div>
        </div>
      </div>
      
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0">Consultar Pagamento</h5>
          </div>
          <div class="card-body">
            <form id="paymentForm">
              <div class="mb-3">
                <label for="paymentId" class="form-label">ID do Pagamento</label>
                <input type="text" class="form-control" id="paymentId" required>
              </div>
              <button type="submit" class="btn btn-primary">Consultar Pagamento</button>
            </form>
            <div id="paymentResult" class="result-container mt-3" style="display: none;"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Toggle cartão de crédito fields
      const billingTypeInputs = document.querySelectorAll('input[name="billingType"]');
      const cardDataSection = document.getElementById('cardDataSection');
      
      billingTypeInputs.forEach(input => {
        input.addEventListener('change', function() {
          if (this.value === 'CREDIT_CARD') {
            cardDataSection.style.display = 'block';
          } else {
            cardDataSection.style.display = 'none';
          }
        });
      });
      
      // Customer form
      const customerForm = document.getElementById('customerForm');
      const customerResult = document.getElementById('customerResult');
      
      customerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const data = {
          name: document.getElementById('name').value,
          email: document.getElementById('email').value,
          cpfCnpj: document.getElementById('cpf').value,
          phone: document.getElementById('phone').value,
          userId: 'test-user'
        };
        
        try {
          customerResult.innerHTML = 'Criando cliente...';
          customerResult.style.display = 'block';
          
          const response = await fetch('/api/asaas-create-customer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          });
          
          const result = await response.json();
          
          if (result.success) {
            customerResult.innerHTML = '<div class="alert alert-success">Cliente criado com sucesso!</div>' +
              '<p><strong>ID do Cliente:</strong> ' + result.data.customerId + '</p>' +
              '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            
            // Auto-fill customer ID in subscription form
            document.getElementById('customerId').value = result.data.customerId;
          } else {
            customerResult.innerHTML = '<div class="alert alert-danger">Erro ao criar cliente</div>' +
              '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
          }
        } catch (error) {
          customerResult.innerHTML = '<div class="alert alert-danger">Erro ao processar requisição</div>' +
            '<pre>' + error.toString() + '</pre>';
        }
      });
      
      // Subscription form
      const subscriptionForm = document.getElementById('subscriptionForm');
      const subscriptionResult = document.getElementById('subscriptionResult');
      const pixQrCodeSection = document.getElementById('pixQrCodeSection');
      
      subscriptionForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const billingType = document.querySelector('input[name="billingType"]:checked').value;
        
        const data = {
          customerId: document.getElementById('customerId').value,
          planId: document.getElementById('planId').value,
          value: parseFloat(document.getElementById('value').value),
          billingType: billingType
        };
        
        if (billingType === 'CREDIT_CARD') {
          data.holderName = document.getElementById('holderName').value;
          data.cardNumber = document.getElementById('cardNumber').value;
          data.expiryMonth = document.getElementById('expiryMonth').value;
          data.expiryYear = document.getElementById('expiryYear').value;
          data.ccv = document.getElementById('ccv').value;
          data.holderEmail = document.getElementById('holderEmail').value;
          data.holderCpfCnpj = document.getElementById('holderCpfCnpj').value;
          data.holderPostalCode = document.getElementById('holderPostalCode').value;
          data.holderAddressNumber = document.getElementById('holderAddressNumber').value;
          data.holderPhone = document.getElementById('holderPhone').value;
        }
        
        try {
          subscriptionResult.innerHTML = 'Criando assinatura...';
          subscriptionResult.style.display = 'block';
          pixQrCodeSection.style.display = 'none';
          
          const response = await fetch('/api/asaas-create-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
          });
          
          const result = await response.json();
          
          if (result.success) {
            subscriptionResult.innerHTML = '<div class="alert alert-success">Assinatura criada com sucesso!</div>' +
              '<p><strong>ID da Assinatura:</strong> ' + result.subscription.id + '</p>' +
              '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            
            // Auto-fill subscription ID in payments form
            document.getElementById('subscriptionId').value = result.subscription.id;
            
            // Se for PIX, buscar o QR Code para o primeiro pagamento
            if (billingType === 'PIX') {
              // Primeiro, buscar os pagamentos da assinatura
              const paymentsResponse = await fetch('/api/asaas-subscription-payments?subscriptionId=' + result.subscription.id);
              const paymentsResult = await paymentsResponse.json();
              
              if (paymentsResult.success && paymentsResult.payments && paymentsResult.payments.length > 0) {
                const firstPayment = paymentsResult.payments[0];
                
                // Buscar QR Code PIX
                const pixResponse = await fetch('/api/asaas-pix-qrcode', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ paymentId: firstPayment.id })
                });
                const pixResult = await pixResponse.json();
                
                if (pixResult.success) {
                  // Exibir QR Code PIX
                  document.getElementById('pixQrCodeImage').src = 'data:image/png;base64,' + pixResult.qrCodeImage;
                  document.getElementById('pixQrCodeText').value = pixResult.qrCodeText;
                  document.getElementById('pixExpirationDate').innerText = 'Expira em: ' + new Date(pixResult.expirationDate).toLocaleString();
                  pixQrCodeSection.style.display = 'block';
                  
                  // Preencher ID do pagamento
                  document.getElementById('paymentId').value = firstPayment.id;
                }
              }
            }
          } else {
            subscriptionResult.innerHTML = '<div class="alert alert-danger">Erro ao criar assinatura</div>' +
              '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
          }
        } catch (error) {
          subscriptionResult.innerHTML = '<div class="alert alert-danger">Erro ao processar requisição</div>' +
            '<pre>' + error.toString() + '</pre>';
        }
      });
      
      // Subscription Payments form
      const subscriptionPaymentsForm = document.getElementById('subscriptionPaymentsForm');
      const subscriptionPaymentsResult = document.getElementById('subscriptionPaymentsResult');
      
      subscriptionPaymentsForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const subscriptionId = document.getElementById('subscriptionId').value;
        
        try {
          subscriptionPaymentsResult.innerHTML = 'Consultando pagamentos...';
          subscriptionPaymentsResult.style.display = 'block';
          
          const response = await fetch('/api/asaas-subscription-payments?subscriptionId=' + subscriptionId);
          const result = await response.json();
          
          if (result.success) {
            let htmlContent = '<div class="alert alert-success">Pagamentos consultados com sucesso!</div>' +
              '<p><strong>Total de pagamentos:</strong> ' + result.count + '</p>';
            
            if (result.payments && result.payments.length > 0) {
              htmlContent += '<table class="table table-striped">' +
                '<thead><tr><th>ID</th><th>Valor</th><th>Status</th><th>Vencimento</th><th>Ações</th></tr></thead>' +
                '<tbody>';
              
              result.payments.forEach(payment => {
                htmlContent += '<tr>' +
                  '<td>' + payment.id + '</td>' +
                  '<td>R$ ' + payment.value.toFixed(2) + '</td>' +
                  '<td>' + payment.status + '</td>' +
                  '<td>' + new Date(payment.dueDate).toLocaleDateString() + '</td>' +
                  '<td>' +
                  '<button class="btn btn-sm btn-primary consult-payment" data-id="' + payment.id + '">Consultar</button> ' +
                  (payment.billingType === 'PIX' ? '<button class="btn btn-sm btn-success get-pix" data-id="' + payment.id + '">QR Code</button>' : '') +
                  '</td>' +
                  '</tr>';
              });
              
              htmlContent += '</tbody></table>';
            } else {
              htmlContent += '<p>Nenhum pagamento encontrado.</p>';
            }
            
            htmlContent += '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            subscriptionPaymentsResult.innerHTML = htmlContent;
            
            // Adicionar event listeners para botões de ação
            document.querySelectorAll('.consult-payment').forEach(button => {
              button.addEventListener('click', function() {
                document.getElementById('paymentId').value = this.dataset.id;
                document.getElementById('paymentForm').dispatchEvent(new Event('submit'));
              });
            });
            
            document.querySelectorAll('.get-pix').forEach(button => {
              button.addEventListener('click', async function() {
                try {
                  const pixResponse = await fetch('/api/asaas-pix-qrcode', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ paymentId: this.dataset.id })
                  });
                  const pixResult = await pixResponse.json();
                  
                  if (pixResult.success) {
                    // Exibir QR Code PIX
                    document.getElementById('pixQrCodeImage').src = 'data:image/png;base64,' + pixResult.qrCodeImage;
                    document.getElementById('pixQrCodeText').value = pixResult.qrCodeText;
                    document.getElementById('pixExpirationDate').innerText = 'Expira em: ' + new Date(pixResult.expirationDate).toLocaleString();
                    pixQrCodeSection.style.display = 'block';
                    
                    // Scroll to QR code
                    pixQrCodeSection.scrollIntoView({ behavior: 'smooth' });
                  }
                } catch (error) {
                  console.error('Erro ao obter QR Code:', error);
                }
              });
            });
          } else {
            subscriptionPaymentsResult.innerHTML = '<div class="alert alert-danger">Erro ao consultar pagamentos</div>' +
              '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
          }
        } catch (error) {
          subscriptionPaymentsResult.innerHTML = '<div class="alert alert-danger">Erro ao processar requisição</div>' +
            '<pre>' + error.toString() + '</pre>';
        }
      });
      
      // Payment form
      const paymentForm = document.getElementById('paymentForm');
      const paymentResult = document.getElementById('paymentResult');
      
      paymentForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const paymentId = document.getElementById('paymentId').value;
        
        try {
          paymentResult.innerHTML = 'Consultando pagamento...';
          paymentResult.style.display = 'block';
          
          const response = await fetch('/api/asaas-find-payment?paymentId=' + paymentId);
          const result = await response.json();
          
          if (result.success) {
            let htmlContent = '<div class="alert alert-success">Pagamento consultado com sucesso!</div>';
            
            const payment = result.payment;
            htmlContent += '<table class="table">' +
              '<tr><th>ID</th><td>' + payment.id + '</td></tr>' +
              '<tr><th>Valor</th><td>R$ ' + payment.value.toFixed(2) + '</td></tr>' +
              '<tr><th>Status</th><td>' + payment.status + '</td></tr>' +
              '<tr><th>Vencimento</th><td>' + new Date(payment.dueDate).toLocaleDateString() + '</td></tr>' +
              '<tr><th>Tipo</th><td>' + payment.billingType + '</td></tr>';
            
            if (payment.billingType === 'PIX') {
              htmlContent += '<tr><th>QR Code PIX</th><td><button class="btn btn-sm btn-success get-pix" data-id="' + payment.id + '">Gerar QR Code</button></td></tr>';
            }
            
            htmlContent += '</table>';
            
            htmlContent += '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
            paymentResult.innerHTML = htmlContent;
            
            // Adicionar event listener para o botão de PIX
            document.querySelectorAll('.get-pix').forEach(button => {
              button.addEventListener('click', async function() {
                try {
                  const pixResponse = await fetch('/api/asaas-pix-qrcode', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ paymentId: this.dataset.id })
                  });
                  const pixResult = await pixResponse.json();
                  
                  if (pixResult.success) {
                    // Exibir QR Code PIX
                    document.getElementById('pixQrCodeImage').src = 'data:image/png;base64,' + pixResult.qrCodeImage;
                    document.getElementById('pixQrCodeText').value = pixResult.qrCodeText;
                    document.getElementById('pixExpirationDate').innerText = 'Expira em: ' + new Date(pixResult.expirationDate).toLocaleString();
                    pixQrCodeSection.style.display = 'block';
                    
                    // Scroll to QR code
                    pixQrCodeSection.scrollIntoView({ behavior: 'smooth' });
                  }
                } catch (error) {
                  console.error('Erro ao obter QR Code:', error);
                }
              });
            });
          } else {
            paymentResult.innerHTML = '<div class="alert alert-danger">Erro ao consultar pagamento</div>' +
              '<pre>' + JSON.stringify(result, null, 2) + '</pre>';
          }
        } catch (error) {
          paymentResult.innerHTML = '<div class="alert alert-danger">Erro ao processar requisição</div>' +
            '<pre>' + error.toString() + '</pre>';
        }
      });
      
      // Copy PIX code button
      document.getElementById('copyPixCodeButton').addEventListener('click', function() {
        const pixCodeTextarea = document.getElementById('pixQrCodeText');
        pixCodeTextarea.select();
        document.execCommand('copy');
        this.innerText = 'Copiado!';
        setTimeout(() => { this.innerText = 'Copiar Código PIX'; }, 2000);
      });
    });
  </script>
</body>
</html>`;
  
  res.status(200).send(html);
}; 