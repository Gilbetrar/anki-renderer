"""HTTP API for the Anki rendering service.

POST /render — render templates + fields through Anki's real engine.
GET  /healthz — liveness check with engine version.
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from anki.errors import CardTypeError, TemplateError

from .renderer import ANKI_VERSION, RenderRequest, RenderService, TemplateSpec


class TemplateIn(BaseModel):
    front: str
    back: str
    name: str = "Card 1"


class RenderIn(BaseModel):
    templates: list[TemplateIn] = Field(min_length=1)
    fields: dict[str, str] = Field(min_length=1)
    css: str | None = None
    modelName: str = "Preview"
    cloze: bool = False
    deckName: str = "Default"
    tags: list[str] = []
    fillEmpty: bool = False


app = FastAPI(title="anki-renderer", version=ANKI_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

service = RenderService(data_dir=os.environ.get("ANKI_RENDER_DATA_DIR"))


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True, "ankiVersion": ANKI_VERSION}


@app.post("/render")
def render(body: RenderIn) -> dict:
    req = RenderRequest(
        templates=[TemplateSpec(front=t.front, back=t.back, name=t.name) for t in body.templates],
        fields=body.fields,
        css=body.css,
        model_name=body.modelName,
        cloze=body.cloze,
        deck_name=body.deckName,
        tags=body.tags,
        fill_empty=body.fillEmpty,
    )
    try:
        return service.render(req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"unknown field: {e}")
    except (CardTypeError, TemplateError) as e:
        raise HTTPException(status_code=400, detail=str(e))
