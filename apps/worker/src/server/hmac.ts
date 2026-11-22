import { FastifyRequest, FastifyReply } from "fastify";
import { verifySignature } from "@tg2wa/shared";
import { logger } from "../logger";

export function createHmacAuthHook(secret: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip /health endpoint
    if (request.url === "/health") {
      return;
    }

    const timestamp = request.headers["x-timestamp"] as string | undefined;
    const signature = request.headers["x-signature"] as string | undefined;

    let bodyStr = "";
    if (request.body !== undefined && request.body !== null) {
      if (typeof request.body === "object") {
        bodyStr = Object.keys(request.body).length > 0 ? JSON.stringify(request.body) : "";
      } else {
        bodyStr = String(request.body);
      }
    }

    let verification = verifySignature(
      secret,
      request.method,
      request.url,
      bodyStr,
      timestamp,
      signature
    );

    // If verification failed and body was empty or {}, try alternative empty representations
    if (!verification.valid && (bodyStr === "" || bodyStr === "{}")) {
      const altStr = bodyStr === "" ? "{}" : "";
      const alt = verifySignature(secret, request.method, request.url, altStr, timestamp, signature);
      if (alt.valid) {
        verification = alt;
      }
    }

    if (!verification.valid) {
      logger.warn({ reason: verification.reason, path: request.url }, "HMAC Auth Rejected");
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired request signature",
        },
      });
    }
  };
}
