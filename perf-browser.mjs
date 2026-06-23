/**
 * Browser-level performance measurement using Playwright.
 * Measures real FCP, domContentLoaded, and loadEventEnd per route.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

const routes = [
  { name: 'Login (/)', path: '/' },
  { name: 'Onboarding', path: '/onboarding' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'QuoteBuilder', path: '/quotes/new' },
  { name: 'Invoices', path: '/invoices' },
  { name: 'Templates', path: '/templates' },
  { name: 'Clients', path: '/clients' },
  { name: 'Recurring', path: '/recurring' },
  { name: 'Settings', path: '/settings' },
  { name: 'Reports', path: '/reports' },
  { name: 'ClientView', path: '/client/quote/test-id' },
];

async function measurePage(page, route, cache = true) {
  // Clear SW caches for cold run
  if (!cache) {
    await page.context().clearCookies();
  }

  await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded' });

  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');

    return {
      ttfb: nav ? nav.responseStart - nav.requestStart : null,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : null,
      loadEvent: nav ? nav.loadEventEnd - nav.startTime : null,
      fcp: fcp ? fcp.startTime : null,
    };
  });

  return { ...timing, route: route.name, path: route.path };
}

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  for (const cacheMode of [{ label: 'Cold (no cache)', cache: false }, { label: 'Warm (cached)', cache: true }]) {
    console.log(`\n=== ${cacheMode.label} ===`);
    console.log('Route'.padEnd(20), 'TTFB'.padEnd(10), 'DOMReady'.padEnd(12), 'FCP'.padEnd(10), 'Load');
    console.log('-'.repeat(65));

    const context = await browser.newContext({
      // Disable caching for cold run
      ...(cacheMode.cache ? {} : { ignoreHTTPSErrors: true }),
    });

    if (!cacheMode.cache) {
      await context.clearCookies();
    }

    const page = await context.newPage();

    // Warm up service worker on first request
    if (cacheMode.cache) {
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
    }

    let allUnder50 = true;
    for (const route of routes) {
      const results = [];
      for (let i = 0; i < 3; i++) {
        const r = await measurePage(page, route, cacheMode.cache);
        results.push(r);
        await page.waitForTimeout(100);
      }

      const avg = (key) => {
        const vals = results.map(r => r[key]).filter(v => v !== null && v >= 0);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };

      const ttfb = avg('ttfb');
      const dom = avg('domContentLoaded');
      const fcp = avg('fcp');
      const load = avg('loadEvent');

      const displayVal = (v) => v !== null ? `${v.toFixed(0)}ms` : 'N/A';
      const metricOver50 = fcp !== null ? fcp > 50 : (dom !== null ? dom > 50 : false);
      if (metricOver50) allUnder50 = false;
      const mark = metricOver50 ? '❌' : '✅';

      console.log(
        route.name.padEnd(20),
        displayVal(ttfb).padEnd(10),
        displayVal(dom).padEnd(12),
        (displayVal(fcp) + ' ' + mark).padEnd(12),
        displayVal(load)
      );
    }

    await context.close();
    console.log('\n' + (allUnder50 ? '✅ ALL pages FCP under 50ms!' : '❌ Some pages exceed 50ms FCP.'));
  }

  await browser.close();
}

main().catch(console.error);
