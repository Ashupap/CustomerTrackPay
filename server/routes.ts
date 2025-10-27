import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertCustomerSchema, insertPurchaseSchema } from "@shared/schema";
import { addMonths, addYears, startOfMonth, startOfYear } from "date-fns";
import Papa from "papaparse";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  next();
}

function calculatePayments(
  totalPrice: number,
  initialPayment: number,
  paymentTerms: string,
  purchaseDate: Date
) {
  const remaining = totalPrice - initialPayment;
  
  if (paymentTerms === "one-time") {
    return [{
      amount: totalPrice.toFixed(2),
      dueDate: purchaseDate,
      status: initialPayment >= totalPrice ? "paid" : "upcoming",
      paidDate: initialPayment >= totalPrice ? purchaseDate : null,
    }];
  }

  const payments: Array<{
    amount: string;
    dueDate: Date;
    status: string;
    paidDate: Date | null;
  }> = [];

  if (initialPayment > 0) {
    payments.push({
      amount: initialPayment.toFixed(2),
      dueDate: purchaseDate,
      status: "paid",
      paidDate: purchaseDate,
    });
  }

  if (remaining <= 0) {
    return payments;
  }

  let numInstallments = 6;
  let addPeriod = (date: Date, num: number) => addMonths(date, num);

  if (paymentTerms === "quarterly") {
    numInstallments = 4;
    addPeriod = (date: Date, num: number) => addMonths(date, num * 3);
  } else if (paymentTerms === "yearly") {
    numInstallments = 3;
    addPeriod = (date: Date, num: number) => addYears(date, num);
  }

  const installmentAmount = remaining / numInstallments;
  const now = new Date();

  for (let i = 0; i < numInstallments; i++) {
    const dueDate = addPeriod(purchaseDate, i + 1);
    
    let status = "upcoming";
    if (dueDate < now) {
      status = "overdue";
    }
    
    payments.push({
      amount: installmentAmount.toFixed(2),
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
        parseFloat(validated.totalPrice),
        parseFloat(validated.initialPayment),
        validated.paymentTerms,
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

  const httpServer = createServer(app);
  return httpServer;
}
