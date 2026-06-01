# Jarvis OS — Slack Setup Guide

## What you'll have when done
Six agent channels in Slack. Message any channel, get that agent's response.
Message #jarvis with a goal and he coordinates the team.
Use `/jarvis` or `/agent bobby` from anywhere.

---

## Step 1 — Create your Slack App

1. Go to **api.slack.com/apps** → click **Create New App**
2. Choose **From scratch**
3. Name it `Jarvis OS`, pick your workspace → **Create App**

---

## Step 2 — Enable Socket Mode

1. Left sidebar → **Socket Mode** → toggle **Enable Socket Mode** ON
2. It will ask you to create an App-Level Token
3. Name it `jarvis-socket`, add scope `connections:write` → **Generate**
4. Copy the token that starts with `xapp-` → this is your `SLACK_APP_TOKEN`

---

## Step 3 — Add Bot Permissions

1. Left sidebar → **OAuth & Permissions**
2. Scroll to **Bot Token Scopes** → Add these scopes:
   - `channels:history`
   - `channels:read`
   - `chat:write`
   - `commands`
   - `groups:history`
   - `groups:read`
   - `im:history`
   - `im:write`

3. Scroll up → **Install to Workspace** → Allow
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`) → `SLACK_BOT_TOKEN`

---

## Step 4 — Enable Events

1. Left sidebar → **Event Subscriptions** → toggle ON
2. Subscribe to bot events → Add:
   - `message.channels`
   - `message.groups`
   - `message.im`
3. Save Changes

---

## Step 5 — Add Slash Commands

1. Left sidebar → **Slash Commands** → **Create New Command**

Create these two:

| Command  | Description                        |
|----------|------------------------------------|
| /jarvis  | Send a goal to Jarvis              |
| /agent   | Message any agent: /agent eva ...  |

For Request URL: put `https://placeholder.com` for now (Socket Mode doesn't need a real URL)

---

## Step 6 — Get your Signing Secret

1. Left sidebar → **Basic Information**
2. Scroll to **App Credentials**
3. Copy **Signing Secret** → `SLACK_SIGNING_SECRET`

---

## Step 7 — Create your Slack channels

Create these channels in your Slack workspace and invite the bot to each:

- `#jarvis`
- `#bobby`
- `#sarah`
- `#eva`
- `#tom`
- `#scout`

To invite the bot: open each channel → `/invite @Jarvis OS`

---

## Step 8 — Set up and run the backend

```bash
# Clone or copy the jarvis-bot folder to your machine
cd jarvis-bot

# Install dependencies
npm install

# Copy the env template
cp .env.example .env

# Fill in your keys
nano .env   # or open in any text editor
```

Add your four keys:
```
ANTHROPIC_API_KEY=...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...
```

Run it:
```bash
npm start
```

You should see:
```
⚡ Jarvis OS is online
Agents active: jarvis, bobby, sarah, eva, tom, scout
```

---

## Step 9 — Test it

Open Slack on your phone. Go to `#jarvis`. Type:

> We had a spike in support tickets this week and I don't know if it's a product bug or a process issue

Jarvis will respond and tell you who he's routing to.

Then try from anywhere:
```
/jarvis What should our Q3 growth focus be?
/agent scout What are our top 3 competitors doing with AI right now?
```

---

## Deploy to Railway (so it runs 24/7)

1. Push the `jarvis-bot` folder to a GitHub repo
2. Go to **railway.app** → New Project → Deploy from GitHub
3. Add your environment variables in Railway's dashboard
4. Deploy — Railway gives you a live URL and keeps it running

Free tier covers light usage. $5/month hobby plan for always-on.

---

## Voice memos (bonus)

Slack on iPhone automatically transcribes voice messages.
The transcription gets sent as a text message to the channel,
so your agents receive it just like typed text. No extra setup needed.

For higher accuracy transcription, you can add Whisper API later —
just intercept the audio file before it hits the agent.

---

## File structure

```
jarvis-bot/
├── src/
│   └── server.js        ← All agent logic and Slack handling
├── .env.example         ← Copy to .env and fill in keys
├── .env                 ← Your actual keys (never commit this)
├── package.json
└── SETUP.md             ← This file
```
