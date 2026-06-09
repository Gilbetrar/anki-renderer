"""Core rendering logic: wraps the official anki package so every card is
rendered by Anki's real Rust engine, via the same code path Anki desktop's
card-layout preview uses (TemplateRenderContext.from_card_layout)."""

from __future__ import annotations

import os
import tempfile
import threading
from dataclasses import dataclass, field

import anki.collection  # noqa: F401  (must import before anki.template — circular import)
import anki.buildinfo
from anki.cards import Card
from anki.collection import Collection
from anki.template import TemplateRenderContext

ANKI_VERSION = anki.buildinfo.version


@dataclass
class TemplateSpec:
    front: str
    back: str
    name: str = "Card 1"


@dataclass
class RenderRequest:
    templates: list[TemplateSpec]
    fields: dict[str, str]
    css: str | None = None
    model_name: str = "Preview"
    cloze: bool = False
    deck_name: str = "Default"
    tags: list[str] = field(default_factory=list)
    fill_empty: bool = False


class RenderService:
    """Holds one scratch Collection; renders requests against ephemeral
    notetypes/notes that are removed again after each render.

    Collection is not thread-safe, so all rendering is serialized."""

    def __init__(self, data_dir: str | None = None):
        self._lock = threading.Lock()
        self._dir = data_dir or tempfile.mkdtemp(prefix="anki-render-")
        os.makedirs(self._dir, exist_ok=True)
        self._col_path = os.path.join(self._dir, "scratch.anki2")
        self._col = Collection(self._col_path)

    def close(self) -> None:
        with self._lock:
            self._col.close()

    def render(self, req: RenderRequest) -> dict:
        with self._lock:
            try:
                return self._render(req)
            except Exception:
                # A failed render can leave the scratch collection in a bad
                # state; rebuild it so one bad request can't poison the next.
                self._reset_collection()
                raise

    def _reset_collection(self) -> None:
        try:
            self._col.close()
        except Exception:
            pass
        for suffix in ("", "-wal", "-shm"):
            try:
                os.remove(self._col_path + suffix)
            except FileNotFoundError:
                pass
        self._col = Collection(self._col_path)

    def _render(self, req: RenderRequest) -> dict:
        col = self._col
        mm = col.models

        if not req.templates:
            raise ValueError("at least one template is required")
        if not req.fields:
            raise ValueError("at least one field is required")

        notetype = mm.new(req.model_name)
        if req.cloze:
            notetype["type"] = 1
        for fname in req.fields:
            mm.add_field(notetype, mm.new_field(fname))
        for spec in req.templates:
            tpl = mm.new_template(spec.name)
            tpl["qfmt"] = spec.front
            tpl["afmt"] = spec.back
            mm.add_template(notetype, tpl)
        if req.css is not None:
            notetype["css"] = req.css
        mm.add(notetype)

        note = None
        try:
            note = col.new_note(notetype)
            for name, value in req.fields.items():
                note[name] = value
            note.tags = list(req.tags)

            deck_id = col.decks.id(req.deck_name)
            # Persist the note so cards render through the exact same path a
            # real review uses (deck names, card generation rules included).
            col.add_note(note, deck_id=deck_id)
            real_cards = {c.ord: c for c in note.cards()}

            if req.cloze:
                ordinals = sorted(real_cards) or [0]
                jobs = [(o, notetype["tmpls"][0]) for o in ordinals]
            else:
                jobs = list(enumerate(notetype["tmpls"]))

            cards = []
            for ord_, tpl in jobs:
                card = real_cards.get(ord_)
                if card is not None:
                    out = card.render_output(reload=True)
                    empty = False
                else:
                    # Anki would not generate this card (front renders empty).
                    # Render it anyway via the card-layout preview path so the
                    # author can still see the template.
                    card = Card(col)
                    card.ord = ord_
                    card.did = deck_id
                    ctx = TemplateRenderContext.from_card_layout(
                        note, card, notetype=notetype, template=tpl,
                        fill_empty=req.fill_empty,
                    )
                    out = ctx.render()
                    empty = True
                cards.append({
                    "ord": ord_,
                    "name": tpl["name"],
                    "empty": empty,
                    "question": out.question_text,
                    "answer": out.answer_text,
                    "questionAvTags": [_av_tag_dict(t) for t in out.question_av_tags],
                    "answerAvTags": [_av_tag_dict(t) for t in out.answer_av_tags],
                })

            return {
                "cards": cards,
                "css": notetype["css"],
                "ankiVersion": ANKI_VERSION,
            }
        finally:
            if note is not None and note.id:
                col.remove_notes([note.id])
            mm.remove(notetype["id"])


def _av_tag_dict(tag) -> dict:
    # TTSTag has field_text/lang/voices/speed; SoundOrVideoTag has filename.
    if hasattr(tag, "filename"):
        return {"kind": "sound", "filename": tag.filename}
    return {
        "kind": "tts",
        "fieldText": tag.field_text,
        "lang": tag.lang,
        "voices": list(tag.voices),
        "speed": tag.speed,
    }
