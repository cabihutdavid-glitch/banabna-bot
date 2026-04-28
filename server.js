const express = require('express');
const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config();

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/chat', async (req, res) => {
  const { messages, userName } = req.body;
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Eres Banana, un asistente personal amigable, inteligente y motivador.
          ${userName ? `El nombre del usuario es ${userName}. Úsalo ocasionalmente para personalizar tus respuestas.` : ''}
          Tu misión es ayudar al usuario con su vida cotidiana: organización, tareas, ideas,
          redacción y consejos. Responde siempre en español, de forma clara y concisa.
          Usa emojis con moderación. Nunca seas negativo.`
        },
        ...messages
      ]
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Banana corriendo en http://localhost:${PORT}`));
}