import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { insertPurchaseSchema, InsertPurchase, Purchase, CustomerSummary } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ShoppingCart, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useEffect } from "react";

export default function PurchaseFormPage() {
  const [, globalNewParams] = useRoute("/purchases/new");
  const [, customerNewParams] = useRoute("/customers/:customerId/purchase/new");
  const [, editParams] = useRoute("/customers/:customerId/purchase/:purchaseId/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const params = editParams || customerNewParams;
  const customerId = params?.customerId;
  const purchaseId = editParams?.purchaseId;
  const isEdit = !!purchaseId;
  const isGlobalNew = !!globalNewParams;

  const { data: purchase } = useQuery<Purchase>({
    queryKey: ["/api/purchases", purchaseId],
    enabled: isEdit,
  });

  const { data: customers } = useQuery<CustomerSummary[]>({
    queryKey: ["/api/customers"],
    enabled: isGlobalNew,
  });

  const formSchema = isGlobalNew
    ? insertPurchaseSchema.refine((data) => data.customerId && data.customerId !== "", {
        message: "Please select a customer",
        path: ["customerId"],
      })
    : insertPurchaseSchema;

  const form = useForm<InsertPurchase>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: customerId || "",
      product: "",
      purchaseDate: new Date(),
      initialPayment: "",
      rentalAmount: "",
      rentalFrequency: "monthly",
    },
  });

  useEffect(() => {
    if (purchase && isEdit) {
      form.reset({
        customerId: purchase.customerId,
        product: purchase.product,
        purchaseDate: new Date(purchase.purchaseDate),
        initialPayment: purchase.initialPayment,
        rentalAmount: purchase.rentalAmount,
        rentalFrequency: purchase.rentalFrequency,
      });
    }
  }, [purchase, isEdit, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertPurchase) => {
      const res = await apiRequest("POST", "/api/purchases", data);
      return await res.json();
    },
    onSuccess: (_, variables) => {
      const targetCustomerId = variables.customerId;
      queryClient.invalidateQueries({ queryKey: ["/api/customers", targetCustomerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/this-month-upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/overdue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/overdue-count"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/kpi");
        }
      });
      toast({
        title: "Purchase added",
        description: "Purchase and payment schedule have been created successfully",
      });
      if (isGlobalNew) {
        setLocation("/");
      } else {
        setLocation(`/customers/${targetCustomerId}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create purchase",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertPurchase) => {
      const res = await apiRequest("PATCH", `/api/purchases/${purchaseId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/this-month-upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/overdue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/overdue-count"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/kpi");
        }
      });
      toast({
        title: "Purchase updated",
        description: "Purchase information has been updated successfully",
      });
      setLocation(`/customers/${customerId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update purchase",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertPurchase) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const hasNoCustomers = isGlobalNew && customers && customers.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
          <Link href={isGlobalNew ? "/" : `/customers/${customerId}`}>
            <Button variant="outline" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isGlobalNew ? "Back to Dashboard" : "Back to Customer"}
            </Button>
          </Link>

          {hasNoCustomers ? (
            <Card className="shadow-md">
              <CardContent className="pt-12 pb-12">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Customers Yet</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                    You need to add at least one customer before you can create a purchase.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button onClick={() => setLocation("/customers/new")} data-testid="button-add-first-customer">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Customer
                    </Button>
                    <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-back-to-dashboard">
                      Back to Dashboard
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl">
                  {isEdit ? "Edit Purchase" : "Add New Purchase"}
                </CardTitle>
                <CardDescription>
                  {isEdit 
                    ? "Update purchase and rental information"
                    : "Enter initial payment and recurring rental details"}
                </CardDescription>
              </CardHeader>
              <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {isGlobalNew && (
                    <FormField
                      control={form.control}
                      name="customerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-customer">
                                <SelectValue placeholder="Select a customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {customers && customers.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  No customers found. Please add a customer first.
                                </div>
                              ) : (
                                customers?.map((customer) => (
                                  <SelectItem key={customer.id} value={customer.id.toString()}>
                                    {customer.name} {customer.company ? `(${customer.company})` : ''}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>Choose which customer this purchase is for</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="product"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product / Service *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Website Development"
                            {...field}
                            data-testid="input-product"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value instanceof Date 
                              ? field.value.toISOString().split('T')[0]
                              : field.value}
                            data-testid="input-purchase-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="initialPayment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Payment *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="1000.00"
                            {...field}
                            data-testid="input-initial-payment"
                          />
                        </FormControl>
                        <FormDescription>Upfront one-time payment (can be zero)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rentalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rental Amount *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="500.00"
                            {...field}
                            data-testid="input-rental-amount"
                          />
                        </FormControl>
                        <FormDescription>Recurring rental payment amount</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rentalFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rental Frequency *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-rental-frequency">
                              <SelectValue placeholder="Select rental frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="one-time">One-time</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>How often rental payments are due</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setLocation(isGlobalNew ? "/" : `/customers/${customerId}`)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="w-full sm:flex-1"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-submit-purchase"
                    >
                      {(createMutation.isPending || updateMutation.isPending)
                        ? "Saving..."
                        : isEdit
                        ? "Update Purchase"
                        : "Create Purchase"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </div>
  );
}
