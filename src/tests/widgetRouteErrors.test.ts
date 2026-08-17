import { strict as assert } from "node:assert";
import {
  classifyWidgetBootstrapServiceMessage,
  classifyWidgetSubmitServiceMessage,
} from "../api/http/widgetRouteErrors.js";

async function main() {
  assert.equal(classifyWidgetBootstrapServiceMessage("Widget session expired."), "gone");
  assert.equal(classifyWidgetBootstrapServiceMessage("Session already consumed."), "conflict");
  assert.equal(classifyWidgetBootstrapServiceMessage("Session cancelled."), "conflict");
  assert.equal(classifyWidgetBootstrapServiceMessage("Parent origin is not allowed."), "bad_request");

  assert.equal(classifyWidgetSubmitServiceMessage("Widget session expired."), "gone");
  assert.equal(classifyWidgetSubmitServiceMessage("Widget session already consumed."), "conflict");
  assert.equal(classifyWidgetSubmitServiceMessage("Widget session not found."), "not_found");
  assert.equal(classifyWidgetSubmitServiceMessage("Invalid origin for widget session submit."), "bad_request");

  // "not found" substring without submit-specific phrasing still maps (same as prior includes("not found"))
  assert.equal(classifyWidgetSubmitServiceMessage("not found"), "not_found");

  // eslint-disable-next-line no-console
  console.log("widgetRouteErrors classification tests passed");
}

await main();
