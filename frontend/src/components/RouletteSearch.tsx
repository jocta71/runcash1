import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface RouletteSearchProps {
  initialValue?: string;
  onSearch: (searchTerm: string) => void;
}

/**
 * Componente de pesquisa para roletas
 */
const RouletteSearch: React.FC<RouletteSearchProps> = ({
  initialValue = '',
  onSearch
}) => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  
  // Efeito para atualizar a pesquisa quando o valor inicial mudar
  useEffect(() => {
    setSearchTerm(initialValue);
  }, [initialValue]);
  
  // Função para limpar o campo de pesquisa
  const clearSearch = () => {
    setSearchTerm('');
    onSearch('');
  };
  
  // Função para lidar com a submissão do formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };
  
  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div className="relative flex items-center">
        <Search size={16} className="absolute left-3 text-gray-400" />
        
        <Input
          type="text"
          placeholder="Pesquisar roletas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 pr-9 h-10 bg-transparent border-border text-white"
        />
        
        {searchTerm && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-1 p-1 h-7 w-7"
          >
            <X size={14} className="text-gray-400" />
          </Button>
        )}
      </div>
    </form>
  );
};

export default RouletteSearch; 