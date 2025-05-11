import { useState, useEffect } from 'react';
import { LifeBuoy, ChevronDown, Gamepad2, Globe, Send, X, Settings, CreditCard, Package, Key, ChevronRight } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

const Sidebar = ({ isOpen = false, onClose, isMobile = false }: SidebarProps) => {
  const [otherExpanded, setOtherExpanded] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('account-information');
  const [isRoulettesActive, setIsRoulettesActive] = useState(true);
  const [contaExpanded, setContaExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    const pathname = location.pathname;
    
    // Verifica se está na página inicial
    if (pathname === '/' || pathname === '') {
      setIsRoulettesActive(true);
    } else {
      setIsRoulettesActive(false);
    }
    
    // Atualiza a tab de configurações ativa
    if (pathname.includes('/profile') && !pathname.includes('/billing')) {
      setActiveSettingsTab('account-information');
      setContaExpanded(true);
    } else if (pathname.includes('/billing')) {
      setActiveSettingsTab('billing');
      setContaExpanded(true);
    } else if (pathname.includes('/planos')) {
      setActiveSettingsTab('plans');
    } else if (pathname.includes('/gerenciar-chaves')) {
      setActiveSettingsTab('api-keys');
      setContaExpanded(true);
    }
  }, [location.pathname]);
  
  const contaSubitems = [
    { id: 'account-information', label: 'Meu Perfil', icon: Settings },
    { id: 'billing', label: 'Pagamentos', icon: CreditCard },
    { id: 'api-keys', label: 'Chaves API', icon: Key },
  ];
  
  const settingsOptions = [
    { id: 'conta', label: 'Conta', icon: Settings, hasSubitems: true },
    { id: 'plans', label: 'Planos', icon: Package },
  ];
  
  const handleSettingsItemClick = (id: string) => {
    if (id === 'conta') {
      setContaExpanded(!contaExpanded);
      return;
    }
    
    setActiveSettingsTab(id);
    setIsRoulettesActive(false);
    
    if (id === 'plans') {
      navigate('/planos');
    }
  };
  
  const handleContaSubitemClick = (id: string) => {
    setActiveSettingsTab(id);
    setIsRoulettesActive(false);
    
    if (id === 'account-information') {
      navigate('/profile');
    } else if (id === 'billing') {
      navigate('/profile/billing');
    } else if (id === 'api-keys') {
      navigate('/gerenciar-chaves');
    }
  };
  
  const otherOptions = [
    { id: 'support', label: 'Suporte', icon: LifeBuoy, path: '/suporte' },
  ];
  
  const handleOtherItemClick = (path: string) => {
    setIsRoulettesActive(false);
    navigate(path);
  };
  
  const handleRouletteClick = () => {
    setIsRoulettesActive(true);
    setActiveSettingsTab('');
    navigate('/');
  };
  
  const sidebarClassName = isMobile
    ? "h-screen fixed top-0 left-0 w-full md:w-64 flex flex-col z-40 bg-vegas-darkbg border-r border-border overflow-auto"
    : "h-screen fixed top-0 left-0 w-64 hidden md:flex flex-col animate-slide-right z-40 bg-vegas-darkbg border-r border-border";
  
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
            <div 
              className={`menu-item ${isRoulettesActive ? 'active' : ''}`}
              onClick={handleRouletteClick}
            >
              <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                <Gamepad2 size={18} className={isRoulettesActive ? "text-[#00FF00]" : "text-white"} />
              </div>
              <span className="truncate">Roletas</span>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-gray-500 text-xs font-medium px-4 mb-2">Configurações</h3>
          <div className="space-y-1">
            {settingsOptions.map((option) => (
              <div key={option.id}>
                <div 
                  className={`menu-item ${option.id === 'conta' && contaExpanded ? 'active' : ''}`}
                  onClick={() => handleSettingsItemClick(option.id)}
                >
                  <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                    <option.icon size={18} className={option.id === 'conta' && contaExpanded ? "text-[#00FF00]" : "text-white"} />
                  </div>
                  <span className="truncate">{option.label}</span>
                  {option.hasSubitems && (
                    <ChevronRight size={16} className={`ml-auto transform transition-transform ${contaExpanded ? 'rotate-90' : ''}`} />
                  )}
                </div>
                
                {option.id === 'conta' && contaExpanded && (
                  <div className="ml-8 space-y-1 mt-1">
                    {contaSubitems.map(subitem => (
                      <div 
                        key={subitem.id}
                        className={`menu-item-sub ${activeSettingsTab === subitem.id ? 'active' : ''}`}
                        onClick={() => handleContaSubitemClick(subitem.id)}
                      >
                        <div className="bg-[#1A191F] p-1.5 rounded-md flex-shrink-0">
                          <subitem.icon size={16} className={activeSettingsTab === subitem.id ? "text-[#00FF00]" : "text-white"} />
                        </div>
                        <span className="truncate text-sm">{subitem.label}</span>
                      </div>
                    ))}
                  </div>
                )}
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
        <div className={sidebarClassName} onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }
  
  return (
    <div className={sidebarClassName}>
      {content}
    </div>
  );
};

export default Sidebar;