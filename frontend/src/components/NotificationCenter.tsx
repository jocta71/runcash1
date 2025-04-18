import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Check, X, AlertCircle, Info, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

// Tipos de notificação que serão exibidos
export type NotificationType = 'all' | 'payment' | 'subscription' | 'system';

// Interface para notificações
export interface UserNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
  notification_type?: NotificationType;
}

// Componente principal do centro de notificações
const NotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<NotificationType>('all');
  
  const { user } = useAuth();
  
  // Função para buscar notificações do servidor
  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const response = await api.get('/api/user-notifications');
      
      if (response.data?.notifications) {
        setNotifications(response.data.notifications);
        
        // Contar notificações não lidas
        const unread = response.data.notifications.filter(
          (notif: UserNotification) => !notif.read
        ).length;
        
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Marcar notificação como lida
  const markAsRead = async (notificationId: string) => {
    try {
      await api.post(`/api/mark-notification-read`, {
        notificationId
      });
      
      // Atualizar estado local
      setNotifications(prevNotifications => 
        prevNotifications.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true } 
            : notif
        )
      );
      
      // Atualizar contador de não lidas
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };
  
  // Marcar todas como lidas
  const markAllAsRead = async () => {
    try {
      await api.post(`/api/mark-all-notifications-read`);
      
      // Atualizar estado local
      setNotifications(prevNotifications => 
        prevNotifications.map(notif => ({ ...notif, read: true }))
      );
      
      // Zerar contador
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
    }
  };
  
  // Deletar notificação
  const deleteNotification = async (notificationId: string) => {
    try {
      await api.delete(`/api/delete-notification/${notificationId}`);
      
      // Remover do estado local
      setNotifications(prevNotifications => 
        prevNotifications.filter(notif => notif.id !== notificationId)
      );
      
      // Atualizar contador se necessário
      const wasUnread = notifications.find(n => n.id === notificationId && !n.read);
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Erro ao excluir notificação:', error);
    }
  };
  
  // Carregar notificações quando o componente montar ou quando o usuário mudar
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);
  
  // Recarregar notificações quando o popover abrir
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);
  
  // Filtrar notificações com base na aba selecionada
  const filteredNotifications = notifications.filter(notification => {
    if (selectedTab === 'all') return true;
    
    // Classificar notificações com base no título ou conteúdo
    const isPayment = 
      notification.title.toLowerCase().includes('pagamento') || 
      notification.message.toLowerCase().includes('pagamento');
      
    const isSubscription = 
      notification.title.toLowerCase().includes('assinatura') || 
      notification.message.toLowerCase().includes('assinatura') ||
      notification.title.toLowerCase().includes('plano') || 
      notification.message.toLowerCase().includes('plano');
    
    if (selectedTab === 'payment' && isPayment) return true;
    if (selectedTab === 'subscription' && isSubscription) return true;
    if (selectedTab === 'system' && !isPayment && !isSubscription) return true;
    
    return false;
  });
  
  // Função auxiliar para renderizar o ícone apropriado para cada tipo de notificação
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-vegas-gold" />;
    }
  };
  
  // Formatar data relativa
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s atrás`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m atrás`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h atrás`;
    
    return `${Math.floor(diffInSeconds / 86400)}d atrás`;
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative p-0">
          <div className={cn(
            "relative",
            unreadCount > 0 && "animate-bell-shake"
          )}>
            {unreadCount > 0 ? <BellRing className="h-5 w-5 text-vegas-gold" /> : <Bell className="h-5 w-5" />}
            
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-vegas-gold text-[10px] font-bold text-black">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 md:w-96 p-0" align="end">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="font-semibold text-lg">Notificações</h3>
          
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead} 
              className="text-xs h-7 px-2 text-vegas-gold hover:text-vegas-gold/80"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        
        <Tabs 
          defaultValue="all" 
          value={selectedTab} 
          onValueChange={(v) => setSelectedTab(v as NotificationType)}
          className="w-full"
        >
          <TabsList className="grid grid-cols-4 p-1 m-2 bg-gray-800/50">
            <TabsTrigger value="all" className="text-xs">
              Todas
            </TabsTrigger>
            <TabsTrigger value="subscription" className="text-xs">
              Assinaturas
            </TabsTrigger>
            <TabsTrigger value="payment" className="text-xs">
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs">
              Sistema
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value={selectedTab} className="mt-0">
            <ScrollArea className="h-[300px]">
              {loading ? (
                <div className="flex justify-center items-center h-[200px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vegas-gold"></div>
                </div>
              ) : filteredNotifications.length > 0 ? (
                <div className="divide-y divide-gray-700">
                  {filteredNotifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={cn(
                        "p-3 hover:bg-gray-800/50 flex items-start gap-3",
                        !notification.read && "bg-gray-800/30"
                      )}
                    >
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(notification.created_at)}
                            </span>
                            
                            {!notification.read && (
                              <Badge variant="outline" className="h-4 ml-1 px-1 text-[9px] bg-vegas-gold/20 text-vegas-gold border-vegas-gold/30">
                                Novo
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-xs text-gray-300 mt-1">{notification.message}</p>
                        
                        <div className="flex justify-end mt-2 gap-2">
                          {!notification.read && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 text-[10px]"
                              onClick={() => markAsRead(notification.id)}
                            >
                              Marcar como lida
                            </Button>
                          )}
                          
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[200px] text-center p-4">
                  <Bell className="h-12 w-12 text-gray-500 mb-3 opacity-25" />
                  <p className="text-gray-400">Nenhuma notificação disponível</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter; 