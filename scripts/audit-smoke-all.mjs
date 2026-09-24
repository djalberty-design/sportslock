import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const chromePath = existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : undefined;

const outDir = join(process.cwd(), "screenshots");
mkdirSync(outDir, { recursive: true });

const ROUTES = [
  { name: "home", path: "/" },
  { name: "arbitrage", path: "/arbitrage" },
  { name: "results", path: "/results" },
  { name: "picks", path: "/picks" },
  { name: "profile", path: "/profile" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

async function run() {
  console.log("Launching Chromium for comprehensive audit...");
  const browser = await chromium.launch({
    headless: true,
    ...(chromePath ? { executablePath: chromePath } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // Step 1: Sign in with djalberty@gmail.com on /login
  console.log("Signing in as djalberty@gmail.com...");
  const page = await context.newPage();
  
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`[Console Error] ${msg.text()}`);
  });
  page.on("pageerror", (err) => pageErrors.push(`[Page Error] ${err.message}`));

  await page.goto("http://127.0.0.1:8080/login", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".animate-pulse", { state: "detached", timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Fill email & password
  await page.fill('input[type="email"]', "djalberty@gmail.com");
  await page.fill('input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');

  // Wait for redirect to / or url change
  await page.waitForURL("http://127.0.0.1:8080/", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log("Current URL after sign-in:", page.url());

  const auditResults = {};

  for (const r of ROUTES) {
    auditResults[r.name] = {};
    for (const vp of VIEWPORTS) {
      console.log(`Auditing ${r.name} (${r.path}) on ${vp.name} (${vp.width}x${vp.height})...`);
      const vpPage = await context.newPage();
      await vpPage.setViewportSize({ width: vp.width, height: vp.height });
      const vpErrors = [];
      vpPage.on("console", (msg) => {
        if (msg.type() === "error") vpErrors.push(msg.text());
      });
      vpPage.on("pageerror", (err) => vpErrors.push(err.message));

      const resp = await vpPage.goto(`http://127.0.0.1:8080${r.path}`, { waitUntil: "domcontentloaded" });
      await vpPage.waitForSelector("body:not(:has-text('Loading SportsLock...')):not(:has-text('Checking access...'))", { timeout: 15000 }).catch(() => {});
      await vpPage.waitForSelector(".animate-pulse", { state: "detached", timeout: 5000 }).catch(() => {});
      await vpPage.waitForTimeout(2000);

      const title = await vpPage.title();
      const bodyText = await vpPage.locator("body").innerText().catch(() => "");
      const horizontalOverflow = await vpPage.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth > el.clientWidth + 1;
      });

      const shotPath = join(outDir, `${r.name}-${vp.name}.png`);
      await vpPage.screenshot({ path: shotPath, fullPage: false });

      auditResults[r.name][vp.name] = {
        status: resp?.status() ?? 0,
        title,
        bodyTextLength: bodyText.length,
        bodySnippet: bodyText.slice(0, 100).replace(/\n/g, " "),
        horizontalOverflow,
        consoleErrors: vpErrors,
        screenshot: shotPath,
      };

      await vpPage.close();
    }
  }

  await browser.close();

  const reportPath = join(outDir, "full-audit-verdict.json");
  writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
  console.log("Full Audit Complete! Verdict saved to:", reportPath);
  console.log(JSON.stringify(auditResults, null, 2));
}

run().catch((err) => {
  console.error("Audit failure:", err);
  process.exit(1);
});
