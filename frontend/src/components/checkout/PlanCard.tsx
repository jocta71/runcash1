import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plan } from '@/types/plans';

interface PlanCardProps {
  plan: Plan;
  isSelected: boolean;
  onSelect: (plan: Plan) => void;
}

export const PlanCard = ({ plan, isSelected, onSelect }: PlanCardProps) => {
  const isPremium = plan.id === 'premium';
  
  return (
    <Card 
      className={`overflow-hidden transition-all hover:shadow-md ${
        isSelected ? 'border-primary ring-2 ring-primary' : ''
      }`}
    >
      <CardHeader className={`${isPremium ? 'bg-primary text-white' : ''}`}>
        <CardTitle>{plan.name}</CardTitle>
        <CardDescription className={isPremium ? 'text-white/90' : ''}>
          {plan.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="mb-4">
          <span className="text-3xl font-bold">
            {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2)}`}
          </span>
          {plan.price > 0 && <span className="text-muted-foreground">/mês</span>}
        </div>
        
        <ul className="space-y-2 mb-6">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start">
              <Check className="h-4 w-4 mr-2 text-green-500 mt-1 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={() => onSelect(plan)} 
          className="w-full" 
          variant={isPremium ? 'default' : 'outline'}
        >
          {isSelected ? 'Selecionado' : `Escolher ${plan.name}`}
        </Button>
      </CardFooter>
    </Card>
  );
}; 