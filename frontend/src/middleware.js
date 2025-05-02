// Middleware para lidar com rotas de API não encontradas e requisições undefined
import { NextResponse } from 'next/server';

export function middleware(request) {
  // Obter a URL da requisição
  const url = request.nextUrl.clone();
  const path = url.pathname;
  
  // Log para depuração
  console.log(`[API Middleware] Request para: ${path}`);
  
  // Verificar se é uma requisição para /undefined
  if (path.includes('/undefined')) {
    console.log('[API Middleware] Detectada requisição para /undefined - Redirecionando para API de saúde');
    
    // Redirecionar para o endpoint de health
    url.pathname = '/api/health';
    return NextResponse.redirect(url);
  }
  
  // Se for uma requisição para backendapi-production no Railway que não existe no Vercel
  if (path.includes('/api/subscription/status')) {
    console.log('[API Middleware] Detectada requisição para subscription/status - Redirecionando');
    
    // Redirecionar para o endpoint local
    url.pathname = '/api/subscription/status';
    return NextResponse.redirect(url);
  }
  
  // Requisições para o Railway que devem ser interceptadas
  if (path.includes('backendapi-production-36b5.up.railway.app')) {
    console.log('[API Middleware] Detectada requisição para Railway - Redirecionando para API local');
    
    // Extrair o caminho da API do Railway
    const railwayPath = path.split('backendapi-production-36b5.up.railway.app')[1];
    
    // Redirecionar para o endpoint local equivalente
    url.pathname = railwayPath || '/api';
    return NextResponse.redirect(url);
  }
  
  // Continuar com a requisição normal
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/undefined',
    '/:path*',
  ],
}; 