from fastapi.testclient import TestClient

from server.app import app

client = TestClient(app)


def test_healthz():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_render_endpoint():
    r = client.post("/render", json={
        "templates": [{"front": "{{Front}}", "back": "{{FrontSide}}<hr>{{Back}}"}],
        "fields": {"Front": "2+2?", "Back": "4"},
    })
    assert r.status_code == 200
    body = r.json()
    assert body["cards"][0]["question"] == "2+2?"
    assert body["cards"][0]["answer"] == "2+2?<hr>4"
    assert body["ankiVersion"]


def test_render_cloze_endpoint():
    r = client.post("/render", json={
        "templates": [{"front": "{{cloze:Text}}", "back": "{{cloze:Text}}"}],
        "fields": {"Text": "{{c1::a}} {{c2::b}}"},
        "cloze": True,
    })
    assert r.status_code == 200
    assert len(r.json()["cards"]) == 2


def test_validation_error():
    r = client.post("/render", json={"templates": [], "fields": {}})
    assert r.status_code == 422


def test_cors_header():
    r = client.post("/render", headers={"Origin": "https://example.com"}, json={
        "templates": [{"front": "{{F}}", "back": "x"}],
        "fields": {"F": "y"},
    })
    assert r.headers.get("access-control-allow-origin") == "*"
