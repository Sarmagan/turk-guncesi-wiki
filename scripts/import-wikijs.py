#!/usr/bin/env python3
"""
One-shot importer: pulls every published page from the Wiki.js instance
at wiki.turkguncesi.com and writes them as Markdown files, preserving the
full hierarchy, into src/content/wiki/.

Wiki.js is a hierarchical wiki. A path like
    turk-tarihi/osmanli/ikinci-mehmed
becomes
    src/content/wiki/turk-tarihi/osmanli/ikinci-mehmed.md
and is served by Astro at
    /turk-tarihi/osmanli/ikinci-mehmed/

Usage:  python3 scripts/import-wikijs.py
"""

from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup
from markdownify import MarkdownConverter

WIKI_BASE = "https://wiki.turkguncesi.com"
ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "src" / "content" / "wiki"

# Top-level segment rewrites applied to every Wiki.js path.
# - Wiki.js spells "türk" with ü in `türk-folkloru`; we normalise to ASCII.
# - Wiki.js uses the older "musigi" spelling; our canonical category slug
#   is "muzigi".
# Only the FIRST segment of each path is rewritten so that nested pages keep
# whatever folder names Wiki.js used beneath the top level.
TOP_CATEGORY_REWRITE = {
    "türk-folkloru": "turk-folkloru",
    "turk-musigi": "turk-muzigi",
}

VALID_CATEGORIES = {
    "turk-edebiyati",
    "turk-folkloru",
    "turk-milliyetciligi",
    "turk-muzigi",
    "turk-tarihi",
    "turk-dili",
    "turk-mimarisi",
    "turk-mutfagi",
    "turk-sanati",
}


# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------


