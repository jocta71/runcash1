/**
 * Arquivo de barril (barrel file) para componentes da UI
 * Exporta todos os componentes da UI para facilitar importações
 */

// Componentes básicos
export * from './button';
export * from './card';
export * from './input';
export * from './label';
export * from './checkbox';
export * from './dialog';
export * from './dropdown-menu';
export * from './select';
export * from './textarea';
export * from './tooltip';
export * from './sheet';
export * from './tabs';

// Sistema de toast
export * from './toast';
export * from './use-toast';
export { Toaster as ToastContainer } from './toaster';
export { Toaster as SonnerToaster } from './sonner';

// Componentes de navegação
export * from './navigation-menu';
export * from './sidebar';
export * from './breadcrumb';

// Componentes de layout
export * from './separator';
export * from './scroll-area';
export * from './resizable';

// Componentes de feedback
export * from './alert';
export * from './progress';
export * from './skeleton';

// Outros componentes podem ser adicionados conforme necessário 