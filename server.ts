import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { Resend } from "resend";
import cors from "cors";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
import fs from 'fs';

let _firestoreDatabaseId: string | undefined = process.env.FIRESTORE_DATABASE_ID;

if (!admin.apps.length) {
  try {
    let projectId = process.env.FIREBASE_PROJECT_ID || "your-project-id";
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!process.env.FIREBASE_PROJECT_ID) projectId = config.projectId;
        if (!_firestoreDatabaseId) _firestoreDatabaseId = config.firestoreDatabaseId;
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

// Get a Firestore instance pointing to the correct named database
function getAdminDb() {
  return _firestoreDatabaseId
    ? getFirestore(admin.app(), _firestoreDatabaseId)
    : getFirestore(admin.app());
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

  // Cron route for reminders and recurring invoices
  app.get("/api/cron/reminders", cronLimiter, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const db = getAdminDb();
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
            
            const invoiceId = getAdminDb().collection('invoices').doc().id;
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
            const userDoc = await db.collection("users").doc(invoice.uid).get();
            const contractor = userDoc.data();
            const hasEmail = !!(invoice.clientEmail && contractor);
            const hasPhone = !!(invoice.clientPhone);

            if ((hasEmail || hasPhone) && contractor) {
              const isOverdue = diffDays > 0;
              const statusText = isOverdue ? 'OVERDUE' : diffDays === 0 ? 'DUE TODAY' : 'DUE SOON';
              const invoiceRef = invoice.invoiceNumber || invoice.id.substring(0, 8).toUpperCase();
              const appOrigin = process.env.APP_ORIGIN || 'https://solobid.app';

              // Mark overdue status first
              if (isOverdue && invoice.status !== 'overdue') {
                await docSnap.ref.update({ status: 'overdue' });
              }

              // Send email reminder if client has email
              if (hasEmail) {
                const htmlTemplate = `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #333;">Invoice Reminder: ${statusText}</h2>
                    <p>Hi ${invoice.clientName},</p>
                    <p>This is a friendly reminder that invoice <strong>#${invoiceRef}</strong> for <strong>${invoice.currency === 'ZAR' ? 'R' : ''}${invoice.total.toFixed(2)}</strong> is ${statusText.toLowerCase()}.</p>
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                      <p style="margin: 0 0 10px 0;"><strong>Amount Due:</strong> ${invoice.currency === 'ZAR' ? 'R' : ''}${invoice.total.toFixed(2)}</p>
                      <p style="margin: 0;"><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                    </div>
                    <p>Please arrange payment at your earliest convenience.</p>
                    <p>Thank you for your business!</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="color: #666; font-size: 14px; text-align: center;">Powered by SoloBid</p>
                  </div>
                `;
                try {
                  await resend.emails.send({
                    from: "SoloBid <noreply@solobid.app>",
                    to: invoice.clientEmail,
                    subject: `Reminder: Invoice #${invoiceRef} is ${statusText.toLowerCase()}`,
                    html: htmlTemplate,
                  });
                  sentCount++;
                } catch (e) {
                  console.error("Failed to send reminder email:", (e as any).message);
                  errors.push({ id: docSnap.id, error: `Email failed: ${(e as any).message}` });
                }
              }

              // Generate WhatsApp reminder link and store it on the invoice for the contractor
              if (hasPhone) {
                try {
                  const rawPhone = (invoice.clientPhone as string).replace(/\D/g, '');
                  const phone = rawPhone.startsWith('0') ? `27${rawPhone.slice(1)}` : rawPhone;
                  const amount = `${invoice.currency === 'ZAR' ? 'R' : ''}${invoice.total.toFixed(2)}`;
                  const msg = `Hi ${invoice.clientName}, just a reminder that invoice #${invoiceRef} for *${amount}* is *${statusText}* (due ${dueDate.toLocaleDateString()}). Please arrange payment. — ${contractor.businessName || 'Your contractor'}`;
                  const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                  // Store the WhatsApp reminder link on the invoice so the contractor can send it
                  await docSnap.ref.update({ whatsappReminderLink: waLink, whatsappReminderStatus: statusText, whatsappReminderAt: now.toISOString() });
                } catch (e) {
                  console.error("Failed to generate WhatsApp reminder:", (e as any).message);
                }
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
        await getAdminDb().collection('cronLogs').add({
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

  // Rate limiter for client approval actions
  const approvalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
  });

  // POST /api/quotes/:id/approve — public, no auth required (quote ID is the access token)
  app.post('/api/quotes/:id/approve', approvalLimiter, async (req, res) => {
    const { id } = req.params;
    if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid quote ID.' });
    }

    const { signatureName, signatureDataUrl } = req.body;

    if (typeof signatureName !== 'string' || signatureName.trim().length < 2 || signatureName.trim().length > 100) {
      return res.status(400).json({ error: 'Please enter your full name to sign (2–100 characters).' });
    }
    if (typeof signatureDataUrl !== 'string' || signatureDataUrl.length < 20) {
      return res.status(400).json({ error: 'Please draw your signature before approving.' });
    }
    if (!signatureDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid signature format. Please clear and redraw your signature.' });
    }

    try {
      const firestoreDb = getAdminDb();

      // Try quotes first, then fall back to legacy estimates collection
      let quoteRef: any = null;
      let quote: any = null;

      const quotesSnap = await firestoreDb.collection('quotes').doc(id).get();
      if (quotesSnap.exists) {
        quoteRef = quotesSnap.ref;
        quote = quotesSnap.data()!;
      } else {
        const estimatesSnap = await firestoreDb.collection('estimates').doc(id).get();
        if (estimatesSnap.exists) {
          quoteRef = estimatesSnap.ref;
          quote = estimatesSnap.data()!;
        }
      }

      if (!quoteRef || !quote) {
        return res.status(404).json({ error: 'Quote not found.' });
      }
      if (quote.status !== 'sent') {
        return res.status(409).json({ error: 'This quotation is not currently open for approval.' });
      }
      if (quote.expiresAt && new Date() > new Date(quote.expiresAt)) {
        return res.status(410).json({ error: 'This quotation has expired. Contact the contractor for a renewed quote.' });
      }

      const approvedAt = new Date().toISOString();
      await quoteRef.update({ status: 'approved', signatureName: signatureName.trim(), signatureDataUrl, approvedAt });

      return res.json({ success: true, approvedAt });
    } catch (error: any) {
      console.error('Error approving quote:', error);
      return res.status(500).json({ error: 'Failed to approve quotation. Please try again.' });
    }
  });

  // POST /api/quotes/:id/decline — public, no auth required
  app.post('/api/quotes/:id/decline', approvalLimiter, async (req, res) => {
    const { id } = req.params;
    if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid quote ID.' });
    }

    const rejectionReason = typeof req.body.rejectionReason === 'string'
      ? req.body.rejectionReason.trim().slice(0, 1000)
      : '';

    try {
      const firestoreDb = getAdminDb();

      let quoteRef: any = null;
      let quote: any = null;

      const quotesSnap = await firestoreDb.collection('quotes').doc(id).get();
      if (quotesSnap.exists) {
        quoteRef = quotesSnap.ref;
        quote = quotesSnap.data()!;
      } else {
        const estimatesSnap = await firestoreDb.collection('estimates').doc(id).get();
        if (estimatesSnap.exists) {
          quoteRef = estimatesSnap.ref;
          quote = estimatesSnap.data()!;
        }
      }

      if (!quoteRef || !quote) {
        return res.status(404).json({ error: 'Quote not found.' });
      }
      if (quote.status !== 'sent') {
        return res.status(409).json({ error: 'This quotation is not currently open for rejection.' });
      }
      if (quote.expiresAt && new Date() > new Date(quote.expiresAt)) {
        return res.status(410).json({ error: 'This quotation has already expired.' });
      }

      const rejectedAt = new Date().toISOString();
      await quoteRef.update({ status: 'rejected', rejectionReason, rejectedAt });

      return res.json({ success: true, rejectedAt });
    } catch (error: any) {
      console.error('Error declining quote:', error);
      return res.status(500).json({ error: 'Failed to decline quotation. Please try again.' });
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
