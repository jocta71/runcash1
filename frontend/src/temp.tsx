import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';

const IndexSimple = () => {
  const [showModal, setShowModal] = useState(false);
  
  return (
    <Layout>
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center min-h-[70vh]">
          <div className="bg-[#131614]/80 p-10 rounded-xl backdrop-blur-lg shadow-2xl border border-gray-800/50 text-center max-w-xl w-full">
            <h2 className="text-[#00FF00] font-bold text-xl mb-6">Acesse nossas estatísticas exclusivas</h2>
            <p className="text-white/80 mb-6">Escolha um plano agora e desbloqueie acesso completo às melhores análises de roletas em tempo real</p>
            
            {/* Botão de ação */}
            <Button
              onClick={() => setShowModal(true)}
              className="bg-[#00FF00] hover:bg-[#00CC00] text-black font-bold py-3 px-6 rounded-lg w-full text-center transition-all transform hover:scale-105"
            >
              Escolher Plano
            </Button>
          </div>
        </div>
        
        {/* Modal de checkout */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
            <div className="bg-[#131614] rounded-xl shadow-2xl border border-gray-800/50 max-w-md w-full overflow-hidden p-6">
              <h3 className="text-xl font-bold text-white mb-4">Escolha um plano</h3>
              <Button
                onClick={() => setShowModal(false)}
                className="mt-4 w-full bg-[#00FF00] hover:bg-[#00CC00] text-black font-bold"
              >
                Fechar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default IndexSimple; 