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
  User
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
