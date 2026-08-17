import { strict as assert } from "node:assert";
import { orderPolicySectionsForWidgetRuntime } from "../domain/policy/widgetSectionOrder.js";

async function main() {
  const ordered = orderPolicySectionsForWidgetRuntime({
    title: "Consent Form",
    sections: [
      { id: "processing", text: "processing text" },
      { id: "purpose", text: "purpose text" },
      { id: "retention", text: "retention text" },
      { id: "grievance", text: "grievance text" },
      { id: "withdrawal", text: "withdrawal text" },
      { id: "data_categories", text: "data categories text" },
      { id: "custom_extra", text: "extra text" },
    ],
  });

  assert.deepEqual(
    ordered.map((s) => s.id),
    [
      "purpose",
      "data_categories",
      "processing",
      "retention",
      "withdrawal",
      "grievance",
      "custom_extra",
    ],
  );

  // eslint-disable-next-line no-console
  console.log("widgetSectionOrder tests passed");
}

await main();
