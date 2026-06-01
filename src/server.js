const { App } = require("@slack/bolt");
const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();

const slack = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Agent definitions ────────────────────────────────────────────────────────

const AGENTS = {
  jarvis: {
    name: "Jarvis",
    emoji: "🧠",
    system: `You are Jarvis, the central manager agent. You coordinate Bobby (business/growth), Sarah (customer support), Eva (content operations), Tom (engineering), and Scout (research/monitoring).

When given a goal or task:
1. Analyze what needs to happen
2. State clearly which agents you're routing to and why
3. Provide your own initial assessment or action plan
4. Be direct, efficient, and decisive

If a task clearly belongs to one agent, route it and explain why. If it spans multiple agents, coordinate and break down who owns what. You are the operating system — speak with authority.

Format responses cleanly. Use short headers or bullet points when coordinating multiple agents. Keep it sharp.`,
  },
  bobby: {
    name: "Bobby",
    emoji: "📈",
    system: `You are Bobby, the business and growth agent. You handle revenue strategy, partnerships, market opportunities, funnel optimization, growth experiments, and business metrics.

You're analytical, ambitious, and always thinking about the numbers and the upside. Keep responses focused, data-driven, and actionable. If you need research from Scout or technical help from Tom, say so clearly.`,
  },
  sarah: {
    name: "Sarah",
    emoji: "💬",
    system: `You are Sarah, the customer support workflow agent. You handle support ticket triage, customer communication templates, escalation protocols, SLA tracking, and support ops improvements.

You're empathetic, organized, and solution-focused. You think about the customer experience first. If a support issue has an engineering root cause, flag it for Tom. If it reveals a growth or retention pattern, loop in Bobby.`,
  },
  eva: {
    name: "Eva",
    emoji: "✍️",
    system: `You are Eva, the content operations agent. You handle content strategy, editorial calendars, copy, social media posts, newsletters, brand voice, and content workflows.

You're creative, detail-oriented, and audience-aware. You think in narratives and hooks. If you need research or competitive intel, ask Scout. Keep your output punchy and ready to use.`,
  },
  tom: {
    name: "Tom",
    emoji: "⚙️",
    system: `You are Tom, the engineering agent. You handle technical architecture decisions, bug triage, code reviews, system design, performance issues, and the engineering roadmap.

You're precise, pragmatic, and technically rigorous. You cut through vague problem descriptions to find the root cause. Keep it digestible — not everyone you're talking to is an engineer.`,
  },
  scout: {
    name: "Scout",
    emoji: "🔍",
    system: `You are Scout, the research and monitoring agent. You handle competitive intelligence, market research, trend monitoring, data synthesis, and surfacing insights the team needs to make good decisions.

You're thorough, curious, and evidence-driven. You don't speculate — you reason from what's known and flag what's unknown. Deliver insights in a format the team can actually use.`,
  },
};

// ─── Channel → Agent mapping ──────────────────────────────────────────────────
// Maps Slack channel names to agent keys.
// These should match the channel names you create in Slack.

const CHANNEL_AGENT_MAP = {
  "jarvis":  "jarvis",
  "bobby":   "bobby",
  "sarah":   "sarah",
  "eva":     "eva",
  "tom":     "tom",
  "scout":   "scout",
  // Aliases / alternates
  "agent-jarvis": "jarvis",
  "agent-bobby":  "bobby",
  "agent-sarah":  "sarah",
  "agent-eva":    "eva",
  "agent-tom":    "tom",
  "agent-scout":  "scout",
};

// In-memory conversation history per channel (survives restarts if you add Redis later)
const conversationHistory = {};

// ─── Core: call Claude as a specific agent ────────────────────────────────────

async function callAgent(agentKey, userMessage, channelId) {
  const agent = AGENTS[agentKey];
  if (!agent) throw new Error(`Unknown agent: ${agentKey}`);

  if (!conversationHistory[channelId]) conversationHistory[channelId] = [];

  conversationHistory[channelId].push({ role: "user", content: userMessage });

  // Keep last 20 messages to stay within context limits
  const history = conversationHistory[channelId].slice(-20);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: agent.system,
    messages: history,
  });

  const reply = response.content[0].text;
  conversationHistory[channelId].push({ role: "assistant", content: reply });

  return reply;
}

