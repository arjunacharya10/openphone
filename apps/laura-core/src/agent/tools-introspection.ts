import { tools } from "./tools.js";
import type { ToolSpec } from "../api/types.js";

/**
 * Project agent tools into serializable ToolSpec for GET /api/tools.
 */
export function getToolSpecs(): ToolSpec[] {
  return tools.map((t) => {
    const params: Record<string, string> = {};
    if (t.parameters && typeof t.parameters === "object") {
      const schema = (t.parameters as { properties?: Record<string, { description?: string }> }).properties;
      if (schema) {
        for (const [key, val] of Object.entries(schema)) {
          params[key] = val?.description ?? "unknown";
        }
      }
    }
    return {
      name: t.name,
      description: t.description ?? "",
      parameters: Object.keys(params).length > 0 ? params : undefined,
    };
  });
}
