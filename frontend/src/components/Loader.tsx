import React from 'react';

// Componente de loader com cubo 3D e coração
const CubeLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center">
      <div style={{width: "150px", height: "150px", position: "relative", transformStyle: "preserve-3d", animation: "cube-rotate 4s linear infinite"}}>
        <div style={{position: "absolute", inset: 0, background: "#222", transform: "rotatex(90deg) translatez(75px)", display: "flex", justifyContent: "center", alignItems: "center"}}>
          <span style={{fontSize: "50px"}}>❤️</span>
        </div>
        <div style={{position: "absolute", inset: 0, transformStyle: "preserve-3d"}}>
          <span style={{position: "absolute", inset: 0, background: "linear-gradient(#151515, #3aff5e)", transform: "rotatey(0deg) translatez(75px)"}}></span>
          <span style={{position: "absolute", inset: 0, background: "linear-gradient(#151515, #3aff5e)", transform: "rotatey(90deg) translatez(75px)"}}></span>
          <span style={{position: "absolute", inset: 0, background: "linear-gradient(#151515, #3aff5e)", transform: "rotatey(180deg) translatez(75px)"}}></span>
          <span style={{position: "absolute", inset: 0, background: "linear-gradient(#151515, #3aff5e)", transform: "rotatey(270deg) translatez(75px)"}}></span>
        </div>
        <div style={{position: "absolute", inset: 0, background: "#222", transform: "rotatex(90deg) translatez(75px)"}}>
          <div style={{content: "''", position: "absolute", background: "#3aff5e", inset: 0, transform: "translatez(-250px)", filter: "blur(30px)", boxShadow: "0 0 120px rgba(58, 134, 255, 0.2), 0 0 200px rgba(58, 134, 255, 0.4), 0 0 300px #00ff2f, 0 0 400px #51fd71, 0 0 500px #3aff5e"}}></div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cube-rotate {
          0% { transform: rotatex(-30deg) rotatey(0deg); }
          100% { transform: rotatex(-30deg) rotatey(360deg); }
        }
      `}} />
    </div>
  );
};

export default CubeLoader; 