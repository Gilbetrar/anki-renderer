import pytest

from server.renderer import RenderRequest, RenderService, TemplateSpec


@pytest.fixture(scope="module")
def svc(tmp_path_factory):
    s = RenderService(data_dir=str(tmp_path_factory.mktemp("col")))
    yield s
    s.close()


def render(svc, **kw):
    defaults = dict(
        templates=[TemplateSpec(front="{{Front}}", back="{{FrontSide}}<hr id=answer>{{Back}}")],
        fields={"Front": "Q", "Back": "A"},
    )
    defaults.update(kw)
    return svc.render(RenderRequest(**defaults))


def test_basic_card(svc):
    out = render(svc)
    assert out["cards"][0]["question"] == "Q"
    assert out["cards"][0]["answer"] == "Q<hr id=answer>A"


def test_issue20_field_names_with_punctuation(svc):
    name = "Source (book, article, etc.)"
    tpl = TemplateSpec(
        front="{{#%s}}<p>{{%s}}</p>{{/%s}}x" % (name, name, name),
        back="{{FrontSide}}",
    )
    out = render(svc, templates=[tpl], fields={name: "Bk"})
    assert out["cards"][0]["question"] == "<p>Bk</p>x"

    # With the field empty the conditional drops out. Only field replacements
    # count toward a non-blank front, so Anki appends its blank-front notice
    # after the literal "x" — but still generates card 1 (a note always gets
    # at least one card).
    out = render(svc, templates=[tpl], fields={name: "", "Other": "y"})
    q = out["cards"][0]["question"]
    assert q.startswith("x") and "blank" in q
    assert out["cards"][0]["empty"] is False


def test_card_anki_would_not_generate_is_flagged_empty(svc):
    # Card 1 always exists, so use a second template with a blank front:
    # Anki does not generate that card, but we still preview it.
    out = render(
        svc,
        templates=[
            TemplateSpec(front="{{A}}", back="x", name="T1"),
            TemplateSpec(front="{{#B}}{{B}}{{/B}}", back="y", name="T2"),
        ],
        fields={"A": "a", "B": ""},
    )
    assert out["cards"][0]["empty"] is False
    assert out["cards"][1]["empty"] is True
    assert "blank" in out["cards"][1]["question"]


def test_cloze_generates_card_per_ordinal(svc):
    out = render(
        svc,
        templates=[TemplateSpec(front="{{cloze:Text}}", back="{{cloze:Text}}")],
        fields={"Text": "{{c1::alpha}} then {{c2::beta::hint}}"},
        cloze=True,
    )
    assert [c["ord"] for c in out["cards"]] == [0, 1]
    q1, q2 = out["cards"][0]["question"], out["cards"][1]["question"]
    # Modern Anki hides the answer in the visible text but carries it in the
    # data-cloze attribute (used by its show-answer interactivity).
    assert '>[...]</span>' in q1 and 'data-cloze="alpha"' in q1
    assert ">[hint]</span>" in q2 and 'data-cloze="beta"' in q2
    assert ">alpha</span>" in out["cards"][0]["answer"]


def test_cloze_field_name_with_ampersand(svc):
    out = render(
        svc,
        templates=[TemplateSpec(
            front="{{cloze:Cloze Question & Answer}}",
            back="{{cloze:Cloze Question & Answer}}",
        )],
        fields={"Cloze Question & Answer": "x {{c1::y}}"},
        cloze=True,
    )
    assert "cloze" in out["cards"][0]["question"]
    assert "y" in out["cards"][0]["answer"]


def test_multiple_templates_render_all_cards(svc):
    out = render(
        svc,
        templates=[
            TemplateSpec(front="{{Front}}", back="{{Back}}", name="Forward"),
            TemplateSpec(front="{{Back}}", back="{{Front}}", name="Reverse"),
        ],
    )
    assert [c["name"] for c in out["cards"]] == ["Forward", "Reverse"]
    assert out["cards"][1]["question"] == "A"


def test_special_fields(svc):
    out = render(
        svc,
        templates=[TemplateSpec(front="{{Deck}}|{{Subdeck}}|{{Card}}|{{Tags}}|{{Type}}|{{Front}}", back="x")],
        deck_name="Parent::Child",
        tags=["t1", "t2"],
        model_name="MyModel",
    )
    q = out["cards"][0]["question"]
    assert q == "Parent::Child|Child|Card 1|t1 t2|MyModel|Q"


def test_sound_tags_extracted(svc):
    out = render(
        svc,
        templates=[TemplateSpec(front="{{Front}}", back="x")],
        fields={"Front": "hello [sound:beep.mp3]"},
    )
    card = out["cards"][0]
    assert card["questionAvTags"] == [{"kind": "sound", "filename": "beep.mp3"}]
    assert "[anki:play:q:0]" in card["question"]


def test_css_passthrough(svc):
    out = render(svc, css=".card { color: red; }")
    assert out["css"] == ".card { color: red; }"


def test_default_css_when_unspecified(svc):
    out = render(svc)
    assert ".card" in out["css"]


def test_unknown_field_in_template_raises(svc):
    # Anki raises CardTypeError for a template referencing a missing field;
    # the API layer turns this into a 4xx.
    from anki.errors import CardTypeError
    with pytest.raises(CardTypeError):
        render(svc, templates=[TemplateSpec(front="{{Nope}}", back="x")])


def test_bad_request_rejected(svc):
    with pytest.raises(ValueError):
        svc.render(RenderRequest(templates=[], fields={"a": "b"}))


def test_collection_survives_failed_render(svc):
    with pytest.raises(ValueError):
        svc.render(RenderRequest(templates=[], fields={"a": "b"}))
    assert render(svc)["cards"][0]["question"] == "Q"
