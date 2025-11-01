import axios from "axios";
import { logger } from "./logger.js";

export async function postToTelex(url: string, payload: any) {
  try {
    const res = await axios.post(url, payload, { headers: { "Content-Type": "application/json" }, timeout: 10000 });
    return res.data;
  } catch (err: any) {
    logger.error({ err: err?.toString(), url }, "Failed to post to Telex outbound URL");
    throw err;
  }
}