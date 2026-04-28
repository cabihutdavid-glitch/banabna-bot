const express = require('express');
const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config();

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/chat', async (req, res) => {
  const { messages, userName, image } = req.body;
  try {
    let apiMessages = [
      {
        role: 'system',
        content: `Eres Banabna, un asistente personal completo, amigable e inteligente.
        ${userName ? `El usuario se llama ${userName}. Úsalo ocasionalmente.` : ''}
        Puedes analizar imágenes, documentos, hacer cálculos, dar consejos y mucho más.
        Responde siempre en español, de forma clara, cálida y concisa. Usa emojis con moderación.`
      }
    ];

    // Si hay imagen, usar modelo con visión
    if (image) {
      const lastUserMsg = messages[messages.length - 1];
      apiMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: lastUserMsg?.content || 'Describe esta imagen' },
          { type: 'image_url', image_url: { url: `data:${image.type};base64,${image.data}` } }
        ]
      });

      const completion = await groq.chat.completions.create({
        model: 'llama-3.2-11b-vision-preview',
        messages: apiMessages,
        max_tokens: 1000
      });
      return res.json({ reply: completion.choices[0].message.content });
    }

    // Chat normal
    apiMessages = [...apiMessages, ...messages];
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: apiMessages,
      max_tokens: 1000
    });
    res.json({ reply: completion.choices[0].message.content });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/translate', async (req, res) => {
  const { text, from, to } = req.body;
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `Translate the following text from ${from} to ${to}. Only respond with the translation, nothing else.` },
        { role: 'user', content: text }
      ],
      max_tokens: 2000
    });
    res.json({ translatedText: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Banabna corriendo en http://localhost:${PORT}`));
}