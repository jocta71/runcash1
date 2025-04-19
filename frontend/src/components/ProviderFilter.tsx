import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ProviderFilterProps {
  providers: string[];
  selectedProvider: string | null;
  onSelectProvider: (provider: string | null) => void;
}

export const ProviderFilter: React.FC<ProviderFilterProps> = ({
  providers,
  selectedProvider,
  onSelectProvider,
}) => {
  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 bg-[#1a1922] text-white px-4 py-2 rounded-lg border border-white/10 hover:bg-[#23222e] transition-colors"
          >
            <span>Provedor: {selectedProvider || 'Todos'}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-56 bg-[#1a1922] border-white/10 text-white">
          <DropdownMenuGroup>
            <DropdownMenuItem 
              className={cn(
                "flex items-center justify-between cursor-pointer hover:bg-[#23222e]",
                !selectedProvider && "text-green-500 font-semibold"
              )}
              onClick={() => onSelectProvider(null)}
            >
              <span>Todos</span>
              {!selectedProvider && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
            
            {providers.map((provider) => (
              <DropdownMenuItem
                key={provider}
                className={cn(
                  "flex items-center justify-between cursor-pointer hover:bg-[#23222e]",
                  selectedProvider === provider && "text-green-500 font-semibold"
                )}
                onClick={() => onSelectProvider(provider)}
              >
                <span>{provider}</span>
                {selectedProvider === provider && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}; 