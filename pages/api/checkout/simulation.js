/**
 * Página de simulação de checkout 
 * Exibe uma página HTML que simula o processo de checkout do Asaas
 */

/**
 * Handler para exibir página de simulação de checkout
 * 
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
export default function handler(req, res) {
  // Extrair parâmetros de query
  const { checkoutId, planId } = req.query;
  
  // Mapear planos para valores
  const planValues = {
    'basic': 49.90,
    'premium': 99.90,
    'pro': 179.90
  };
  
  // Obter valor do plano ou valor padrão
  const planValue = planValues[planId?.toLowerCase()] || 99.90;
  
  // Gerar data de pagamento fictícia (hoje + alguns segundos)
  const paymentDate = new Date();
  paymentDate.setSeconds(paymentDate.getSeconds() + 30);
  
  // Definir HTML da página de simulação
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Simulação de Checkout - Asaas</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background-color: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          padding: 30px;
        }
        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #eee;
        }
        .logo {
          font-weight: bold;
          font-size: 24px;
          color: #6b46c1;
        }
        .logo span {
          color: #8B5CF6;
        }
        .secure-badge {
          display: flex;
          align-items: center;
          font-size: 14px;
          color: #16a34a;
        }
        .secure-badge svg {
          margin-right: 6px;
        }
        .plan-info {
          background-color: #f9f9f9;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 25px;
        }
        .plan-name {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 5px;
        }
        .plan-price {
          font-size: 22px;
          font-weight: bold;
          color: #333;
        }
        .period {
          font-size: 14px;
          color: #666;
        }
        .divider {
          height: 1px;
          background-color: #eee;
          margin: 25px 0;
        }
        .payment-section h2 {
          font-size: 18px;
          margin-bottom: 15px;
        }
        .payment-methods {
          display: flex;
          gap: 15px;
          margin-bottom: 25px;
        }
        .payment-method {
          flex: 1;
          border: 2px solid #eee;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .payment-method.active {
          border-color: #8B5CF6;
          background-color: #f3f0ff;
        }
        .payment-method:hover {
          border-color: #d8d8d8;
        }
        .payment-method svg {
          margin-bottom: 10px;
        }
        .action-buttons {
          display: flex;
          gap: 15px;
          margin-top: 25px;
        }
        .btn {
          padding: 12px 20px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          font-size: 16px;
        }
        .btn-primary {
          background-color: #8B5CF6;
          color: white;
        }
        .btn-primary:hover {
          background-color: #7c3aed;
        }
        .btn-outline {
          background-color: transparent;
          border: 1px solid #d1d5db;
          color: #374151;
        }
        .btn-outline:hover {
          background-color: #f9fafb;
        }
        .countdown {
          font-size: 14px;
          color: #666;
          margin-top: 10px;
          text-align: center;
        }
        .success-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255,255,255,0.9);
          z-index: 1000;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        }
        .success-message {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          padding: 30px;
          text-align: center;
          max-width: 450px;
        }
        .success-icon {
          width: 60px;
          height: 60px;
          background-color: #ecfdf5;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }
        .success-icon svg {
          color: #10b981;
        }
        .success-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 15px;
        }
        .hidden {
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div class="logo">Asaas <span>Checkout</span></div>
          <div class="secure-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Ambiente Seguro
          </div>
        </header>

        <div class="plan-info">
          <div class="plan-name">Plano ${planId ? planId.toUpperCase() : 'RunCash'}</div>
          <div class="plan-price">R$ ${planValue.toFixed(2)} <span class="period">/mês</span></div>
          <p>Assinatura mensal com renovação automática</p>
        </div>

        <div class="payment-section">
          <h2>Forma de pagamento</h2>
          <div class="payment-methods">
            <div class="payment-method active" data-method="credit-card">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              <div>Cartão de Crédito</div>
            </div>
            <div class="payment-method" data-method="pix">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <div>PIX</div>
            </div>
            <div class="payment-method" data-method="boleto">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 8v13H3V8"></path>
                <path d="M1 3h22v5H1z"></path>
                <path d="M10 12h4"></path>
                <path d="M10 16h4"></path>
              </svg>
              <div>Boleto</div>
            </div>
          </div>

          <div id="payment-form" class="payment-form">
            <p>Este é um ambiente de simulação. Em um ambiente real, você veria campos para preencher os dados de pagamento aqui.</p>
            
            <div class="divider"></div>
            
            <div class="action-buttons">
              <button id="btn-cancel" class="btn btn-outline">Voltar</button>
              <button id="btn-pay" class="btn btn-primary">Finalizar Pagamento</button>
            </div>
            
            <div class="countdown" id="countdown">Esta simulação redirecionará em <span id="timer">30</span> segundos</div>
          </div>
        </div>
      </div>
      
      <div id="success-overlay" class="success-overlay">
        <div class="success-message">
          <div class="success-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 class="success-title">Pagamento Simulado com Sucesso!</h2>
          <p>Seu pagamento fictício foi processado. Em um ambiente real, você seria redirecionado de volta para a aplicação.</p>
          <p>Redirecionando em <span id="redirect-timer">5</span> segundos...</p>
          <div class="action-buttons" style="justify-content: center;">
            <button id="btn-go-back" class="btn btn-primary">Voltar para Planos</button>
          </div>
        </div>
      </div>

      <script>
        // JavaScript para interatividade da página de simulação
        document.addEventListener('DOMContentLoaded', function() {
          // Selecionar método de pagamento
          const paymentMethods = document.querySelectorAll('.payment-method');
          paymentMethods.forEach(method => {
            method.addEventListener('click', function() {
              paymentMethods.forEach(m => m.classList.remove('active'));
              this.classList.add('active');
            });
          });
          
          // Botão de cancelar
          const btnCancel = document.getElementById('btn-cancel');
          btnCancel.addEventListener('click', function() {
            window.location.href = '/planos';
          });
          
          // Botão de voltar para planos (na tela de sucesso)
          const btnGoBack = document.getElementById('btn-go-back');
          btnGoBack.addEventListener('click', function() {
            window.location.href = '/planos';
          });
          
          // Botão de pagamento
          const btnPay = document.getElementById('btn-pay');
          btnPay.addEventListener('click', function() {
            showPaymentSuccess();
          });
          
          // Contador regressivo
          let timeLeft = 30;
          const timerElement = document.getElementById('timer');
          const countdownInterval = setInterval(function() {
            timeLeft--;
            timerElement.textContent = timeLeft;
            
            if (timeLeft <= 0) {
              clearInterval(countdownInterval);
              showPaymentSuccess();
            }
          }, 1000);
          
          // Função para mostrar overlay de sucesso
          function showPaymentSuccess() {
            document.getElementById('success-overlay').style.display = 'flex';
            
            // Iniciar contagem regressiva para redirecionamento
            let redirectTime = 5;
            const redirectTimer = document.getElementById('redirect-timer');
            const redirectInterval = setInterval(function() {
              redirectTime--;
              redirectTimer.textContent = redirectTime;
              
              if (redirectTime <= 0) {
                clearInterval(redirectInterval);
                window.location.href = '/planos';
              }
            }, 1000);
          }
        });
      </script>
    </body>
    </html>
  `;
  
  // Definir cabeçalho e retornar HTML
  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
} 