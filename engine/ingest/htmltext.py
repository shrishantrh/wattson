"""Readable prose out of a 10-K's HTML (inline XBRL and all).

Inline tags must not introduce whitespace or "data <b>centers</b>" becomes
"data  centers"; block and table-cell boundaries must, or "Item 1A.</td><td>Risk
Factors" becomes "Item 1A.Risk Factors" and the section regex misses it.
"""

import re
from html.parser import HTMLParser

DROP = {"script", "style", "head"}
SPACE_TAGS = {"td", "th"}
BREAK_TAGS = {"p", "div", "br", "li", "tr", "table", "section", "ul", "ol",
              "h1", "h2", "h3", "h4", "h5", "h6"}


class _Extract(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in DROP:
            self._skip += 1
        elif tag in SPACE_TAGS:
            self.parts.append(" ")
        elif tag in BREAK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in DROP:
            self._skip = max(0, self._skip - 1)
        elif tag in SPACE_TAGS:
            self.parts.append(" ")
        elif tag in BREAK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def html_to_text(html):
    p = _Extract()
    p.feed(html)
    text = "".join(p.parts).replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
