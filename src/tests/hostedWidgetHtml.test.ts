import { strict as assert } from "node:assert";
import { buildHostedWidgetHtml } from "../services/widget/hostedWidgetHtml.js";

/** Parity checks after P2 extraction — ensures critical iframe/bootstrap/submit strings remain in the document. */
async function main() {
  const token =
    "eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiIxMjM0NTY3LTg5MGItYWJjZC1lZjAxMjM0NTY3ODkifQ.signature";
  const html = buildHostedWidgetHtml(token);

  assert.equal(
    html.includes(`const SESSION_TOKEN = ${JSON.stringify(token)};`),
    true,
    "session token must be embedded via JSON.stringify for browser parity",
  );

  const markers = [
    "/v1/widget/runtime/bootstrap",
    "/v1/widget/sessions/",
    "bootstrap.session.session_id",
    "/submit",
    "x-sammati-embed-origin",
    'const VERSION = "1.0"',
    "window.parent.postMessage({ version: VERSION, event, payload }, parentOrigin)",
    "widget.ready",
    "widget.loaded",
    "consent.submitted",
    "consent.failed",
    "widget.error",
    "widget.resized",
    "BOOTSTRAP_FAILED",
  ];
  for (const m of markers) {
    assert.equal(html.includes(m), true, `missing marker: ${m}`);
  }

  const tokenWithQuote = `${"a".repeat(20)}\"x`;
  const html2 = buildHostedWidgetHtml(tokenWithQuote);
  assert.equal(html2.includes(`const SESSION_TOKEN = ${JSON.stringify(tokenWithQuote)};`), true);

  // eslint-disable-next-line no-console
  console.log("hostedWidgetHtml parity tests passed");
}

await main();
