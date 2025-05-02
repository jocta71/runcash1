import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = ({ message = 'Carregando...' }) => {
  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p className="loading-message">{message}</p>
    </div>
  );
};

export default LoadingScreen; 