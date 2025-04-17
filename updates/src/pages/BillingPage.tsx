import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Check } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const BillingPage = () => {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState('standard');

  const handleSubscribe = (plan: string) => {
    setSelectedPlan(plan);
    toast({
      title: "Subscription updated",
      description: `You've successfully subscribed to the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan.`,
      variant: "default"
    });
  };

  return (
    <div className="flex min-h-screen bg-[#22c55e0d]">
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>
      
      <div className="flex-1 p-6 md:p-10 overflow-auto">
        <div className="max-w-4xl mx-auto bg-[#1A191F] rounded-xl p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold mb-6 text-white">Billing</h1>
          
          <Tabs defaultValue="subscription" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[#111118] border border-[#33333359]">
              <TabsTrigger value="subscription" className="data-[state=active]:bg-white data-[state=active]:text-black">
                Subscription
              </TabsTrigger>
              <TabsTrigger value="payment-methods" className="data-[state=active]:bg-white data-[state=active]:text-black">
                Payment Methods
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="subscription" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Basic Plan */}
                <div className={`rounded-lg border ${selectedPlan === 'basic' ? 'border-white' : 'border-[#33333359]'} p-4 flex flex-col`}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Basic</h3>
                    {selectedPlan === 'basic' && (
                      <span className="bg-white text-black text-xs px-2 py-1 rounded-full">Current Plan</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold mb-2">$9.99<span className="text-sm font-normal text-gray-400">/month</span></div>
                  <ul className="mb-6 flex-grow space-y-2">
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      Basic features
                    </li>
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      Limited access
                    </li>
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      Email support
                    </li>
                  </ul>
                  <Button 
                    variant={selectedPlan === 'basic' ? 'outline' : 'default'}
                    className={selectedPlan === 'basic' ? 
                      'border-white text-white hover:bg-white hover:text-black' : 
                      'bg-white text-black hover:bg-gray-200'}
                    onClick={() => handleSubscribe('basic')}
                  >
                    {selectedPlan === 'basic' ? 'Current Plan' : 'Subscribe'}
                  </Button>
                </div>
                
                {/* Standard Plan */}
                <div className={`rounded-lg border ${selectedPlan === 'standard' ? 'border-white' : 'border-[#33333359]'} p-4 flex flex-col relative overflow-hidden`}>
                  <div className="absolute -right-8 top-4 bg-white text-black text-xs px-8 py-1 rotate-45">
                    Popular
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Standard</h3>
                    {selectedPlan === 'standard' && (
                      <span className="bg-white text-black text-xs px-2 py-1 rounded-full">Current Plan</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold mb-2">$19.99<span className="text-sm font-normal text-gray-400">/month</span></div>
                  <ul className="mb-6 flex-grow space-y-2">
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      All basic features
                    </li>
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      Premium access
                    </li>
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      Priority support
                    </li>
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      Advanced analytics
                    </li>
                  </ul>
                  <Button 
                    variant={selectedPlan === 'standard' ? 'outline' : 'default'}
                    className={selectedPlan === 'standard' ? 
                      'border-white text-white hover:bg-white hover:text-black' : 
                      'bg-white text-black hover:bg-gray-200'}
                    onClick={() => handleSubscribe('standard')}
                  >
                    {selectedPlan === 'standard' ? 'Current Plan' : 'Subscribe'}
                  </Button>
                </div>
                
                {/* Premium Plan */}
                <div className={`rounded-lg border ${selectedPlan === 'premium' ? 'border-white' : 'border-[#33333359]'} p-4 flex flex-col`}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Premium</h3>
                    {selectedPlan === 'premium' && (
                      <span className="bg-white text-black text-xs px-2 py-1 rounded-full">Current Plan</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold mb-2">$49.99<span className="text-sm font-normal text-gray-400">/month</span></div>
                  <ul className="mb-6 flex-grow space-y-2">
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      All standard features
                    </li>
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      Unlimited access
                    </li>
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      24/7 support
                    </li>
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      Custom solutions
                    </li>
                    <li className="flex items-center text-sm">
                      <Check size={16} className="mr-2 text-green-500" />
                      Dedicated account manager
                    </li>
                  </ul>
                  <Button 
                    variant={selectedPlan === 'premium' ? 'outline' : 'default'}
                    className={selectedPlan === 'premium' ? 
                      'border-white text-white hover:bg-white hover:text-black' : 
                      'bg-white text-black hover:bg-gray-200'}
                    onClick={() => handleSubscribe('premium')}
                  >
                    {selectedPlan === 'premium' ? 'Current Plan' : 'Subscribe'}
                  </Button>
                </div>
              </div>
              
              {/* Billing History */}
              <div className="mt-8 p-4 bg-[#111118] border border-[#33333359] rounded-lg">
                <h3 className="text-lg font-bold mb-4">Billing History</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm pb-2 border-b border-[#33333359]">
                    <div className="flex items-center">
                      <CreditCard className="mr-2 text-green-500" size={16} />
                      <span>April 13, 2025</span>
                    </div>
                    <div>
                      <span className="bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded-full mr-2">Paid</span>
                      <span>$19.99</span>
                    </div>
                  </div>
                  {/* Similar changes for other billing history items */}
                </div>
              </div>
            </TabsContent>
            
            {/* Payment Methods Section */}
            <TabsContent value="payment-methods" className="mt-6">
              <div className="space-y-6">
                <div className="p-4 bg-[#111118] border border-[#33333359] rounded-lg">
                  <h3 className="text-lg font-bold mb-4">Payment Methods</h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 border border-[#33333359] rounded-lg">
                      <div className="flex items-center">
                        <div className="h-8 w-12 bg-[#1A191F] rounded-md mr-3 flex items-center justify-center">
                          <CreditCard className="text-green-500" size={20} />
                        </div>
                        <div>
                          <p className="font-medium">•••• •••• •••• 4242</p>
                          <p className="text-xs text-gray-400">Expires 10/28</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="bg-green-500/10 text-green-500 text-xs px-2 py-1 rounded-full">Default</span>
                        <Button variant="outline" size="sm" className="border-[#33333359] text-white hover:bg-[#33333359]">
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button className="bg-white text-black hover:bg-gray-200">
                      <CreditCard className="mr-2" size={16} />
                      Add New Payment Method
                    </Button>
                  </div>
                </div>
                
                {/* Billing Address Section */}
                <div className="p-4 bg-[#111118] border border-[#33333359] rounded-lg">
                  <h3 className="text-lg font-bold mb-4">Billing Address</h3>
                  
                  <div className="space-y-2 mb-4">
                    <p>Washim Chowdhury</p>
                    <p>123 Main Street</p>
                    <p>New York, NY 10001</p>
                    <p>United States</p>
                  </div>
                  
                  <Button variant="outline" className="border-white text-white hover:bg-white hover:text-black">
                    Edit Billing Address
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
