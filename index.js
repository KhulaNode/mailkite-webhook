'use strict';

const express = require('express');

function createApp(log = record => console.log(JSON.stringify(record))) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const bytes = Buffer.concat(chunks);
      const body = bytes.toString('utf8');
      const record = {
        timestamp, method: req.method, url: req.originalUrl,
        headers: req.headers, rawHeaders: req.rawHeaders,
        body, bodyBytes: bytes.length, bodyBase64: bytes.toString('base64')
      };
      if ((req.headers['content-type'] || '').toLowerCase().includes('json') && bytes.length) {
        try { record.json = JSON.parse(body); }
        catch (error) { record.jsonParseError = error.message; }
      }
      log(record);
      next();
    });
    req.on('error', error => {
      log({timestamp, method:req.method, url:req.originalUrl,
        headers:req.headers, rawHeaders:req.rawHeaders,
        body:Buffer.concat(chunks).toString('utf8'), error:error.message});
      if (!res.headersSent) res.status(400).end();
    });
  });
  app.post('/hooks/mail', (_req, res) => res.status(200).end());
  app.get('/health', (_req, res) => res.json({ok:true}));
  return app;
}

if (require.main === module) {
  const port = 3005;
  const server = createApp().listen(port, '0.0.0.0', () => {
    console.log(JSON.stringify({timestamp:new Date().toISOString(), event:'listening', host:'0.0.0.0', port}));
  });
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

module.exports = {createApp};
