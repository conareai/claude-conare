#!/usr/bin/env node
// claude-conare MCP bridge: stdio ↔ https://api.conare.ai/mcp
//
// Why this exists: the Conare MCP server authenticates with the API key that
// `bunx conare@latest` writes to ~/.conare/config.json. A static .mcp.json
// can't carry per-user credentials, so this bridge reads the key locally and
// forwards JSON-RPC over HTTP with the Bearer header — already-signed-in
// users get working tools with zero auth prompts.
//
// Signed-out mode: with no API key, the bridge answers locally with a single
// `setup` tool that tells the agent how to get the user connected. The key is
// re-checked on every message, so signing in mid-session starts working
// without a reconnect.
//
// https://github.com/conareai/claude-conare

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const VERSION = "1.1.0";
const API_URL = process.env.CONARE_API_URL || "https://api.conare.ai";

const SETUP_TEXT =
  "Conare isn't connected on this machine yet. Have the user run " +
  "`bunx conare@latest` in a terminal — it creates/links their account, saves " +
  "the API key to ~/.conare/config.json, and starts chat-history sync. Memory " +
  "tools (recall/search/save/forget) appear here immediately after, no restart needed.";

function readApiKey() {
  try {
    const config = JSON.parse(
      readFileSync(join(homedir(), ".conare", "config.json"), "utf8"),
    );
    return typeof config.apiKey === "string" && config.apiKey ? config.apiKey : null;
  } catch {
    return null;
  }
}

const write = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");

async function forward(msg, apiKey) {
  try {
    const res = await fetch(`${API_URL}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": `claude-conare-bridge/${VERSION}`,
      },
      body: JSON.stringify(msg),
    });
    const text = await res.text();
    if (msg.id === undefined || msg.id === null) return null; // notification
    if (!res.ok) {
      return {
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32000, message: `conare: upstream ${res.status}` },
      };
    }
    return text.trim() ? JSON.parse(text) : null;
  } catch (err) {
    if (msg.id === undefined || msg.id === null) return null;
    return {
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32000, message: `conare: ${err?.message ?? "network error"}` },
    };
  }
}

// Minimal local server for the signed-out state — enough for the client to
// connect cleanly and for the agent to learn how to onboard the user.
function localAnswer(msg) {
  if (msg.id === undefined || msg.id === null) return null; // notification
  switch (msg.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: msg.params?.protocolVersion ?? "2025-03-26",
          serverInfo: { name: "conare", version: VERSION },
          capabilities: { tools: {} },
          instructions: SETUP_TEXT,
        },
      };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          tools: [
            {
              name: "setup",
              description:
                "Conare is not connected on this machine. Call this for setup instructions — recall/search/save/forget appear right after the user signs in.",
              inputSchema: { type: "object", properties: {} },
            },
          ],
        },
      };
    case "tools/call":
      return {
        jsonrpc: "2.0",
        id: msg.id,
        result: { content: [{ type: "text", text: SETUP_TEXT }] },
      };
    case "ping":
      return { jsonrpc: "2.0", id: msg.id, result: {} };
    default:
      return {
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32601, message: "Method not found" },
      };
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return; // not a JSON-RPC message; ignore
  }
  const apiKey = readApiKey(); // re-read every message: sign-in works mid-session
  const reply = apiKey ? await forward(msg, apiKey) : localAnswer(msg);
  if (reply) write(reply);
});
// No close handler: when stdin ends, in-flight forwards finish and the event
// loop drains naturally — an eager process.exit(0) would kill pending replies.
