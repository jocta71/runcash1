import React from 'react';

interface GlowingCubeLoaderProps {
  size?: 'small' | 'medium' | 'large';
  showLabels?: boolean;
}

/**
 * Componente de loader com cubo animado
 */
const GlowingCubeLoader: React.FC<GlowingCubeLoaderProps> = ({ 
  size = 'medium', 
  showLabels = true 
}) => {
  // Determinar tamanho do cubo com base na prop
  const cubeSize = {
    small: 80,
    medium: 150,
    large: 200
  }[size];

  // Determinar tamanho do ícone
  const iconSize = {
    small: 40,
    medium: 80,
    large: 100
  }[size];

  return (
    <div className="flex justify-center items-center h-full w-full">
      <div style={{ textAlign: "center" }}>
        {showLabels && (
          <div className="flex items-center justify-center space-x-2 mb-3">
            <img src="/assets/icon-rabbit.svg" alt="RunCash" className="w-5 h-5" />
            <span className="text-green-400 text-sm">RunCash IA</span>
          </div>
        )}
        <div className="glowing-cube" style={{ width: `${cubeSize}px`, height: `${cubeSize}px` }}>
          <div className="top"></div>
          <div>
            <span style={{ "--i": 0 } as React.CSSProperties}></span>
            <span style={{ "--i": 1 } as React.CSSProperties}></span>
            <span style={{ "--i": 2 } as React.CSSProperties}></span>
            <span style={{ "--i": 3 } as React.CSSProperties}></span>
          </div>
        </div>
        {showLabels && (
          <div className="text-green-400/80 text-xs mt-3">Buscando...</div>
        )}
        <style>{`
          .glowing-cube {
            position: relative;
            transform-style: preserve-3d;
            animation: cube-rotate 4s linear infinite;
          }

          @keyframes cube-rotate {
            0% {
              transform: rotatex(-30deg) rotatey(0deg);
            }

            100% {
              transform: rotatex(-30deg) rotatey(360deg);
            }
          }

          .glowing-cube div {
            position: absolute;
            inset: 0;
            transform-style: preserve-3d;
          }

          .glowing-cube div span {
            position: absolute;
            inset: 0;
            background: linear-gradient(#151515, #3aff5e);
            transform: rotatey(calc(90deg * var(--i))) translatez(calc(${cubeSize}px / 2));
          }

          .glowing-cube .top {
            position: absolute;
            inset: 0;
            background: #222;
            transform: rotatex(90deg) translatez(calc(${cubeSize}px / 2));
            display: flex;
            justify-content: center;
            align-items: center;
            color: #ffffff;
            font-size: 7rem;
          }

          .glowing-cube .top::before {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            background-image: url('/assets/icon-rabbit.svg');
            background-size: ${iconSize}px;
            background-position: center;
            background-repeat: no-repeat;
            display: flex;
            justify-content: center;
            align-items: center;
          }

          .glowing-cube .top::after {
            content: '';
            position: absolute;
            background: #3aff5e;
            inset: 0;
            transform: translatez(calc(0px - calc(${cubeSize}px + ${cubeSize * 0.66}px)));
            filter: blur(30px);
            box-shadow: 0 0 120px rgba(58, 134, 255, 0.2),
              0 0 200px rgba(58, 134, 255, 0.4),
              0 0 300px #00ff2f,
              0 0 400px #51fd71,
              0 0 500px #3aff5e;
          }
        `}</style>
      </div>
    </div>
  );
};

export default GlowingCubeLoader; 