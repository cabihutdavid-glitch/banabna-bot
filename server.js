const express = require('express');
const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config();

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/chat', async (req, res) => {
  const { messages, userName } = req.body;
  
  console.log('API Key exists:', !!process.env.GROQ_API_KEY);
  console.log('Key value:', process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0,10)+'...' : 'MISSING');
  
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY no configurada en Vercel. Ve a Settings > Environment Variables.' });
  }
  
  try {
    let systemMsg = `Eres Banabna, asistente personal. Responde en español curto.`;
    if (userName) systemMsg += ` El usuario se llama ${userName}.`;

    const apiMessages = [{ role: 'system', content: systemMsg }, ...messages];
    
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: apiMessages,
      max_tokens: 300
    });
    
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.log('Groq error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Banabna en http://localhost:${PORT}`));
}