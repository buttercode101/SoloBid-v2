import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { Resend } from "resend";
import ReactPDF from "@react-pdf/renderer";
import React from "react";
import { InvoicePDF } from "./src/components/InvoicePDF.js";
import cors from "cors";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
import fs from 'fs';

if (!admin.apps.length) {
  try {
    let projectId = process.env.FIREBASE_PROJECT_ID || "your-project-id";
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath) && !process.env.FIREBASE_PROJECT_ID) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        projectId = config.projectId;
      }
    } catch (e) {
      console.warn("Could not read firebase-applet-config.json for admin init", e);
    }
    
    admin.initializeApp({
      projectId
    });
  } catch (error) {
    console.warn("Failed to initialize Firebase Admin.", error);
  }
}

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");

// Auth Middleware
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying auth token', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Rate Limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

const cronLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit cron to 5 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

async function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;

  // CORS configuration
  const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };

  app.use(cors(corsOptions));

  // CSRF token/security headers for state-changing operations
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use('/api/', apiLimiter);

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/send-email", requireAuth, async (req, res) => {
    try {
      const { to, subject, html, attachments } = req.body;
      
      if (!to || !subject || !html) {
        return res.status(400).json({ error: "Missing required fields: to, subject, and html are required." });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return res.status(400).json({ error: "Invalid email address format." });
      }

      const data = await resend.emails.send({
        from: "SoloBid <noreply@solobid.app>",
        to,
        subject,
        html,
        attachments
      });

      res.json({ status: "ok", data });
    } catch (error: any) {
      console.error("Email sending error:", error);
      // Don't expose internal Resend API errors directly to the client if possible
      let errorMessage = "Failed to send email. Please try again later.";
      if (error.statusCode === 401 || error.message?.includes('Unauthorized')) {
          errorMessage = "Email service configuration error. Please contact support.";
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post("/api/send-invoice", requireAuth, async (req, res) => {
    try {
      const { invoiceId } = req.body;
      if (!invoiceId) return res.status(400).json({ error: "Missing invoiceId" });

      const db = admin.firestore();
      const invoiceDoc = await db.collection("invoices").doc(invoiceId).get();
      if (!invoiceDoc.exists) return res.status(404).json({ error: "Invoice not found" });
      
      const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as any;
      
      // Security check: ensure the user owns the invoice
      if (invoice.uid !== (req as any).user.uid) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      const estimateDoc = await db.collection("estimates").doc(invoice.estimateId).get();
      const estimate = estimateDoc.data();
      
      const userDoc = await db.collection("users").doc(invoice.uid).get();
      const contractor = userDoc.data();
      
      const itemsSnap = await db.collection("estimates").doc(invoice.estimateId).collection("lineItems").get();
      const lineItems = itemsSnap.docs.map(d => d.data());

      // Generate PDF on server
      const pdfStream = await ReactPDF.renderToStream(
        React.createElement(InvoicePDF, { invoice, estimate, contractor, lineItems }) as any
      );
      
      const chunks: any[] = [];
      pdfStream.on('data', chunk => chunks.push(chunk));
      pdfStream.on('end', async () => {
        const pdfBuffer = Buffer.concat(chunks);
        const base64Pdf = pdfBuffer.toString('base64');

        const invoiceNum = invoice.invoiceNumber || invoice.id.substring(0, 8).toUpperCase();

        const htmlTemplate = `
          <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #333;">Invoice from ${contractor?.businessName}</h2>
            <p>Hi ${invoice.clientName},</p>
            <p>Please find attached your invoice <strong>#${invoiceNum}</strong> for <strong>$${invoice.total.toFixed(2)}</strong>.</p>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Amount Due:</strong> $${invoice.total.toFixed(2)}</p>
              <p style="margin: 0;"><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="#" style="background-color: #18181b; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Pay Online (Coming Soon)</a>
            </div>
            <p>Thank you for your business!</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 14px; text-align: center;">Powered by SoloBid</p>
          </div>
        `;

        try {
          await resend.emails.send({
            from: "SoloBid <noreply@solobid.app>",
            to: invoice.clientEmail,
            subject: `Invoice #${invoiceNum} from ${contractor?.businessName}`,
            html: htmlTemplate,
            attachments: [
              {
                filename: `Invoice_${invoiceNum}.pdf`,
                content: base64Pdf
              }
            ]
          });
          
          await invoiceDoc.ref.update({ status: 'sent' });
          res.json({ status: "ok" });
        } catch (e: any) {
          console.error("Failed to send email", e);
          let errorMessage = "Failed to send the invoice email. Please try again later.";
          if (e.statusCode === 401 || e.message?.includes('Unauthorized')) {
             errorMessage = "Email service configuration error. Please contact support.";
          }
          res.status(500).json({ error: errorMessage });
        }
      });
    } catch (error: any) {
      console.error("Server error:", error);
      res.status(500).json({ error: "An unexpected server error occurred while sending the invoice." });
    }
  });

  // Cron route for reminders and recurring invoices
  app.get("/api/cron/reminders", cronLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const db = admin.firestore();
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      let sentCount = 0;
      let generatedCount = 0;
      const errors: any[] = [];

      // 1. Process Recurring Invoices
      const recurringRef = db.collection("recurringInvoices");
      const recurringSnap = await recurringRef
        .where("status", "==", "active")
        .where("nextIssueDate", "<=", todayStr)
        .get();
      
      for (const docSnap of recurringSnap.docs) {
        try {
          const recurring = docSnap.data();
          
          // Validate required fields
          if (!recurring.uid) {
            errors.push({ 
              id: docSnap.id, 
              error: "Missing uid" 
            });
            continue;
          }
          
          if (!recurring.clientEmail) {
            errors.push({ 
              id: docSnap.id, 
              error: "Missing clientEmail, skipping send" 
            });
            continue;
          }
          
          // Validate nextIssueDate
          try {
            new Date(recurring.nextIssueDate); // Will throw if invalid
          } catch {
            errors.push({ 
              id: docSnap.id, 
              error: "Invalid nextIssueDate format" 
            });
            continue;
          }
          
          // Generate new invoice
          await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(recurring.uid);
            const userDoc = await transaction.get(userRef);
            
            if (!userDoc.exists) {
              throw new Error(`User ${recurring.uid} not found`);
            }
            
            const userData = userDoc.data()!;
            const currentCount = userData.invoiceCount || 0;
            const newCount = currentCount + 1;
            const prefix = userData.invoicePrefix || 'INV-';
            const invoiceNumber = `${prefix}${newCount.toString().padStart(4, '0')}`;
            
            transaction.update(userRef, { invoiceCount: newCount });
            
            const invoiceId = admin.firestore().collection('invoices').doc().id;
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 14);
            
            const invoiceData = {
              id: invoiceId,
              uid: recurring.uid,
              estimateId: recurring.id,
              invoiceNumber,
              clientName: recurring.clientName,
              clientEmail: recurring.clientEmail,
              total: recurring.total || 0,
              currency: recurring.currency || 'ZAR',
              status: 'draft',
              dueDate: dueDate.toISOString(),
              createdAt: new Date().toISOString()
            };
            
            transaction.set(db.collection('invoices').doc(invoiceId), invoiceData);
            
            // Calculate next issue date safely
            const nextDate = new Date(recurring.nextIssueDate);
            if (recurring.frequency === 'weekly') {
              nextDate.setDate(nextDate.getDate() + 7);
            } else if (recurring.frequency === 'monthly') {
              nextDate.setMonth(nextDate.getMonth() + 1);
            } else if (recurring.frequency === 'yearly') {
              nextDate.setFullYear(nextDate.getFullYear() + 1);
            }
            
            transaction.update(docSnap.ref, { 
              nextIssueDate: nextDate.toISOString().split('T')[0],
              updatedAt: new Date().toISOString(),
              lastGeneratedInvoice: invoiceId
            });
            
            generatedCount++;
          });
        } catch (error) {
          errors.push({
            id: docSnap.id,
            error: (error as any).message || "Unknown error"
          });
        }
      }
      
      // 2. Process Reminders
      const invoicesRef = db.collection("invoices");
      const snapshot = await invoicesRef.where("status", "in", ["sent", "overdue"]).get();
      
      for (const docSnap of snapshot.docs) {
        const invoice = docSnap.data();
        if (!invoice.dueDate) continue;
        
        const dueDate = new Date(invoice.dueDate);
        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Send reminder if 3 days before, on due date, or 7/14 days overdue
        if (diffDays === -3 || diffDays === 0 || diffDays === 7 || diffDays === 14) {
          if (invoice.estimateId) {
            // It could be an estimateId or recurringId, but we just need clientEmail
            const userDoc = await db.collection("users").doc(invoice.uid).get();
            const contractor = userDoc.data();
            
            if (invoice.clientEmail && contractor) {
              const isOverdue = diffDays > 0;
              const statusText = isOverdue ? 'OVERDUE' : diffDays === 0 ? 'DUE TODAY' : 'DUE SOON';
              
              const htmlTemplate = `
                <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                  <h2 style="color: #333;">Invoice Reminder: ${statusText}</h2>
                  <p>Hi ${invoice.clientName},</p>
                  <p>This is a friendly reminder that invoice <strong>#${invoice.invoiceNumber || invoice.id.substring(0, 8).toUpperCase()}</strong> for <strong>$${invoice.total.toFixed(2)}</strong> is ${statusText.toLowerCase()}.</p>
                  <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>Amount Due:</strong> $${invoice.total.toFixed(2)}</p>
                    <p style="margin: 0;"><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                  </div>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="#" style="background-color: #18181b; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Pay Online (Coming Soon)</a>
                  </div>
                  <p>Please arrange for payment at your earliest convenience.</p>
                  <p>Thank you for your business!</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                  <p style="color: #666; font-size: 14px; text-align: center;">Powered by SoloBid</p>
                </div>
              `;

              try {
                await resend.emails.send({
                  from: "SoloBid <noreply@solobid.app>",
                  to: invoice.clientEmail,
                  subject: `Reminder: Invoice #${invoice.invoiceNumber || invoice.id.substring(0, 8).toUpperCase()} is ${statusText.toLowerCase()}`,
                  html: htmlTemplate,
                });
                
                if (isOverdue && invoice.status !== 'overdue') {
                  await docSnap.ref.update({ status: 'overdue' });
                }
                sentCount++;
              } catch (e) {
                console.error("Failed to send reminder email", e);
                errors.push({ id: docSnap.id, error: "Failed to send reminder email" });
              }
            }
          }
        }
      }

      // Log cron run with error details
      await db.collection('cronLogs').add({
        type: 'reminders',
        runAt: now.toISOString(),
        sentCount,
        generatedCount,
        errorCount: errors.length,
        errors: errors.length > 0 ? errors : undefined
      });

      res.json({ 
        status: "ok", 
        sentCount, 
        generatedCount,
        // Optional: you can choose not to send detailed errors in the API response or sanitize them
        errorCount: errors.length
      });
    } catch (error: any) {
      console.error("Cron error:", error);
      
      try {
        await admin.firestore().collection('cronLogs').add({
          type: 'reminders',
          runAt: new Date().toISOString(),
          error: error.message || "Internal server error",
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } catch (logError) {
        console.error("Failed to log cron error:", logError);
      }

      res.status(500).json({ 
        error: "Internal server error running cron task."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

// Only start the server if this file is run directly
const isMain = process.argv[1] === fileURLToPath(import.meta.url) || 
               process.argv[1]?.endsWith("server.ts") || 
               process.argv[1]?.endsWith("server.cjs");
if (isMain) {
  const PORT = 3000;
  createApp().then(app => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

export { createApp };
