import { WIDGET_EVENTS, WIDGET_MESSAGE_VERSION } from "@sammati/shared-core";

/**
 * Hosted consent widget document served at GET /widget/hosted.
 * Pure HTML generation only — CSP, auth, and route registration live in api/http/routes/widgetRuntime.ts.
 */
export function buildHostedWidgetHtml(sessionToken: string): string {
  const escapedToken = JSON.stringify(sessionToken);
  const v = JSON.stringify(WIDGET_MESSAGE_VERSION);
  const evReady = JSON.stringify(WIDGET_EVENTS.ready);
  const evResized = JSON.stringify(WIDGET_EVENTS.resized);
  const evConsentSubmitted = JSON.stringify(WIDGET_EVENTS.consentSubmitted);
  const evConsentFailed = JSON.stringify(WIDGET_EVENTS.consentFailed);
  const evLoaded = JSON.stringify(WIDGET_EVENTS.loaded);
  const evError = JSON.stringify(WIDGET_EVENTS.error);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sammati Consent Widget</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #111827; background: #fff; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    .meta { color: #374151; font-size: 13px; margin-bottom: 12px; }
    .section { margin-bottom: 12px; }
    .section h2 { font-size: 15px; margin: 0 0 6px; text-transform: capitalize; }
    .section p { margin: 0; line-height: 1.4; white-space: pre-wrap; }
    .state { margin: 12px 0; padding: 10px; border-radius: 6px; font-size: 14px; }
    .state.error { background: #fef2f2; color: #991b1b; }
    .state.info { background: #eff6ff; color: #1e3a8a; }
    .actions { display: flex; gap: 8px; margin-top: 16px; }
    button { border: 0; border-radius: 6px; padding: 10px 14px; cursor: pointer; font-weight: 600; }
    .grant { background: #059669; color: white; }
    .update { background: #2563eb; color: white; }
    .revoke { background: #dc2626; color: white; }
    button[disabled] { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="card">
    <h1 id="title">Loading consent...</h1>
    <div id="meta" class="meta"></div>
    <div id="state" class="state info">Initializing widget runtime...</div>
    <div id="sections"></div>
    <div class="actions">
      <button id="grant" class="grant">Grant</button>
      <button id="update" class="update">Update</button>
      <button id="revoke" class="revoke">Revoke</button>
    </div>
  </div>
  <script>
    (() => {
      const SESSION_TOKEN = ${escapedToken};
      const VERSION = ${v};
      function apiUrl(path) {
        return new URL(path, window.location.href).toString();
      }
      const stateEl = document.getElementById("state");
      const titleEl = document.getElementById("title");
      const metaEl = document.getElementById("meta");
      const sectionsEl = document.getElementById("sections");
      const buttons = {
        GRANT: document.getElementById("grant"),
        UPDATE: document.getElementById("update"),
        REVOKE: document.getElementById("revoke"),
      };
      if (!stateEl || !titleEl || !metaEl || !sectionsEl || !buttons.GRANT || !buttons.UPDATE || !buttons.REVOKE) {
        document.body.innerHTML = '<p style="padding:16px;font-family:sans-serif">Sammati widget: missing DOM nodes.</p>';
        return;
      }
      let bootstrap = null;

      function parseParentOrigin() {
        try {
          if (!document.referrer) return null;
          return new URL(document.referrer).origin;
        } catch {
          return null;
        }
      }

      function parentPost(event, payload) {
        const parentOrigin = bootstrap?.session?.allowed_origin ?? parseParentOrigin() ?? "*";
        if (window.parent !== window) {
          window.parent.postMessage({ version: VERSION, event, payload }, parentOrigin);
        }
      }

      function updateHeight() {
        const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        parentPost(${evResized}, { height });
      }

      function disableActions(disabled) {
        Object.values(buttons).forEach((btn) => { btn.disabled = disabled; });
      }

      function setState(text, kind = "info") {
        stateEl.textContent = text;
        stateEl.className = "state " + kind;
      }

      async function submit(action) {
        if (!bootstrap) return;
        try {
          disableActions(true);
          setState("Submitting consent action...", "info");
          const res = await fetch(apiUrl("/v1/widget/sessions/" + bootstrap.session.session_id + "/submit"), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-sammati-embed-origin": bootstrap.session.allowed_origin,
            },
            body: JSON.stringify({
              session_token: SESSION_TOKEN,
              action,
              occurred_at: new Date().toISOString(),
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.message || "Submit failed");
          setState("Consent submitted. Proof status: PENDING", "info");
          parentPost(${evConsentSubmitted}, json);
          disableActions(true);
          updateHeight();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Submit failed";
          setState(message, "error");
          parentPost(${evConsentFailed}, { message });
          disableActions(false);
          updateHeight();
        }
      }

      buttons.GRANT.addEventListener("click", () => submit("GRANT"));
      buttons.UPDATE.addEventListener("click", () => submit("UPDATE"));
      buttons.REVOKE.addEventListener("click", () => submit("REVOKE"));

      async function bootstrapWidget() {
        parentPost(${evReady}, { state: "bootstrapping" });
        const parentOrigin = parseParentOrigin();
        try {
          const res = await fetch(apiUrl("/v1/widget/runtime/bootstrap"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ session_token: SESSION_TOKEN, parent_origin: parentOrigin || undefined }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.message || "Runtime bootstrap failed");
          bootstrap = json;

          titleEl.textContent = json.policy.title;
          metaEl.textContent = "Purpose: " + json.session.purpose_code + " | Locale: " + json.session.locale + " | Legal version: " + json.policy.required_legal_version;
          sectionsEl.innerHTML = "";
          for (const section of json.policy.sections) {
            const el = document.createElement("div");
            el.className = "section";
            const h = document.createElement("h2");
            h.textContent = section.id.replace(/_/g, " ");
            const p = document.createElement("p");
            p.textContent = section.text;
            el.appendChild(h);
            el.appendChild(p);
            sectionsEl.appendChild(el);
          }

          if (json.session.status === "CONSUMED" || json.session.status === "EXPIRED" || json.session.status === "CANCELLED") {
            disableActions(true);
            setState(json.session.state_reason || ("Session is " + json.session.status.toLowerCase()), "error");
          } else {
            disableActions(false);
            setState("Review the policy and choose an action.", "info");
          }

          parentPost(${evLoaded}, {
            session_id: json.session.session_id,
            status: json.session.status,
            locale: json.session.locale,
            render_hash: json.session.render_hash,
          });
          updateHeight();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Widget bootstrap failed";
          setState(message, "error");
          disableActions(true);
          parentPost(${evError}, { code: "BOOTSTRAP_FAILED", message });
          updateHeight();
        }
      }

      window.addEventListener("load", bootstrapWidget);
      window.addEventListener("resize", updateHeight);
    })();
  </script>
</body>
</html>`;
}
