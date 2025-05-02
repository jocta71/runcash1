import React from 'react';
import { Link } from 'react-router-dom';
import './SubscriptionRequiredPage.css';

const SubscriptionRequiredPage = () => {
  return (
    <div className="subscription-required-container">
      <div className="subscription-required-card">
        <div className="lock-icon">
          <i className="fas fa-lock"></i>
        </div>
        
        <h1>Acesso Restrito</h1>
        
        <p className="message">
          Esta funcionalidade está disponível apenas para assinantes.
          Para ter acesso a todas as roletas e seus dados históricos completos,
          você precisa assinar um de nossos planos.
        </p>
        
        <div className="benefits">
          <h3>Benefícios da Assinatura:</h3>
          <ul>
            <li>
              <span className="check-icon">✓</span>
              Acesso a todas as roletas disponíveis
            </li>
            <li>
              <span className="check-icon">✓</span>
              Dados históricos completos
            </li>
            <li>
              <span className="check-icon">✓</span>
              Atualizações em tempo real
            </li>
            <li>
              <span className="check-icon">✓</span>
              Estatísticas detalhadas e análises
            </li>
          </ul>
        </div>
        
        <div className="action-buttons">
          <Link to="/plans" className="subscribe-button">
            Ver Planos
          </Link>
          
          <Link to="/" className="back-button">
            Voltar para Home
          </Link>
        </div>
        
        <p className="preview-note">
          Você ainda pode acessar a <Link to="/preview">versão de demonstração</Link> com recursos limitados.
        </p>
      </div>
    </div>
  );
};

export default SubscriptionRequiredPage; 