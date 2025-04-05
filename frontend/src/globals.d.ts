// globals.d.ts
// TypeScript definitions for global variables

/**
 * Extend the Window interface to include our globally initialized variables.
 * This prevents TypeScript errors when accessing these variables from window object.
 */
declare global {
  interface Window {
    // Registry of initialized variables
    __INIT_REGISTRY__?: Record<string, boolean>;
    __REACT_POLYFILL_LOADED__?: boolean;
    __REACT_LAYOUT_EFFECT_CLEANUP__?: Function;
    __REACT_LAYOUT_EFFECT_CLEANUPS__?: Record<string, Function>;
    
    // Global Yo variable that's initialized early
    Yo: {
      initialized: boolean;
      timestamp?: number;
    };
    
    // Objeto React global
    React: {
      useLayoutEffect?: Function;
      useEffect?: Function;
      [key: string]: any;
    };
    
    // Variável z que pode ser usada em código minificado
    z?: any;
    
    // Any other variables that might need initialization
    __GLOBAL_INIT__?: {
      initialized: Record<string, any>;
      registerModule: (name: string) => boolean;
    };
  }
}

// This empty export makes this file a module
export {}; 