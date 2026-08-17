import type { FastifyInstance } from "fastify";
import { z } from "zod";
import "../types.js";
import { verifyWidgetSessionToken } from "../../../security/widgetSessionToken.js";
import { WidgetRuntimeBootstrapSchema } from "../../../services/widget/widgetRuntimeContract.js";
import { buildHostedWidgetHtml } from "../../../services/widget/hostedWidgetHtml.js";
import { throwWidgetBootstrapServiceError } from "../widgetRouteErrors.js";

export async function registerWidgetRuntimeRoutes(app: FastifyInstance) {
  // Helmet defaults (X-Frame-Options: SAMEORIGIN + CSP frame-ancestors 'self') block cross-origin
  // embedding (e.g. parent http://localhost:5173, iframe http://127.0.0.1:3000). Framing is enforced
  // only by this route's Content-Security-Policy frame-ancestors (allowed_origin from session).
  app.get("/widget/hosted", { config: { skipApiKeyAuth: true }, helmet: false }, async (req, reply) => {
    const query = z.object({ session_token: z.string().min(20) }).safeParse(req.query);
    if (!query.success) throw app.httpErrors.badRequest("Missing session_token query param.");

    const claims = verifyWidgetSessionToken(query.data.session_token, { allowExpired: true });
    reply.header(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "connect-src 'self'",
        "img-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline'",
        `frame-ancestors ${claims.allowed_origin}`,
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
    );
    reply.type("text/html; charset=utf-8");
    return reply.send(buildHostedWidgetHtml(query.data.session_token));
  });

  // Skip Helmet: default Cross-Origin-Resource-Policy: same-origin breaks fetch() from sandboxed
  // iframes without allow-same-origin (opaque origin). Parent framing is not via these JSON routes.
  app.post("/v1/widget/runtime/bootstrap", { config: { skipApiKeyAuth: true }, helmet: false }, async (req, reply) => {
    const parsed = WidgetRuntimeBootstrapSchema.safeParse(req.body);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Invalid body.");
    try {
      const data = await app.services.widgetRuntime.bootstrap(parsed.data);
      return reply.code(200).send(data);
    } catch (err) {
      throwWidgetBootstrapServiceError(app.httpErrors, err, "Runtime bootstrap failed.");
    }
  });
}
