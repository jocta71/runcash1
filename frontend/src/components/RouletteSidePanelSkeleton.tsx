import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Componente de skeleton para o painel lateral de estatísticas da roleta
 * Exibe um esboço animado do painel durante o carregamento
 */
const RouletteSidePanelSkeleton: React.FC = () => {
  return (
    <div className="w-full rounded-lg overflow-y-auto max-h-screen border-l border-border">
      {/* Cabeçalho */}
      <div className="p-5 border-b border-gray-800 bg-opacity-40">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-6 h-6 rounded-full bg-gray-700 animate-pulse"></div>
          <div className="h-7 w-64 bg-gray-800 rounded animate-pulse"></div>
        </div>
        <div className="h-4 w-40 bg-gray-800 rounded animate-pulse"></div>
      </div>
      
      {/* Seção de filtros */}
      <div className="space-y-4 p-5 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-700 animate-pulse"></div>
            <div className="h-5 w-32 bg-gray-800 rounded animate-pulse"></div>
          </div>
        </div>
        
        {/* Filtros skeleton */}
        <div className="space-y-3">
          <div className="h-8 bg-gray-800 rounded animate-pulse w-full"></div>
          <div className="h-8 bg-gray-800 rounded animate-pulse w-full"></div>
        </div>
      </div>
      
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
        {/* Card de histórico de números */}
        <Card className="md:col-span-2 backdrop-filter bg-opacity-40 bg-vegas-darkbg border border-gray-800/30">
          <CardHeader className="p-2 pb-0 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-700 animate-pulse"></div>
              <div className="h-5 w-40 bg-gray-800 rounded animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2 justify-center my-3">
              {[...Array(30)].map((_, idx) => (
                <div 
                  key={idx} 
                  className="w-8 h-8 rounded-full bg-gray-800 animate-pulse"
                  style={{ 
                    animationDelay: `${idx * 50}ms`,
                    opacity: 0.7 - (idx * 0.02)
                  }}
                ></div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Card de distribuição por cor */}
        <Card className="backdrop-filter bg-opacity-40 bg-vegas-darkbg border border-gray-800/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-700 animate-pulse"></div>
              <div className="h-5 w-40 bg-gray-800 rounded animate-pulse"></div>
            </div>
            <div className="h-4 w-56 bg-gray-800 rounded animate-pulse mt-2"></div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-gray-800 animate-pulse opacity-60"></div>
            </div>
          </CardContent>
        </Card>
        
        {/* Card de mapa de calor */}
        <Card className="backdrop-filter bg-opacity-40 bg-vegas-darkbg border border-gray-800/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-700 animate-pulse"></div>
              <div className="h-5 w-40 bg-gray-800 rounded animate-pulse"></div>
            </div>
            <div className="h-4 w-56 bg-gray-800 rounded animate-pulse mt-2"></div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center">
              <div className="w-32 h-32 rounded bg-gray-800 animate-pulse opacity-60"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RouletteSidePanelSkeleton; 