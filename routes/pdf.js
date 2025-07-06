const express = require('express');
const puppeteer = require('puppeteer');

const router = express.Router();

router.get('/demo', async (req, res) => {
  const html = `<!DOCTYPE html>
  <html><head><meta charset="utf-8"></head><body>
  <h1>PDF de prueba</h1><p>Generado desde el navegador</p>
  </body></html>`;

  const browser = await require('puppeteer').launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true
  });

  await browser.close();

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline; filename=demo.pdf',
    'Content-Length': pdfBuffer.length
  });

  res.end(pdfBuffer);
});


module.exports = router;