import {
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Purchase,
  type InsertPurchase,
  type Payment,
  type InsertPayment,
  type CustomerSummary,
  type CustomerWithPurchases,
} from "@shared/schema";
import { randomUUID } from "crypto";
import session from "express-session";
import Database from "better-sqlite3";
// @ts-ignore - no type definitions available
import SqliteStore from "better-sqlite3-session-store";

const SessionStore = SqliteStore(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getCustomer(id: string, userId: string): Promise<Customer | undefined>;
  getCustomers(userId: string): Promise<CustomerSummary[]>;
  getCustomerWithPurchases(id: string, userId: string): Promise<CustomerWithPurchases | undefined>;
  createCustomer(customer: InsertCustomer, userId: string): Promise<Customer>;
  updateCustomer(id: string, customer: InsertCustomer, userId: string): Promise<Customer | undefined>;
  deleteCustomer(id: string, userId: string): Promise<boolean>;
  
  getPurchase(id: string): Promise<Purchase | undefined>;
  getPurchasesByCustomer(customerId: string): Promise<Purchase[]>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByPurchase(purchaseId: string): Promise<Payment[]>;
  getUpcomingPayments(userId: string, daysAhead: number): Promise<any[]>;
  getOverduePaymentsCount(userId: string): Promise<number>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  
  sessionStore: any;
}

export class SqliteStorage implements IStorage {
  private db: Database.Database;
  sessionStore: any;

  constructor(dbPath: string = "./paytrack.db") {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    
    this.initializeDatabase();
    
    this.sessionStore = new SessionStore({
      client: this.db,
      expired: {
        clear: true,
        intervalMs: 900000
      }
    });
  }

