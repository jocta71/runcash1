import { useState } from 'react';
import { CircleDollarSign, Rocket, Heart, Gift, Ticket, Trophy, Users, BarChart3, Scale, LifeBuoy, ChevronDown, Gamepad2, Flame, Globe, Send, X, Settings, CreditCard, Package, Beaker } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

const Sidebar = ({ isOpen = false, onClose, isMobile = false }: SidebarProps) => {
  const [otherExpanded, setOtherExpanded] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('account-information');
  const navigate = useNavigate();
  
  const settingsOptions = [
    { id: 'account-information', label: 'Conta', icon: Settings },
    { id: 'billing', label: 'Pagamentos', icon: CreditCard },
    { id: 'plans', label: 'Planos', icon: Package },
  ];
  
  const handleSettingsItemClick = (id: string) => {
    setActiveSettingsTab(id);
    if (id === 'account-information') {
      navigate('/profile');
    } else if (id === 'billing') {
      navigate('/billing');
    } else if (id === 'plans') {
      navigate('/planos');
    }
  };
  
  const otherOptions = [
    { id: 'stats', label: 'Estatísticas', icon: BarChart3, path: '/estatisticas' },
    { id: 'fair-game', label: 'Jogo Justo', icon: Scale, path: '/jogo-justo' },
    { id: 'support', label: 'Suporte', icon: LifeBuoy, path: '/suporte' },
  ];
  
  const handleOtherItemClick = (path: string) => {
    navigate(path);
  };
  
  const sidebarClasses = isMobile
    ? "h-full w-full mobile-sidebar-inner animate-slide-right"
    : "h-screen fixed top-0 left-0 w-64 hidden md:flex flex-col animate-slide-right z-40 bg-[#131614] border-r border-[#33333359]";
  
  const content = (
    <div className="p-3 flex flex-col h-full justify-between">
      <div className="flex justify-center items-center py-4 mb-2">
        <Link to="/" className="flex items-center justify-center">
          <img src="/img/logo.svg" alt="RunCash Logo" className="h-12" />
        </Link>
      </div>
      
      {isMobile && (
        <div className="flex justify-end mb-4">
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
      )}
      
      <div className="space-y-6">
        <div>
          <h3 className="text-gray-500 text-xs font-medium px-4 mb-2">Jogos</h3>
          <div className="space-y-1">
            <div className="menu-item active">
              <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                <Gamepad2 size={18} className="text-white" />
              </div>
              <span className="truncate">Slots</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                <Flame size={18} className="text-white" />
              </div>
              <span className="truncate">Cassino Ao Vivo</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                <Heart size={18} className="text-white" />
              </div>
              <span className="truncate">Favoritos</span>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-gray-500 text-xs font-medium px-4 mb-2">Bônus</h3>
          <div className="space-y-1">
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                <Gift size={18} className="bg-gradient-to-r from-[#00FF00] to-[#A3FFA3] bg-clip-text text-transparent" />
              </div>
              <span className="truncate">Código Promocional</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                <Trophy size={18} className="text-white" />
              </div>
              <span className="truncate">Programa de Fidelidade</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                <Users size={18} className="text-white" />
              </div>
              <span className="truncate">Programa de Indicação</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                <CircleDollarSign size={18} className="text-white" />
              </div>
              <span className="truncate">Loteria</span>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-gray-500 text-xs font-medium px-4 mb-2">Configurações</h3>
          <div className="space-y-1">
            {settingsOptions.map((option) => (
              <div 
                key={option.id}
                className={`menu-item ${activeSettingsTab === option.id ? 'active' : ''}`}
                onClick={() => handleSettingsItemClick(option.id)}
              >
                <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                  <option.icon size={18} className={activeSettingsTab === option.id ? "bg-gradient-to-r from-[#00FF00] to-[#A3FFA3] bg-clip-text text-transparent" : "text-white"} />
                </div>
                <span className="truncate">{option.label}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-gray-500 text-xs font-medium px-4 mb-2">Outros</h3>
          <div className="space-y-1">
            {otherOptions.map((option) => (
              <div 
                key={option.id}
                className="menu-item"
                onClick={() => handleOtherItemClick(option.path)}
              >
                <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                  <option.icon size={18} className="text-white" />
                </div>
                <span className="truncate">{option.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="space-y-2 mt-auto">
        <div className="bg-[#22202a] rounded-md p-2 flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity">
          <div className="bg-[#1A191F] p-1 rounded-md flex-shrink-0">
            <Send size={18} className="text-gray-400" />
          </div>
          <span className="text-gray-300 truncate">Telegram</span>
        </div>
        
        <div className="bg-[#22202a] rounded-md p-2 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity">
          <div className="flex items-center gap-2">
            <div className="bg-[#1A191F] p-1 rounded-md flex-shrink-0">
              <Globe size={18} className="text-gray-400" />
            </div>
            <span className="text-gray-300 truncate">Português</span>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
  
  if (isMobile) {
    if (!isOpen) return null;
    
    return (
      <div className="mobile-sidebar" onClick={onClose}>
        <div className={sidebarClasses} onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }
  
  return (
    <div className={sidebarClasses}>
      {content}
    </div>
  );
};

export default Sidebar;