def fetch_json(url: str, body: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_html(path: str) -> str:
    # Wiki.js paths can contain Turkish diacritics; they must be percent
    # encoded in the URL while preserving "/" as the separator.
    encoded = urllib.parse.quote(path, safe="/")
    url = f"{WIKI_BASE}/tr/{encoded}"
    req = urllib.request.Request(
        url, headers={"User-Agent": "TG-Wiki-Importer/1.0"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def list_pages() -> list[dict]:
    query = (
        "query { pages { list { id path locale title description tags "
        "updatedAt createdAt isPublished } } }"
    )
    data = fetch_json(f"{WIKI_BASE}/graphql", {"query": query})
    return data["data"]["pages"]["list"]


# ---------------------------------------------------------------------------
# HTML → Markdown
# ---------------------------------------------------------------------------


def _rewrite_internal_link(href: str, current_path: str) -> str:
    """
    Rewrite a Wiki.js internal link like "/tr/turk-tarihi/osmanli" to our
    URL space ("/turk-tarihi/osmanli/"), applying the same top-level
    category rewrites used for the folder layout.
    """
    if href.startswith("/tr/"):
        rel = href[len("/tr/"):]
        parts = rel.split("/", 1)
        if parts:
            parts[0] = TOP_CATEGORY_REWRITE.get(parts[0], parts[0])
        rel = "/".join(parts)
        return f"/{rel}/" if rel else "/dizin/"
    return href


class TGConverter(MarkdownConverter):
    """Markdownify subclass tuned for Wiki.js content."""

    def convert_br(self, el, text, parent_tags):
        # Wiki.js uses <br> inside <p> for poem line breaks. The default
        # Markdownify behaviour emits a soft newline, which CommonMark
        # collapses to a single space — destroying poem layouts. Emit a
        # hard break (two trailing spaces + newline) instead.
        return "  \n"

    def convert_img(self, el, text, parent_tags):
        src = el.get("src", "")
        alt = el.get("alt", "") or ""
        # Rewrite local Wiki.js uploads to our /images/ convention.
        if src.startswith("/") and not src.startswith("//"):
            filename = src.rsplit("/", 1)[-1]
            src = f"/images/{filename}"
        return f"![{alt}]({src})"

    def convert_a(self, el, text, parent_tags):
        href = el.get("href", "") or ""
        href = _rewrite_internal_link(href, "")
        if not text.strip():
            return href
        return f"[{text}]({href})"


def strip_pilcrow_anchors(md: str) -> str:
    """
    Wiki.js renders heading anchors as `<a href="#slug">¶</a>` immediately
    before the heading text. After markdownify those become
    `# [¶](#slug) Some heading`. Astro adds its own heading IDs, so strip
    them and leave bare headings.
    """
    heading = re.compile(r"^(#{1,6})\s*(?:\[¶\]\([^)]*\)\s*)+", re.MULTILINE)
    md = heading.sub(r"\1 ", md)
    md = re.sub(r"\[¶\]\([^)]*\)", "", md)
    md = md.replace("¶", "")
    return md


def demote_leading_title(md: str, title: str) -> str:
    """
    If the first non-empty block is an H1 (typically a duplicate of the
    page title), remove it — the Astro article layout already renders the
    title from frontmatter.
    """
    lines = md.splitlines()
    for i, ln in enumerate(lines):
        if not ln.strip():
            continue
        if ln.startswith("# "):
            candidate = re.sub(r"\s+", " ", ln[2:]).strip().lower()
            target = re.sub(r"\s+", " ", title).strip().lower()
            if (
                candidate == target
                or target.startswith(candidate)
                or candidate.startswith(target)
            ):
                del lines[i]
                if i < len(lines) and not lines[i].strip():
                    del lines[i]
                return "\n".join(lines)
        break
    return md


def html_to_markdown(html: str, title: str) -> str:
    conv = TGConverter(
        heading_style="ATX",
        bullets="-",
        strong_em_symbol="*",
        code_language="",
        escape_asterisks=False,
        escape_underscores=False,
    )
    md = conv.convert(html)
    md = strip_pilcrow_anchors(md)
    md = demote_leading_title(md, title)

    # Preserve trailing "  " (two spaces) — that's the Markdown hard-break
    # marker we emit for <br>; everything else gets stripped.
    def _trim(ln: str) -> str:
        if ln.endswith("  "):
            return ln.rstrip() + "  "
        return ln.rstrip()

    lines = [_trim(ln) for ln in md.splitlines()]
    out: list[str] = []
    blank = 0
    for ln in lines:
        if not ln.strip():
            blank += 1
            if blank <= 1:
                out.append("")
            continue
        blank = 0
        out.append(ln)
    return "\n".join(out).strip() + "\n"


def extract_meta_and_content(html: str) -> tuple[dict, str]:
    """
    Pull page metadata and the HTML body of the rendered article from a
    Wiki.js page HTML dump.
    """
    soup = BeautifulSoup(html, "html.parser")
    page_el = soup.find("page")
    meta: dict[str, str] = {}
    if page_el is not None:
        for attr in (
            "title",
            "description",
            "author-name",
            "created-at",
            "updated-at",
            "path",
            "locale",
        ):
            val = page_el.get(attr)
            if val:
                meta[attr] = val

    content_html = ""
    tpl = soup.find("template", attrs={"slot": "contents"})
    if tpl is not None:
        inner = tpl.decode_contents()
        inner_soup = BeautifulSoup(inner, "html.parser")
        # Strip Wiki.js-specific `is-*` utility classes.
        for tag in inner_soup.find_all(True):
            if tag.has_attr("class"):
                cls = [c for c in tag["class"] if not c.startswith("is-")]
                if cls:
                    tag["class"] = cls
                else:
                    del tag["class"]
        content_html = str(inner_soup)

    return meta, content_html


# ---------------------------------------------------------------------------
# Path rewriting (Wiki.js → disk)
# ---------------------------------------------------------------------------


def rewrite_path(wiki_path: str) -> str:
    """
    Map a Wiki.js page path to our on-disk / URL path.

    - Rewrites the TOP-level segment using TOP_CATEGORY_REWRITE so that
      `türk-folkloru/...` becomes `turk-folkloru/...` and
      `turk-musigi/...` becomes `turk-muzigi/...`.
    - Leaves all nested segments alone.
    """
    parts = wiki_path.split("/")
    if parts:
        parts[0] = TOP_CATEGORY_REWRITE.get(parts[0], parts[0])
    return "/".join(parts)


# ---------------------------------------------------------------------------
# Frontmatter writer
# ---------------------------------------------------------------------------


def yaml_escape(s: str) -> str:
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{s}"'


def write_article(
    relative_path: str,
    title: str,
    description: str,
    date: str,
    author: str,
    body: str,
    source_path: str,
) -> Path:
    """
    Write a Markdown file at CONTENT_DIR/<relative_path>.md, creating any
    intermediate directories needed.
    """
    parts = relative_path.split("/")
    category = parts[0]
    if category not in VALID_CATEGORIES:
        raise ValueError(
            f"Top-level segment '{category}' is not a configured category."
        )
    fpath = CONTENT_DIR.joinpath(*parts).with_suffix(".md")
    fpath.parent.mkdir(parents=True, exist_ok=True)

    if not description.strip():
        plain = body
        plain = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", plain)
        plain = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", plain)
        plain = re.sub(r"[#*_`>\n]+", " ", plain)
        plain = re.sub(r"\s+", " ", plain).strip()
        if len(plain) > 160:
            description = plain[:160].rsplit(" ", 1)[0] + "…"
        else:
            description = plain
        if not description:
            description = title

    fm_lines = [
        "---",
        f"title: {yaml_escape(title)}",
        f'category: "{category}"',
        f"description: {yaml_escape(description)}",
        f'date: {date[:10] if date else "2025-03-12"}',
    ]
    if author:
        fm_lines.append(f"author: {yaml_escape(author)}")
    fm_lines.append("tags: []")
    fm_lines.append("related: []")
    fm_lines.append(f"# source: {source_path}")
    fm_lines.append("---")
    fm_lines.append("")

    fpath.write_text("\n".join(fm_lines) + body, encoding="utf-8")
    return fpath


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def wipe_existing_markdown():
    """Remove every existing .md file so re-runs produce a clean import."""
    for md in CONTENT_DIR.rglob("*.md"):
        md.unlink()


def main() -> int:
    print("Listing pages from Wiki.js …")
    pages = list_pages()
    published = [
        p
        for p in pages
        if p.get("isPublished") and p.get("locale") == "tr" and p["path"] != "home"
    ]
    print(f"  found {len(pages)} pages ({len(published)} importable)")

    wipe_existing_markdown()

    ok = 0
    errs = 0
    for page in published:
        wiki_path = page["path"]
        rel_path = rewrite_path(wiki_path)
        parts = rel_path.split("/")
        if parts[0] not in VALID_CATEGORIES:
            print(f"  [skip] unknown category: {wiki_path}")
            continue

        print(f"  /{rel_path}/  <- {wiki_path}")

        try:
            html = fetch_html(wiki_path)
            meta, body_html = extract_meta_and_content(html)
        except Exception as e:
            print(f"    ! fetch failed: {e}")
            errs += 1
            continue

        title = meta.get("title") or page["title"]
        body_md = html_to_markdown(body_html, title)

        if not body_md.strip():
            body_md = (
                "*Bu maddenin ayrıntılı içeriği henüz yazılmamıştır. Kısa "
                "süre içinde eklenecektir.*\n"
            )

        author = meta.get("author-name") or ""
        if author.strip().lower() == "administrator":
            author = "Türk Güncesi"

        try:
            write_article(
                relative_path=rel_path,
                title=title,
                description=meta.get("description")
                or page.get("description")
                or "",
                date=meta.get("updated-at") or page.get("updatedAt") or "",
                author=author,
                body=body_md,
                source_path=wiki_path,
            )
        except Exception as e:
            print(f"    ! write failed: {e}")
            errs += 1
            continue

        ok += 1

    print(f"\nDone. {ok} articles imported, {errs} errors.")
    return 0 if errs == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
