import axios from "axios";
import { logger } from "./logger.js";

export async function callMastraExternal(input: string, systemPrompt?: string, metadata?: any) {
  const BASE = process.env.MASTRA_BASE_URL || "";
  const PATH = process.env.MASTRA_AGENT_PATH || "";
  if (!BASE || !PATH) {
    // no external Mastra configured
    return null;
  }
  const url = `${BASE.replace(/\/$/, "")}${PATH.startsWith("/") ? PATH : "/" + PATH}`;
  try {
    const body = { input, system_prompt: systemPrompt, metadata };
    const headers: Record<string,string> = { "Content-Type": "application/json" };
    if (process.env.MASTRA_API_KEY) headers["Authorization"] = `Bearer ${process.env.MASTRA_API_KEY}`;
    const res = await axios.post(url, body, { headers, timeout: 15000 });
    // Expecting { output, actions? }
    return res.data;
  } catch (err: any) {
    logger.error({ err: err?.toString(), url }, "Mastra external call failed");
    return null;
  }
}