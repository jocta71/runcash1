// Endpoint para página de teste com React

// Node.js built-in modules
const fs = require('fs');
const path = require('path');

// Carrega o HTML da página de teste
const HTML = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RunCash - Teste Asaas</title>
  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    body { padding: 20px 0; background-color: #f8f9fa; }
    .container { max-width: 1200px; }
    .card { margin-bottom: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .card-header { background-color: #f1f5f9; font-weight: bold; border-radius: 10px 10px 0 0 !important; }
    code { background-color: #f1f1f1; padding: 2px 4px; border-radius: 3px; }
    .result-box { background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; max-height: 400px; overflow-y: auto; }
    .btn-primary { background-color: #0d6efd; }
    .btn-success { background-color: #198754; }
    .btn-info { background-color: #0dcaf0; }
    .btn-warning { background-color: #ffc107; }
    .btn-danger { background-color: #dc3545; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="mb-4 text-center">RunCash - Teste Integração Asaas</h1>
    
    <div class="row">
      <div class="col-md-12 mb-4">
        <div class="card">
          <div class="card-header">
            <i class="fas fa-info-circle me-2"></i> Informações
          </div>
          <div class="card-body">
            <p>Esta página permite testar todas as integrações com o Asaas. Utilize os formulários abaixo para:</p>
            <ul>
              <li>Criar clientes no Asaas</li>
              <li>Buscar clientes por ID, CPF ou Email</li>
              <li>Criar assinaturas com cartão de crédito ou PIX</li>
              <li>Consultar status de assinaturas</li>
              <li>Cancelar assinaturas</li>
              <li>Verificar pagamentos</li>
            </ul>
            <p><strong>Ambiente:</strong> <span id="environment-badge" class="badge text-bg-warning">Carregando...</span></p>
          </div>
        </div>
      </div>
    </div>
    
    <div class="row">
      <!-- Coluna 1: Cliente e Assinatura -->
      <div class="col-md-6">
        <!-- Criar Cliente -->
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <div><i class="fas fa-user-plus me-2"></i> Criar Cliente</div>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#createCustomerForm">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
          <div class="card-body collapse show" id="createCustomerForm">
            <form id="customer-form">
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
                <input type="text" class="form-control" id="cpf" required maxlength="11" minlength="11">
              </div>
              <div class="mb-3">
                <label for="phone" class="form-label">Telefone</label>
                <input type="text" class="form-control" id="phone" required>
              </div>
              <button type="submit" class="btn btn-primary" id="create-customer-btn">
                <i class="fas fa-user-plus me-2"></i> Criar Cliente
              </button>
            </form>
            <div id="customer-result" class="mt-3 d-none">
              <div class="alert alert-success">Cliente criado com sucesso!</div>
              <div class="small mt-2">
                <strong>ID do Cliente:</strong> <span id="customer-id"></span><br>
                <button class="btn btn-sm btn-outline-secondary mt-2" id="copy-customer-id">
                  <i class="fas fa-copy me-1"></i> Copiar ID
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Buscar Cliente -->
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <div><i class="fas fa-search me-2"></i> Buscar Cliente</div>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#findCustomerForm">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
          <div class="card-body collapse show" id="findCustomerForm">
            <form id="find-customer-form">
              <div class="mb-3">
                <label class="form-label">Buscar por:</label>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="findCustomerBy" id="findByCustomerId" value="customerId" checked>
                  <label class="form-check-label" for="findByCustomerId">ID do Cliente</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="findCustomerBy" id="findByCpf" value="cpfCnpj">
                  <label class="form-check-label" for="findByCpf">CPF/CNPJ</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="findCustomerBy" id="findByEmail" value="email">
                  <label class="form-check-label" for="findByEmail">Email</label>
                </div>
              </div>
              
              <div class="mb-3" id="findCustomerId-field">
                <label for="findCustomerId" class="form-label">ID do Cliente</label>
                <input type="text" class="form-control" id="findCustomerId">
              </div>
              <div class="mb-3 d-none" id="findCpf-field">
                <label for="findCpf" class="form-label">CPF/CNPJ</label>
                <input type="text" class="form-control" id="findCpf">
              </div>
              <div class="mb-3 d-none" id="findEmail-field">
                <label for="findEmail" class="form-label">Email</label>
                <input type="text" class="form-control" id="findEmail">
              </div>
              
              <button type="submit" class="btn btn-info" id="find-customer-btn">
                <i class="fas fa-search me-2"></i> Buscar Cliente
              </button>
            </form>
            <div id="find-customer-result" class="mt-3 d-none">
              <h5>Detalhes do Cliente:</h5>
              <div class="result-box">
                <pre id="find-customer-details"></pre>
              </div>
              <h5 class="mt-3">Assinaturas:</h5>
              <div class="result-box">
                <pre id="find-customer-subscriptions"></pre>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Criar Assinatura -->
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <div><i class="fas fa-calendar-check me-2"></i> Criar Assinatura</div>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#createSubscriptionForm">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
          <div class="card-body collapse show" id="createSubscriptionForm">
            <form id="subscription-form">
              <div class="mb-3">
                <label for="customerId" class="form-label">ID do Cliente</label>
                <input type="text" class="form-control" id="customerId" required>
              </div>
              <div class="mb-3">
                <label for="planId" class="form-label">Plano</label>
                <select class="form-select" id="planId" required>
                  <option value="">Selecione um plano</option>
                  <option value="basic">Básico (R$ 99,90)</option>
                  <option value="pro">Profissional (R$ 199,90)</option>
                  <option value="premium">Premium (R$ 299,90)</option>
                </select>
              </div>
              <div class="mb-3">
                <label for="paymentMethod" class="form-label">Método de Pagamento</label>
                <select class="form-select" id="paymentMethod" required>
                  <option value="CREDIT_CARD">Cartão de Crédito</option>
                  <option value="PIX">PIX</option>
                  <option value="BOLETO">Boleto</option>
                </select>
              </div>
              
              <button type="button" class="btn btn-success" id="create-subscription-btn">
                <i class="fas fa-calendar-plus me-2"></i> Criar Assinatura
              </button>
              <button type="button" class="btn btn-outline-primary ms-2" id="go-to-payment-btn">
                <i class="fas fa-credit-card me-2"></i> Ir para Pagamento
              </button>
            </form>
            <div id="subscription-result" class="mt-3 d-none">
              <div class="alert alert-success">Assinatura criada com sucesso!</div>
              <div class="small mt-2">
                <strong>ID da Assinatura:</strong> <span id="subscription-id"></span><br>
                <strong>ID do Pagamento:</strong> <span id="payment-id"></span><br>
                <button class="btn btn-sm btn-outline-secondary mt-2" id="copy-subscription-id">
                  <i class="fas fa-copy me-1"></i> Copiar ID da Assinatura
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Coluna 2: Consultas e Gerenciamento -->
      <div class="col-md-6">
        <!-- Verificar Assinatura -->
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <div><i class="fas fa-clipboard-check me-2"></i> Consultar Assinatura</div>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#checkSubscriptionForm">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
          <div class="card-body collapse show" id="checkSubscriptionForm">
            <form id="check-subscription-form">
              <div class="mb-3">
                <label for="subscriptionId" class="form-label">ID da Assinatura</label>
                <input type="text" class="form-control" id="subscriptionId" required>
              </div>
              <button type="submit" class="btn btn-info" id="check-subscription-btn">
                <i class="fas fa-search me-2"></i> Consultar Assinatura
              </button>
            </form>
            <div id="subscription-detail-result" class="mt-3 d-none">
              <h5>Detalhes da Assinatura:</h5>
              <div class="result-box">
                <pre id="subscription-details"></pre>
              </div>
              <h5 class="mt-3">Pagamentos:</h5>
              <div class="result-box">
                <pre id="subscription-payments"></pre>
              </div>
              <div class="mt-3">
                <button class="btn btn-danger" id="cancel-subscription-btn">
                  <i class="fas fa-times-circle me-2"></i> Cancelar Assinatura
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Verificar Pagamento -->
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <div><i class="fas fa-money-bill-wave me-2"></i> Consultar Pagamento</div>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#checkPaymentForm">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
          <div class="card-body collapse show" id="checkPaymentForm">
            <form id="check-payment-form">
              <div class="mb-3">
                <label for="paymentId" class="form-label">ID do Pagamento</label>
                <input type="text" class="form-control" id="paymentId" required>
              </div>
              <button type="submit" class="btn btn-info" id="check-payment-btn">
                <i class="fas fa-search me-2"></i> Consultar Pagamento
              </button>
            </form>
            <div id="payment-result" class="mt-3 d-none">
              <h5>Detalhes do Pagamento:</h5>
              <div class="result-box">
                <pre id="payment-details"></pre>
              </div>
              <h5 class="mt-3">Status:</h5>
              <div id="payment-status" class="alert alert-info">Carregando...</div>
              <div class="mt-3" id="pix-container">
                <h5>QR Code PIX:</h5>
                <div class="text-center">
                  <div id="pix-qrcode" class="mb-3"></div>
                  <button class="btn btn-outline-secondary" id="copy-pix-code">
                    <i class="fas fa-copy me-1"></i> Copiar Código PIX
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- QR Code para Teste -->
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <div><i class="fas fa-qrcode me-2"></i> Gerar QR Code PIX Avulso</div>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#qrCodeForm">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
          <div class="card-body collapse show" id="qrCodeForm">
            <form id="qrcode-form">
              <div class="mb-3">
                <label for="paymentValue" class="form-label">Valor (R$)</label>
                <input type="number" step="0.01" min="1" class="form-control" id="paymentValue" required>
              </div>
              <div class="mb-3">
                <label for="paymentDescription" class="form-label">Descrição</label>
                <input type="text" class="form-control" id="paymentDescription" value="Teste de PIX">
              </div>
              <button type="submit" class="btn btn-warning" id="generate-qrcode-btn">
                <i class="fas fa-qrcode me-2"></i> Gerar QR Code
              </button>
            </form>
            <div id="qrcode-result" class="mt-3 d-none">
              <h5>QR Code PIX:</h5>
              <div class="text-center">
                <div id="payment-qrcode" class="mb-3"></div>
                <button class="btn btn-outline-secondary" id="copy-payment-pix-code">
                  <i class="fas fa-copy me-1"></i> Copiar Código PIX
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Bootstrap JS -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>
  <!-- QR Code Library -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
  
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Detectar ambiente
      const isProduction = window.location.hostname.includes('vercel') || 
                          window.location.hostname.includes('railway') || 
                          window.location.hostname.includes('runcashh');
      const envBadge = document.getElementById('environment-badge');
      
      if (isProduction) {
        envBadge.textContent = 'Produção';
        envBadge.className = 'badge text-bg-danger';
      } else {
        envBadge.textContent = 'Desenvolvimento';
        envBadge.className = 'badge text-bg-success';
      }
      
      // Trocar exibição dos campos de busca de cliente
      document.querySelectorAll('input[name="findCustomerBy"]').forEach(radio => {
        radio.addEventListener('change', function() {
          document.getElementById('findCustomerId-field').classList.add('d-none');
          document.getElementById('findCpf-field').classList.add('d-none');
          document.getElementById('findEmail-field').classList.add('d-none');
          
          if (this.value === 'customerId') {
            document.getElementById('findCustomerId-field').classList.remove('d-none');
          } else if (this.value === 'cpfCnpj') {
            document.getElementById('findCpf-field').classList.remove('d-none');
          } else if (this.value === 'email') {
            document.getElementById('findEmail-field').classList.remove('d-none');
          }
        });
      });
      
      // Copiar ID do cliente
      document.getElementById('copy-customer-id')?.addEventListener('click', function() {
        const customerId = document.getElementById('customer-id').textContent;
        copyToClipboard(customerId);
        this.textContent = '✓ Copiado!';
        setTimeout(() => {
          this.innerHTML = '<i class="fas fa-copy me-1"></i> Copiar ID';
        }, 2000);
      });
      
      // Copiar ID da assinatura
      document.getElementById('copy-subscription-id')?.addEventListener('click', function() {
        const subscriptionId = document.getElementById('subscription-id').textContent;
        copyToClipboard(subscriptionId);
        this.textContent = '✓ Copiado!';
        setTimeout(() => {
          this.innerHTML = '<i class="fas fa-copy me-1"></i> Copiar ID da Assinatura';
        }, 2000);
      });
      
      // Copiar código PIX de pagamento
      document.getElementById('copy-pix-code')?.addEventListener('click', function() {
        const pixCode = window.pixCodeCache;
        if (pixCode) {
          copyToClipboard(pixCode);
          this.textContent = '✓ Copiado!';
          setTimeout(() => {
            this.innerHTML = '<i class="fas fa-copy me-1"></i> Copiar Código PIX';
          }, 2000);
        }
      });
      
      // Copiar código PIX de QR Code avulso
      document.getElementById('copy-payment-pix-code')?.addEventListener('click', function() {
        const pixCode = window.paymentPixCodeCache;
        if (pixCode) {
          copyToClipboard(pixCode);
          this.textContent = '✓ Copiado!';
          setTimeout(() => {
            this.innerHTML = '<i class="fas fa-copy me-1"></i> Copiar Código PIX';
          }, 2000);
        }
      });
      
      // Função para copiar para clipboard
      function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
          console.error('Erro ao copiar:', err);
          // Fallback
          const textarea = document.createElement('textarea');
          textarea.value = text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        });
      }
      
      // Formulário de criação de cliente
      document.getElementById('customer-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const cpf = document.getElementById('cpf').value;
        const phone = document.getElementById('phone').value;
        
        try {
          const response = await fetch('/api/asaas-create-customer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, cpfCnpj: cpf, phone }),
          });
          
          const data = await response.json();
          
          if (response.ok) {
            document.getElementById('customer-result').classList.remove('d-none');
            document.getElementById('customer-id').textContent = data.id;
            // Preencher automaticamente o ID do cliente no formulário de assinatura
            document.getElementById('customerId').value = data.id;
          } else {
            alert(`Erro: ${data.error || 'Falha ao criar cliente'}`);
          }
        } catch (err) {
          console.error('Erro:', err);
          alert('Erro ao conectar com a API');
        }
      });
      
      // Formulário para buscar cliente
      document.getElementById('find-customer-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const findBy = document.querySelector('input[name="findCustomerBy"]:checked').value;
        let queryParam, queryValue;
        
        if (findBy === 'customerId') {
          queryParam = 'id';
          queryValue = document.getElementById('findCustomerId').value;
        } else if (findBy === 'cpfCnpj') {
          queryParam = 'cpfCnpj';
          queryValue = document.getElementById('findCpf').value;
        } else if (findBy === 'email') {
          queryParam = 'email';
          queryValue = document.getElementById('findEmail').value;
        }
        
        if (!queryValue) {
          alert('Por favor, preencha o campo de busca');
          return;
        }
        
        try {
          const response = await fetch(`/api/asaas-find-customer?${queryParam}=${encodeURIComponent(queryValue)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            const findCustomerResult = document.getElementById('find-customer-result');
            findCustomerResult.classList.remove('d-none');
            
            // Mostrar detalhes do cliente
            const customerDetails = document.getElementById('find-customer-details');
            customerDetails.textContent = JSON.stringify(data.customer, null, 2);
            
            // Mostrar assinaturas do cliente
            const customerSubscriptions = document.getElementById('find-customer-subscriptions');
            if (data.subscriptions && data.subscriptions.length > 0) {
              customerSubscriptions.textContent = JSON.stringify(data.subscriptions, null, 2);
            } else {
              customerSubscriptions.textContent = 'Nenhuma assinatura encontrada.';
            }
            
            // Preencher ID do cliente no formulário de assinatura automaticamente
            if (data.customer && data.customer.id) {
              document.getElementById('customerId').value = data.customer.id;
            }
          } else {
            alert(`Erro: ${data.error || 'Cliente não encontrado'}`);
          }
        } catch (err) {
          console.error('Erro:', err);
          alert('Erro ao conectar com a API');
        }
      });
      
      // Criar assinatura
      document.getElementById('create-subscription-btn')?.addEventListener('click', async function() {
        const customerId = document.getElementById('customerId').value;
        const planId = document.getElementById('planId').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        
        if (!customerId || !planId || !paymentMethod) {
          alert('Por favor, preencha todos os campos');
          return;
        }
        
        try {
          const response = await fetch('/api/asaas-create-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              customerId, 
              planId, 
              paymentMethod 
            }),
          });
          
          const data = await response.json();
          
          if (response.ok) {
            document.getElementById('subscription-result').classList.remove('d-none');
            document.getElementById('subscription-id').textContent = data.id;
            
            // Se houver um pagamento associado
            if (data.paymentId) {
              document.getElementById('payment-id').textContent = data.paymentId;
              
              // Preencher automaticamente o ID do pagamento no formulário de verificação
              document.getElementById('paymentId').value = data.paymentId;
            } else {
              document.getElementById('payment-id').textContent = 'N/A';
            }
            
            // Se for PIX, mostrar botão para ver pagamento
            if (paymentMethod === 'PIX' && data.paymentId) {
              document.getElementById('go-to-payment-btn').classList.remove('d-none');
              document.getElementById('go-to-payment-btn').addEventListener('click', function() {
                document.getElementById('paymentId').value = data.paymentId;
                document.getElementById('check-payment-btn').click();
                // Scroll até o formulário de pagamento
                document.getElementById('checkPaymentForm').scrollIntoView({ behavior: 'smooth' });
              });
            } else {
              document.getElementById('go-to-payment-btn').classList.add('d-none');
            }
          } else {
            alert(`Erro: ${data.error || 'Falha ao criar assinatura'}`);
          }
        } catch (err) {
          console.error('Erro:', err);
          alert('Erro ao conectar com a API');
        }
      });
      
      // Verificar assinatura
      document.getElementById('check-subscription-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const subscriptionId = document.getElementById('subscriptionId').value;
        
        if (!subscriptionId) {
          alert('Por favor, insira o ID da assinatura');
          return;
        }
        
        try {
          const response = await fetch(`/api/asaas-find-subscription?id=${encodeURIComponent(subscriptionId)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            document.getElementById('subscription-detail-result').classList.remove('d-none');
            
            // Mostrar detalhes da assinatura
            document.getElementById('subscription-details').textContent = JSON.stringify(data.subscription, null, 2);
            
            // Mostrar pagamentos da assinatura
            if (data.payments && data.payments.length > 0) {
              document.getElementById('subscription-payments').textContent = JSON.stringify(data.payments, null, 2);
              
              // Se houver pagamentos, preencher o ID do primeiro no formulário de consulta
              if (data.payments[0].id) {
                document.getElementById('paymentId').value = data.payments[0].id;
              }
            } else {
              document.getElementById('subscription-payments').textContent = 'Nenhum pagamento encontrado.';
            }
            
            // Configurar botão de cancelamento
            document.getElementById('cancel-subscription-btn').onclick = async function() {
              if (confirm('Tem certeza que deseja cancelar esta assinatura?')) {
                try {
                  const cancelResponse = await fetch('/api/asaas-cancel-subscription', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ id: subscriptionId }),
                  });
                  
                  const cancelData = await cancelResponse.json();
                  
                  if (cancelResponse.ok) {
                    alert('Assinatura cancelada com sucesso!');
                    // Atualizar detalhes
                    document.getElementById('subscription-details').textContent = JSON.stringify(cancelData, null, 2);
                  } else {
                    alert(`Erro: ${cancelData.error || 'Falha ao cancelar assinatura'}`);
                  }
                } catch (err) {
                  console.error('Erro:', err);
                  alert('Erro ao conectar com a API');
                }
              }
            };
          } else {
            alert(`Erro: ${data.error || 'Assinatura não encontrada'}`);
          }
        } catch (err) {
          console.error('Erro:', err);
          alert('Erro ao conectar com a API');
        }
      });
      
      // Verificar pagamento
      document.getElementById('check-payment-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const paymentId = document.getElementById('paymentId').value;
        
        if (!paymentId) {
          alert('Por favor, insira o ID do pagamento');
          return;
        }
        
        try {
          const response = await fetch(`/api/asaas-find-payment?id=${encodeURIComponent(paymentId)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            document.getElementById('payment-result').classList.remove('d-none');
            
            // Mostrar detalhes do pagamento
            document.getElementById('payment-details').textContent = JSON.stringify(data, null, 2);
            
            // Mostrar status formatado
            const paymentStatus = document.getElementById('payment-status');
            
            switch (data.status) {
              case 'PENDING':
                paymentStatus.className = 'alert alert-warning';
                paymentStatus.textContent = 'Pendente: Aguardando pagamento';
                break;
              case 'RECEIVED':
              case 'CONFIRMED':
                paymentStatus.className = 'alert alert-success';
                paymentStatus.textContent = 'Confirmado: Pagamento recebido';
                break;
              case 'OVERDUE':
                paymentStatus.className = 'alert alert-danger';
                paymentStatus.textContent = 'Atrasado: Pagamento não realizado no prazo';
                break;
              case 'REFUNDED':
                paymentStatus.className = 'alert alert-info';
                paymentStatus.textContent = 'Reembolsado: Valor devolvido ao cliente';
                break;
              default:
                paymentStatus.className = 'alert alert-secondary';
                paymentStatus.textContent = `Status: ${data.status || 'Desconhecido'}`;
            }
            
            // Verificar se é um pagamento PIX
            const pixContainer = document.getElementById('pix-container');
            
            if (data.billingType === 'PIX' && data.status === 'PENDING') {
              pixContainer.classList.remove('d-none');
              
              // Buscar o QR Code PIX
              try {
                const pixResponse = await fetch(`/api/asaas-pix-qrcode?id=${encodeURIComponent(paymentId)}`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  }
                });
                
                const pixData = await pixResponse.json();
                
                if (pixResponse.ok && pixData.encodedImage) {
                  // Armazenar código PIX para copiar
                  window.pixCodeCache = pixData.payload;
                  
                  // Mostrar QR Code
                  const qrCodeContainer = document.getElementById('pix-qrcode');
                  qrCodeContainer.innerHTML = '';
                  
                  // Criar imagem do QR Code
                  const qrImg = document.createElement('img');
                  qrImg.src = `data:image/png;base64,${pixData.encodedImage}`;
                  qrImg.style.maxWidth = '200px';
                  qrImg.alt = 'QR Code PIX';
                  qrCodeContainer.appendChild(qrImg);
                } else {
                  throw new Error(pixData.error || 'QR Code não disponível');
                }
              } catch (pixErr) {
                console.error('Erro ao buscar QR Code PIX:', pixErr);
                pixContainer.innerHTML = `<div class="alert alert-danger">Erro ao gerar QR Code: ${pixErr.message}</div>`;
              }
            } else {
              pixContainer.classList.add('d-none');
            }
          } else {
            alert(`Erro: ${data.error || 'Pagamento não encontrado'}`);
          }
        } catch (err) {
          console.error('Erro:', err);
          alert('Erro ao conectar com a API');
        }
      });
      
      // Gerar QR Code PIX avulso
      document.getElementById('qrcode-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const value = document.getElementById('paymentValue').value;
        const description = document.getElementById('paymentDescription').value;
        
        if (!value) {
          alert('Por favor, insira um valor');
          return;
        }
        
        try {
          // Gerar QR Code diretamente via lib QRCode
          const qrcodeContainer = document.getElementById('payment-qrcode');
          qrcodeContainer.innerHTML = '';
          
          // Simular código PIX com valor e descrição
          const mockPixCode = `00020126580014BR.GOV.BCB.PIX0136${btoa(description)}5204000053039865406${parseFloat(value).toFixed(2)}5802BR5913Runcash Teste6008Sao Paulo62160512${Date.now()}63046A82`;
          
          // Armazenar o código PIX para copiar
          window.paymentPixCodeCache = mockPixCode;
          
          // Gerar QR Code
          await QRCode.toCanvas(qrcodeContainer, mockPixCode, {
            width: 200,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });
          
          document.getElementById('qrcode-result').classList.remove('d-none');
        } catch (err) {
          console.error('Erro:', err);
          alert('Erro ao gerar QR Code');
        }
      });
    });
  </script>
</body>
</html>
`;

// Função handler do endpoint
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(HTML);
}; 