import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Esquema de validação do formulário
const formSchema = z.object({
  name: z.string().min(3, { message: 'Nome completo é obrigatório' }),
  email: z.string().email({ message: 'E-mail inválido' }),
  cpf: z.string().min(11, { message: 'CPF inválido' }).max(14),
  phone: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CheckoutFormProps {
  defaultValues?: {
    name?: string;
    email?: string;
    cpf?: string;
    phone?: string;
  };
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function CheckoutForm({ defaultValues, onSubmit, onCancel, isSubmitting }: CheckoutFormProps) {
  const [isTouched, setIsTouched] = useState(false);

  // Inicializar formulário com react-hook-form + zod
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues?.name || '',
      email: defaultValues?.email || '',
      cpf: defaultValues?.cpf || '',
      phone: defaultValues?.phone || '',
    },
  });

  // Funções de formatação
  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  // Manipuladores de eventos
  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (...event: any[]) => void) => {
    const formatted = formatCPF(e.target.value);
    onChange(formatted);
    setIsTouched(true);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (...event: any[]) => void) => {
    const formatted = formatPhone(e.target.value);
    onChange(formatted);
    setIsTouched(true);
  };

  const handleInputChange = () => {
    setIsTouched(true);
  };

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit(data);
  };

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)}>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-xl font-semibold mb-4">Informações pessoais</h2>
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Seu nome completo" 
                      disabled={isSubmitting}
                      onChange={(e) => {
                        field.onChange(e);
                        handleInputChange();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="email" 
                      placeholder="seu@email.com" 
                      disabled={isSubmitting}
                      onChange={(e) => {
                        field.onChange(e);
                        handleInputChange();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="000.000.000-00" 
                      maxLength={14}
                      disabled={isSubmitting}
                      onChange={(e) => handleCPFChange(e, field.onChange)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="(00) 00000-0000" 
                      maxLength={15}
                      disabled={isSubmitting}
                      onChange={(e) => handlePhoneChange(e, field.onChange)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          
          <CardFooter className="flex justify-between space-x-4 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-full"
            >
              Cancelar
            </Button>
            
            <Button 
              type="submit" 
              disabled={isSubmitting || (!isTouched && !form.formState.isDirty)} 
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Continuar para pagamento'
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
} 