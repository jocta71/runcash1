import React from 'react';
import styled from 'styled-components';

const Loader = () => {
  return (
    <StyledWrapper>
      <div className="loader">
        <div className="loader-inner">
          <div className="cube cube1"></div>
          <div className="cube cube2"></div>
          <div className="cube cube3"></div>
          <div className="cube cube4"></div>
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .loader {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 80px;
    height: 80px;
    position: relative;
  }

  .loader-inner {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    transform: rotate(45deg);
  }

  .cube {
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 2px;
    animation: cube 1.5s cubic-bezier(0.645, 0.045, 0.355, 1) infinite;
  }

  .cube1 {
    background-image: linear-gradient(to right, #8b5cf6, #6366f1);
    left: 0;
    top: 0;
    animation-delay: -0.3s;
  }

  .cube2 {
    background-image: linear-gradient(to right, #6366f1, #3b82f6);
    right: 0;
    top: 0;
    animation-delay: -0.15s;
  }

  .cube3 {
    background-image: linear-gradient(to right, #8b5cf6, #d946ef);
    right: 0;
    bottom: 0;
    animation-delay: 0s;
  }

  .cube4 {
    background-image: linear-gradient(to right, #3b82f6, #0ea5e9);
    left: 0;
    bottom: 0;
    animation-delay: -0.45s;
  }

  @keyframes cube {
    0% { transform: scale(1) rotate(0); opacity: 1; }
    25% { transform: scale(0.8) rotate(90deg); opacity: 0.8; }
    50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
    75% { transform: scale(0.9) rotate(270deg); opacity: 0.9; }
    100% { transform: scale(1) rotate(360deg); opacity: 1; }
  }
`;

export default Loader; 