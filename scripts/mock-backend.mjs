#!/usr/bin/env node
/**
 * TEST-ONLY mock of the image-to-3D backend API (v1). It does NOT generate anything: it returns
 * a fixed GLB so the app's client protocol (health, upload, polling, auth, CORS, result import)
 * can be tested automatically. Never deploy this as a "generator".
 * Usage: node scripts/mock-backend.mjs <port> <fixed.glb>
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const port = Number(process.argv[2] || 5181);
const glb = readFileSync(process.argv[3]);
const jobs = new Map();
let last = {};

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };

createServer((req, res) => {
  const send = (code, body, type = 'application/json') => {
    res.writeHead(code, { ...cors, 'Content-Type': type });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
  };
  if (req.method === 'OPTIONS') return send(204, '', 'text/plain');
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__last') return send(200, last);
  if (req.headers.authorization !== 'Bearer test-token') return send(401, { detail: 'invalid or missing token' });
  if (url.pathname === '/health') return send(200, { status: 'ok', model: 'mock-test-only', device: 'none', version: 'test' });
  if (url.pathname === '/v1/jobs' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const boundary = '--' + (req.headers['content-type'] || '').split('boundary=')[1];
      const parts = body.toString('latin1').split(boundary);
      const img = parts.find((p) => /name="image"/.test(p)) || '';
      const start = img.indexOf('\r\n\r\n') + 4;
      const imageBytes = Buffer.from(img.slice(start, img.length - 2), 'latin1').length;
      last = { auth: req.headers.authorization, imageBytes };
      const id = 'job' + Date.now();
      jobs.set(id, Date.now());
      send(200, { id });
    });
    return;
  }
  const m = url.pathname.match(/^\/v1\/jobs\/([^/]+)(\/result)?$/);
  if (m && jobs.has(m[1])) {
    const age = Date.now() - jobs.get(m[1]);
    if (m[2]) return age > 2500 ? send(200, glb, 'model/gltf-binary') : send(404, { detail: 'not ready' });
    return send(200, { id: m[1], status: age > 2500 ? 'done' : 'running', progress: Math.min(1, age / 2500) });
  }
  send(404, { detail: 'not found' });
}).listen(port, () => console.log('mock backend on', port));