  private initializeDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        company TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        product TEXT NOT NULL,
        purchase_date INTEGER NOT NULL,
        total_price TEXT NOT NULL,
        payment_terms TEXT NOT NULL,
        initial_payment TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
        amount TEXT NOT NULL,
        due_date INTEGER NOT NULL,
        status TEXT NOT NULL,
        paid_date INTEGER,
        created_at INTEGER NOT NULL
      );
    `);
  }

  async getUser(id: string): Promise<User | undefined> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    return row as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const row = this.db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    return row as User | undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    
    try {
      this.db.prepare("INSERT INTO users (id, username, password) VALUES (?, ?, ?)")
        .run(user.id, user.username, user.password);
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed')) {
        throw new Error('Username already exists');
      }
      throw error;
    }
    
    return user;
  }

  async getCustomer(id: string, userId: string): Promise<Customer | undefined> {
    const row = this.db.prepare("SELECT * FROM customers WHERE id = ? AND user_id = ?")
      .get(id, userId) as any;
    
    if (!row) return undefined;
    
    return {
      ...row,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
    };
  }

  async getCustomers(userId: string): Promise<CustomerSummary[]> {
    const rows = this.db.prepare("SELECT * FROM customers WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as any[];

    const summaries: CustomerSummary[] = [];

    for (const row of rows) {
      const customer: Customer = {
        ...row,
        userId: row.user_id,
        createdAt: new Date(row.created_at),
      };

      const purchases = this.db.prepare("SELECT * FROM purchases WHERE customer_id = ?")
        .all(customer.id) as any[];

      let nextPaymentDate: string | null = null;
      let nextPaymentAmount: string | null = null;
      let totalOverdue = 0;
      let totalPaid = 0;

      for (const purchase of purchases) {
        const payments = this.db.prepare("SELECT * FROM payments WHERE purchase_id = ? ORDER BY due_date ASC")
          .all(purchase.id) as any[];

        for (const payment of payments) {
          if (payment.status === "paid") {
            totalPaid += parseFloat(payment.amount);
          } else {
            const dueDate = new Date(payment.due_date);
            const now = new Date();
            
            if (dueDate < now) {
              totalOverdue += parseFloat(payment.amount);
            } else if (!nextPaymentDate || dueDate < new Date(nextPaymentDate)) {
              nextPaymentDate = new Date(payment.due_date).toISOString();
              nextPaymentAmount = payment.amount;
            }
          }
        }
      }

      summaries.push({
        ...customer,
        nextPaymentDate,
        nextPaymentAmount,
        totalOverdue: totalOverdue.toString(),
        totalPaid: totalPaid.toString(),
      });
    }

    return summaries;
  }

  async getCustomerWithPurchases(id: string, userId: string): Promise<CustomerWithPurchases | undefined> {
    const customer = await this.getCustomer(id, userId);
    if (!customer) return undefined;

    const purchaseRows = this.db.prepare("SELECT * FROM purchases WHERE customer_id = ? ORDER BY purchase_date DESC")
      .all(customer.id) as any[];

    const purchasesWithPayments = purchaseRows.map((row) => {
      const purchase: Purchase = {
        ...row,
        customerId: row.customer_id,
        purchaseDate: new Date(row.purchase_date),
        totalPrice: row.total_price,
        paymentTerms: row.payment_terms,
        initialPayment: row.initial_payment,
        createdAt: new Date(row.created_at),
      };

      const paymentRows = this.db.prepare("SELECT * FROM payments WHERE purchase_id = ? ORDER BY due_date ASC")
        .all(purchase.id) as any[];

      const payments: Payment[] = paymentRows.map((p) => ({
        ...p,
        purchaseId: p.purchase_id,
        dueDate: new Date(p.due_date),
        paidDate: p.paid_date ? new Date(p.paid_date) : null,
        createdAt: new Date(p.created_at),
      }));

      return {
        ...purchase,
        payments,
      };
    });

    return {
      ...customer,
      purchases: purchasesWithPayments,
    };
  }

  async createCustomer(insertCustomer: InsertCustomer, userId: string): Promise<Customer> {
    const id = randomUUID();
    const createdAt = new Date();
    
    const customer: Customer = {
      id,
      userId,
      name: insertCustomer.name,
      email: insertCustomer.email ?? null,
      phone: insertCustomer.phone ?? null,
      company: insertCustomer.company ?? null,
      createdAt,
    };

    this.db.prepare(
      "INSERT INTO customers (id, user_id, name, email, phone, company, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      customer.id,
      customer.userId,
      customer.name,
      customer.email,
      customer.phone,
      customer.company,
      createdAt.getTime()
    );

    return customer;
  }

  async updateCustomer(id: string, insertCustomer: InsertCustomer, userId: string): Promise<Customer | undefined> {
    const existing = await this.getCustomer(id, userId);
    if (!existing) return undefined;

    const updated: Customer = {
      ...existing,
      ...insertCustomer,
    };

    this.db.prepare(
      "UPDATE customers SET name = ?, email = ?, phone = ?, company = ? WHERE id = ? AND user_id = ?"
    ).run(
      updated.name,
      updated.email,
      updated.phone,
      updated.company,
      id,
      userId
    );

    return updated;
  }

  async deleteCustomer(id: string, userId: string): Promise<boolean> {
    const customer = await this.getCustomer(id, userId);
    if (!customer) return false;
    
    this.db.prepare("DELETE FROM customers WHERE id = ? AND user_id = ?").run(id, userId);
    return true;
  }

  async getPurchase(id: string): Promise<Purchase | undefined> {
    const row = this.db.prepare("SELECT * FROM purchases WHERE id = ?").get(id) as any;
    if (!row) return undefined;

    return {
      ...row,
      customerId: row.customer_id,
      purchaseDate: new Date(row.purchase_date),
      totalPrice: row.total_price,
      paymentTerms: row.payment_terms,
      initialPayment: row.initial_payment,
      createdAt: new Date(row.created_at),
    };
  }

  async getPurchasesByCustomer(customerId: string): Promise<Purchase[]> {
    const rows = this.db.prepare("SELECT * FROM purchases WHERE customer_id = ?").all(customerId) as any[];
    
    return rows.map((row) => ({
      ...row,
      customerId: row.customer_id,
      purchaseDate: new Date(row.purchase_date),
      totalPrice: row.total_price,
      paymentTerms: row.payment_terms,
      initialPayment: row.initial_payment,
      createdAt: new Date(row.created_at),
    }));
  }

  async createPurchase(insertPurchase: InsertPurchase): Promise<Purchase> {
    const id = randomUUID();
    const purchaseDate = typeof insertPurchase.purchaseDate === 'string' 
      ? new Date(insertPurchase.purchaseDate)
      : insertPurchase.purchaseDate;
    const createdAt = new Date();

    const purchase: Purchase = {
      ...insertPurchase,
      id,
      purchaseDate,
      createdAt,
    };

    this.db.prepare(
      "INSERT INTO purchases (id, customer_id, product, purchase_date, total_price, payment_terms, initial_payment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      purchase.id,
      purchase.customerId,
      purchase.product,
      purchaseDate.getTime(),
      purchase.totalPrice,
      purchase.paymentTerms,
      purchase.initialPayment,
      createdAt.getTime()
    );

    return purchase;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const row = this.db.prepare("SELECT * FROM payments WHERE id = ?").get(id) as any;
    if (!row) return undefined;

    return {
      ...row,
      purchaseId: row.purchase_id,
      dueDate: new Date(row.due_date),
      paidDate: row.paid_date ? new Date(row.paid_date) : null,
      createdAt: new Date(row.created_at),
    };
  }

  async getPaymentsByPurchase(purchaseId: string): Promise<Payment[]> {
    const rows = this.db.prepare("SELECT * FROM payments WHERE purchase_id = ? ORDER BY due_date ASC")
      .all(purchaseId) as any[];
    
    return rows.map((row) => ({
      ...row,
      purchaseId: row.purchase_id,
      dueDate: new Date(row.due_date),
      paidDate: row.paid_date ? new Date(row.paid_date) : null,
      createdAt: new Date(row.created_at),
    }));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const dueDate = typeof insertPayment.dueDate === 'string'
      ? new Date(insertPayment.dueDate)
      : insertPayment.dueDate;
    const paidDate = insertPayment.paidDate 
      ? (typeof insertPayment.paidDate === 'string'
        ? new Date(insertPayment.paidDate)
        : insertPayment.paidDate)
      : null;
    const createdAt = new Date();

    const payment: Payment = {
      ...insertPayment,
      id,
      dueDate,
      paidDate,
      createdAt,
    };

    this.db.prepare(
      "INSERT INTO payments (id, purchase_id, amount, due_date, status, paid_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      payment.id,
      payment.purchaseId,
      payment.amount,
      dueDate.getTime(),
      payment.status,
      paidDate ? paidDate.getTime() : null,
      createdAt.getTime()
    );

    return payment;
  }

  async updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment | undefined> {
    const existing = await this.getPayment(id);
    if (!existing) return undefined;

    const updated: Payment = {
      ...existing,
      ...updates,
      dueDate: updates.dueDate 
        ? (typeof updates.dueDate === 'string' ? new Date(updates.dueDate) : updates.dueDate)
        : existing.dueDate,
      paidDate: updates.paidDate !== undefined
        ? (updates.paidDate 
          ? (typeof updates.paidDate === 'string' ? new Date(updates.paidDate) : updates.paidDate)
          : null)
        : existing.paidDate,
    };

    this.db.prepare(
      "UPDATE payments SET amount = ?, due_date = ?, status = ?, paid_date = ? WHERE id = ?"
    ).run(
      updated.amount,
      updated.dueDate.getTime(),
      updated.status,
      updated.paidDate ? updated.paidDate.getTime() : null,
      id
    );

    return updated;
  }

  async getUpcomingPayments(userId: string, daysAhead: number): Promise<any[]> {
    // Use current timestamp to exclude payments that are already overdue
    // (payments with due date in the past)
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    
    const rows = this.db.prepare(`
      SELECT 
        p.id,
        p.amount,
        p.due_date,
        p.status,
        pur.product,
        c.name as customer_name,
        c.id as customer_id
      FROM payments p
      INNER JOIN purchases pur ON p.purchase_id = pur.id
      INNER JOIN customers c ON pur.customer_id = c.id
      WHERE c.user_id = ?
        AND p.status != 'paid'
        AND p.due_date > ?
        AND p.due_date <= ?
      ORDER BY p.due_date ASC
      LIMIT 10
    `).all(userId, now.getTime(), futureDate.getTime()) as any[];
    
    return rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      dueDate: new Date(row.due_date),
      status: row.status,
      product: row.product,
      customerName: row.customer_name,
      customerId: row.customer_id,
    }));
  }

  async getOverduePaymentsCount(userId: string): Promise<number> {
    const now = new Date();
    
    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM payments p
      INNER JOIN purchases pur ON p.purchase_id = pur.id
      INNER JOIN customers c ON pur.customer_id = c.id
      WHERE c.user_id = ?
        AND p.status != 'paid'
        AND p.due_date < ?
    `).get(userId, now.getTime()) as any;
    
    return result?.count || 0;
  }
}

export const storage = new SqliteStorage();
