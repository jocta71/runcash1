import { useEffect, useRef } from 'react';

// Tipos de sons disponíveis na aplicação
export type SoundType = 'coin' | 'win' | 'notification';

// Interface para o contexto de som
interface SoundManagerProps {
  children?: React.ReactNode;
}

const SoundManager: React.FC<SoundManagerProps> = ({ children }) => {
  // Referencias para os elementos de áudio
  const coinAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Função para pré-carregar os sons
  const preloadSounds = () => {
    try {
      // Pré-carregar som de moeda
      const coinAudio = new Audio('/sounds/coin.mp3');
      coinAudio.preload = 'auto';
      coinAudioRef.current = coinAudio;
      
      // Você pode adicionar mais sons aqui conforme necessário
    } catch (error) {
      console.error('Erro ao pré-carregar sons:', error);
    }
  };
  
  // Pré-carregar os sons quando o componente montar
  useEffect(() => {
    preloadSounds();
    
    // Adicionar ao window para acesso global
    (window as any).playCoinSound = () => playSound('coin');
    
    return () => {
      // Limpar quando o componente desmontar
      (window as any).playCoinSound = undefined;
    };
  }, []);
  
  // Função para reproduzir um som específico
  const playSound = (type: SoundType) => {
    try {
      switch (type) {
        case 'coin':
          if (coinAudioRef.current) {
            coinAudioRef.current.currentTime = 0;
            coinAudioRef.current.play().catch((error) => {
              console.log('Erro ao reproduzir som (provavelmente bloqueado pelo navegador):', error);
            });
          }
          break;
        // Adicione mais casos conforme necessário
        default:
          console.warn(`Tipo de som não reconhecido: ${type}`);
      }
    } catch (error) {
      console.error(`Erro ao reproduzir som ${type}:`, error);
    }
  };
  
  // O componente não renderiza nada, apenas gerencia os sons
  return <>{children}</>;
};

export default SoundManager; 