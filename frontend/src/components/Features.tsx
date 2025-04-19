import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  RefreshCw, 
  Bell, 
  BookOpen, 
  BarChart, 
  Bookmark, 
  Download,
  Filter,
  Layers,
  Star 
} from 'lucide-react';

interface FeaturesProps {
  onFeatureClick: (feature: string) => void;
}

export const Features: React.FC<FeaturesProps> = ({ onFeatureClick }) => {
  const features = [
    {
      id: 'refresh',
      name: 'Atualização Automática',
      description: 'Mantenha os dados das roletas sempre atualizados automaticamente.',
      icon: <RefreshCw className="w-4 h-4 mr-2" />
    },
    {
      id: 'notifications',
      name: 'Notificações',
      description: 'Receba alertas quando ocorrerem padrões específicos nas roletas.',
      icon: <Bell className="w-4 h-4 mr-2" />
    },
    {
      id: 'strategies',
      name: 'Estratégias',
      description: 'Acesse estratégias recomendadas baseadas nos padrões das roletas.',
      icon: <BookOpen className="w-4 h-4 mr-2" />
    },
    {
      id: 'analytics',
      name: 'Análises Avançadas',
      description: 'Visualize estatísticas detalhadas e tendências das roletas.',
      icon: <BarChart className="w-4 h-4 mr-2" />
    },
    {
      id: 'favorites',
      name: 'Favoritos',
      description: 'Marque suas roletas preferidas para acesso rápido.',
      icon: <Star className="w-4 h-4 mr-2" />
    },
    {
      id: 'export',
      name: 'Exportar Dados',
      description: 'Faça download dos dados das roletas para análise offline.',
      icon: <Download className="w-4 h-4 mr-2" />
    },
    {
      id: 'display',
      name: 'Modo de Exibição',
      description: 'Alterne entre visualização em grade ou lista detalhada.',
      icon: <Layers className="w-4 h-4 mr-2" />
    },
    {
      id: 'advanced-filter',
      name: 'Filtros Avançados',
      description: 'Filtre roletas por mais critérios além do provedor.',
      icon: <Filter className="w-4 h-4 mr-2" />
    }
  ];

  return (
    <div className="bg-[#1a1922] rounded-xl p-6 border border-white/10">
      <h2 className="text-xl font-bold text-white mb-4">Funcionalidades Sugeridas</h2>
      <p className="text-gray-400 mb-6">
        Explore estas funcionalidades para melhorar sua experiência com as roletas:
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map(feature => (
          <div 
            key={feature.id}
            className="bg-[#23222e] p-4 rounded-lg border border-white/5 hover:border-green-500/30 transition-colors cursor-pointer"
            onClick={() => onFeatureClick(feature.id)}
          >
            <div className="flex items-center mb-2">
              <div className="text-green-500 mr-2">
                {feature.icon}
              </div>
              <h3 className="font-medium text-white">{feature.name}</h3>
            </div>
            <p className="text-sm text-gray-400">{feature.description}</p>
          </div>
        ))}
      </div>
      
      <div className="mt-6 text-center">
        <Button 
          onClick={() => onFeatureClick('all')}
          className="bg-green-600 text-white hover:bg-green-700"
        >
          Ver Todas as Funcionalidades
        </Button>
      </div>
    </div>
  );
}; 