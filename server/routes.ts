import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertCustomerSchema, insertPurchaseSchema, type InsertPayment } from "@shared/schema";
import { addMonths, addYears, startOfMonth, startOfYear } from "date-fns";
import Papa from "papaparse";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  next();
}

function calculatePayments(
  initialPayment: number,
  rentalAmount: number,
  rentalFrequency: string,
  purchaseDate: Date
) {
  const payments: Array<{
    amount: string;
    dueDate: Date;
    status: string;
    paidDate: Date | null;
  }> = [];

  const now = new Date();

  // Add initial payment (always marked as paid on purchase date)
  if (initialPayment > 0) {
    payments.push({
      amount: initialPayment.toFixed(2),
      dueDate: purchaseDate,
      status: "paid",
      paidDate: purchaseDate,
    });
  }

  // For one-time rental, create only one rental payment
  if (rentalFrequency === "one-time") {
    const dueDate = purchaseDate;
    payments.push({
      amount: rentalAmount.toFixed(2),
      dueDate,
      status: dueDate < now ? "overdue" : "upcoming",
      paidDate: null,
    });
    return payments;
  }

  // For recurring rentals (monthly, quarterly, yearly), create payments for next 12 months
  let addPeriod: (date: Date, num: number) => Date;
  let numPayments = 12; // Number of future rental payments to generate

  if (rentalFrequency === "monthly") {
    addPeriod = (date: Date, num: number) => addMonths(date, num);
    numPayments = 12; // 12 monthly payments
  } else if (rentalFrequency === "quarterly") {
    addPeriod = (date: Date, num: number) => addMonths(date, num * 3);
    numPayments = 4; // 4 quarterly payments (1 year)
  } else if (rentalFrequency === "yearly") {
    addPeriod = (date: Date, num: number) => addYears(date, num);
    numPayments = 3; // 3 yearly payments
  } else {
    return payments; // Invalid frequency
  }

  // Generate recurring rental payments
  for (let i = 0; i < numPayments; i++) {
    const dueDate = addPeriod!(purchaseDate, i + 1);
    
    let status = "upcoming";
    if (dueDate < now) {
      status = "overdue";
    }
    
    payments.push({
      amount: rentalAmount.toFixed(2),
      dueDate,
      status,
      paidDate: null,
    });
  }

  return payments;
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.get("/api/customers", requireAuth, async (req, res) => {
    try {
      const customers = await storage.getCustomers(req.user!.id);
      res.json(customers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomerWithPurchases(
        req.params.id,
        req.user!.id
      );
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/customers", requireAuth, async (req, res) => {
    try {
      const validated = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validated, req.user!.id);
      res.status(201).json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const validated = insertCustomerSchema.parse(req.body);
      const customer = await storage.updateCustomer(
        req.params.id,
        validated,
        req.user!.id
      );
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteCustomer(req.params.id, req.user!.id);
      if (!deleted) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.sendStatus(204);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/customers/bulk-import", requireAuth, async (req, res) => {
    try {
      const { csvData } = req.body;
      
      if (!csvData || typeof csvData !== 'string') {
        return res.status(400).json({ message: "CSV data is required" });
      }

      // Auto-detect delimiter for maximum compatibility
      const parseResult = Papa.parse<Record<string, string>>(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
        delimiter: "", // Auto-detect comma, semicolon, tab, etc.
        quoteChar: '"',
        escapeChar: '"',
      });

      // Continue processing even with non-critical errors
      // Only log errors but don't fail immediately

      const results = {
        success: [] as any[],
        failed: [] as any[],
      };

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i];
        const rowNumber = i + 2; // +2 because header is row 1 and arrays are 0-indexed
        
        try {
          // Map CSV columns to customer schema
          const customerData = {
            name: row.name || row.customer_name || '',
            email: row.email || null,
            phone: row.phone || null,
            company: row.company || null,
          };

          // Validate using schema
          const validated = insertCustomerSchema.parse(customerData);
          
          // Create customer
          const customer = await storage.createCustomer(validated, req.user!.id);
          
          results.success.push({
            row: rowNumber,
            customer,
          });
        } catch (error: any) {
          results.failed.push({
            row: rowNumber,
            data: row,
            error: error.message || 'Unknown error',
          });
        }
      }

      res.status(200).json({
        total: parseResult.data.length,
        successCount: results.success.length,
        failedCount: results.failed.length,
        results,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/purchases", requireAuth, async (req, res) => {
    try {
      const validated = insertPurchaseSchema.parse(req.body);
      
      const customer = await storage.getCustomer(validated.customerId, req.user!.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const purchase = await storage.createPurchase(validated);
      
      const paymentsToCreate = calculatePayments(
        parseFloat(validated.initialPayment),
        parseFloat(validated.rentalAmount),
        validated.rentalFrequency,
        new Date(validated.purchaseDate)
      );

      for (const paymentData of paymentsToCreate) {
        await storage.createPayment({
          purchaseId: purchase.id,
          ...paymentData,
        });
      }

      res.status(201).json(purchase);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/purchases/:id", requireAuth, async (req, res) => {
    try {
      const purchase = await storage.getPurchase(req.params.id);
      if (!purchase) {
        return res.status(404).json({ message: "Purchase not found" });
      }

      const customer = await storage.getCustomer(purchase.customerId, req.user!.id);
      if (!customer) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validated = insertPurchaseSchema.partial().parse(req.body);
      
      // Prevent customerId changes (security - cross-tenant data breach)
      if (validated.customerId && validated.customerId !== purchase.customerId) {
        return res.status(403).json({ message: "Cannot change customer assignment" });
      }

      const updated = await storage.updatePurchase(req.params.id, validated);

      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/payments/:id", requireAuth, async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const purchase = await storage.getPurchase(payment.purchaseId);
      if (!purchase) {
        return res.status(404).json({ message: "Purchase not found" });
      }

      const customer = await storage.getCustomer(purchase.customerId, req.user!.id);
      if (!customer) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Only allow updating amount and dueDate
      const allowedUpdates: Partial<InsertPayment> = {};
      if (req.body.amount !== undefined) {
        allowedUpdates.amount = String(req.body.amount);
      }
      if (req.body.dueDate !== undefined) {
        allowedUpdates.dueDate = new Date(req.body.dueDate);
      }

      const updated = await storage.updatePayment(req.params.id, allowedUpdates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/payments/:id/mark-paid", requireAuth, async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const purchase = await storage.getPurchase(payment.purchaseId);
      if (!purchase) {
        return res.status(404).json({ message: "Purchase not found" });
      }

      const customer = await storage.getCustomer(purchase.customerId, req.user!.id);
      if (!customer) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updated = await storage.updatePayment(req.params.id, {
        status: "paid",
        paidDate: new Date(),
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/kpi", requireAuth, async (req, res) => {
    try {
      const period = req.query.period as string || "all";
      const customers = await storage.getCustomers(req.user!.id);
      
      let totalPaid = 0;
      let totalOverdue = 0;

      const now = new Date();
      let filterDate: Date | null = null;

      if (period === "month") {
        filterDate = startOfMonth(now);
      } else if (period === "year") {
        filterDate = startOfYear(now);
      }

      for (const customer of customers) {
        const purchases = await storage.getPurchasesByCustomer(customer.id);
        
        for (const purchase of purchases) {
          const payments = await storage.getPaymentsByPurchase(purchase.id);
          
          for (const payment of payments) {
            if (payment.status === "paid") {
              if (!filterDate || (payment.paidDate && payment.paidDate >= filterDate)) {
                totalPaid += parseFloat(payment.amount);
              }
            } else if (new Date(payment.dueDate) < now) {
              totalOverdue += parseFloat(payment.amount);
            }
          }
        }
      }

      res.json({
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOverdue: Math.round(totalOverdue * 100) / 100,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/payments/upcoming", requireAuth, async (req, res) => {
    try {
      const daysAhead = parseInt(req.query.days as string) || 7;
      const upcomingPayments = await storage.getUpcomingPayments(req.user!.id, daysAhead);
      res.json(upcomingPayments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/payments/overdue-count", requireAuth, async (req, res) => {
    try {
      const count = await storage.getOverduePaymentsCount(req.user!.id);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
