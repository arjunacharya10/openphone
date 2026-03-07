import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from graphiti_core import Graphiti
from graphiti_core.driver.kuzu_driver import KuzuDriver
from graphiti_core.embedder.openai import OpenAIEmbedder, OpenAIEmbedderConfig
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.llm_client.openai_client import OpenAIClient
from pydantic import BaseModel

load_dotenv()

KUZU_DB = os.environ.get("KUZU_DB", ":memory:")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "ollama")
LLM_MODEL = os.environ.get("LLM_MODEL", "llama3.1:8b")
EMBEDDING_BASE_URL = os.environ.get("EMBEDDING_BASE_URL", LLM_BASE_URL)
EMBEDDING_API_KEY = os.environ.get("EMBEDDING_API_KEY", LLM_API_KEY)
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text")
GROUP_ID = os.environ.get("GROUP_ID", "openphone")

graphiti: Graphiti | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global graphiti

    kuzu_driver = KuzuDriver(db=KUZU_DB)
    llm_client = OpenAIClient(
        config=LLMConfig(
            api_key=LLM_API_KEY,
            model=LLM_MODEL,
            base_url=LLM_BASE_URL,
        )
    )
    embedder = OpenAIEmbedder(
        config=OpenAIEmbedderConfig(
            api_key=EMBEDDING_API_KEY,
            embedding_model=EMBEDDING_MODEL,
            base_url=EMBEDDING_BASE_URL,
        )
    )

    graphiti = Graphiti(
        graph_driver=kuzu_driver,
        llm_client=llm_client,
        embedder=embedder,
    )
    await graphiti.build_indices_and_constraints()
    print(f"[graphiti-service] ready — db={KUZU_DB} model={LLM_MODEL}")
    yield
    await graphiti.close()


app = FastAPI(title="graphiti-service", lifespan=lifespan)


# ── Models ──


class AddEpisodeRequest(BaseModel):
    name: str
    content: str
    source_description: str = "openphone conversation"
    group_id: str = GROUP_ID
    reference_time: str | None = None


class SearchRequest(BaseModel):
    query: str
    num_results: int = 10
    group_ids: list[str] | None = None


# ── Routes ──


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/status")
async def status():
    if graphiti is None:
        raise HTTPException(status_code=503, detail="graphiti not initialised")
    try:
        # Probe Kuzu with a trivial search
        await graphiti.search(query="_", num_results=1, group_ids=[GROUP_ID])
        return {"ok": True, "db": KUZU_DB, "model": LLM_MODEL}
    except Exception as e:
        return JSONResponse(status_code=503, content={"ok": False, "error": str(e)})


@app.post("/episodes")
async def add_episode(req: AddEpisodeRequest):
    if graphiti is None:
        raise HTTPException(status_code=503, detail="graphiti not initialised")
    ref_time = (
        datetime.fromisoformat(req.reference_time)
        if req.reference_time
        else datetime.now(timezone.utc)
    )
    episode = await graphiti.add_episode(
        name=req.name,
        episode_body=req.content,
        source_description=req.source_description,
        reference_time=ref_time,
        group_id=req.group_id,
    )
    return {"ok": True, "episode_uuid": str(episode.uuid) if episode else None}


@app.post("/search")
async def search(req: SearchRequest):
    if graphiti is None:
        raise HTTPException(status_code=503, detail="graphiti not initialised")
    group_ids = req.group_ids or [GROUP_ID]
    results = await graphiti.search(
        query=req.query,
        num_results=req.num_results,
        group_ids=group_ids,
    )
    return {
        "results": [
            {
                "fact": r.fact,
                "relation": r.name,
                "valid_at": r.valid_at.isoformat() if r.valid_at else None,
                "invalid_at": r.invalid_at.isoformat() if r.invalid_at else None,
            }
            for r in results
            if r.invalid_at is None  # only current facts by default
        ]
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 7473)))
