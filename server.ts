import express from "express";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import cors from "cors";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[SoloBid] Missing SUPABASE_URL or SUPABASE_ANON_KEY — set these in your environment variables.');
}

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

  // Compression middleware — brotli preferred, gzip fallback
  // Buffers the full response then compresses it (safe for static files, JSON APIs)
  app.use((req, res, next) => {
    const ae = (req.headers['accept-encoding'] as string) ?? '';
    const supportsBr = ae.includes('br');
    const supportsGzip = ae.includes('gzip');
    if (!supportsBr && !supportsGzip) return next();

    const chunks: Buffer[] = [];
    const _write = res.write.bind(res);
    const _end = res.end.bind(res);

    let intercepting = false;
    let ended = false;

    const maybeIntercept = () => {
      const ct = (res.getHeader('Content-Type') as string) ?? '';
      const ce = (res.getHeader('Content-Encoding') as string) ?? '';
      if (ce) return false; // already encoded
      if (!/text|javascript|json|xml|svg/.test(ct)) return false;
      return true;
    };

    const flush = async (finalChunk?: Buffer) => {
      if (ended) return;
      ended = true;
      if (finalChunk) chunks.push(finalChunk);
      const body = Buffer.concat(chunks);
      if (body.length < 512) {
        // Too small to compress
        _write(body);
        _end();
        return;
      }
      try {
        let compressed: Buffer;
        if (supportsBr) {
          compressed = await new Promise<Buffer>((resolve, reject) =>
            zlib.brotliCompress(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }, (e, r) => e ? reject(e) : resolve(r))
          );
          res.setHeader('Content-Encoding', 'br');
        } else {
          compressed = await new Promise<Buffer>((resolve, reject) =>
            zlib.gzip(body, { level: 6 }, (e, r) => e ? reject(e) : resolve(r))
          );
          res.setHeader('Content-Encoding', 'gzip');
        }
        res.setHeader('Content-Length', compressed.length);
        _write(compressed);
        _end();
      } catch {
        _write(body);
        _end();
      }
    };

    res.write = function(chunk: any, encoding?: any, callback?: any) {
      if (!intercepting) {
        intercepting = maybeIntercept();
        if (intercepting) res.removeHeader('Content-Length');
      }
      if (intercepting) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding as BufferEncoding : 'utf8'));
        if (typeof encoding === 'function') encoding();
        else if (typeof callback === 'function') callback();
        return true;
      }
      return _write(chunk, encoding, callback);
    } as any;

    res.end = function(chunk?: any, encoding?: any, callback?: any) {
      if (!intercepting) {
        intercepting = maybeIntercept();
        if (intercepting) res.removeHeader('Content-Length');
      }
      if (intercepting) {
        const buf = chunk ? (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding as BufferEncoding : 'utf8')) : undefined;
        flush(buf).then(() => {
          if (typeof encoding === 'function') encoding();
          else if (typeof callback === 'function') callback();
        });
        return this;
      }
      return _end(chunk, encoding, callback);
    } as any;

    next();
  });

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

  // Send quote link to client by email
  app.post("/api/quotes/:id/send-email", requireAuth, async (req: express.Request, res: express.Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const { clientEmail, clientName } = req.body;

      if (!clientEmail || typeof clientEmail !== 'string' || !clientEmail.includes('@')) {
        return res.status(400).json({ error: 'Valid client email is required' });
      }

      const { data: quote, error: qErr } = await supabaseAdmin
        .from('quotes')
        .select('id, client_name, total, currency, contractor_business_name, quote_number, expires_at')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (qErr || !quote) {
        return res.status(404).json({ error: 'Quote not found or access denied' });
      }

      const appOrigin = process.env.APP_ORIGIN || 'https://solobids.vercel.app';
      const quoteUrl = `${appOrigin}/client/quote/${id}`;
      const currencySymbol = quote.currency === 'ZAR' ? 'R' : quote.currency === 'USD' ? '$' : quote.currency === 'EUR' ? '€' : quote.currency === 'GBP' ? '£' : '';
      const ref = quote.quote_number || `#${id.substring(0, 8).toUpperCase()}`;
      const name = clientName || quote.client_name || 'there';
      const business = quote.contractor_business_name || 'Your service provider';
      const expiryNote = quote.expires_at ? `<p style="color:#6b7280;font-size:13px;">This quote expires on <strong>${new Date(quote.expires_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</strong>.</p>` : '';

      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <div style="background:#052e26;padding:28px 32px;">
            <p style="color:#6ee7b7;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 4px;">SoloBid</p>
            <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">You have a quote to review</h1>
          </div>
          <div style="padding:28px 32px;">
            <p style="color:#111827;font-size:15px;">Hi ${name},</p>
            <p style="color:#374151;font-size:15px;line-height:1.6;"><strong>${business}</strong> has sent you a quote ${ref} for <strong>${currencySymbol}${(quote.total || 0).toFixed(2)}</strong>. Please review and approve or decline at your convenience.</p>
            ${expiryNote}
            <div style="margin:28px 0;text-align:center;">
              <a href="${quoteUrl}" style="display:inline-block;background:#052e26;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;text-decoration:none;">Review Quote ${ref}</a>
            </div>
            <p style="color:#9ca3af;font-size:12px;text-align:center;">No account needed. The link above opens the full quote in your browser.</p>
          </div>
          <div style="border-top:1px solid #f3f4f6;padding:16px 32px;text-align:center;">
            <p style="color:#d1d5db;font-size:11px;margin:0;">Powered by <a href="https://solobids.vercel.app" style="color:#6ee7b7;text-decoration:none;">SoloBid</a></p>
          </div>
        </div>`;

      await resend.emails.send({
        from: 'SoloBid <noreply@solobid.app>',
        to: clientEmail.trim(),
        subject: `Quote ${ref} from ${business} — ${currencySymbol}${(quote.total || 0).toFixed(2)}`,
        html,
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error('send-email error:', err);
      res.status(500).json({ error: err.message || 'Failed to send email' });
    }
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

      // 2. Process Recurring Quotes
      const { data: recurringQuoteRows } = await supabaseAdmin
        .from('recurring_quotes')
        .select('*, clients(name, email, address)')
        .eq('status', 'active')
        .lte('next_issue_date', todayStr);

      for (const rq of (recurringQuoteRows || [])) {
        try {
          if (!rq.user_id) { errors.push({ id: rq.id, error: "Missing user_id" }); continue; }

          // Get user profile for quote numbering
          const { data: userData } = await supabaseAdmin
            .from('users')
            .select('quote_count, quote_prefix')
            .eq('id', rq.user_id)
            .single();

          if (!userData) { errors.push({ id: rq.id, error: `User ${rq.user_id} not found` }); continue; }

          // Fetch template quote
          const { data: templateQuote } = await supabaseAdmin
            .from('quotes')
            .select('*')
            .eq('id', rq.template_quote_id)
            .single();

          if (!templateQuote) { errors.push({ id: rq.id, error: `Template quote ${rq.template_quote_id} not found` }); continue; }

          // Fetch template quote line items
          const { data: templateLineItems } = await supabaseAdmin
            .from('line_items')
            .select('*')
            .eq('quote_id', rq.template_quote_id);

          const newCount = (userData.quote_count || 0) + 1;
          const prefix = userData.quote_prefix || 'QTE-';
          const quoteNumber = `${prefix}${newCount.toString().padStart(4, '0')}`;
          const newQuoteId = crypto.randomUUID();

          const clientData = rq.clients;
          const { error: qErr } = await supabaseAdmin.from('quotes').insert({
            id: newQuoteId,
            user_id: rq.user_id,
            client_id: rq.client_id,
            client_name: rq.client_name || (clientData?.name ?? ''),
            client_email: clientData?.email ?? null,
            client_address: clientData?.address ?? null,
            quote_number: quoteNumber,
            status: 'draft',
            subtotal: templateQuote.subtotal ?? 0,
            tax_amount: templateQuote.tax_amount ?? 0,
            total: templateQuote.total ?? 0,
            tax_rate: templateQuote.tax_rate ?? 0,
            currency: templateQuote.currency || 'ZAR',
            is_sa_tax_invoice: templateQuote.is_sa_tax_invoice,
            notes: templateQuote.notes,
          });
          if (qErr) throw new Error(qErr.message);

          // Copy line items
          if (templateLineItems && templateLineItems.length > 0) {
            const newLineItems = templateLineItems.map((li: any) => ({
              id: crypto.randomUUID(),
              quote_id: newQuoteId,
              template_id: null,
              recurring_invoice_id: null,
              description: li.description,
              qty: li.qty,
              unit_cost: li.unit_cost,
              type: li.type,
              markup_percent: li.markup_percent,
              sort_order: li.sort_order,
            }));
            await supabaseAdmin.from('line_items').insert(newLineItems);
          }

          await supabaseAdmin.from('users').update({ quote_count: newCount }).eq('id', rq.user_id);

          const nextDate = new Date(rq.next_issue_date);
          if (rq.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
          else if (rq.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          else if (rq.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

          await supabaseAdmin.from('recurring_quotes').update({
            next_issue_date: nextDate.toISOString().split('T')[0],
            updated_at: new Date().toISOString(),
          }).eq('id', rq.id);

          generatedCount++;
        } catch (error) {
          errors.push({ id: rq.id, error: (error as any).message || "Unknown error" });
        }
      }

      // 3. Process Reminders
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

  // Mark invoice as paid (called after client-side Paystack success)
  app.post('/api/invoices/:id/mark-paid', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { reference } = req.body;
      const uid = (req as any).user.id;

      // Verify the invoice belongs to this user
      const { data: invoice } = await supabaseAdmin
        .from('invoices')
        .select('id, user_id, status')
        .eq('id', id)
        .eq('user_id', uid)
        .single();

      if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

      await supabaseAdmin
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString(), paystack_reference: reference })
        .eq('id', id);

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to mark invoice as paid' });
    }
  });

  // Paystack webhook (for server-side payment confirmation)
  // TODO: PAYSTACK LIVE MODE — before switching to live keys (sk_live_), verify:
  //   1. ButterCode Systems Paystack account is approved.
  //   2. PAYSTACK_SECRET_KEY env var is updated to sk_live_ on Vercel.
  //   3. Webhook URL is registered in the Paystack dashboard (Settings → Webhooks).
  //   4. Webhook signature verification below remains enabled (do not disable).
  app.post('/api/webhooks/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
    // Respond immediately
    res.status(200).json({ received: true });

    try {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecret) return;

      const signature = req.headers['x-paystack-signature'] as string;
      const body = req.body;

      const hash = require('crypto')
        .createHmac('sha512', paystackSecret)
        .update(body)
        .digest('hex');

      if (hash !== signature) {
        console.warn('[Paystack webhook] Invalid signature');
        return;
      }

      const event = JSON.parse(body.toString());

      if (event.event === 'charge.success') {
        const reference = event.data.reference;
        const metadata = event.data.metadata || {};
        const invoiceId = metadata.invoiceId;

        if (!invoiceId) return;

        // Idempotency check
        const { data: existing } = await supabaseAdmin
          .from('webhook_logs')
          .select('id')
          .eq('reference', reference)
          .single();

        if (existing) return; // Already processed

        // Log webhook
        await supabaseAdmin.from('webhook_logs').insert({
          provider: 'paystack',
          reference,
          payload: event.data,
          status: 'processed',
        });

        // Update invoice
        await supabaseAdmin
          .from('invoices')
          .update({ status: 'paid', paid_at: new Date().toISOString(), paystack_reference: reference })
          .eq('id', invoiceId)
          .in('status', ['sent', 'overdue']);
      }
    } catch (err) {
      console.error('[Paystack webhook] Error:', err);
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
    const indexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf8");

    // Pre-compress all JS/CSS assets into memory at startup (brotli + gzip).
    // Subsequent requests are served from this cache with zero compression overhead.
    type CompressedEntry = { br: Buffer | null; gz: Buffer | null; raw: Buffer; etag: string; mtime: Date; contentType: string };
    const assetCache = new Map<string, CompressedEntry>();

    const COMPRESSIBLE = /\.(js|css|json|svg|xml|txt|woff2?)$/i;
    const MIME_MAP: Record<string, string> = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
      '.woff': 'font/woff',
    };

    const walkAndCache = async (dir: string, urlBase: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        const url = `${urlBase}/${entry.name}`;
        if (entry.isDirectory()) {
          await walkAndCache(abs, url);
        } else if (COMPRESSIBLE.test(entry.name)) {
          const raw = fs.readFileSync(abs);
          const stat = fs.statSync(abs);
          const ext = path.extname(entry.name).toLowerCase();
          const contentType = MIME_MAP[ext] ?? 'application/octet-stream';
          const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
          let br: Buffer | null = null;
          let gz: Buffer | null = null;
          if (raw.length > 512) {
            [br, gz] = await Promise.all([
              new Promise<Buffer>((res, rej) =>
                zlib.brotliCompress(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }, (e, r) => e ? rej(e) : res(r))
              ).catch(() => null),
              new Promise<Buffer>((res, rej) =>
                zlib.gzip(raw, { level: 6 }, (e, r) => e ? rej(e) : res(r))
              ).catch(() => null),
            ]);
          }
          assetCache.set(url, { br, gz, raw, etag, mtime: stat.mtime, contentType });
        }
      }
    };

    await walkAndCache(path.join(distPath, 'assets'), '/assets');

    // Serve cached & compressed assets
    app.get('/assets/*', (req, res) => {
      const entry = assetCache.get(req.path);
      if (!entry) { res.status(404).end(); return; }

      // ETag conditional request
      if (req.headers['if-none-match'] === entry.etag) {
        res.status(304).end();
        return;
      }

      const ae = (req.headers['accept-encoding'] as string) ?? '';
      let body: Buffer;
      if (entry.br && ae.includes('br')) {
        res.setHeader('Content-Encoding', 'br');
        body = entry.br;
      } else if (entry.gz && ae.includes('gzip')) {
        res.setHeader('Content-Encoding', 'gzip');
        body = entry.gz;
      } else {
        body = entry.raw;
      }

      res.setHeader('Content-Type', entry.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('ETag', entry.etag);
      res.setHeader('Content-Length', body.length);
      res.setHeader('Vary', 'Accept-Encoding');
      res.end(body);
    });

    // Serve non-compressible statics (images, icons, sw.js, etc.)
    app.use(express.static(distPath, {
      etag: true,
      maxAge: '1y',
      immutable: true,
      index: false,
      setHeaders: (res, filePath) => {
        if (
          filePath.endsWith('index.html') ||
          filePath.endsWith('sw.js') ||
          filePath.endsWith('registerSW.js') ||
          filePath.endsWith('workbox') ||
          filePath.includes('workbox-')
        ) {
          res.setHeader('Cache-Control', 'no-cache');
        }
        // Skip files already handled by the asset cache
        if (filePath.includes('/assets/')) return;
      },
    }));

    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(indexHtml);
    });
  }

  return app;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url) ||
               process.argv[1]?.endsWith("server.ts") ||
               process.argv[1]?.endsWith("server.mjs");
if (isMain) {
  const PORT = 3000;
  createApp().then(app => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

export { createApp };
