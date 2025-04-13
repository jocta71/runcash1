
import { supabase } from './client';
import { toast } from '@/components/ui/use-toast';

export const seedRouletteNumbers = async () => {
  try {
    // Call the seed-roulette-numbers edge function
    const { data, error } = await supabase.functions.invoke('seed-roulette-numbers');
    
    if (error) {
      console.error('Error seeding roulette numbers:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar os números iniciais ao banco de dados.',
        variant: 'destructive',
      });
      return false;
    }
    
    console.log('Seed data response:', data);
    return true;
  } catch (error) {
    console.error('Error invoking seed function:', error);
    toast({
      title: 'Erro',
      description: 'Não foi possível conectar ao servidor.',
      variant: 'destructive',
    });
    return false;
  }
};
