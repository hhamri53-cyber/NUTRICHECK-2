require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const valid = ["image/jpeg","image/png","image/webp","image/gif"];
    valid.includes(file.mimetype) ? cb(null, true) : cb(new Error("Formato no válido."));
  },
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `Analiza esta imagen de comida. Devuelve ÚNICAMENTE un JSON válido sin texto extra:
{"detected_foods":["alimentos en español"],"estimated_calories":número,"protein_g":número,"carbs_g":número,"fat_g":número,"fiber_g":número,"micronutrients":["micronutrientes"],"analysis":"comentario breve útil","disclaimer":"Estimación orientativa generada por IA."}`;

app.post("/api/analyze", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se recibió imagen." });
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: req.file.mimetype, data: req.file.buffer.toString("base64") }},
          { type: "text", text: PROMPT }
        ]
      }]
    });
    const raw = response.content.filter(b => b.type === "text").map(b => b.text).join("");
    const clean = raw.replace(/```json\s*/gi,"").replace(/```\s*/gi,"").trim();
    res.json(JSON.parse(clean));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error interno." });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.listen(PORT, () => console.log(`NutriCheck corriendo en puerto ${PORT}`));
