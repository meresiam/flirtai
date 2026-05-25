#!/usr/bin/env python3
"""
Scrape do blog do Robert Greene (powerseductionandwar.com/blog).
Salva cada artigo como markdown em corpus/greene/raw/blog/.
"""

import os
import sys
import time
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Instalando dependencias: requests beautifulsoup4")
    os.system(f"{sys.executable} -m pip install --break-system-packages requests beautifulsoup4 html2text")
    import requests
    from bs4 import BeautifulSoup

import html2text

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "corpus" / "greene" / "raw" / "blog"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = PROJECT_ROOT / "scripts" / "logs" / "scrape-greene-blog.log"
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

BASE = "https://powerseductionandwar.com"
BLOG_INDEX = f"{BASE}/category/blog/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
}

h2t = html2text.HTML2Text()
h2t.body_width = 0
h2t.ignore_images = True
h2t.ignore_links = False


def log(msg: str):
    print(msg)
    with open(LOG_FILE, "a") as f:
        f.write(msg + "\n")


def slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[-\s]+", "-", text).strip("-")
    return text[:80]


def discover_article_urls() -> list:
    """Itera paginas do blog index e coleta URLs de posts."""
    urls = set()
    page = 1
    while True:
        page_url = BLOG_INDEX if page == 1 else f"{BLOG_INDEX}page/{page}/"
        log(f"  -> page {page}: {page_url}")
        try:
            r = requests.get(page_url, headers=HEADERS, timeout=20)
        except Exception as e:
            log(f"     ERROR: {e}")
            break
        if r.status_code != 200:
            log(f"     status {r.status_code} -> stop")
            break

        soup = BeautifulSoup(r.text, "html.parser")
        # WordPress padrao: article tag ou h2.entry-title a
        new_found = 0
        for a in soup.select("h2.entry-title a, h1.entry-title a, article a[rel='bookmark']"):
            href = a.get("href")
            if href and "/blog/" in href or (href and BASE in href and "/category/" not in href and "/author/" not in href):
                if href not in urls and href.startswith(BASE):
                    urls.add(href)
                    new_found += 1

        # Fallback generico: qualquer link interno que pareca post
        for a in soup.select("a[href]"):
            href = a.get("href", "")
            if href.startswith(BASE) and href != BASE + "/" and "/page/" not in href and "/category/" not in href and "/author/" not in href and "/tag/" not in href:
                # Pattern: /yyyy/mm/slug/ ou /slug/
                if re.search(r"/\d{4}/\d{2}/", href) or (href.count("/") >= 4 and "blog" in href.lower()):
                    if href not in urls:
                        urls.add(href)
                        new_found += 1

        log(f"     +{new_found} URLs (total: {len(urls)})")
        if new_found == 0:
            break
        page += 1
        if page > 30:
            break
        time.sleep(1)

    return sorted(urls)


def slug_from_url(url: str) -> str:
    """Extrai slug do path da URL (mais confiavel que titulo)."""
    parsed = urlparse(url)
    parts = [p for p in parsed.path.split("/") if p]
    # Filtra fragmentos comuns (#comments, #more-500, etc) e datas
    parts = [p for p in parts if not re.match(r"^\d+$", p) and not p.startswith("#")]
    if parts:
        return parts[-1][:80]
    return "post-" + str(abs(hash(url)) % 100000)


def scrape_article(url: str):
    # Skip anchors duplicados (mesmo post, mesmo conteudo)
    if "#" in url:
        url_clean = url.split("#")[0]
        if url_clean != url:
            log(f"  ~ skip anchor variant: {url}")
            return

    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        if r.status_code != 200:
            log(f"  ! {url} -> {r.status_code}")
            return
    except Exception as e:
        log(f"  ! {url} -> {e}")
        return

    soup = BeautifulSoup(r.text, "html.parser")

    # Titulo: tenta varias fontes em ordem
    title = None
    for sel in ["h1.entry-title", "h1.post-title", "article h1", "h1",
                "meta[property='og:title']", "meta[name='twitter:title']",
                "title"]:
        el = soup.select_one(sel)
        if not el:
            continue
        if el.name == "meta":
            val = el.get("content", "").strip()
        else:
            val = el.get_text(strip=True)
        if val and val.lower() not in ("home", "robert greene", ""):
            # Limpa sufixos do site
            val = re.sub(r"\s*[-|]\s*Robert Greene.*$", "", val).strip()
            if val:
                title = val
                break

    if not title:
        title = slug_from_url(url).replace("-", " ").title()

    # Conteudo
    body_el = (soup.select_one("div.entry-content") or
               soup.select_one("article .content") or
               soup.select_one("article") or
               soup.select_one("main") or
               soup.select_one("div.post-content"))

    if not body_el:
        log(f"  ! {url} -> no body found")
        return

    # Remove sidebar/comments/related/nav
    for sel in ["aside", "footer", "nav", ".comments", "#comments",
                ".related", ".sidebar", "script", "style",
                ".share", ".social", "form"]:
        for el in body_el.select(sel):
            el.decompose()

    markdown = h2t.handle(str(body_el))
    word_count = len(markdown.split())

    if word_count < 100:
        log(f"  ~ skip (too short, {word_count} words): {url}")
        return

    # Usa slug do URL (unico, estavel)
    slug = slug_from_url(url)
    filename = f"{slug}.md"
    out_path = OUTPUT_DIR / filename

    with open(out_path, "w") as f:
        f.write(f"---\nsource_url: {url}\ntitle: {title}\nword_count: {word_count}\n---\n\n")
        f.write(f"# {title}\n\n")
        f.write(markdown)

    log(f"  ✓ [{slug}] {title[:60]} ({word_count} words)")


def main():
    log(f"=== Scrape Greene blog :: starting ===")
    urls = discover_article_urls()
    log(f"\nDiscovered {len(urls)} URLs")
    log("")

    for i, url in enumerate(urls, 1):
        log(f"[{i}/{len(urls)}] {url}")
        scrape_article(url)
        time.sleep(0.8)

    log("")
    log(f"=== Done :: {len(list(OUTPUT_DIR.glob('*.md')))} articles saved ===")


if __name__ == "__main__":
    main()
