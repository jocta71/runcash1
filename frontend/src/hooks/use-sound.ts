import { useCallback, useEffect, useRef } from 'react';

type SoundType = 'coin' | 'win' | 'notification';

interface SoundOptions {
  volume?: number;
  loop?: boolean;
  onError?: (error: any) => void;
}

/**
 * Hook personalizado para reproduzir sons na aplicação.
 * 
 * @param soundPath Caminho para o arquivo de som ou tipo de som predefinido
 * @param options Opções de configuração (volume, loop, onError)
 * @returns Funções para controlar a reprodução do som
 */
export const useSound = (
  soundPath: string | SoundType,
  options: SoundOptions = {}
) => {
  const { volume = 1, loop = false, onError } = options;
  
  // Se for um tipo predefinido, converter para o caminho real
  const resolvedPath = useCallback(() => {
    if (typeof soundPath === 'string' && ['coin', 'win', 'notification'].includes(soundPath)) {
      switch (soundPath) {
        case 'coin':
          return '/sounds/coin.mp3';
        case 'win':
          return '/sounds/win.mp3';
        case 'notification':
          return '/sounds/notification.mp3';
        default:
          return soundPath;
      }
    }
    return soundPath;
  }, [soundPath]);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Inicializar o objeto de áudio
  useEffect(() => {
    try {
      const path = resolvedPath();
      const audio = new Audio(path);
      audio.volume = volume;
      audio.loop = loop;
      audioRef.current = audio;
      
      // Pré-carregar o áudio
      audio.load();
      
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    } catch (error) {
      console.error('Erro ao inicializar áudio:', error);
      if (onError) onError(error);
    }
  }, [resolvedPath, volume, loop, onError]);
  
  // Função para reproduzir o som
  const play = useCallback(() => {
    try {
      if (audioRef.current) {
        // Reiniciar se já estiver tocando
        audioRef.current.currentTime = 0;
        
        // Reproduzir o som
        audioRef.current.play().catch(error => {
          console.warn('Reprodução de áudio bloqueada pelo navegador:', error);
          if (onError) onError(error);
        });
      }
    } catch (error) {
      console.error('Erro ao reproduzir áudio:', error);
      if (onError) onError(error);
    }
  }, [onError]);
  
  // Função para pausar o som
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);
  
  // Função para parar o som (pausa e reseta)
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);
  
  // Função para ajustar o volume
  const setVolume = useCallback((newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, newVolume));
    }
  }, []);
  
  return { play, pause, stop, setVolume };
};

export default useSound; 