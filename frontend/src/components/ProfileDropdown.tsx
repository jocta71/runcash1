import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Home,
  Settings,
  CreditCard,
  User,
  LogOut
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const ProfileDropdown = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  // Obter iniciais do nome de usuário para o avatar fallback
  const initials = user?.username ? user.username.substring(0, 2).toUpperCase() : 'U';
  
  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full overflow-hidden w-9 h-9 p-0 border-green-600">
          {user?.profilePicture ? (
            <AvatarImage src={user.profilePicture} alt={user.username || "Usuário"} />
          ) : (
            <AvatarFallback className="bg-green-600 text-white">
              {initials}
            </AvatarFallback>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {user && (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.username}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
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
            <User className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </Link>
        </DropdownMenuItem>
        {user && (
          <DropdownMenuItem onClick={handleSignOut} className="text-red-500">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropdown;
