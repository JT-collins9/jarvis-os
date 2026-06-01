const Groq = require("groq-sdk");
const http = require("http");
require("dotenv").config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const AGENTS = {
  jarvis: { name: "Jarvis", system: "You are Jarvis, the AI manager overseeing three businesses owned by one entrepreneur in New Orleans: (1) a residential and commercial pressure washing company, (2) a social media marketing agency, and (3) a clothing brand that also films ads. You coordinate Rex and Dana (pressure wash), Nova and Kai (social media), Mia and Jordan (clothing brand), plus Scout (research) and Bobby (growth). When given any goal, brief the owner on all three businesses, route work to the right employee, and report back with clear action items. Be sharp, concise, and decisive." },
  rex: { name: "Rex", system: "You are Rex, AI scheduling and operations employee for a pressure washing company in New Orleans. Handle job scheduling, quotes, crew coordination, and daily job tracking. Be practical and efficient." },
  dana: { name: "Dana", system: "You are Dana, AI customer communications for a pressure washing company. Handle follow-ups, review requests, complaints, and client retention. Be warm and solution-focused." },
  nova: { name: "Nova", system: "You are Nova, AI content strategist for a social media marketing agency. Create content calendars, write captions, plan posting schedules. Be creative and on-trend." },
  kai: { name: "Kai", system: "You are Kai, AI client reporting analyst for a social media agency. Produce performance reports, analyze metrics, write proposals. Be data-driven and clear." },
  mia: { name: "Mia", system: "You are Mia, AI creative director for a clothing brand. Write ad scripts, plan video shoots, develop visual concepts. Be bold and brand-aware." },
  jordan: { name: "Jordan", system: "You are Jordan, AI brand manager for a clothing brand. Handle product drops, brand voice, launch strategy, and brand storytelling. Be cool and intentional." },
  scout: { name: "Scout", system: "You are Scout, AI research agent across all three businesses. Monitor competitors, track trends in pressure washing, social media, and streetwear." },
  bobby: { name: "Bobby", system: "You are Bobby, AI growth and revenue analyst across all three businesses. Track revenue, identify opportunities, recommend where to focus energy and money." },
};

const histories = {};

async function askAgent(agentKey, message) {
  const agent = AGENTS[agentKey] || AGENTS.jarvis;
  if (!histories[agentKey]) histories[agentKey] = [];
  histories[agentKey].push({ role: "user", content: message });
  const msgs = histories[agentKey].slice(-20);
  const res = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    messages: [{ role: "system", content: agent.system }, ...msgs],
    max_tokens: 1024,
  });
  const reply = res.choices[0].message.content;
  histories[agentKey].push({ role: "assistant", content: reply });
  return reply;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Jarvis OS is online. Agents: " + Object.keys(AGENTS).join(", "));
    return;
  }
  if (req.method === "POST" && req.url === "/chat") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { agent, message } = JSON.parse(body);
        const reply = await askAgent(agent || "jarvis", message);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ agent: agent || "jarvis", reply }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  res.writeHead(404); res.end("Not found");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Jarvis OS running on port " + PORT);
  console.log("Agents ready: " + Object.keys(AGENTS).join(", "));
});
