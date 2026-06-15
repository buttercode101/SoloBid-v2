import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import cors from "cors";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kkxgrsmmwajcbuuigayf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtreGdyc21td2FqY2J1dWlnYXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NzEyNzcsImV4cCI6MjA5NzA0NzI3N30.NUgq9WRf9q8LgOKEUBMg8sDufmR8jQIweDZwPPB71W4';

// Admin client — uses service role key (bypasses RLS). Falls back to anon key if service role not set.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");

// Auth Middleware (for future authenticated server routes)
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) throw error || new Error('Unauthorized');
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Error verifying auth token', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Rate Limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

const cronLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

async function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;

  const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };

  app.use(cors(corsOptions));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use('/api/', apiLimiter);

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

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      let sentCount = 0;
      let generatedCount = 0;
      const errors: any[] = [];

      // 1. Process Recurring Invoices
      const { data: recurringRows } = await supabaseAdmin
        .from('recurring_invoices')
        .select('*')
        .eq('status', 'active')
        .lte('next_issue_date', todayStr);

      for (const recurring of (recurringRows || [])) {
        try {
          if (!recurring.user_id) { errors.push({ id: recurring.id, error: "Missing user_id" }); continue; }
          if (!recurring.client_email) { errors.push({ id: recurring.id, error: "Missing client_email, skipping send" }); continue; }

          // Get user profile for invoice numbering
          const { data: userData } = await supabaseAdmin
            .from('users')
            .select('invoice_count, invoice_prefix, business_name')
            .eq('id', recurring.user_id)
            .single();

          if (!userData) { errors.push({ id: recurring.id, error: `User ${recurring.user_id} not found` }); continue; }

          const newCount = (userData.invoice_count || 0) + 1;
          const prefix = userData.invoice_prefix || 'INV-';
          const invoiceNumber = `${prefix}${newCount.toString().padStart(4, '0')}`;
          const invoiceId = crypto.randomUUID();
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 14);

          const { error: invError } = await supabaseAdmin.from('invoices').insert({
            id: invoiceId,
            user_id: recurring.user_id,
            quote_id: null,
            invoice_number: invoiceNumber,
            client_name: recurring.client_name,
            client_email: recurring.client_email,
            total: recurring.total || 0,
            currency: recurring.currency || 'ZAR',
            status: 'draft',
            due_date: dueDate.toISOString(),
          });
          if (invError) throw new Error(invError.message);

          await supabaseAdmin.from('users').update({ invoice_count: newCount }).eq('id', recurring.user_id);

          const nextDate = new Date(recurring.next_issue_date);
          if (recurring.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
          else if (recurring.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          else if (recurring.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

          await supabaseAdmin.from('recurring_invoices').update({
            next_issue_date: nextDate.toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          }).eq('id', recurring.id);

          // Send email notification
          if (recurring.client_email) {
            const appOrigin = process.env.APP_ORIGIN || 'https://solobid.app';
            const htmlTemplate = `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eee;border-radius:8px;">
                <h2 style="color:#333;">New Invoice: ${invoiceNumber}</h2>
                <p>Hi ${recurring.client_name},</p>
                <p>A new invoice <strong>#${invoiceNumber}</strong> for <strong>${recurring.currency === 'ZAR' ? 'R' : ''}${(recurring.total || 0).toFixed(2)}</strong> has been generated.</p>
                <p>Due date: ${dueDate.toLocaleDateString()}</p>
                <p>Thank you for your business!</p>
                <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
                <p style="color:#666;font-size:14px;text-align:center;">Powered by SoloBid</p>
              </div>
            `;
            try {
              await resend.emails.send({
                from: "SoloBid <noreply@solobid.app>",
                to: recurring.client_email,
                subject: `New Invoice #${invoiceNumber} from ${userData.business_name || 'SoloBid'}`,
                html: htmlTemplate,
              });
              sentCount++;
            } catch (e) {
              errors.push({ id: recurring.id, error: `Email failed: ${(e as any).message}` });
            }
          }

          generatedCount++;
        } catch (error) {
          errors.push({ id: recurring.id, error: (error as any).message || "Unknown error" });
        }
      }

      // 2. Process Reminders
      const { data: invoiceRows } = await supabaseAdmin
        .from('invoices')
        .select('*, users!inner(business_name)')
        .in('status', ['sent', 'overdue']);

      for (const invoice of (invoiceRows || [])) {
        if (!invoice.due_date) continue;

        const dueDate = new Date(invoice.due_date);
        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === -3 || diffDays === 0 || diffDays === 7 || diffDays === 14) {
          const isOverdue = diffDays > 0;
          const statusText = isOverdue ? 'OVERDUE' : diffDays === 0 ? 'DUE TODAY' : 'DUE SOON';
          const invoiceRef = invoice.invoice_number || invoice.id.substring(0, 8).toUpperCase();
          const contractor = (invoice as any).users;

          if (isOverdue && invoice.status !== 'overdue') {
            await supabaseAdmin.from('invoices').update({ status: 'overdue' }).eq('id', invoice.id);
          }

          if (invoice.client_email && contractor) {
            const htmlTemplate = `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eee;border-radius:8px;">
                <h2 style="color:#333;">Invoice Reminder: ${statusText}</h2>
                <p>Hi ${invoice.client_name},</p>
                <p>This is a friendly reminder that invoice <strong>#${invoiceRef}</strong> for <strong>${invoice.currency === 'ZAR' ? 'R' : ''}${(invoice.total || 0).toFixed(2)}</strong> is ${statusText.toLowerCase()}.</p>
                <div style="background-color:#f9fafb;padding:15px;border-radius:6px;margin:20px 0;">
                  <p style="margin:0 0 10px 0;"><strong>Amount Due:</strong> ${invoice.currency === 'ZAR' ? 'R' : ''}${(invoice.total || 0).toFixed(2)}</p>
                  <p style="margin:0;"><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                </div>
                <p>Please arrange payment at your earliest convenience.</p>
                <p>Thank you for your business!</p>
                <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
                <p style="color:#666;font-size:14px;text-align:center;">Powered by SoloBid</p>
              </div>
            `;
            try {
              await resend.emails.send({
                from: "SoloBid <noreply@solobid.app>",
                to: invoice.client_email,
                subject: `Reminder: Invoice #${invoiceRef} is ${statusText.toLowerCase()}`,
                html: htmlTemplate,
              });
              sentCount++;
            } catch (e) {
              errors.push({ id: invoice.id, error: `Email failed: ${(e as any).message}` });
            }
          }

          if (invoice.client_phone) {
            try {
              const rawPhone = (invoice.client_phone as string).replace(/\D/g, '');
              const phone = rawPhone.startsWith('0') ? `27${rawPhone.slice(1)}` : rawPhone;
              const amount = `${invoice.currency === 'ZAR' ? 'R' : ''}${(invoice.total || 0).toFixed(2)}`;
              const businessName = contractor?.business_name || 'Your contractor';
              const msg = `Hi ${invoice.client_name}, just a reminder that invoice #${invoiceRef} for *${amount}* is *${statusText}* (due ${dueDate.toLocaleDateString()}). Please arrange payment. — ${businessName}`;
              const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
              await supabaseAdmin.from('invoices').update({
                whatsapp_reminder_link: waLink,
                whatsapp_reminder_status: statusText,
                whatsapp_reminder_at: now.toISOString()
              }).eq('id', invoice.id);
            } catch (e) {
              console.error("Failed to generate WhatsApp reminder:", (e as any).message);
            }
          }
        }
      }

      // Log cron run
      await supabaseAdmin.from('cron_logs').insert({
        type: 'reminders',
        run_at: now.toISOString(),
        sent_count: sentCount,
        generated_count: generatedCount,
        error_count: errors.length,
        errors: errors.length > 0 ? errors : null,
      });

      res.json({ status: "ok", sentCount, generatedCount, errorCount: errors.length });
    } catch (error: any) {
      console.error("Cron error:", error);

      try {
        await supabaseAdmin.from('cron_logs').insert({
          type: 'reminders',
          run_at: new Date().toISOString(),
          error: error.message || "Internal server error",
        });
      } catch (logError) {
        console.error("Failed to log cron error:", logError);
      }

      res.status(500).json({ error: "Internal server error running cron task." });
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

  // POST /api/quotes/:id/approve — public, no auth required
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
      const { data: quote, error: fetchError } = await supabaseAdmin
        .from('quotes')
        .select('id, status, expires_at')
        .eq('id', id)
        .single();

      if (fetchError || !quote) {
        return res.status(404).json({ error: 'Quote not found.' });
      }
      if (quote.status !== 'sent') {
        return res.status(409).json({ error: 'This quotation is not currently open for approval.' });
      }
      if (quote.expires_at && new Date() > new Date(quote.expires_at)) {
        return res.status(410).json({ error: 'This quotation has expired. Contact the contractor for a renewed quote.' });
      }

      const approvedAt = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from('quotes')
        .update({ status: 'approved', signature_name: signatureName.trim(), signature_data_url: signatureDataUrl, approved_at: approvedAt })
        .eq('id', id);

      if (updateError) throw new Error(updateError.message);

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
      const { data: quote, error: fetchError } = await supabaseAdmin
        .from('quotes')
        .select('id, status, expires_at')
        .eq('id', id)
        .single();

      if (fetchError || !quote) {
        return res.status(404).json({ error: 'Quote not found.' });
      }
      if (quote.status !== 'sent') {
        return res.status(409).json({ error: 'This quotation is not currently open for rejection.' });
      }
      if (quote.expires_at && new Date() > new Date(quote.expires_at)) {
        return res.status(410).json({ error: 'This quotation has already expired.' });
      }

      const rejectedAt = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from('quotes')
        .update({ status: 'rejected', rejection_reason: rejectionReason, rejected_at: rejectedAt })
        .eq('id', id);

      if (updateError) throw new Error(updateError.message);

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
