#!/usr/bin/env node
// Capture real screens of your app at 3x for a video (ground truth for kit components and full-screen shots).
//
//   node tools/capture.mjs <slug>                 runs videos/<slug>/capture.json
//   node tools/capture.mjs <slug> --site          quick capture of the public site at appUrl (desktop + phone)
//
// capture.json: { "baseUrl": "http://localhost:3000", "login": { "email": "...", "password": "..." },
//                 "blockHosts": [".supabase.co", "api.yourapp.com"], "checkLocalSupabase": false,
//                 "shots": [{ "name": "dashboard-dark", "path": "/dashboard", "viewport": [390, 844], "theme": "dark",
//                             "actions": [{ "click": "text=Stats" }, { "wait": 600 }], "clip": "main" }] }
//
// Safety: logging in is only allowed against a LOCAL app (localhost / 127.0.0.1) with demo data. If the page
// talks to any host in `blockHosts` (your production API or database), the run stops before and after login,
// so production data is never touched. `checkLocalSupabase: true` also scans the app bundle for a remote
// Supabase URL (useful for Next.js + Supabase apps, where login can run server-side).
// Login credentials: put the demo account in .env as CAPTURE_EMAIL / CAPTURE_PASSWORD, or in capture.json
// for a throwaway local account. Never use a real account.
// Output: public/<slug>/captures/<name>.png (+ captures.json with sizes).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug) {
  console.error("usage: node tools/capture.mjs <slug> [--site]");
  process.exit(1);
}
const outDir = path.join(ROOT, "public", slug, "captures");
fs.mkdirSync(outDir, { recursive: true });

const studio = JSON.parse(fs.readFileSync(path.join(ROOT, "studio.config.json"), "utf8"));
const siteUrl = studio.appUrl.startsWith("{{") ? null : studio.appUrl.replace(/^(?!https?:\/\/)/, "https://");
const SITE = {
  baseUrl: siteUrl,
  shots: [
    { name: "site-hero-desktop", path: "/", viewport: [1440, 900] },
    { name: "site-full-desktop", path: "/", viewport: [1440, 900], fullPage: true },
    { name: "site-hero-phone", path: "/", viewport: [390, 844] },
  ],
};

const cfg = process.argv.includes("--site")
  ? SITE
  : JSON.parse(fs.readFileSync(path.join(ROOT, "videos", slug, "capture.json"), "utf8"));
if (!cfg.baseUrl) {
  console.error("no baseUrl: fill appUrl in studio.config.json (for --site) or baseUrl in capture.json");
  process.exit(1);
}

// Demo credentials from .env (CAPTURE_EMAIL / CAPTURE_PASSWORD) override capture.json; values are never printed.
function envValue(key) {
  if (process.env[key]) return process.env[key];
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return undefined;
  const line = fs.readFileSync(envFile, "utf8").split("\n").find((l) => l.startsWith(key + "="));
  return line ? line.slice(key.length + 1).trim() : undefined;
}
if (cfg.login) {
  cfg.login.email = envValue("CAPTURE_EMAIL") || cfg.login.email;
  cfg.login.password = envValue("CAPTURE_PASSWORD") || cfg.login.password;
  const host = new URL(cfg.baseUrl).hostname;
  if (!["localhost", "127.0.0.1", "0.0.0.0"].includes(host)) {
    console.error(`refusing to log in to ${host}: captures with a login run against a local app with demo data only`);
    process.exit(1);
  }
}
const blockHosts = cfg.blockHosts ?? [];
const isBlocked = (host) => blockHosts.some((b) => (b.startsWith(".") ? host.endsWith(b) : host === b));

const browser = await chromium.launch();
const blocked = new Set();
const results = [];

async function newPage(viewport, theme) {
  const ctx = await browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    deviceScaleFactor: 3,
    colorScheme: theme === "light" ? "light" : "dark",
    storageState: cfg.storageState && fs.existsSync(cfg.storageState) ? cfg.storageState : undefined,
  });
  const page = await ctx.newPage();
  page.on("request", (req) => {
    const host = new URL(req.url()).hostname;
    if (isBlocked(host)) blocked.add(host);
  });
  return { ctx, page };
}

// Optional (checkLocalSupabase): login may run server-side, where the browser never sees the Supabase host.
// The client bundle still inlines NEXT_PUBLIC_SUPABASE_URL, so scan the page's scripts for which Supabase it uses.
async function assertLocalSupabase(page) {
  const srcs = await page.$$eval("script[src]", (els) => els.map((e) => e.src));
  const inline = await page.$$eval("script:not([src])", (els) => els.map((e) => e.textContent ?? "").join("\n"));
  let code = inline;
  for (const src of srcs) code += "\n" + (await (await page.request.get(src)).text());
  const remote = [...new Set(code.match(/https:\/\/[a-z0-9-]+\.supabase\.co/g) ?? [])];
  const local = /(127\.0\.0\.1|localhost):54321/.test(code);
  if (remote.length) throw new Error(`app bundle points at remote Supabase (${remote.join(", ")}); refusing to log in`);
  if (!local) throw new Error("could not confirm the app uses the local Supabase (127.0.0.1:54321); refusing to log in");
}

let checkedBundle = false;
async function login(page) {
  const { email, password, path: loginPath = "/auth/login" } = cfg.login;
  await page.goto(cfg.baseUrl + loginPath, { waitUntil: "networkidle" });
  if (cfg.checkLocalSupabase && !checkedBundle) {
    await assertLocalSupabase(page);
    checkedBundle = true;
  }
  if (blocked.size) throw new Error(`app talks to a blocked host (${[...blocked]}); refusing to log in`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith(loginPath), { timeout: 20000 }), page.click('button[type="submit"]')]);
  if (blocked.size) throw new Error(`app talked to a blocked host (${[...blocked]}) during login`);
}

try {
  for (const shot of cfg.shots) {
    const { ctx, page } = await newPage(shot.viewport ?? [1440, 900], shot.theme);
    if (cfg.login) await login(page);
    await page.goto(cfg.baseUrl + shot.path, { waitUntil: "networkidle" });
    if (shot.theme) {
      // many apps (e.g. next-themes) store the choice in localStorage("theme"); adjust for yours
      await page.evaluate((t) => localStorage.setItem("theme", t), shot.theme);
      await page.reload({ waitUntil: "networkidle" });
    }
    for (const a of shot.actions ?? []) {
      if (a.click) await page.click(a.click);
      if (a.wait) await page.waitForTimeout(a.wait);
      if (a.scroll) await page.mouse.wheel(0, a.scroll);
    }
    await page.waitForTimeout(shot.settle ?? 800); // let app transitions finish before the still
    if (cfg.hideSelectors?.length) await page.addStyleTag({ content: `${cfg.hideSelectors.join(",")}{display:none!important}` });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }); // hide the Next.js dev badge, if any
    const file = path.join(outDir, `${shot.name}.png`);
    if (shot.clip) await page.locator(shot.clip).first().screenshot({ path: file });
    else await page.screenshot({ path: file, fullPage: Boolean(shot.fullPage) });
    results.push({ name: shot.name, file: path.relative(ROOT, file), viewport: shot.viewport, theme: shot.theme ?? "dark" });
    console.log(`  ${shot.name}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(outDir, "captures.json"), JSON.stringify({ baseUrl: cfg.baseUrl, at: new Date().toISOString(), shots: results }, null, 1) + "\n");
console.log(`captures: public/${slug}/captures/ (${results.length})`);
