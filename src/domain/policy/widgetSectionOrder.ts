import type { PolicyLocaleContent } from "./types.js";
import { RequiredPolicySectionIds } from "./validation.js";

/**
 * Deterministic section order for hosted widget bootstrap JSON.
 * Required legal sections first (see RequiredPolicySectionIds), then remaining sections by id ascending.
 */
export function orderPolicySectionsForWidgetRuntime(
  content: PolicyLocaleContent,
): Array<{ id: string; text: string }> {
  const byId = new Map(content.sections.map((s) => [s.id, s]));
  const ordered: Array<{ id: string; text: string }> = [];
  for (const id of RequiredPolicySectionIds) {
    const section = byId.get(id);
    if (section) ordered.push(section);
    byId.delete(id);
  }
  const remaining = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  return ordered.concat(remaining);
}
