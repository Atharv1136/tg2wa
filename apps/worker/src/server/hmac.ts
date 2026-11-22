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

    const bodyStr = request.body ? JSON.stringify(request.body) : "";
    const verification = verifySignature(
      secret,
      request.method,
      request.url,
      bodyStr,
      timestamp,
      signature
    );

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
