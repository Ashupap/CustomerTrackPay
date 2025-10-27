import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const purchases = sqliteTable("purchases", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  product: text("product").notNull(),
  purchaseDate: integer("purchase_date", { mode: "timestamp" }).notNull(),
  totalPrice: text("total_price").notNull(),
  paymentTerms: text("payment_terms").notNull(), // 'monthly', 'quarterly', 'yearly', 'one-time'
  initialPayment: text("initial_payment").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const insertPurchaseSchema = createInsertSchema(purchases, {
  purchaseDate: z.coerce.date(),
  totalPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  initialPayment: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
}).omit({
  id: true,
  createdAt: true,
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
});

export const insertPaymentSchema = createInsertSchema(payments, {
  dueDate: z.coerce.date(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format"),
  paidDate: z.coerce.date().optional().nullable(),
}).omit({
  id: true,
  createdAt: true,
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
