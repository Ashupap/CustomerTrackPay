import {
  type User,
  type InsertUser,
  type CreateUser,
  type SafeUser,
  type Customer,
  type InsertCustomer,
  type Purchase,
  type InsertPurchase,
  type Payment,
  type InsertPayment,
  type CustomerSummary,
  type CustomerWithPurchases,
  type ActivityLogEntry,
  type UserWithStats,
} from "@shared/schema";
import { randomUUID } from "crypto";
import session from "express-session";
import Database from "better-sqlite3";
// @ts-ignore - no type definitions available
import SqliteStore from "better-sqlite3-session-store";

const SessionStore = SqliteStore(session);

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Admin user management
  getAllUsers(): Promise<SafeUser[]>;
  getUsersWithStats(): Promise<UserWithStats[]>;
  createUserByAdmin(user: CreateUser, adminId: string): Promise<SafeUser>;
  deleteUser(id: string): Promise<boolean>;
  resetUserPassword(id: string, newPassword: string): Promise<boolean>;
  isAdmin(userId: string): Promise<boolean>;
  
  // Customer management
  getCustomer(id: string, userId: string): Promise<Customer | undefined>;
  getCustomers(userId: string): Promise<CustomerSummary[]>;
  getAllCustomers(): Promise<CustomerSummary[]>; // Admin only
  getCustomerWithPurchases(id: string, userId: string): Promise<CustomerWithPurchases | undefined>;
  createCustomer(customer: InsertCustomer, userId: string): Promise<Customer>;
  updateCustomer(id: string, customer: InsertCustomer, userId: string): Promise<Customer | undefined>;
  deleteCustomer(id: string, userId: string): Promise<boolean>;
  
  // Purchase management
  getPurchase(id: string): Promise<Purchase | undefined>;
  getPurchasesByCustomer(customerId: string): Promise<Purchase[]>;
  createPurchase(purchase: InsertPurchase, userId: string): Promise<Purchase>;
  updatePurchase(id: string, purchase: Partial<InsertPurchase>): Promise<Purchase | undefined>;
  
  // Payment management
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByPurchase(purchaseId: string): Promise<Payment[]>;
  getUpcomingPayments(userId: string, daysAhead: number): Promise<any[]>;
  getThisMonthUpcomingPayments(userId: string): Promise<any[]>;
  getOverduePaymentsCount(userId: string): Promise<number>;
  getOverduePayments(userId: string): Promise<any[]>;
  createPayment(payment: InsertPayment, userId: string): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  markPaymentPaid(id: string, userId: string): Promise<Payment | undefined>;
  
  // Admin activity tracking
  getActivityLog(limit?: number): Promise<ActivityLogEntry[]>;
  
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
    // Create tables with new schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        created_by TEXT
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        company TEXT,
        created_at INTEGER NOT NULL,
        created_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        product TEXT NOT NULL,
        purchase_date INTEGER NOT NULL,
        initial_payment TEXT NOT NULL,
        rental_amount TEXT NOT NULL,
        rental_frequency TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        created_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
        amount TEXT NOT NULL,
        due_date INTEGER NOT NULL,
        status TEXT NOT NULL,
        paid_date INTEGER,
        created_at INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        marked_paid_by TEXT
      );
    `);
    
    // Migrate existing tables by adding new columns if they don't exist
    this.migrateDatabase();
  }
  
  private migrateDatabase() {
    const now = Date.now();
    
    // Check if columns exist and add them if not
    const userColumns = this.db.prepare("PRAGMA table_info(users)").all() as any[];
    const hasRole = userColumns.some(col => col.name === 'role');
    const hasUserCreatedAt = userColumns.some(col => col.name === 'created_at');
    const hasUserCreatedBy = userColumns.some(col => col.name === 'created_by');
    
    if (!hasRole) {
      this.db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
      this.db.exec("UPDATE users SET role = 'user' WHERE role IS NULL");
    }
    if (!hasUserCreatedAt) {
      this.db.exec("ALTER TABLE users ADD COLUMN created_at INTEGER");
      this.db.prepare("UPDATE users SET created_at = ? WHERE created_at IS NULL").run(now);
    }
    if (!hasUserCreatedBy) {
      this.db.exec("ALTER TABLE users ADD COLUMN created_by TEXT");
    }
    
    // Check customers table
    const customerColumns = this.db.prepare("PRAGMA table_info(customers)").all() as any[];
    const hasCustomerCreatedBy = customerColumns.some(col => col.name === 'created_by');
    
    if (!hasCustomerCreatedBy) {
      // For existing customers, set created_by to user_id
      this.db.exec("ALTER TABLE customers ADD COLUMN created_by TEXT");
      this.db.exec("UPDATE customers SET created_by = user_id WHERE created_by IS NULL");
    }
    
    // Check purchases table
    const purchaseColumns = this.db.prepare("PRAGMA table_info(purchases)").all() as any[];
    const hasPurchaseCreatedBy = purchaseColumns.some(col => col.name === 'created_by');
    
    if (!hasPurchaseCreatedBy) {
      this.db.exec("ALTER TABLE purchases ADD COLUMN created_by TEXT");
      // Set existing purchases created_by from customer's user_id
      this.db.exec(`
        UPDATE purchases SET created_by = (
          SELECT c.user_id FROM customers c WHERE c.id = purchases.customer_id
        ) WHERE created_by IS NULL
      `);
    }
    
    // Check payments table
    const paymentColumns = this.db.prepare("PRAGMA table_info(payments)").all() as any[];
    const hasPaymentCreatedBy = paymentColumns.some(col => col.name === 'created_by');
    const hasMarkedPaidBy = paymentColumns.some(col => col.name === 'marked_paid_by');
    
    if (!hasPaymentCreatedBy) {
      this.db.exec("ALTER TABLE payments ADD COLUMN created_by TEXT");
      // Set existing payments created_by from purchase's customer's user_id
      this.db.exec(`
        UPDATE payments SET created_by = (
          SELECT c.user_id FROM purchases p 
          JOIN customers c ON c.id = p.customer_id 
          WHERE p.id = payments.purchase_id
        ) WHERE created_by IS NULL
      `);
    }
    
    if (!hasMarkedPaidBy) {
      this.db.exec("ALTER TABLE payments ADD COLUMN marked_paid_by TEXT");
    }
    
    // Update existing admin user to have admin role
    this.db.exec("UPDATE users SET role = 'admin' WHERE username = 'admin'");
  }

  async getUser(id: string): Promise<User | undefined> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return {
      ...row,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      createdBy: row.created_by,
    };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const row = this.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    if (!row) return undefined;
    return {
      ...row,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      createdBy: row.created_by,
    };
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const createdAt = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      role: 'user',
      createdAt,
      createdBy: null,
    };
    
    try {
      this.db.prepare("INSERT INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(user.id, user.username, user.password, user.role, createdAt.getTime());
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed')) {
        throw new Error('Username already exists');
      }
      throw error;
    }
    
    return user;
  }
  
  // Admin methods
  async getAllUsers(): Promise<SafeUser[]> {
    const rows = this.db.prepare("SELECT id, username, role, created_at, created_by FROM users ORDER BY created_at DESC").all() as any[];
    return rows.map(row => ({
      id: row.id,
      username: row.username,
      role: row.role || 'user',
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      createdBy: row.created_by,
    }));
  }
  
  async getUsersWithStats(): Promise<UserWithStats[]> {
    const users = await this.getAllUsers();
    
    const result: UserWithStats[] = [];
    for (const user of users) {
      const customersCreated = (this.db.prepare("SELECT COUNT(*) as count FROM customers WHERE created_by = ?").get(user.id) as any)?.count || 0;
      const purchasesCreated = (this.db.prepare("SELECT COUNT(*) as count FROM purchases WHERE created_by = ?").get(user.id) as any)?.count || 0;
      const paymentsMarked = (this.db.prepare("SELECT COUNT(*) as count FROM payments WHERE marked_paid_by = ?").get(user.id) as any)?.count || 0;
      
      result.push({
        ...user,
        customersCreated,
        purchasesCreated,
        paymentsMarked,
      });
    }
    
    return result;
  }
  
  async createUserByAdmin(createUser: CreateUser, adminId: string): Promise<SafeUser> {
    const id = randomUUID();
    const createdAt = new Date();
    
    try {
      this.db.prepare("INSERT INTO users (id, username, password, role, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, createUser.username, createUser.password, createUser.role, createdAt.getTime(), adminId);
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint failed')) {
        throw new Error('Username already exists');
      }
      throw error;
    }
    
    return {
      id,
      username: createUser.username,
      role: createUser.role,
      createdAt,
      createdBy: adminId,
    };
  }
  
  async deleteUser(id: string): Promise<boolean> {
    const user = await this.getUser(id);
    if (!user) return false;
    
    // Don't allow deleting the last admin
    const adminCount = (this.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as any)?.count || 0;
    if (user.role === 'admin' && adminCount <= 1) {
      throw new Error('Cannot delete the last admin user');
    }
    
    this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
    return true;
  }
  
  async resetUserPassword(id: string, newPassword: string): Promise<boolean> {
    const user = await this.getUser(id);
    if (!user) return false;
    
    this.db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPassword, id);
    return true;
  }
  
  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return user?.role === 'admin';
  }

  async getCustomer(id: string, userId: string): Promise<Customer | undefined> {
    const row = this.db.prepare("SELECT * FROM customers WHERE id = ? AND user_id = ?")
      .get(id, userId) as any;
    
    if (!row) return undefined;
    
    return {
      ...row,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by || row.user_id,
    };
  }
  
  async getCustomerById(id: string): Promise<Customer | undefined> {
    const row = this.db.prepare("SELECT * FROM customers WHERE id = ?")
      .get(id) as any;
    
    if (!row) return undefined;
    
    return {
      ...row,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by || row.user_id,
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
        createdBy: row.created_by || row.user_id,
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
        initialPayment: row.initial_payment,
        rentalAmount: row.rental_amount,
        rentalFrequency: row.rental_frequency,
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
      createdBy: userId,
    };

    this.db.prepare(
      "INSERT INTO customers (id, user_id, name, email, phone, company, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      customer.id,
      customer.userId,
      customer.name,
      customer.email,
      customer.phone,
      customer.company,
      createdAt.getTime(),
      userId
    );

    return customer;
  }
  
  async getAllCustomers(): Promise<CustomerSummary[]> {
    const rows = this.db.prepare("SELECT * FROM customers ORDER BY created_at DESC")
      .all() as any[];

    const summaries: CustomerSummary[] = [];

    for (const row of rows) {
      const customer: Customer = {
        ...row,
        userId: row.user_id,
        createdAt: new Date(row.created_at),
        createdBy: row.created_by || row.user_id,
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
      initialPayment: row.initial_payment,
      rentalAmount: row.rental_amount,
      rentalFrequency: row.rental_frequency,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,
    };
  }

  async getPurchasesByCustomer(customerId: string): Promise<Purchase[]> {
    const rows = this.db.prepare("SELECT * FROM purchases WHERE customer_id = ?").all(customerId) as any[];
    
    return rows.map((row) => ({
      ...row,
      customerId: row.customer_id,
      purchaseDate: new Date(row.purchase_date),
      initialPayment: row.initial_payment,
      rentalAmount: row.rental_amount,
      rentalFrequency: row.rental_frequency,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,
    }));
  }

  async createPurchase(insertPurchase: InsertPurchase, userId: string): Promise<Purchase> {
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
      createdBy: userId,
    };

    this.db.prepare(
      "INSERT INTO purchases (id, customer_id, product, purchase_date, initial_payment, rental_amount, rental_frequency, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      purchase.id,
      purchase.customerId,
      purchase.product,
      purchaseDate.getTime(),
      purchase.initialPayment,
      purchase.rentalAmount,
      purchase.rentalFrequency,
      createdAt.getTime(),
      userId
    );

    return purchase;
  }

  async updatePurchase(id: string, updates: Partial<InsertPurchase>): Promise<Purchase | undefined> {
    const existing = await this.getPurchase(id);
    if (!existing) return undefined;

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.product !== undefined) {
      updateFields.push("product = ?");
      updateValues.push(updates.product);
    }
    if (updates.purchaseDate !== undefined) {
      updateFields.push("purchase_date = ?");
      const purchaseDate = typeof updates.purchaseDate === 'string' 
        ? new Date(updates.purchaseDate)
        : updates.purchaseDate;
      updateValues.push(purchaseDate.getTime());
    }
    if (updates.initialPayment !== undefined) {
      updateFields.push("initial_payment = ?");
      updateValues.push(updates.initialPayment);
    }
    if (updates.rentalAmount !== undefined) {
      updateFields.push("rental_amount = ?");
      updateValues.push(updates.rentalAmount);
    }
    if (updates.rentalFrequency !== undefined) {
      updateFields.push("rental_frequency = ?");
      updateValues.push(updates.rentalFrequency);
    }

    if (updateFields.length === 0) return existing;

    updateValues.push(id);
    this.db.prepare(
      `UPDATE purchases SET ${updateFields.join(", ")} WHERE id = ?`
    ).run(...updateValues);

    return await this.getPurchase(id);
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
      createdBy: row.created_by,
      markedPaidBy: row.marked_paid_by,
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
      createdBy: row.created_by,
      markedPaidBy: row.marked_paid_by,
    }));
  }

  async createPayment(insertPayment: InsertPayment, userId: string): Promise<Payment> {
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
      createdBy: userId,
      markedPaidBy: paidDate ? userId : null,
    };

    this.db.prepare(
      "INSERT INTO payments (id, purchase_id, amount, due_date, status, paid_date, created_at, created_by, marked_paid_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      payment.id,
      payment.purchaseId,
      payment.amount,
      dueDate.getTime(),
      payment.status,
      paidDate ? paidDate.getTime() : null,
      createdAt.getTime(),
      userId,
      paidDate ? userId : null
    );

    return payment;
  }
  
  async markPaymentPaid(id: string, userId: string): Promise<Payment | undefined> {
    const existing = await this.getPayment(id);
    if (!existing) return undefined;
    
    const paidDate = new Date();
    
    this.db.prepare(
      "UPDATE payments SET status = 'paid', paid_date = ?, marked_paid_by = ? WHERE id = ?"
    ).run(paidDate.getTime(), userId, id);
    
    return {
      ...existing,
      status: 'paid',
      paidDate,
      markedPaidBy: userId,
    };
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

  async getThisMonthUpcomingPayments(userId: string): Promise<any[]> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const rows = this.db.prepare(`
      SELECT 
        p.id,
        p.amount,
        p.due_date,
        p.status,
        pur.product,
        c.name as customer_name,
        c.company,
        c.email,
        c.phone,
        c.id as customer_id
      FROM payments p
      INNER JOIN purchases pur ON p.purchase_id = pur.id
      INNER JOIN customers c ON pur.customer_id = c.id
      WHERE c.user_id = ?
        AND p.status = 'upcoming'
        AND p.due_date >= ?
        AND p.due_date <= ?
      ORDER BY p.due_date ASC
    `).all(userId, startOfMonth.getTime(), endOfMonth.getTime()) as any[];
    
    return rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      dueDate: new Date(row.due_date),
      status: row.status,
      product: row.product,
      customerName: row.customer_name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      customerId: row.customer_id,
    }));
  }

  async getOverduePayments(userId: string): Promise<any[]> {
    const rows = this.db.prepare(`
      SELECT 
        p.id,
        p.amount,
        p.due_date,
        p.status,
        pur.product,
        c.name as customer_name,
        c.company,
        c.email,
        c.phone,
        c.id as customer_id
      FROM payments p
      INNER JOIN purchases pur ON p.purchase_id = pur.id
      INNER JOIN customers c ON pur.customer_id = c.id
      WHERE c.user_id = ?
        AND p.status = 'overdue'
      ORDER BY p.due_date ASC
    `).all(userId) as any[];
    
    return rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      dueDate: new Date(row.due_date),
      status: row.status,
      product: row.product,
      customerName: row.customer_name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      customerId: row.customer_id,
    }));
  }
  
  async getActivityLog(limit: number = 50): Promise<ActivityLogEntry[]> {
    const entries: ActivityLogEntry[] = [];
    
    // Get customer creation activities
    const customerRows = this.db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.created_at,
        c.created_by,
        u.username as created_by_username
      FROM customers c
      LEFT JOIN users u ON c.created_by = u.id
      ORDER BY c.created_at DESC
      LIMIT ?
    `).all(limit) as any[];
    
    for (const row of customerRows) {
      entries.push({
        id: `customer-${row.id}`,
        type: 'customer_created',
        entityId: row.id,
        entityName: row.name,
        createdAt: new Date(row.created_at),
        createdById: row.created_by,
        createdByUsername: row.created_by_username || 'Unknown',
      });
    }
    
    // Get purchase creation activities
    const purchaseRows = this.db.prepare(`
      SELECT 
        p.id,
        p.product,
        p.created_at,
        p.created_by,
        u.username as created_by_username,
        c.name as customer_name
      FROM purchases p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN customers c ON p.customer_id = c.id
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(limit) as any[];
    
    for (const row of purchaseRows) {
      entries.push({
        id: `purchase-${row.id}`,
        type: 'purchase_created',
        entityId: row.id,
        entityName: `${row.product} for ${row.customer_name}`,
        createdAt: new Date(row.created_at),
        createdById: row.created_by,
        createdByUsername: row.created_by_username || 'Unknown',
      });
    }
    
    // Get payment marked paid activities
    const paymentRows = this.db.prepare(`
      SELECT 
        py.id,
        py.amount,
        py.paid_date,
        py.marked_paid_by,
        u.username as marked_by_username,
        pur.product,
        c.name as customer_name
      FROM payments py
      LEFT JOIN users u ON py.marked_paid_by = u.id
      LEFT JOIN purchases pur ON py.purchase_id = pur.id
      LEFT JOIN customers c ON pur.customer_id = c.id
      WHERE py.status = 'paid' AND py.marked_paid_by IS NOT NULL
      ORDER BY py.paid_date DESC
      LIMIT ?
    `).all(limit) as any[];
    
    for (const row of paymentRows) {
      entries.push({
        id: `payment-${row.id}`,
        type: 'payment_marked_paid',
        entityId: row.id,
        entityName: `$${row.amount} - ${row.product} for ${row.customer_name}`,
        createdAt: row.paid_date ? new Date(row.paid_date) : new Date(),
        createdById: row.marked_paid_by,
        createdByUsername: row.marked_by_username || 'Unknown',
      });
    }
    
    // Sort all entries by date descending and limit
    return entries
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

export const storage = new SqliteStorage();
