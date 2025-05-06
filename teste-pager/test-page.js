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
            <div><i class="fas fa-receipt me-2"></i> Verificar Pagamento</div>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#checkPaymentForm">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
          <div class="card-body collapse show" id="checkPaymentForm">
            <form id="payment-form">
              <div class="mb-3">
                <label for="paymentId" class="form-label">ID do Pagamento</label>
                <input type="text" class="form-control" id="paymentId" required>
              </div>
              <button type="submit" class="btn btn-info" id="check-payment-btn">
                <i class="fas fa-search me-2"></i> Verificar Pagamento
              </button>
            </form>
            <div id="payment-result" class="mt-3 d-none">
              <h5>Detalhes do Pagamento:</h5>
              <div class="result-box">
                <pre id="payment-details"></pre>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Logs e Resultados -->
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <div><i class="fas fa-history me-2"></i> Log de Operações</div>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#logSection">
              <i class="fas fa-chevron-down"></i>
            </button>
          </div>
          <div class="card-body collapse show" id="logSection">
            <div id="log-container" class="result-box" style="max-height: 300px; overflow-y: auto;">
              <div class="text-secondary">Aguardando operações...</div>
            </div>
            <div class="mt-3 d-flex justify-content-between">
              <button class="btn btn-sm btn-outline-secondary" id="clear-log-btn">
                <i class="fas fa-trash-alt me-1"></i> Limpar Log
              </button>
              <span class="text-muted small">Version: 2.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Modal de Erro -->
  <div class="modal fade" id="errorModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header bg-danger text-white">
          <h5 class="modal-title"><i class="fas fa-exclamation-circle me-2"></i> Erro</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <p id="error-message"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Scripts -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Mostrar o ambiente (sandbox ou produção)
      const isProduction = ${process.env.ASAAS_ENVIRONMENT === 'production'};
      const envBadge = document.getElementById('environment-badge');
      if (isProduction) {
        envBadge.textContent = 'PRODUÇÃO';
        envBadge.className = 'badge text-bg-danger';
      } else {
        envBadge.textContent = 'SANDBOX (TESTE)';
        envBadge.className = 'badge text-bg-success';
      }
      
      // Funções utilitárias
      function logOperation(message, type = 'info') {
        const logContainer = document.getElementById('log-container');
        const logEntry = document.createElement('div');
        logEntry.className = \`mb-2 \${type === 'error' ? 'text-danger' : type === 'success' ? 'text-success' : 'text-info'}\`;
        logEntry.innerHTML = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
      }
      
      function showError(message) {
        const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        document.getElementById('error-message').textContent = message;
        errorModal.show();
        logOperation(message, 'error');
      }
      
      function formatJson(obj) {
        return JSON.stringify(obj, null, 2);
      }
      
      // Toggle campos de busca de cliente
      document.querySelectorAll('input[name="findCustomerBy"]').forEach(radio => {
        radio.addEventListener('change', function() {
          document.getElementById('findCustomerId-field').classList.add('d-none');
          document.getElementById('findCpf-field').classList.add('d-none');
          document.getElementById('findEmail-field').classList.add('d-none');
          
          document.getElementById(\`find\${this.value.charAt(0).toUpperCase() + this.value.slice(1)}-field\`).classList.remove('d-none');
        });
      });
      
      // Criar Cliente
      document.getElementById('customer-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const createCustomerBtn = document.getElementById('create-customer-btn');
        const originalBtnHtml = createCustomerBtn.innerHTML;
        createCustomerBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Processando...';
        createCustomerBtn.disabled = true;
        
        try {
          const data = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            cpfCnpj: document.getElementById('cpf').value.replace(/\\D/g, ''),
            phone: document.getElementById('phone').value.replace(/\\D/g, ''),
            userId: 'test-user'
          };
          
          logOperation(\`Criando cliente: \${data.name} (\${data.email})\`);
          
          const response = await fetch('/api/asaas-create-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          const result = await response.json();
          
          if (result.success && result.data && result.data.customerId) {
            document.getElementById('customer-id').textContent = result.data.customerId;
            document.getElementById('customer-result').classList.remove('d-none');
            document.getElementById('customerId').value = result.data.customerId;
            document.getElementById('findCustomerId').value = result.data.customerId;
            logOperation(\`Cliente criado com sucesso! ID: \${result.data.customerId}\`, 'success');
          } else {
            throw new Error(result.error || 'Erro ao criar cliente');
          }
        } catch (error) {
          showError(error.message);
        } finally {
          createCustomerBtn.innerHTML = originalBtnHtml;
          createCustomerBtn.disabled = false;
        }
      });
      
      // Buscar Cliente
      document.getElementById('find-customer-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const findCustomerBtn = document.getElementById('find-customer-btn');
        const originalBtnHtml = findCustomerBtn.innerHTML;
        findCustomerBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Buscando...';
        findCustomerBtn.disabled = true;
        
        try {
          const findBy = document.querySelector('input[name="findCustomerBy"]:checked').value;
          let queryParams = '';
          
          if (findBy === 'customerId') {
            const customerId = document.getElementById('findCustomerId').value;
            if (!customerId) throw new Error('ID do cliente é obrigatório');
            queryParams = \`customerId=\${customerId}\`;
            logOperation(\`Buscando cliente pelo ID: \${customerId}\`);
          } else if (findBy === 'cpfCnpj') {
            const cpfCnpj = document.getElementById('findCpf').value.replace(/\\D/g, '');
            if (!cpfCnpj) throw new Error('CPF/CNPJ é obrigatório');
            queryParams = \`cpfCnpj=\${cpfCnpj}\`;
            logOperation(\`Buscando cliente pelo CPF/CNPJ: \${cpfCnpj}\`);
          } else if (findBy === 'email') {
            const email = document.getElementById('findEmail').value;
            if (!email) throw new Error('Email é obrigatório');
            queryParams = \`email=\${encodeURIComponent(email)}\`;
            logOperation(\`Buscando cliente pelo email: \${email}\`);
          }
          
          const response = await fetch(\`/api/asaas-find-customer?\${queryParams}\`);
          const result = await response.json();
          
          if (result.success) {
            document.getElementById('find-customer-details').textContent = formatJson(result.customer);
            document.getElementById('find-customer-subscriptions').textContent = formatJson(result.subscriptions);
            document.getElementById('find-customer-result').classList.remove('d-none');
            
            // Preencher ID nos outros formulários
            if (result.customer && result.customer.id) {
              document.getElementById('customerId').value = result.customer.id;
              logOperation(\`Cliente encontrado! ID: \${result.customer.id}\`, 'success');
            }
          } else {
            throw new Error(result.error || 'Cliente não encontrado');
          }
        } catch (error) {
          showError(error.message);
        } finally {
          findCustomerBtn.innerHTML = originalBtnHtml;
          findCustomerBtn.disabled = false;
        }
      });
      
      // Copiar ID do cliente
      document.getElementById('copy-customer-id').addEventListener('click', function() {
        const customerId = document.getElementById('customer-id').textContent;
        navigator.clipboard.writeText(customerId);
        logOperation('ID do cliente copiado para a área de transferência');
        alert('ID copiado!');
      });
      
      // Criar Assinatura
      document.getElementById('create-subscription-btn').addEventListener('click', async function() {
        const createSubscriptionBtn = document.getElementById('create-subscription-btn');
        const originalBtnHtml = createSubscriptionBtn.innerHTML;
        createSubscriptionBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Processando...';
        createSubscriptionBtn.disabled = true;
        
        try {
          const customerId = document.getElementById('customerId').value;
          if (!customerId) throw new Error('ID do cliente é obrigatório');
          
          const planId = document.getElementById('planId').value;
          if (!planId) throw new Error('Plano é obrigatório');
          
          const paymentMethod = document.getElementById('paymentMethod').value;
          
          let planValue = 99.9; // Valor padrão
          if (planId === 'pro') planValue = 199.9;
          if (planId === 'premium') planValue = 299.9;
          
          const data = {
            customerId,
            planId,
            value: planValue,
            billingType: paymentMethod
          };
          
          logOperation(\`Criando assinatura: \${planId} (\${paymentMethod}) para cliente \${customerId}\`);
          
          const response = await fetch('/api/asaas-create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          const result = await response.json();
          
          if (result.success && result.data) {
            document.getElementById('subscription-id').textContent = result.data.subscriptionId || '';
            document.getElementById('payment-id').textContent = result.data.paymentId || '';
            document.getElementById('subscription-result').classList.remove('d-none');
            
            // Preencher IDs nos outros formulários
            if (result.data.subscriptionId) {
              document.getElementById('subscriptionId').value = result.data.subscriptionId;
            }
            if (result.data.paymentId) {
              document.getElementById('paymentId').value = result.data.paymentId;
            }
            
            logOperation(\`Assinatura criada com sucesso! ID: \${result.data.subscriptionId}\`, 'success');
          } else {
            throw new Error(result.error || 'Erro ao criar assinatura');
          }
        } catch (error) {
          showError(error.message);
        } finally {
          createSubscriptionBtn.innerHTML = originalBtnHtml;
          createSubscriptionBtn.disabled = false;
        }
      });
      
      // Copiar ID da assinatura
      document.getElementById('copy-subscription-id').addEventListener('click', function() {
        const subscriptionId = document.getElementById('subscription-id').textContent;
        navigator.clipboard.writeText(subscriptionId);
        logOperation('ID da assinatura copiado para a área de transferência');
        alert('ID copiado!');
      });
      
      // Ir para página de pagamento
      document.getElementById('go-to-payment-btn').addEventListener('click', function() {
        const customerId = document.getElementById('customerId').value;
        const planId = document.getElementById('planId').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        
        if (!customerId || !planId) {
          showError('ID do cliente e Plano são obrigatórios');
          return;
        }
        
        logOperation('Redirecionando para página de pagamento...');
        window.location.href = \`/payment?planId=\${planId}&customerId=\${customerId}&paymentMethod=\${paymentMethod}\`;
      });
      
      // Consultar Assinatura
      document.getElementById('check-subscription-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const checkSubscriptionBtn = document.getElementById('check-subscription-btn');
        const originalBtnHtml = checkSubscriptionBtn.innerHTML;
        checkSubscriptionBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Consultando...';
        checkSubscriptionBtn.disabled = true;
        
        try {
          const subscriptionId = document.getElementById('subscriptionId').value;
          if (!subscriptionId) throw new Error('ID da assinatura é obrigatório');
          
          logOperation(\`Consultando assinatura: \${subscriptionId}\`);
          
          const response = await fetch(\`/api/asaas-find-subscription?subscriptionId=\${subscriptionId}\`);
          const result = await response.json();
          
          if (result.success) {
            document.getElementById('subscription-details').textContent = formatJson(result.subscription);
            document.getElementById('subscription-payments').textContent = formatJson(result.payments);
            document.getElementById('subscription-detail-result').classList.remove('d-none');
            document.getElementById('cancel-subscription-btn').dataset.subscriptionId = subscriptionId;
            
            logOperation(\`Assinatura encontrada! Status: \${result.subscription.status}\`, 'success');
          } else {
            throw new Error(result.error || 'Erro ao consultar assinatura');
          }
        } catch (error) {
          showError(error.message);
        } finally {
          checkSubscriptionBtn.innerHTML = originalBtnHtml;
          checkSubscriptionBtn.disabled = false;
        }
      });
      
      // Cancelar Assinatura
      document.getElementById('cancel-subscription-btn').addEventListener('click', async function() {
        if (!confirm('Tem certeza que deseja cancelar esta assinatura?')) return;
        
        const cancelSubscriptionBtn = document.getElementById('cancel-subscription-btn');
        const originalBtnHtml = cancelSubscriptionBtn.innerHTML;
        cancelSubscriptionBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Cancelando...';
        cancelSubscriptionBtn.disabled = true;
        
        try {
          const subscriptionId = cancelSubscriptionBtn.dataset.subscriptionId;
          if (!subscriptionId) throw new Error('ID da assinatura é obrigatório');
          
          logOperation(\`Cancelando assinatura: \${subscriptionId}\`);
          
          const response = await fetch('/api/asaas-cancel-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId })
          });
          
          const result = await response.json();
          
          if (result.success) {
            // Atualizar os detalhes da assinatura
            document.getElementById('check-subscription-form').dispatchEvent(new Event('submit'));
            logOperation(\`Assinatura cancelada com sucesso!\`, 'success');
          } else {
            throw new Error(result.error || 'Erro ao cancelar assinatura');
          }
        } catch (error) {
          showError(error.message);
        } finally {
          cancelSubscriptionBtn.innerHTML = originalBtnHtml;
          cancelSubscriptionBtn.disabled = false;
        }
      });
      
      // Verificar Pagamento
      document.getElementById('payment-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const checkPaymentBtn = document.getElementById('check-payment-btn');
        const originalBtnHtml = checkPaymentBtn.innerHTML;
        checkPaymentBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Verificando...';
        checkPaymentBtn.disabled = true;
        
        try {
          const paymentId = document.getElementById('paymentId').value;
          if (!paymentId) throw new Error('ID do pagamento é obrigatório');
          
          logOperation(\`Verificando pagamento: \${paymentId}\`);
          
          const response = await fetch(\`/api/asaas-find-payment?paymentId=\${paymentId}\`);
          const result = await response.json();
          
          if (result.success) {
            document.getElementById('payment-details').textContent = formatJson(result.payment);
            document.getElementById('payment-result').classList.remove('d-none');
            logOperation(\`Pagamento encontrado! Status: \${result.payment.status}\`, 'success');
          } else {
            throw new Error(result.error || 'Erro ao verificar pagamento');
          }
        } catch (error) {
          showError(error.message);
        } finally {
          checkPaymentBtn.innerHTML = originalBtnHtml;
          checkPaymentBtn.disabled = false;
        }
      });
      
      // Limpar Log
      document.getElementById('clear-log-btn').addEventListener('click', function() {
        document.getElementById('log-container').innerHTML = '<div class="text-secondary">Log limpo</div>';
      });
      
      // Log inicial
      logOperation('Página de teste inicializada');
    });
  </script>
</body>
</html>
`;

module.exports = (req, res) => {
  // Configurar cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  // Verificar se é um preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Verificar método
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Configurar cabeçalho de content-type
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  // Enviar o HTML
  res.status(200).send(HTML);
}; 