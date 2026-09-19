"""10-K filings are HTML with inline XBRL. We need readable prose out."""

from engine.ingest.htmltext import html_to_text


def test_drops_tags_and_keeps_prose():
    html = "<html><body><p>We operate <b>data centers</b>.</p></body></html>"

    assert html_to_text(html) == "We operate data centers."


def test_drops_script_and_style_content():
    html = "<body><style>p{color:red}</style><script>var x=1</script><p>Real text.</p></body>"

    out = html_to_text(html)

    assert "Real text." in out
    assert "color" not in out and "var x" not in out


def test_adjacent_block_elements_do_not_run_words_together():
    html = "<td>Item 1A.</td><td>Risk Factors</td>"

    assert "Item 1A. Risk Factors" in html_to_text(html)


def test_resolves_html_entities():
    assert html_to_text("<p>AT&amp;T&nbsp;grew</p>") == "AT&T grew"
