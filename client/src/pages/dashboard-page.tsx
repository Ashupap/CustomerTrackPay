import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CustomerSummary } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, AlertCircle, Plus, Search, Eye, LogOut, Upload, CheckCircle, XCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<any>(null);
  const { toast } = useToast();

  const { data: customers, isLoading } = useQuery<CustomerSummary[]>({
    queryKey: ["/api/customers"],
  });

  const { data: kpiData } = useQuery<{
    totalPaid: number;
    totalOverdue: number;
  }>({
    queryKey: ["/api/kpi", filterPeriod],
  });

  const { data: upcomingPayments } = useQuery<any[]>({
    queryKey: ["/api/payments/upcoming"],
  });

  const { data: overdueData } = useQuery<{ count: number }>({
    queryKey: ["/api/payments/overdue-count"],
  });

  const filteredCustomers = customers?.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === "overdue") {
      return matchesSearch && parseFloat(customer.totalOverdue) > 0;
    }
    if (statusFilter === "upcoming") {
      return matchesSearch && customer.nextPaymentDate;
    }
    return matchesSearch;
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const importMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const response = await apiRequest("POST", "/api/customers/bulk-import", { csvData });
      return await response.json();
    },
    onSuccess: (data: any) => {
      setImportResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Import Completed",
        description: `${data.successCount} customers imported successfully, ${data.failedCount} failed.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import customers",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setImportResults(null);
    }
  };

  const handleImport = async () => {
    if (!csvFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvData = e.target?.result as string;
      importMutation.mutate(csvData);
    };
    reader.readAsText(csvFile);
  };

  const resetImport = () => {
    setCsvFile(null);
    setImportResults(null);
    setImportDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
                <DollarSign className="h-4 w-4 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-medium" data-testid="text-app-name">PayTrack</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground" data-testid="text-username">
                {user?.username}
              </span>
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-medium tracking-tight mb-2" data-testid="text-page-title">Dashboard</h2>
            <p className="text-base text-muted-foreground">Monitor your payment collections and customer accounts</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide">
                  Total Payments Received
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-4xl font-bold" data-testid="text-total-paid">
                      ${kpiData?.totalPaid.toLocaleString() ?? "0"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Collected from customers
                    </p>
                  </div>
                  <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                    <SelectTrigger className="w-32" data-testid="select-period-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-destructive/20">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide">
                  Total Overdue Amount
                </CardTitle>
                <div className="flex items-center gap-2">
                  {overdueData && overdueData.count > 0 && (
                    <Badge variant="destructive" data-testid="badge-overdue-count">
                      {overdueData.count} {overdueData.count === 1 ? 'payment' : 'payments'}
                    </Badge>
                  )}
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-destructive" data-testid="text-total-overdue">
                  ${kpiData?.totalOverdue.toLocaleString() ?? "0"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Requires immediate attention
                </p>
              </CardContent>
            </Card>
          </div>

          {upcomingPayments && upcomingPayments.length > 0 && (
            <Card className="shadow-md border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Upcoming Payments (Next 7 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="list-upcoming-payments">
                  {upcomingPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-background rounded-md border hover-elevate"
                      data-testid={`payment-upcoming-${payment.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/customers/${payment.customerId}`}
                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            data-testid={`link-customer-${payment.customerId}`}
                          >
                            {payment.customerName}
                          </Link>
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">{payment.product}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Due: {format(new Date(payment.dueDate), "MMM d, yyyy")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-lg" data-testid={`text-amount-${payment.id}`}>
                          ${parseFloat(payment.amount).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search customers..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-customers"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    <SelectItem value="upcoming">With Upcoming</SelectItem>
                    <SelectItem value="overdue">With Overdue</SelectItem>
                  </SelectContent>
                </Select>
                
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" data-testid="button-import-csv">
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Import Customers from CSV</DialogTitle>
                      <DialogDescription>
                        Upload a CSV file with customer data. Required columns: name. Optional: email, phone, company.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {!importResults ? (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">CSV File</label>
                            <Input
                              type="file"
                              accept=".csv"
                              onChange={handleFileChange}
                              data-testid="input-csv-file"
                            />
                            <p className="text-xs text-muted-foreground">
                              CSV format: name, email, phone, company (with headers)
                            </p>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={resetImport}
                              data-testid="button-cancel-import"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleImport}
                              disabled={!csvFile || importMutation.isPending}
                              data-testid="button-submit-import"
                            >
                              {importMutation.isPending ? "Importing..." : "Import"}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <Card>
                              <CardContent className="pt-6">
                                <div className="text-center">
                                  <div className="text-2xl font-bold">{importResults.total}</div>
                                  <div className="text-xs text-muted-foreground">Total Rows</div>
                                </div>
                              </CardContent>
                            </Card>
                            <Card className="border-green-200 bg-green-50">
                              <CardContent className="pt-6">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-green-700">{importResults.successCount}</div>
                                  <div className="text-xs text-green-600">Successful</div>
                                </div>
                              </CardContent>
                            </Card>
                            <Card className="border-red-200 bg-red-50">
                              <CardContent className="pt-6">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-red-700">{importResults.failedCount}</div>
                                  <div className="text-xs text-red-600">Failed</div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {importResults.results.failed.length > 0 && (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              <div className="text-sm font-medium">Failed Imports:</div>
                              {importResults.results.failed.map((failure: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-2 text-xs p-2 bg-red-50 rounded border border-red-200">
                                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <div className="font-medium">Row {failure.row}</div>
                                    <div className="text-muted-foreground">{failure.error}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex justify-end">
                            <Button onClick={resetImport} data-testid="button-close-results">
                              Close
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Button onClick={() => setLocation("/customers/new")} data-testid="button-add-customer">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              </div>
            </div>

            <Card className="shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase">Customer</TableHead>
                    <TableHead className="text-xs uppercase">Company</TableHead>
                    <TableHead className="text-xs uppercase">Contact</TableHead>
                    <TableHead className="text-xs uppercase">Next Payment</TableHead>
                    <TableHead className="text-xs uppercase">Amount Due</TableHead>
                    <TableHead className="text-xs uppercase">Overdue</TableHead>
                    <TableHead className="text-xs uppercase text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredCustomers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-sm text-muted-foreground">No customers found</p>
                          <Button variant="outline" size="sm" onClick={() => setLocation("/customers/new")}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add your first customer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers?.map((customer) => (
                      <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell className="text-sm">{customer.company || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {customer.email || customer.phone || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {customer.nextPaymentDate
                            ? format(new Date(customer.nextPaymentDate), "MMM dd, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {customer.nextPaymentAmount
                            ? `$${parseFloat(customer.nextPaymentAmount).toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {parseFloat(customer.totalOverdue) > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              ${parseFloat(customer.totalOverdue).toLocaleString()}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/customers/${customer.id}`}>
                            <Button variant="ghost" size="sm" data-testid={`button-view-${customer.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
