const DEFAULT_MODEL = "text-embedding-3-small";
const OPENAI_BASE = "https://api.openai.com/v1";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export interface EmbeddingProvider {
  model: string;
  dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export function createEmbeddingProvider(options: {
  provider?: "openai" | "openrouter" | "custom";
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}): EmbeddingProvider | null {
  const apiKey =
    options.apiKey ??
    process.env["OPENAI_API_KEY"] ??
    process.env["OPENROUTER_API_KEY"];
  if (!apiKey?.trim()) return null;

  const provider = options.provider ?? (process.env["OPENROUTER_API_KEY"] ? "openrouter" : "openai");
  const baseUrl =
    options.baseUrl?.trim() ??
    (provider === "openrouter" ? OPENROUTER_BASE : OPENAI_BASE);
  const model = options.model ?? process.env["MEMORY_EMBEDDING_MODEL"] ?? DEFAULT_MODEL;

  const url = baseUrl.endsWith("/embeddings")
    ? baseUrl
    : `${baseUrl.replace(/\/$/, "")}/embeddings`;

  const dimensions = model.includes("3-small") ? 1536 : model.includes("3-large") ? 3072 : 1536;

  return {
    model,
    dimensions,
    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const input = texts.filter((t) => typeof t === "string" && t.trim().length > 0);
      if (input.length === 0) return [];

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, input }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Embedding API error ${res.status}: ${err}`);
      }
      const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
      const dataArr = data?.data ?? [];
      if (dataArr.length !== input.length) {
        throw new Error(`Embedding count mismatch: got ${dataArr.length}, expected ${input.length}`);
      }
      return dataArr
        .sort((a, b) => (a.embedding ? 0 : 1) - (b.embedding ? 0 : 1))
        .map((d) => d.embedding ?? []);
    },
  };
}
