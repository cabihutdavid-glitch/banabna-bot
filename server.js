const express = require('express');
const Groq = require('groq-sdk');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
require('dotenv').config();

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const JWT_SECRET = process.env.JWT_SECRET || 'banabna-secret-2024';
const DB_FILE = 'banabna.json';

let db = { users: [], sessions: [] };
if (fs.existsSync(DB_FILE)) {
  try { db = JSON.parse(fs.readFileSync(DB_FILE)); } catch {}
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No autorizado' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Token inválido' }); }
}

app.post('/register', async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
  if (db.users.find(u => u.username === username)) return res.status(400).json({ error: 'Usuario ya existe' });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const isFirst = db.users.length === 0;
    const newUser = { id: Date.now(), username, password: hashedPassword, name: name || username, lang: 'es-CO', is_admin: isFirst ? 1 : 0, created_at: new Date().toISOString() };
    db.users.push(newUser);
    saveDB();
    const token = jwt.sign({ id: newUser.id, username, is_admin: newUser.is_admin }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: newUser.id, username, name: newUser.name, isAdmin: newUser.is_admin });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Credenciales incorrectas' });
  const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, userId: user.id, username: user.username, name: user.name, isAdmin: user.is_admin });
});

app.post('/chat', authenticate, async (req, res) => {
  const { messages, image } = req.body;
  const userId = req.user.id;
  try {
    const user = db.users.find(u => u.id === userId);
    let apiMessages = [{
      role: 'system',
      content: `Eres Banabna, un asistente personal completo, amigable e inteligente.
      ${user?.name ? `El usuario se llama ${user.name}. Úsalo ocasionalmente.` : ''}
      Responde siempre en español, de forma clara, cálida y concisa.`
    }];
    if (image) {
      apiMessages.push({ role: 'user', content: [{ type: 'text', text: messages[messages.length - 1]?.content || 'Describe esta imagen' }, { type: 'image_url', image_url: { url: `data:${image.type};base64,${image.data}` } }] });
      const completion = await groq.chat.completions.create({ model: 'llama-3.2-11b-vision-preview', messages: apiMessages, max_tokens: 1000 });
      return res.json({ reply: completion.choices[0].message.content });
    }
    apiMessages = [...apiMessages, ...messages];
    const completion = await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: apiMessages, max_tokens: 1000 });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/save-session', authenticate, (req, res) => {
  const { messages } = req.body;
  const userId = req.user.id;
  try {
    db.sessions.push({ id: Date.now(), user_id: userId, messages: JSON.stringify(messages), created_at: new Date().toISOString() });
    saveDB();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/sessions', authenticate, (req, res) => {
  const userId = req.user.id;
  const sessions = db.sessions.filter(s => s.user_id === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
  res.json(sessions.map(s => ({
    id: s.id,
    preview: JSON.parse(s.messages).find(m => m.role === 'user')?.content?.substring(0, 60) || 'Chat',
    date: s.created_at
  })));
});

app.get('/session/:id', authenticate, (req, res) => {
  const userId = req.user.id;
  const session = db.sessions.find(s => s.id == req.params.id && s.user_id === userId);
  if (!session) return res.status(404).json({ error: 'No encontrada' });
  res.json({ messages: JSON.parse(session.messages) });
});

app.get('/admin/users', authenticate, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo admins' });
  res.json(db.users);
});

app.get('/admin/all-sessions', authenticate, (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Solo admins' });
  const sessions = db.sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50).map(s => ({ ...s, username: db.users.find(u => u.id === s.user_id)?.username }));
  res.json(sessions);
});

app.post('/translate', authenticate, async (req, res) => {
  const { text, from, to } = req.body;
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: `Translate from ${from} to ${to}. Only respond with translation.` }, { role: 'user', content: text }],
      max_tokens: 2000
    });
    res.json({ translatedText: completion.choices[0].message.content });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

module.exports = app;
const PORT = process.env.PORT || 3000;
if (require.main === module) { app.listen(PORT, () => console.log(`Banabna corriendo en http://localhost:${PORT}`)); }