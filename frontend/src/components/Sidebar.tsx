
import { useState } from 'react';
import { CircleDollarSign, Rocket, Heart, Gift, Ticket, Trophy, Users, BarChart3, Scale, LifeBuoy, ChevronDown, Gamepad2, Flame, Globe, Send, X, Settings, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    { id: 'account-information', label: 'Account Information', icon: Settings },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];
  
  const handleSettingsItemClick = (id: string) => {
    setActiveSettingsTab(id);
    if (id === 'account-information') {
      navigate('/profile');
    } else if (id === 'billing') {
      navigate('/billing');
    }
  };
  
  const sidebarClasses = isMobile
    ? "h-full w-full mobile-sidebar-inner animate-slide-right"
    : "h-screen fixed top-0 left-0 w-64 hidden md:flex flex-col animate-slide-right z-40 bg-[#0B0A0F] border-r border-[#33333359]";
  
  const content = (
    <div className="p-3 flex flex-col h-full justify-between">
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
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <Gamepad2 size={18} className="text-white" />
              </div>
              <span>Slots</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <Flame size={18} className="text-white" />
              </div>
              <span>Cassino Ao Vivo</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <Heart size={18} className="text-white" />
              </div>
              <span>Favoritos</span>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-gray-500 text-xs font-medium px-4 mb-2">Bônus</h3>
          <div className="space-y-1">
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <Gift size={18} className="text-green-500" />
              </div>
              <span>Código Promocional</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <Trophy size={18} className="text-white" />
              </div>
              <span>Programa de Fidelidade</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <Users size={18} className="text-white" />
              </div>
              <span>Programa de Indicação</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <CircleDollarSign size={18} className="text-white" />
              </div>
              <span>Loteria</span>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-gray-500 text-xs font-medium px-4 mb-2">Settings</h3>
          <div className="space-y-1">
            {settingsOptions.map((option) => (
              <div 
                key={option.id}
                className={`menu-item ${activeSettingsTab === option.id ? 'active' : ''}`}
                onClick={() => handleSettingsItemClick(option.id)}
              >
                <div className="bg-[#1A191F] p-1.5 rounded-md">
                  <option.icon size={18} className={activeSettingsTab === option.id ? "text-green-400" : "text-white"} />
                </div>
                <span>{option.label}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-gray-500 text-xs font-medium px-4 mb-2">Outros</h3>
          <div className="space-y-1">
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <BarChart3 size={18} className="text-white" />
              </div>
              <span>Estatísticas</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <Scale size={18} className="text-white" />
              </div>
              <span>Jogo Justo</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <LifeBuoy size={18} className="text-white" />
              </div>
              <span>Suporte</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-2 mt-auto">
        <div className="bg-[#22202a] rounded-md p-2 flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity">
          <div className="bg-[#1A191F] p-1 rounded-md">
            <Send size={18} className="text-gray-400" />
          </div>
          <span className="text-gray-300">Telegram</span>
        </div>
        
        <div className="bg-[#22202a] rounded-md p-2 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity">
          <div className="flex items-center gap-2">
            <div className="bg-[#1A191F] p-1 rounded-md">
              <Globe size={18} className="text-gray-400" />
            </div>
            <span className="text-gray-300">Português</span>
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
