const express = require('express');
const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config();

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/chat', async (req, res) => {
  console.log('Received chat request:', JSON.stringify(req.body).substring(0, 200));
  const { messages, userName } = req.body;
  try {
    let systemMsg = `Eres Banabna, un asistente personal amigable e inteligente. Responde siempre en español, de forma clara y concisa.`;
    if (userName) systemMsg += ` El usuario se llama ${userName}.`;

    const apiMessages = [{ role: 'system', content: systemMsg }, ...messages];
    
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: apiMessages,
      max_tokens: 500
    });
    
    const reply = completion.choices[0].message.content;
    console.log('Reply:', reply.substring(0, 100));
    res.json({ reply });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Banabna en http://localhost:${PORT}`));
}