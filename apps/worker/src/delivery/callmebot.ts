import { Sender, Destination, SendResult } from "./sender";
import { logger } from "../logger";

export class CallMeBotSender implements Sender {
  private timeoutMs: number;

  constructor(timeoutMs = 10000) {
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
          return {
            success: false,
            error: `HTTP_${status}`,
            retryable: status >= 500 || status === 429,
          };
        }

        const rawText = await response.text();
        try {
          const data = JSON.parse(rawText);
          if (data.status === "error") {
            return {
              success: false,
              error: data.comment || data.message || "TEXTMEBOT_REJECTED",
              retryable: false,
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
        error: isAbort ? "GATEWAY_TIMEOUT" : "GATEWAY_NETWORK_ERROR",
        retryable: true,
      };
    }
  }
}
