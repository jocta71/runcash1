import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Check } from 'lucide-react';
import { Plan } from '@/types/plans';

interface PaymentSummaryProps {
  plan: Plan;
}

export function PaymentSummary({ plan }: PaymentSummaryProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const formatInterval = (interval: string) => {
    switch (interval) {
      case 'monthly':
        return '/mês';
      case 'annual':
        return '/ano';
      default:
        return '';
    }
  };

  return (
    <Card className="bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Resumo do plano</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-xl font-bold">{plan.name}</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{plan.description}</p>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Valor</span>
            <span className="font-semibold">
              {formatPrice(plan.price)} <span className="text-sm font-normal text-gray-500">{formatInterval(plan.interval)}</span>
            </span>
          </div>
        </div>
        
        <Separator className="my-2" />
        
        <div className="flex justify-between items-center font-semibold text-lg">
          <span>Total</span>
          <span>{formatPrice(plan.price)}</span>
        </div>
        
        <div className="mt-4 space-y-2">
          <h4 className="font-medium">Inclui:</h4>
          <ul className="space-y-2">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
} 