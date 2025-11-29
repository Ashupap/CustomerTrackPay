import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Users, 
  Activity, 
  UserPlus, 
  Trash2, 
  Key,
  Shield,
  User as UserIcon,
  Moon,
  Sun,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/theme-provider";
import type { UserWithStats, ActivityLogEntry, CustomerSummary } from "@shared/schema";

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: roleData, isLoading: roleLoading } = useQuery<{ role: string; isAdmin: boolean }>({
    queryKey: ["/api/user/role"],
  });

  const { data: users, isLoading: usersLoading } = useQuery<UserWithStats[]>({
    queryKey: ["/api/admin/users"],
    enabled: roleData?.isAdmin === true,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/admin/activity"],
    enabled: roleData?.isAdmin === true,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: allCustomers, isLoading: customersLoading } = useQuery<CustomerSummary[]>({
    queryKey: ["/api/admin/customers"],
    enabled: roleData?.isAdmin === true,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; role: string }) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setNewUserDialogOpen(false);
      toast({
        title: "User created",
        description: "The new user has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "User deleted",
        description: "The user has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      await apiRequest("POST", `/api/admin/users/${userId}/reset-password`, { newPassword });
    },
    onSuccess: () => {
      setResetPasswordDialogOpen(false);
      setSelectedUserId(null);
      setNewPassword("");
      toast({
        title: "Password reset",
        description: "The user's password has been reset successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createUserMutation.mutate({
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      role: formData.get("role") as string,
    });
  };

  const handleResetPassword = () => {
    if (selectedUserId && newPassword.length >= 6) {
      resetPasswordMutation.mutate({ userId: selectedUserId, newPassword });
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!roleData?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access this page. Admin privileges are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} data-testid="button-go-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg sm:text-xl font-semibold truncate">Admin Panel</h1>
            <Badge variant="secondary" className="hidden sm:flex">
              <Shield className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-6xl mx-auto">
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2 hidden sm:inline" />
              Users
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">
              <Activity className="h-4 w-4 mr-2 hidden sm:inline" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="customers" data-testid="tab-customers">
              <UserIcon className="h-4 w-4 mr-2 hidden sm:inline" />
              All Customers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Manage system users and their permissions</CardDescription>
                </div>
                <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-user">
                      <UserPlus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Add User</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                      <DialogDescription>
                        Add a new user to the system with specific permissions.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateUser}>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">Username</Label>
                          <Input
                            id="username"
                            name="username"
                            placeholder="Enter username"
                            required
                            minLength={3}
                            data-testid="input-new-username"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Enter password"
                            required
                            minLength={6}
                            data-testid="input-new-password"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Select name="role" defaultValue="user">
                            <SelectTrigger data-testid="select-role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="submit"
                          disabled={createUserMutation.isPending}
                          data-testid="button-create-user"
                        >
                          {createUserMutation.isPending ? "Creating..." : "Create User"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="hidden sm:table-cell">Created</TableHead>
                          <TableHead className="hidden md:table-cell">Customers</TableHead>
                          <TableHead className="hidden md:table-cell">Purchases</TableHead>
                          <TableHead className="hidden lg:table-cell">Payments Marked</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users?.map((u) => (
                          <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                            <TableCell className="font-medium">{u.username}</TableCell>
                            <TableCell>
                              <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                                {u.role === "admin" ? (
                                  <>
                                    <Shield className="h-3 w-3 mr-1" />
                                    Admin
                                  </>
                                ) : (
                                  <>
                                    <UserIcon className="h-3 w-3 mr-1" />
                                    User
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {format(new Date(u.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{u.customersCreated}</TableCell>
                            <TableCell className="hidden md:table-cell">{u.purchasesCreated}</TableCell>
                            <TableCell className="hidden lg:table-cell">{u.paymentsMarked}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedUserId(u.id);
                                    setResetPasswordDialogOpen(true);
                                  }}
                                  data-testid={`button-reset-password-${u.id}`}
                                >
                                  <Key className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={u.id === user?.id}
                                      data-testid={`button-delete-user-${u.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete User</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete user "{u.username}"? This will also delete all their customers, purchases, and payments.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteUserMutation.mutate(u.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        data-testid="button-confirm-delete"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reset Password</DialogTitle>
                  <DialogDescription>
                    Enter a new password for this user. They will need to use this password to log in.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Enter new password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={6}
                      data-testid="input-reset-password"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleResetPassword}
                    disabled={newPassword.length < 6 || resetPasswordMutation.isPending}
                    data-testid="button-confirm-reset-password"
                  >
                    {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>Recent actions by all users in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {activitiesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : activities && activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                        data-testid={`activity-${activity.id}`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {activity.type === "customer_created" && (
                            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                              <UserIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                          )}
                          {activity.type === "purchase_created" && (
                            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                              <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                          )}
                          {activity.type === "payment_marked_paid" && (
                            <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                              <Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{activity.createdByUsername}</span>
                            {" "}
                            {activity.type === "customer_created" && "created customer"}
                            {activity.type === "purchase_created" && "created purchase"}
                            {activity.type === "payment_marked_paid" && "marked payment as paid"}
                            {" "}
                            <span className="text-muted-foreground">"{activity.entityName}"</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(activity.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No activity recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Customers</CardTitle>
                <CardDescription>View all customers across all users</CardDescription>
              </CardHeader>
              <CardContent>
                {customersLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : allCustomers && allCustomers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden sm:table-cell">Company</TableHead>
                          <TableHead className="hidden md:table-cell">Email</TableHead>
                          <TableHead>Overdue</TableHead>
                          <TableHead>Total Paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allCustomers.map((customer) => (
                          <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                            <TableCell className="font-medium">{customer.name}</TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              {customer.company || "-"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {customer.email || "-"}
                            </TableCell>
                            <TableCell>
                              {parseFloat(customer.totalOverdue) > 0 ? (
                                <Badge variant="destructive">
                                  ${parseFloat(customer.totalOverdue).toFixed(2)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-green-600 dark:text-green-400 font-medium">
                              ${parseFloat(customer.totalPaid).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No customers found.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
