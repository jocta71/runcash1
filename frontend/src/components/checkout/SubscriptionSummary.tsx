import { Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plan } from '@/types/plans';

interface SubscriptionSummaryProps {
  plan: Plan;
}

export const SubscriptionSummary = ({ plan }: SubscriptionSummaryProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo da assinatura</CardTitle>
        <CardDescription>Detalhes do plano selecionado</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-medium">{plan.name}</h3>
          <p className="text-muted-foreground">{plan.description}</p>
        </div>
        
        <Separator />
        
        <div className="space-y-2">
          <h4 className="font-medium">Recursos incluídos:</h4>
          <ul className="space-y-1">
            {plan.features.map((feature, i) => (
              <li key={i} className="flex items-start text-sm">
                <Check className="h-4 w-4 mr-2 text-green-500 mt-1 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <Separator />
        
        <div className="flex items-center justify-between font-medium">
          <span>Total:</span>
          <span className="text-xl">
            {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2)}/mês`}
          </span>
        </div>
        
        <div className="text-sm text-muted-foreground">
          {plan.price > 0 && (
            <>
              <p>Pagamento mensal via PIX</p>
              <p>Cancele a qualquer momento</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 