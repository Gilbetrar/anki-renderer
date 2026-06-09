"""Differential fidelity check: render real cards from the live Anki
collection (via AnkiConnect) through RenderService, and byte-compare with
the HTML the running Anki app itself produced (cardsInfo).

Usage: .venv/bin/python -m server.differential [notes-per-model]
Exit code 0 = all sampled cards match exactly.
"""

from __future__ import annotations

import difflib
import sys

import requests

from server.renderer import RenderRequest, RenderService, TemplateSpec

ANKICONNECT = "http://localhost:8765"


def ac(action: str, **params):
    r = requests.post(ANKICONNECT, json={"action": action, "version": 6, "params": params}, timeout=30)
    r.raise_for_status()
    body = r.json()
    if body.get("error"):
        raise RuntimeError(f"AnkiConnect {action}: {body['error']}")
    return body["result"]


def main(notes_per_model: int = 3) -> int:
    svc = RenderService()
    models = ac("modelNames")
    total = matched = 0
    failures: list[str] = []

    for model in models:
        templates = ac("modelTemplates", modelName=model)
        css = ac("modelStyling", modelName=model)["css"]
        note_ids = ac("findNotes", query=f'note:"{model}"')[:notes_per_model]
        if not note_ids:
            print(f"  (no notes) {model}")
            continue
        notes = ac("notesInfo", notes=note_ids)

        for note in notes:
            fields = {
                name: info["value"]
                for name, info in sorted(note["fields"].items(), key=lambda kv: kv[1]["order"])
            }
            card_infos = ac("cardsInfo", cards=note["cards"])
            if not card_infos:
                continue
            is_cloze = any("{{c" in v for v in fields.values()) and any(
                "cloze:" in t["Front"] for t in templates.values()
            )
            out = svc.render(RenderRequest(
                templates=[TemplateSpec(front=t["Front"], back=t["Back"], name=name)
                           for name, t in templates.items()],
                fields=fields,
                css=css,
                model_name=model,
                cloze=is_cloze,
                deck_name=card_infos[0]["deckName"],
                tags=note.get("tags", []),
            ))
            ours_by_ord = {c["ord"]: c for c in out["cards"]}

            for ci in card_infos:
                total += 1
                ours = ours_by_ord.get(ci["ord"])
                if ours is None:
                    failures.append(f"{model} note {note['noteId']} ord {ci['ord']}: not rendered by service")
                    continue
                ok = True
                for side, live_key in (("question", "question"), ("answer", "answer")):
                    # AnkiConnect's cardsInfo returns card.question()/answer(),
                    # which prepend the notetype CSS in a <style> block.
                    live = ci[live_key]
                    mine = f"<style>{out['css']}</style>{ours[side]}"
                    if live != mine:
                        ok = False
                        diff = "\n".join(difflib.unified_diff(
                            live.splitlines(), mine.splitlines(),
                            "live-anki", "service", lineterm="", n=1))[:1500]
                        failures.append(
                            f"{model} note {note['noteId']} ord {ci['ord']} {side} differs:\n{diff}")
                if ok:
                    matched += 1
        print(f"  checked {model}")

    svc.close()
    print(f"\n{matched}/{total} cards matched exactly")
    if failures:
        print(f"\n{len(failures)} mismatches:")
        for f in failures:
            print("-" * 60)
            print(f)
        return 1
    return 0


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    sys.exit(main(n))
