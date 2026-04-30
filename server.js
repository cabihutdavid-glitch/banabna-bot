const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3000;
const GROQ_KEY = process.env.GROQ_API_KEY || '';

function callGroq(messages, callback) {
  const systemMsg = `Eres Banabna, asistente personal amigable. Responde en español curto.`;
  const fullMessages = [{ role: 'system', content: systemMsg }, ...messages];
  
  const data = JSON.stringify({
    model: 'llama-3.1-8b-instant',
    messages: fullMessages,
    max_tokens: 300
  });
  
  const options = {
    hostname: 'api.groq.com',
    port: 443,
    path: '/openai/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + GROQ_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };
  
  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        callback(null, json.choices?.[0]?.message?.content || 'Sin respuesta');
      } catch(e) {
        callback(e.message);
      }
    });
  });
  
  req.on('error', e => callback(e.message));
  req.write(data);
  req.end();
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.end();
  }
  
  if (req.url === '/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { messages } = JSON.parse(body);
        callGroq(messages, (err, reply) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ reply: err || reply }));
        });
      } catch(e) {
        res.end(JSON.stringify({ reply: 'Error' }));
      }
    });
    return;
  }
  
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(__dirname, 'public', 'index.html'), (err2, data2) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(data2 || 'Not found');
      });
    } else {
      const ext = path.extname(filePath);
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
      res.setHeader('Content-Type', types[ext] || 'text/plain');
      res.end(data);
    }
  });
});

server.listen(PORT, () => console.log('Running on port', PORT));

module.exports = { server };