import { Sender, Destination, SendResult } from "./sender";
import { logger } from "../logger";

export class CallMeBotSender implements Sender {
  private timeoutMs: number;

  constructor(timeoutMs = 35000) {
    this.timeoutMs = timeoutMs;
  }

  async send(dest: Destination, text: string): Promise<SendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const provider = dest.provider || "callmebot";

    try {
      if (provider === "textmebot") {
        // TextMeBot expects POST with application/x-www-form-urlencoded
        const recipient = dest.phoneE164.replace(/^\+/, "");
        const params = new URLSearchParams({
          recipient: recipient,
          apikey: dest.apiKey.trim(),
          text: text,
          json: "yes",
        });

        const response = await fetch("https://api.textmebot.com/send.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "TG2WA-Worker/1.0",
          },
          body: params.toString(),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const status = response.status;
          const rawText = await response.text().catch(() => "");
          const isDelay = rawText.toLowerCase().includes("delay") || rawText.toLowerCase().includes("wait") || status === 429;
          return {
            success: false,
            error: rawText ? `HTTP_${status}: ${rawText.slice(0, 80).trim()}` : `HTTP_${status}`,
            retryable: status >= 500 || status === 429 || isDelay,
          };
        }

        const rawText = await response.text();
        try {
          const data = JSON.parse(rawText);
          if (data.status === "error") {
            const comment = data.comment || data.message || "TEXTMEBOT_REJECTED";
            const isDelay = comment.toLowerCase().includes("delay") || comment.toLowerCase().includes("wait");
            return {
              success: false,
              error: comment,
              retryable: isDelay,
            };
          }
          return { success: true };
        } catch {
          if (rawText.toLowerCase().includes("error") || rawText.toLowerCase().includes("invalid")) {
            return {
              success: false,
              error: "TEXTMEBOT_REJECTED",
              retryable: false,
            };
          }
          return { success: true };
        }
      } else {
        // CallMeBot format (GET)
        const params = new URLSearchParams({
          phone: dest.phoneE164,
          text: text,
          apikey: dest.apiKey.trim(),
        });
        const url = `https://api.callmebot.com/whatsapp.php?${params.toString()}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "TG2WA-Worker/1.0",
          },
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          const status = response.status;
          return {
            success: false,
            error: `HTTP_${status}`,
            retryable: status >= 500 || status === 429,
          };
        }

        const body = await response.text();
        if (body.toLowerCase().includes("error") || body.toLowerCase().includes("invalid")) {
          return {
            success: false,
            error: "CALLMEBOT_REJECTED",
            retryable: false,
          };
        }

        return { success: true };
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = (err as Error)?.name === "AbortError";
      logger.warn({ isAbort, provider }, "WhatsApp delivery send error");
      return {
        success: false,
        error: isAbort
          ? (dest.phoneE164.endsWith("@g.us")
              ? "WhatsApp gateway timed out. Please check that your Group ID is in the format 120363xxxxxx@g.us and your linked phone number is an active member of that group."
              : "WhatsApp gateway timed out. Please verify your WhatsApp phone number and that your API key is active.")
          : "GATEWAY_NETWORK_ERROR",
        retryable: true,
      };
    }
  }
}