// ─── Detect agent mentions in Jarvis responses ────────────────────────────────
// When Jarvis routes to another agent, this detects it and can auto-post
// a follow-up in that agent's channel (optional — set AUTO_ROUTE=true in .env)

function detectAgentMentions(text) {
  const agentNames = Object.values(AGENTS).map((a) => a.name);
  return agentNames.filter((name) =>
    new RegExp(`\\b${name}\\b`, "i").test(text)
  );
}

// ─── Format agent reply for Slack ────────────────────────────────────────────

function formatReply(agentKey, reply) {
  const agent = AGENTS[agentKey];
  return `${agent.emoji} *${agent.name}*\n\n${reply}`;
}

// ─── Handle incoming messages ─────────────────────────────────────────────────

slack.message(async ({ message, say, client }) => {
  // Ignore bot messages and thread replies (optional — remove to support threads)
  if (message.bot_id) return;
  if (message.thread_ts && message.thread_ts !== message.ts) return;

  try {
    // Look up channel name
    const channelInfo = await client.conversations.info({ channel: message.channel });
    const channelName = channelInfo.channel.name.toLowerCase();

    const agentKey = CHANNEL_AGENT_MAP[channelName];

    if (!agentKey) {
      // Not a monitored channel — ignore silently
      return;
    }

    const userText = message.text || "";
    if (!userText.trim()) return;

    // Show typing indicator
    await client.assistant.threads.setStatus({
      channel_id: message.channel,
      thread_ts: message.ts,
      status: "is thinking...",
    }).catch(() => {}); // Non-fatal if this API isn't available

    const reply = await callAgent(agentKey, userText, message.channel);
    const formatted = formatReply(agentKey, reply);

    await say({ text: formatted, thread_ts: message.ts });

    // Optional: if Jarvis mentions another agent, log it
    if (agentKey === "jarvis" && process.env.AUTO_ROUTE === "true") {
      const mentioned = detectAgentMentions(reply);
      if (mentioned.length > 0) {
        console.log(`[Jarvis] Mentioned agents: ${mentioned.join(", ")}`);
        // Future: auto-post task to agent's channel
      }
    }
  } catch (err) {
    console.error("Error handling message:", err);
    await say(`⚠️ Something went wrong: ${err.message}`);
  }
});

// ─── Slash command: /agent ────────────────────────────────────────────────────
// Usage: /agent bobby What's our MRR trend telling us?
// Works from any channel — useful for quick cross-agent queries

slack.command("/agent", async ({ command, ack, respond }) => {
  await ack();

  const parts = command.text.trim().split(" ");
  const agentKey = parts[0].toLowerCase();
  const userMessage = parts.slice(1).join(" ");

  if (!AGENTS[agentKey]) {
    await respond(
      `❌ Unknown agent: *${agentKey}*\nAvailable: ${Object.keys(AGENTS).join(", ")}`
    );
    return;
  }

  if (!userMessage) {
    await respond(`Usage: \`/agent ${agentKey} your message here\``);
    return;
  }

  try {
    const reply = await callAgent(agentKey, userMessage, `slash-${agentKey}`);
    await respond({ text: formatReply(agentKey, reply), response_type: "in_channel" });
  } catch (err) {
    await respond(`⚠️ Error: ${err.message}`);
  }
});

// ─── Slash command: /jarvis ───────────────────────────────────────────────────
// Shortcut to reach Jarvis from anywhere

slack.command("/jarvis", async ({ command, ack, respond }) => {
  await ack();

  const userMessage = command.text.trim();
  if (!userMessage) {
    await respond("Usage: `/jarvis your goal or task here`");
    return;
  }

  try {
    const reply = await callAgent("jarvis", userMessage, `slash-jarvis-${command.channel_id}`);
    await respond({ text: formatReply("jarvis", reply), response_type: "in_channel" });
  } catch (err) {
    await respond(`⚠️ Error: ${err.message}`);
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────

const http = require("http");
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Jarvis OS running ✓");
}).listen(process.env.PORT || 3000, () => {
  console.log(`Health check on port ${process.env.PORT || 3000}`);
});

// ─── Start ────────────────────────────────────────────────────────────────────

(async () => {
  await slack.start();
  console.log("⚡ Jarvis OS is online");
  console.log(`Agents active: ${Object.keys(AGENTS).join(", ")}`);
})();
