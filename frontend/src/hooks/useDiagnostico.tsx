import { useState, useCallback } from 'react';
import DiagnosticoModal from '../components/DiagnosticoModal';

/**
 * Hook personalizado para gerenciar o modal de diagnóstico
 * 
 * @returns Um objeto com:
 * - DiagnosticoModalComponent: O componente do modal para usar no JSX
 * - openDiagnostico: Função para abrir o modal
 * - closeDiagnostico: Função para fechar o modal
 * - isOpen: Estado atual do modal (aberto ou fechado)
 */
export function useDiagnostico() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openDiagnostico = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeDiagnostico = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Componente embutido que pode ser usado diretamente no JSX
  const DiagnosticoModalComponent = () => (
    <DiagnosticoModal isOpen={isModalOpen} onClose={closeDiagnostico} />
  );

  return {
    DiagnosticoModalComponent,
    openDiagnostico,
    closeDiagnostico,
    isOpen: isModalOpen
  };
}

export default useDiagnostico; 