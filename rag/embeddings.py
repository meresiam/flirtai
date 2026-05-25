"""Camada de embedding com adapter selecionavel por env (EMBEDDING_PROVIDER).

Default = local (fastembed BAAI/bge-m3, 1024d, gratis, offline, sem torch).
Alternativas pagas: voyage (voyage-3-large) | openai (text-embedding-3-large@1024d).

Todos retornam vetores de config.EMBEDDING_DIMS (1024). Troca de provider NAO
muda o schema (1024 fixo) — so a fonte dos numeros.
"""
from __future__ import annotations

from functools import lru_cache

from tenacity import retry, stop_after_attempt, wait_exponential

import config
from logging_setup import get_logger

log = get_logger("embeddings")


class Embedder:
    """Interface unica. .embed(list[str]) -> list[list[float]] de dim EMBEDDING_DIMS."""

    def __init__(self) -> None:
        self.provider = config.EMBEDDING_PROVIDER
        self.dims = config.EMBEDDING_DIMS
        self._backend = None  # carregado lazy

    # -- API publica -------------------------------------------------------
    def embed(self, texts: list[str], kind: str = "document") -> list[list[float]]:
        """kind = document (itens da KB) | query (consulta do usuario).

        Modelos e5 EXIGEM prefixo 'passage: ' / 'query: ' — sem isso a qualidade
        cai muito. Aplicado so no provider local p/ modelos e5.
        """
        if not texts:
            return []
        texts = self._with_prefix(texts, kind)
        out: list[list[float]] = []
        for i in range(0, len(texts), config.EMBEDDING_BATCH):
            batch = texts[i : i + config.EMBEDDING_BATCH]
            out.extend(self._embed_batch(batch, kind))
        for v in out:
            if len(v) != self.dims:
                raise ValueError(
                    f"provider {self.provider} retornou dim {len(v)} != {self.dims}. "
                    f"Ajuste EMBEDDING_DIMS e a migration 001 (vector(N))."
                )
        return out

    def embed_one(self, text: str, kind: str = "query") -> list[float]:
        return self.embed([text], kind)[0]

    def _with_prefix(self, texts: list[str], kind: str) -> list[str]:
        if self.provider == "local" and "e5" in config.LOCAL_EMBEDDING_MODEL.lower():
            p = "query: " if kind == "query" else "passage: "
            return [p + t for t in texts]
        return texts

    # -- dispatch ----------------------------------------------------------
    def _embed_batch(self, batch: list[str], kind: str = "document") -> list[list[float]]:
        if self.provider == "local":
            return self._local(batch)
        if self.provider == "voyage":
            return self._voyage(batch, kind)
        if self.provider == "openai":
            return self._openai(batch)
        raise ValueError(f"EMBEDDING_PROVIDER desconhecido: {self.provider}")

    # -- local (fastembed / ONNX) -----------------------------------------
    def _local(self, batch: list[str]) -> list[list[float]]:
        if self._backend is None:
            from fastembed import TextEmbedding  # import lazy (pesado)

            log.info("carregando modelo local %s (fastembed/ONNX)...", config.LOCAL_EMBEDDING_MODEL)
            self._backend = TextEmbedding(model_name=config.LOCAL_EMBEDDING_MODEL)
        vecs = self._backend.embed(batch)
        return [list(map(float, v)) for v in vecs]

    # -- voyage ------------------------------------------------------------
    @retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, max=30))
    def _voyage(self, batch: list[str], kind: str = "document") -> list[list[float]]:
        if self._backend is None:
            import voyageai

            if not config.VOYAGE_API_KEY:
                raise RuntimeError("VOYAGE_API_KEY ausente para EMBEDDING_PROVIDER=voyage")
            self._backend = voyageai.Client(api_key=config.VOYAGE_API_KEY)
        res = self._backend.embed(
            batch, model=config.VOYAGE_MODEL,
            input_type="query" if kind == "query" else "document",
            output_dimension=self.dims,
        )
        return [list(map(float, e)) for e in res.embeddings]

    # -- openai ------------------------------------------------------------
    @retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, max=30))
    def _openai(self, batch: list[str]) -> list[list[float]]:
        if self._backend is None:
            from openai import OpenAI

            if not config.OPENAI_API_KEY:
                raise RuntimeError("OPENAI_API_KEY ausente para EMBEDDING_PROVIDER=openai")
            self._backend = OpenAI(api_key=config.OPENAI_API_KEY)
        r = self._backend.embeddings.create(
            model=config.OPENAI_EMBEDDING_MODEL, input=batch, dimensions=self.dims,
        )
        return [list(map(float, d.embedding)) for d in r.data]


@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    return Embedder()
