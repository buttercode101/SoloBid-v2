/**
 * Performance measurement: TTFB + full HTML response + critical asset chain.
 * Simulates what a browser would fetch on the critical path for a SPA:
 *   1. HTML (index.html)
 *   2. CSS bundle
 *   3. JS entry / vendor-react chunk
 */
import http from 'http';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';

const routes = [
  { name: 'Login (/)', path: '/' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'QuoteBuilder', path: '/quotes/new' },
  { name: 'Invoices', path: '/invoices' },
  { name: 'Templates', path: '/templates' },
  { name: 'Clients', path: '/clients' },
  { name: 'Recurring', path: '/recurring' },
  { name: 'Settings', path: '/settings' },
  { name: 'Reports', path: '/reports' },
  { name: 'ClientView', path: '/client/quote/test-id' },
  { name: 'Onboarding', path: '/onboarding' },
];

function request(urlPath, headers = {}) {
  return new Promise((resolve) => {
    const start = performance.now();
    let ttfb = null;
    const opts = new URL(urlPath, BASE);
    const req = http.get({ hostname: opts.hostname, port: opts.port || 3000, path: opts.pathname + opts.search, headers }, (res) => {
      ttfb = performance.now() - start;
      let bytes = 0;
      res.on('data', (chunk) => { bytes += chunk.length; });
      res.on('end', () => {
        resolve({ ttfb, total: performance.now() - start, bytes, status: res.statusCode, headers: res.headers });
      });
    });
    req.on('error', (e) => resolve({ ttfb: -1, total: -1, bytes: 0, status: 0, error: e.message }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ ttfb: -1, total: -1, bytes: 0, status: 0, error: 'timeout' }); });
  });
}

async function getHtmlAndAssets() {
  // Get the HTML to parse out what assets it references
  const res = await request('/');
  // Find critical assets from dist/index.html
  let html = '';
  try { html = fs.readFileSync(path.join(process.cwd(), 'dist/index.html'), 'utf8'); } catch {}

  const scriptSrcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
  const linkHrefs = [...html.matchAll(/href="([^"]+\.css)"/g)].map(m => m[1]);
  return { scriptSrcs, linkHrefs };
}

async function measureAll(runs = 5) {
  console.log(`\n📊 SoloBid Performance Test — ${new Date().toLocaleTimeString()}`);
  console.log(`Measuring HTML response + critical assets over ${runs} runs\n`);

  // Warm up
  for (const route of routes) await request(route.path);

  // Measure HTML for each route
  console.log('=== HTML Response Times ===');
  console.log('Route'.padEnd(22), 'TTFB avg'.padEnd(12), 'Total avg'.padEnd(12), 'Size');
  console.log('-'.repeat(60));

  let allUnder50 = true;
  const results = {};

  for (const route of routes) {
    const runs_data = [];
    for (let i = 0; i < runs; i++) {
      const r = await request(route.path);
      runs_data.push(r);
    }
    const valid = runs_data.filter(r => r.total > 0);
    const avgTtfb = valid.reduce((s, r) => s + r.ttfb, 0) / valid.length;
    const avgTotal = valid.reduce((s, r) => s + r.total, 0) / valid.length;
    const bytes = valid[0]?.bytes ?? 0;
    const over = avgTotal > 50;
    if (over) allUnder50 = false;
    results[route.name] = { avgTtfb, avgTotal, bytes };
    console.log(
      route.name.padEnd(22),
      `${avgTtfb.toFixed(2)}ms`.padEnd(12),
      `${avgTotal.toFixed(2)}ms`.padEnd(12),
      `${(bytes / 1024).toFixed(2)}KB  ${over ? '❌' : '✅'}`
    );
  }

  // Measure critical JS/CSS assets
  const { scriptSrcs, linkHrefs } = await getHtmlAndAssets();
  const criticalAssets = [...linkHrefs, ...scriptSrcs].filter(a => a.startsWith('/'));

  if (criticalAssets.length) {
    console.log('\n=== Critical Asset Transfer Times (cold) ===');
    console.log('Asset'.padEnd(50), 'Time'.padEnd(10), 'Size'.padEnd(12), 'Encoding');
    console.log('-'.repeat(85));
    let totalBytes = 0;
    let totalTime = 0;
    for (const asset of criticalAssets) {
      const r = await request(asset, { 'Accept-Encoding': 'gzip, br' });
      totalBytes += r.bytes;
      totalTime += r.total;
      const name = asset.split('/').pop() || asset;
      console.log(
        name.slice(0, 49).padEnd(50),
        `${r.total.toFixed(1)}ms`.padEnd(10),
        `${(r.bytes / 1024).toFixed(1)}KB`.padEnd(12),
        r.headers['content-encoding'] || 'identity'
      );
    }
    console.log('\n' + `Total critical assets: ${(totalBytes / 1024).toFixed(1)}KB served in ~${totalTime.toFixed(0)}ms`);
  }

  console.log('\n' + (allUnder50 ? '✅ ALL pages HTML response under 50ms!' : '❌ Some HTML responses exceed 50ms.'));
  return allUnder50;
}

measureAll(5).catch(console.error);
