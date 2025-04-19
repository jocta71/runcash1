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
    width: 70px;
    height: 70px;
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
    width: 14px;
    height: 14px;
    border-radius: 2px;
    animation: cube 1.5s cubic-bezier(0.645, 0.045, 0.355, 1) infinite;
  }

  .cube1 {
    background-image: linear-gradient(to right, #10b981, #059669);
    left: 0;
    top: 0;
    animation-delay: -0.3s;
  }

  .cube2 {
    background-image: linear-gradient(to right, #34d399, #10b981);
    right: 0;
    top: 0;
    animation-delay: -0.15s;
  }

  .cube3 {
    background-image: linear-gradient(to right, #059669, #047857);
    right: 0;
    bottom: 0;
    animation-delay: 0s;
  }

  .cube4 {
    background-image: linear-gradient(to right, #047857, #065f46);
    left: 0;
    bottom: 0;
    animation-delay: -0.45s;
  }

  @keyframes cube {
    0% { transform: scale(1) rotate(0); opacity: 1; box-shadow: 0 0 10px rgba(16, 185, 129, 0.2); }
    25% { transform: scale(0.8) rotate(90deg); opacity: 0.8; }
    50% { transform: scale(1.2) rotate(180deg); opacity: 1; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4); }
    75% { transform: scale(0.9) rotate(270deg); opacity: 0.9; }
    100% { transform: scale(1) rotate(360deg); opacity: 1; box-shadow: 0 0 10px rgba(16, 185, 129, 0.2); }
  }
`;

export default Loader; 