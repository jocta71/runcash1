import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import './styles.css';

interface SubscriptionModalProps {
  onClose: () => void;
  onSubscribe: () => void;
}

/**
 * Modal que exibe informações sobre a necessidade de assinatura
 */
const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ onClose, onSubscribe }) => {
  return (
    <div className="subscription-modal-overlay">
      <div className="subscription-modal-container">
        <button className="subscription-modal-close" onClick={onClose}>×</button>
        
        <div className="subscription-modal-header">
          <h2>Assinatura Necessária</h2>
        </div>
        
        <div className="subscription-modal-content">
          <p>Você está tentando acessar um recurso que requer uma assinatura ativa.</p>
          <p>Faça a assinatura do RunCash para acessar:</p>
          
          <ul className="subscription-features-list">
            <li>✅ Acesso a todas as roletas em tempo real</li>
            <li>✅ Estratégias avançadas e estatísticas detalhadas</li>
            <li>✅ Histórico completo de números e muito mais</li>
          </ul>
          
          <div className="subscription-plans">
            <div className="subscription-plan">
              <h3>Plano Básico</h3>
              <div className="subscription-price">R$ 19,90/mês</div>
              <ul>
                <li>Acesso a 10 roletas</li>
                <li>Histórico básico de 30 dias</li>
                <li>Suporte por e-mail</li>
              </ul>
            </div>
            
            <div className="subscription-plan featured">
              <div className="ribbon">Mais Popular</div>
              <h3>Plano Premium</h3>
              <div className="subscription-price">R$ 39,90/mês</div>
              <ul>
                <li>Acesso ilimitado a todas as roletas</li>
                <li>Histórico completo</li>
                <li>Estratégias avançadas</li>
                <li>Suporte prioritário</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="subscription-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Agora não</button>
          <button className="btn btn-primary" onClick={onSubscribe}>Assinar Agora</button>
        </div>
      </div>
    </div>
  );
};

// Elemento onde o modal será renderizado
let modalContainer: HTMLElement | null = null;

/**
 * Função para mostrar o modal de assinatura
 * Cria dinamicamente o elemento no DOM para o modal
 * @returns ID do modal para remoção posterior
 */
export const showSubscriptionRequiredModal = (): string => {
  // Se já existir um modal, não criar outro
  if (document.querySelector('.subscription-modal-overlay')) {
    return 'modal-exists';
  }
  
  // Criar container para o modal se não existir
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'subscription-modal-root';
    document.body.appendChild(modalContainer);
  }
  
  // Gerar ID único para o modal
  const modalId = `subscription-modal-${Date.now()}`;
  
  // Função para fechar o modal
  const closeModal = () => {
    const modalElement = document.getElementById(modalId);
    if (modalElement && modalContainer) {
      ReactDOM.unmountComponentAtNode(modalElement);
      modalElement.remove();
    }
  };
  
  // Função para redirecionar para página de assinatura
  const redirectToSubscription = () => {
    closeModal();
    window.location.href = '/subscription';
  };
  
  // Criar elemento para este modal específico
  const modalElement = document.createElement('div');
  modalElement.id = modalId;
  modalContainer.appendChild(modalElement);
  
  // Renderizar o componente no elemento
  ReactDOM.render(
    <SubscriptionModal 
      onClose={closeModal} 
      onSubscribe={redirectToSubscription} 
    />,
    modalElement
  );
  
  return modalId;
};

export default SubscriptionModal; 