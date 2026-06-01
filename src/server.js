const Groq = require("groq-sdk");
const http = require("http");
require("dotenv").config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are Jarvis, the AI manager overseeing three businesses owned by one entrepreneur in New Orleans: (1) a residential and commercial pressure washing company, (2) a social media marketing agency, and (3) a clothing brand that also films ads. You coordinate Rex and Dana (pressure wash), Nova and Kai (social media), Mia and Jordan (clothing brand), plus Scout (research) and Bobby (growth). Keep ALL responses under 20 seconds when spoken aloud. Be sharp, concise, decisive.`;

async function askGroq(message) {
  const res = await groq.chat.completions.create({
    model: "llama3-8b-8192",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: message }
    ],
    max_tokens: 200,
  });
  return res.choices[0].message.content;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Jarvis OS is online. Agents: jarvis, rex, dana, nova, kai, mia, jordan, scout, bobby");
    return;
  }

  // Fast chat endpoint
  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { message } = JSON.parse(body);
        const reply = await askGroq(message || "Give me a quick status update.");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Alexa endpoint
  if (req.method === "POST" && req.url === "/alexa") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        const requestType = parsed.request?.type;
        let message = "Give me a brief morning briefing across all three businesses in 3 sentences.";

        if (requestType === "IntentRequest") {
          const slots = parsed.request?.intent?.slots;
          message = slots?.message?.value || "What is my next priority?";
        }

        const reply = await askGroq(message);

        const alexaResponse = {
          version: "1.0",
          response: {
            outputSpeech: { type: "PlainText", text: reply },
            reprompt: { outputSpeech: { type: "PlainText", text: "What else do you need?" } },
            shouldEndSession: false
          }
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(alexaResponse));
      } catch (e) {
        const errResponse = {
          version: "1.0",
          response: {
            outputSpeech: { type: "PlainText", text: "Jarvis had trouble responding. Try again." },
            shouldEndSession: true
          }
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(errResponse));
      }
    });
    return;
  }

  res.writeHead(404); res.end("Not found");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Jarvis OS running on port " + PORT);
  console.log("Agents ready: jarvis, rex, dana, nova, kai, mia, jordan, scout, bobby");
});
