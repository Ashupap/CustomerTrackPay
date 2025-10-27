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
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

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
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment | undefined>;
  
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private customers: Map<string, Customer>;
  private purchases: Map<string, Purchase>;
  private payments: Map<string, Payment>;
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.customers = new Map();
    this.purchases = new Map();
    this.payments = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getCustomer(id: string, userId: string): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (customer && customer.userId === userId) {
      return customer;
    }
    return undefined;
  }

  async getCustomers(userId: string): Promise<CustomerSummary[]> {
    const userCustomers = Array.from(this.customers.values()).filter(
      (c) => c.userId === userId
    );

    const summaries: CustomerSummary[] = [];

    for (const customer of userCustomers) {
      const purchases = Array.from(this.purchases.values()).filter(
        (p) => p.customerId === customer.id
      );

      let nextPaymentDate: string | null = null;
      let nextPaymentAmount: string | null = null;
      let totalOverdue = 0;
      let totalPaid = 0;

      for (const purchase of purchases) {
        const payments = Array.from(this.payments.values())
          .filter((p) => p.purchaseId === purchase.id)
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        for (const payment of payments) {
          if (payment.status === "paid") {
            totalPaid += parseFloat(payment.amount);
          } else {
            const dueDate = new Date(payment.dueDate);
            const now = new Date();
            
            if (dueDate < now) {
              totalOverdue += parseFloat(payment.amount);
            } else if (!nextPaymentDate || dueDate < new Date(nextPaymentDate)) {
              nextPaymentDate = payment.dueDate.toISOString();
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

    return summaries.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getCustomerWithPurchases(id: string, userId: string): Promise<CustomerWithPurchases | undefined> {
    const customer = await this.getCustomer(id, userId);
    if (!customer) return undefined;

    const purchases = Array.from(this.purchases.values())
      .filter((p) => p.customerId === customer.id)
      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());

    const purchasesWithPayments = purchases.map((purchase) => {
      const payments = Array.from(this.payments.values())
        .filter((p) => p.purchaseId === purchase.id)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

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
    const customer: Customer = {
      ...insertCustomer,
      id,
      userId,
      createdAt: new Date(),
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: string, insertCustomer: InsertCustomer, userId: string): Promise<Customer | undefined> {
    const existing = await this.getCustomer(id, userId);
    if (!existing) return undefined;

    const updated: Customer = {
      ...existing,
      ...insertCustomer,
    };
    this.customers.set(id, updated);
    return updated;
  }

  async deleteCustomer(id: string, userId: string): Promise<boolean> {
    const customer = await this.getCustomer(id, userId);
    if (!customer) return false;
    this.customers.delete(id);
    return true;
  }

  async getPurchase(id: string): Promise<Purchase | undefined> {
    return this.purchases.get(id);
  }

  async getPurchasesByCustomer(customerId: string): Promise<Purchase[]> {
    return Array.from(this.purchases.values()).filter(
      (p) => p.customerId === customerId
    );
  }

  async createPurchase(insertPurchase: InsertPurchase): Promise<Purchase> {
    const id = randomUUID();
    const purchase: Purchase = {
      ...insertPurchase,
      id,
      purchaseDate: typeof insertPurchase.purchaseDate === 'string' 
        ? new Date(insertPurchase.purchaseDate)
        : insertPurchase.purchaseDate,
      createdAt: new Date(),
    };
    this.purchases.set(id, purchase);
    return purchase;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async getPaymentsByPurchase(purchaseId: string): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter((p) => p.purchaseId === purchaseId)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const payment: Payment = {
      ...insertPayment,
      id,
      dueDate: typeof insertPayment.dueDate === 'string'
        ? new Date(insertPayment.dueDate)
        : insertPayment.dueDate,
      paidDate: insertPayment.paidDate 
        ? (typeof insertPayment.paidDate === 'string'
          ? new Date(insertPayment.paidDate)
          : insertPayment.paidDate)
        : null,
      createdAt: new Date(),
    };
    this.payments.set(id, payment);
    return payment;
  }

  async updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment | undefined> {
    const existing = this.payments.get(id);
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
    this.payments.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
