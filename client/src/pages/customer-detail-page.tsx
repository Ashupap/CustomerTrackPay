import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { CustomerWithPurchases, Payment } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Check, Mail, Phone, Building2, DollarSign, Package, Calendar, Edit2 } from "lucide-react";
import { format, isPast, isFuture, startOfDay } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

function PaymentEditDialog({ payment, onSuccess }: { payment: Payment; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(payment.amount);
  const [dueDate, setDueDate] = useState(format(new Date(payment.dueDate), "yyyy-MM-dd"));
  const { toast } = useToast();

  const editMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/payments/${payment.id}`, {
        amount,
        dueDate: new Date(dueDate),
      });
    },
    onSuccess: () => {
      setOpen(false);
      onSuccess();
      toast({
        title: "Payment updated",
        description: "Payment details have been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" data-testid={`button-edit-payment-${payment.id}`}>
          <Edit2 className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Payment</DialogTitle>
          <DialogDescription>
            Update payment amount and due date
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-payment-amount"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              data-testid="input-payment-due-date"
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending}
              data-testid="button-save-payment"
            >
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CustomerDetailPage() {
  const [, params] = useRoute("/customers/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const customerId = params?.id;

  const { data: customer, isLoading } = useQuery<CustomerWithPurchases>({
    queryKey: ["/api/customers", customerId],
    enabled: !!customerId,
  });

  const markPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      await apiRequest("PATCH", `/api/payments/${paymentId}/mark-paid`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith("/api/kpi");
        }
      });
      toast({
        title: "Payment marked as paid",
        description: "Payment status has been updated successfully",
      });
    },
  });

  const getPaymentStatus = (payment: Payment): "paid" | "overdue" | "upcoming" => {
    if (payment.status === "paid") return "paid";
    // Use startOfDay to normalize dates to midnight for proper comparison
    // This prevents payments due today from being marked as overdue
    const today = startOfDay(new Date());
    const dueDate = startOfDay(new Date(payment.dueDate));
    if (dueDate < today && payment.status !== "paid") return "overdue";
    return "upcoming";
  };

  const getStatusBadge = (status: "paid" | "overdue" | "upcoming") => {
    if (status === "paid") {
      return <Badge className="text-xs bg-chart-2/20 text-chart-2 border-chart-2/30">Paid</Badge>;
    }
    if (status === "overdue") {
      return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Upcoming</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Customer not found</p>
            <Button onClick={() => setLocation("/")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="outline" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <Button onClick={() => setLocation(`/customers/${customerId}/purchase/new`)} data-testid="button-add-purchase">
              <Plus className="h-4 w-4 mr-2" />
              Add Purchase
            </Button>
          </div>

          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl" data-testid="text-customer-name">{customer.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Customer Information</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setLocation(`/customers/${customerId}/edit`)}
                  data-testid="button-edit-customer"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customer.company && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Company</p>
                      <p className="text-sm font-medium">{customer.company}</p>
                    </div>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                      <p className="text-sm font-medium">{customer.email}</p>
                    </div>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Phone</p>
                      <p className="text-sm font-medium">{customer.phone}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-xl font-medium">Purchase History</h3>
            
            {customer.purchases.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-sm text-muted-foreground mb-4">No purchases recorded yet</p>
                  <Button
                    variant="outline"
                    onClick={() => setLocation(`/customers/${customerId}/purchase/new`)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Purchase
                  </Button>
                </CardContent>
              </Card>
            ) : (
              customer.purchases.map((purchase) => (
                <Card key={purchase.id} className="shadow-sm" data-testid={`card-purchase-${purchase.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Package className="h-5 w-5 text-muted-foreground" />
                          {purchase.product}
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(purchase.purchaseDate), "MMM dd, yyyy")}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Initial: ${parseFloat(purchase.initialPayment).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Rental: ${parseFloat(purchase.rentalAmount).toLocaleString()} {purchase.rentalFrequency}
                          </span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setLocation(`/customers/${customerId}/purchase/${purchase.id}/edit`)}
                        data-testid={`button-edit-purchase-${purchase.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold uppercase tracking-wide">Payment Timeline</h4>
                      <div className="space-y-2">
                        {purchase.payments.map((payment, index) => {
                          const status = getPaymentStatus(payment);
                          return (
                            <div
                              key={payment.id}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md bg-muted/50"
                              data-testid={`payment-${payment.id}`}
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background text-xs font-medium shrink-0">
                                  {index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium">
                                    ${parseFloat(payment.amount).toLocaleString()}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Due: {format(new Date(payment.dueDate), "MMM dd, yyyy")}
                                  </p>
                                  {payment.paidDate && (
                                    <p className="text-xs text-chart-2">
                                      Paid: {format(new Date(payment.paidDate), "MMM dd, yyyy")}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {getStatusBadge(status)}
                                {status !== "paid" && (
                                  <>
                                    <PaymentEditDialog 
                                      payment={payment}
                                      onSuccess={() => {
                                        queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId] });
                                        queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
                                        queryClient.invalidateQueries({ 
                                          predicate: (query) => {
                                            const key = query.queryKey[0] as string;
                                            return key?.startsWith("/api/kpi");
                                          }
                                        });
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => markPaymentMutation.mutate(payment.id)}
                                      disabled={markPaymentMutation.isPending}
                                      data-testid={`button-mark-paid-${payment.id}`}
                                    >
                                      <span className="hidden sm:inline">Mark Paid</span>
                                      <span className="sm:hidden">Paid</span>
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
