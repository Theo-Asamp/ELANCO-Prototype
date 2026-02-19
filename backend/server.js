import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// ----- Serve frontend from project root -----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

app.use(express.static(projectRoot));

app.get("/", (req, res) => {
  res.sendFile(path.join(projectRoot, "index.html"));
});

// ----- Chat endpoint (Ollama) -----
app.post("/api/chat", async (req, res) => {
  try {
    const { message, context } = req.body || {};
    if (!message) {
      return res.json({ reply: "Please type a message.", action: { type: "none" } });
    }

    const selectedFarm = context?.selectedFarm || null;

    const prompt = `
You are the assistant for a UK parasite risk mapping prototype called GrazeSafe.

Return ONLY valid JSON in this exact format:
{
  "reply": "string",
  "action": { "type": "none|resetView|zoomTo", "value": any }
}

Rules:
- Keep responses short (1–3 sentences).
- Never claim medical certainty.
- If user says "help", explain the available commands: reset view, zoom to leeds.
- If user says "reset view" or "reset", return action.type="resetView".
- If user says "zoom to leeds", return action.type="zoomTo" and value={"lat":53.8008,"lng":-1.5491,"zoom":11}.
- Otherwise action.type="none".

Selected farm context:
${selectedFarm ? JSON.stringify(selectedFarm) : "none"}

User message:
${message}
`;

    const ollamaRes = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:8b",
        prompt,
        stream: false
      })
    });

    if (!ollamaRes.ok) {
      return res.status(500).json({
        reply: "Local AI is not responding. Make sure Ollama is running.",
        action: { type: "none" }
      });
    }

    const data = await ollamaRes.json();
    const text = (data.response || "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { reply: text || "Sorry, I couldn't process that.", action: { type: "none" } };
    }

    if (!parsed.action || !parsed.action.type) parsed.action = { type: "none" };
    if (!parsed.reply) parsed.reply = "Okay.";

    return res.json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      reply: "Server error in /api/chat. Check backend console.",
      action: { type: "none" }
    });
  }
});

// ----- Start server -----
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
