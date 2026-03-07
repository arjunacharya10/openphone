const BASE_URL = process.env["GRAPHITI_SERVICE_URL"] ?? "http://localhost:7473";
const TIMEOUT_MS = 8000;

export interface KGFact {
  fact: string;
  relation: string;
  valid_at: string | null;
  invalid_at: string | null;
}

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Ingest a conversation or event into the knowledge graph.
 * Graphiti extracts entities and relationships automatically.
 * Fire-and-forget safe — failures degrade silently.
 */
export async function addEpisode(params: {
  name: string;
  content: string;
  sourceDescription?: string;
}): Promise<void> {
  await post("/episodes", {
    name: params.name,
    content: params.content,
    source_description: params.sourceDescription ?? "openphone conversation",
    reference_time: new Date().toISOString(),
  });
}

/**
 * Search the knowledge graph for facts relevant to a query.
 * Returns an empty array if the service is unavailable.
 */
export async function searchGraph(query: string, numResults = 10): Promise<KGFact[]> {
  const data = await post<{ results: KGFact[] }>("/search", {
    query,
    num_results: numResults,
  });
  return data?.results ?? [];
}

/**
 * Format KG results for injection into the system prompt.
 */
export function formatKGForPrompt(facts: KGFact[]): string {
  if (facts.length === 0) return "";
  const lines = facts.map((f) => `- ${f.fact}`);
  return ["## Knowledge Graph", "", ...lines, ""].join("\n");
}

/**
 * Check if the graphiti service is reachable.
 */
export async function isGraphitiAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
