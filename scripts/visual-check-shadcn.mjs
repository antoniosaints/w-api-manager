import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const outputDir = resolve('tmp/visual-shadcn');
mkdirSync(outputDir, { recursive: true });

async function login(page) {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  const email = page.getByLabel('Email');
  if (await email.count()) {
    await email.fill('admin@wapi.local');
    await page.getByLabel('Senha').fill('admin123');
    await page.getByRole('button', { name: /Entrar/i }).click();
    await page.waitForSelector('.app-shell', { timeout: 15000 });
  }
}

async function capture({ name, width, height, theme, view }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript((themePreference) => {
    window.localStorage.setItem('wapi-ui-theme', themePreference);
  }, theme);
  await login(page);
  if (view) {
    const nav = page.getByRole('button', { name: new RegExp(view, 'i') }).first();
    if (await nav.count()) {
      await nav.click();
      await page.waitForTimeout(600);
    }
  }
  await page.screenshot({ path: resolve(outputDir, `${name}.png`), fullPage: true });
  const diagnostics = await page.evaluate(() => {
    const names = ['.app-card', '.app-button', '.app-select-trigger', '.app-input', '.composer-bar', '.bubble'];
    return Object.fromEntries(names.map((selector) => [selector, document.querySelectorAll(selector).length]));
  });
  await browser.close();
  return diagnostics;
}

const results = {};
results.desktopLightDashboard = await capture({ name: 'desktop-light-dashboard', width: 1440, height: 950, theme: 'light' });
results.desktopDarkInbox = await capture({ name: 'desktop-dark-inbox', width: 1440, height: 950, theme: 'dark', view: 'Atendimento' });
results.mobileLightDashboard = await capture({ name: 'mobile-light-dashboard', width: 390, height: 844, theme: 'light' });
results.mobileDarkInbox = await capture({ name: 'mobile-dark-inbox', width: 390, height: 844, theme: 'dark', view: 'Atendimento' });

console.log(JSON.stringify({ outputDir, results }, null, 2));
