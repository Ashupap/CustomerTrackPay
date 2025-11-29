import { pgTable, text, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // 'admin' or 'user'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"), // null for first admin, otherwise admin who created
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const createUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "user"]),
}).pick({
  username: true,
  password: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type User = typeof users.$inferSelect;

// Safe user type without password for frontend
export type SafeUser = Omit<User, "password">;

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(), // Owner user
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by").notNull(), // User who created this entry
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  userId: true,
  createdAt: true,
  createdBy: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  product: text("product").notNull(),
  purchaseDate: integer("purchase_date", { mode: "timestamp" }).notNull(),
  initialPayment: text("initial_payment").notNull(),
  rentalAmount: text("rental_amount").notNull(),
  rentalFrequency: text("rental_frequency").notNull(), // 'monthly', 'quarterly', 'yearly', 'one-time'
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  createdBy: text("created_by").notNull(), // User who created this entry
});

export const insertPurchaseSchema = createInsertSchema(purchases, {
  purchaseDate: z.coerce.date(),
  initialPayment: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  rentalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
}).omit({
  id: true,
  createdAt: true,
  createdBy: true,
});

export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  purchaseId: text("purchase_id").notNull(),
  amount: text("amount").notNull(),
  dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
  status: text("status").notNull(), // 'paid', 'upcoming', 'overdue'
  paidDate: integer("paid_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  createdBy: text("created_by").notNull(), // User who created this entry
  markedPaidBy: text("marked_paid_by"), // User who marked this as paid
});

export const insertPaymentSchema = createInsertSchema(payments, {
  dueDate: z.coerce.date(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format"),
  paidDate: z.coerce.date().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
  createdBy: true,
  markedPaidBy: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Combined types for API responses
export type CustomerWithPurchases = Customer & {
  purchases: (Purchase & {
    payments: Payment[];
  })[];
};

export type CustomerSummary = Customer & {
  nextPaymentDate: string | null;
  nextPaymentAmount: string | null;
  totalOverdue: string;
  totalPaid: string;
};

// Admin activity log entry for tracking user actions
export type ActivityLogEntry = {
  id: string;
  type: 'customer_created' | 'purchase_created' | 'payment_marked_paid' | 'customer_updated' | 'purchase_updated' | 'payment_updated';
  entityId: string;
  entityName: string;
  userId: string;
  username: string;
  details: string;
  createdAt: Date;
};

// User with activity stats for admin dashboard
export type UserWithStats = SafeUser & {
  customersCreated: number;
  purchasesCreated: number;
  paymentsMarked: number;
};
