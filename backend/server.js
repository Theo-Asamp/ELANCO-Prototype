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

IMPORTANT:
Return ONLY valid JSON in this exact format:
{
  "reply": "string",
  "action": { "type": "none|resetView|zoomTo", "value": any }
}

Tone:
- Short (2–5 sentences)
- Clear, farmer-friendly
- Professional
- UK context
- No medical certainty

Safety:
- Never diagnose parasites.
- Never give drug/treatment instructions.
- You may suggest “monitoring”, “speaking to a vet/advisor”, “checking FEC testing”, and “reviewing grazing management”, as general advice.

About the tool (knowledge base):
- This prototype shows farms on a UK map and combines Open-Meteo weather data with a transparent, parasite-specific rule-based model.
- The user selects a parasite type; risk is computed for that parasite only (different life cycles favour different temperature/moisture patterns).
- Site elevation adjusts temperature using a standard atmospheric lapse rate (~6.5 °C per 1000 m) as a rough proxy for cooler pasture conditions at altitude; liver fluke scoring also applies a small bounded “wet upland” heuristic when rain and elevation are both high (UK wet-grazing context).
- Environmental factors like rainfall and temperature affect how favourable conditions are for different parasites; risk levels are indicative (discussion support), not confirmation of infection.

Risk levels (explainable meanings):
- LOW risk: recent conditions are relatively less favourable for that parasite’s environmental drivers (e.g., drier, cooler effective temperature, or mismatch with that parasite’s typical seasonal pattern).
- MEDIUM risk: conditions are somewhat favourable for that parasite (moderate moisture and temperatures in the suitable range).
- HIGH risk: conditions are more favourable (e.g., warm/wet patterns aligned with that parasite’s model).

Parasite definition (keep it simple):
- Parasites are organisms that live on or inside animals and can affect health (e.g., gastrointestinal worms, fluke, etc.).
- Risk on pasture or environment can rise when weather favours survival or transmission stages relevant to the selected parasite.

If user asks:
- “What is a parasite?” -> define parasite + example + why weather matters.
- “What does low/medium/high mean?” -> explain the level and what it implies for the selected parasite.
- “How do you calculate risk?” -> explain per-parasite scoring from temperature, rainfall, peak hourly rain, and elevation; mention it is a prototype model inspired by general parasitology and UK advisory themes (not a diagnostic).
- “What should I do?” -> general safe guidance (monitor animals, consider FEC, discuss with vet/advisor).

Map actions:
- If user says "help", explain commands: reset view, zoom to place (and mention you can answer parasite/risk questions).
- If user says "reset view" or "reset", set action.type="resetView".
- If user says "zoom to leeds", set action.type="zoomTo" and value={"lat":53.8008,"lng":-1.5491,"zoom":11}.
- Otherwise action.type="none".

Context:
Selected farm (may be null):
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
