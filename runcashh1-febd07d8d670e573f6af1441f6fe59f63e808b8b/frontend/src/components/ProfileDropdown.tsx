import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Home,
  Settings,
  CreditCard,
  Star,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// Interface estendida para o usuário com firstName e lastName
interface ExtendedUser {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  profilePicture?: string;
  firstName?: string;
  lastName?: string;
}

const ProfileDropdown = () => {
  const { user } = useAuth();
  const { currentSubscription, currentPlan } = useSubscription();
  
  // Cast para o tipo estendido
  const extUser = user as unknown as ExtendedUser;
  
  // Função para obter o nome completo com fallback para username
  const getDisplayName = () => {
    if (extUser?.firstName || extUser?.lastName) {
      return `${extUser.firstName || ''} ${extUser.lastName || ''}`.trim();
    }
    return extUser?.username || 'Usuário';
  };
  
  const getInitials = (name: string) => {
    // Primeiro tenta usar o nome e sobrenome para as iniciais
    if (extUser?.firstName && extUser?.lastName) {
      return (extUser.firstName[0] + extUser.lastName[0]).toUpperCase();
    }
    
    // Caso contrário, usa a lógica original
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Verificar se o usuário tem uma assinatura ativa
  const hasActivePlan = currentSubscription && 
    (currentSubscription.status?.toLowerCase() === 'active' || 
     currentSubscription.status?.toLowerCase() === 'ativo' || 
     currentSubscription.status?.toLowerCase() === 'confirmed');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full w-8 h-8 p-0 overflow-hidden">
          {user?.profilePicture ? (
            <Avatar className="w-full h-full">
              <AvatarImage src={user.profilePicture} alt={getDisplayName()} />
              <AvatarFallback>{user ? getInitials(user.username) : 'U'}</AvatarFallback>
            </Avatar>
          ) : (
            <span className="font-semibold text-sm">{user ? getInitials(user.username) : 'U'}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {user && (
          <>
            <div className="px-2 py-2 text-sm font-medium">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.profilePicture} alt={getDisplayName()} />
                  <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                </Avatar>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none">{getDisplayName()}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
              
              {/* Indicador de status de assinatura */}
              {currentPlan && (
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {hasActivePlan ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                    )}
                    <span className="text-xs">
                      {hasActivePlan ? `Plano ${currentPlan.name}` : 'Sem plano ativo'}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs py-0 h-5">
                    {hasActivePlan ? currentPlan.name : 'Free'}
                  </Badge>
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link to="/" className="flex items-center cursor-pointer">
            <Home className="mr-2 h-4 w-4" />
            <span>Início</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link to="/billing" className="flex items-center cursor-pointer">
            <Star className="mr-2 h-4 w-4" />
            <span>Minha Assinatura</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link to="/planos" className="flex items-center cursor-pointer">
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Planos</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdown;
