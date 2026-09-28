"""
Convert DEVELOPER_GUIDE.md and USER_MANUAL.md into styled PDFs.

Pipeline:
  1. Parse Markdown with `python-markdown` (fenced_code, tables, toc).
  2. Wrap the HTML in an A4-print template that includes:
       * UPL orange brand accent (matches the app)
       * Inter / system-ui typography
       * Mermaid.js from CDN so the ```mermaid diagrams render live
       * Pygments syntax-highlighting CSS for code blocks
       * Print stylesheet: page numbers, margins, header/footer
  3. Save the HTML.
  4. Drive Chrome (headless) via --print-to-pdf to produce the PDF,
     giving Mermaid ~2 s to render before snapshotting.

Run:
    python build_pdfs.py
"""

from __future__ import annotations

import html as html_lib
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import markdown

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

HERE = Path(__file__).parent
DOCS = [
    ('DEVELOPER_GUIDE.md', 'SafetyVerse_Developer_Guide',
     'Developer Guide', 'SafetyVerse · by UPL'),
    ('DEVELOPER_GUIDE_SIMPLE.md', 'SafetyVerse_Developer_Guide_Simple',
     'The Really Simple Guide', 'SafetyVerse · by UPL'),
    ('TECH_STACK_AND_FILES.md', 'SafetyVerse_Tech_Stack_and_Files',
     'Tech Stack & Complete File Guide', 'SafetyVerse · by UPL'),
    ('USER_MANUAL.md', 'SafetyVerse_User_Manual',
     'User Manual', 'SafetyVerse · by UPL'),
]

CHROME_PATHS = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
]

# ---------------------------------------------------------------------------
# Template — self-contained HTML with Mermaid + brand styling
# ---------------------------------------------------------------------------

TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js"></script>
<style>
  :root {{
    --orange: #F37021;
    --orange-dark: #DB5B0E;
    --orange-tint: #FFF5EE;
    --slate-900: #0F172A;
    --slate-800: #1E293B;
    --slate-700: #334155;
    --slate-600: #475569;
    --slate-500: #64748B;
    --slate-400: #94A3B8;
    --slate-300: #CBD5E1;
    --slate-200: #E2E8F0;
    --slate-100: #F1F5F9;
    --slate-50:  #F8FAFC;
  }}

  @page {{
    size: A4;
    margin: 18mm 16mm 22mm 16mm;
    @bottom-left  {{ content: "SafetyVerse · by UPL"; font-size: 9pt; color: #64748B; }}
    @bottom-right {{ content: "Page " counter(page) " / " counter(pages); font-size: 9pt; color: #64748B; }}
  }}

  html, body {{
    margin: 0;
    padding: 0;
  }}
  body {{
    font-family: -apple-system, "Segoe UI", Roboto, Inter, system-ui, sans-serif;
    color: var(--slate-800);
    font-size: 10.5pt;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }}

  /* Cover block at the very top */
  .cover {{
    padding: 40mm 0 16mm 0;
    border-bottom: 3px solid var(--orange);
    margin-bottom: 12mm;
    page-break-after: always;
  }}
  .cover .eyebrow {{
    color: var(--orange);
    font-weight: 700;
    font-size: 11pt;
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }}
  .cover h1 {{
    font-size: 44pt;
    margin: 8mm 0 2mm 0;
    color: var(--slate-900);
    font-weight: 700;
    letter-spacing: -0.02em;
  }}
  .cover .sub {{
    font-size: 16pt;
    color: var(--slate-500);
    margin: 0 0 20mm 0;
  }}
  .cover .meta {{
    font-size: 10pt;
    color: var(--slate-500);
    border-top: 1px solid var(--slate-200);
    padding-top: 6mm;
    margin-top: 10mm;
  }}
  .cover .meta strong {{ color: var(--slate-800); }}

  /* Headings */
  h1, h2, h3, h4 {{
    color: var(--slate-900);
    font-weight: 700;
    line-height: 1.25;
    margin-top: 1.6em;
    margin-bottom: 0.4em;
    page-break-after: avoid;
  }}
  h1 {{ font-size: 22pt; border-bottom: 2px solid var(--orange); padding-bottom: 2mm; }}
  h2 {{ font-size: 16pt; color: var(--slate-900); margin-top: 1.4em; }}
  h2:before {{
    content: "";
    display: inline-block;
    width: 3px; height: 0.9em;
    background: var(--orange);
    margin-right: 6px;
    vertical-align: -0.05em;
  }}
  h3 {{ font-size: 12.5pt; color: var(--slate-800); }}
  h4 {{ font-size: 11pt; color: var(--slate-700); }}

  p {{ margin: 0.5em 0 0.9em 0; }}
  strong {{ color: var(--slate-900); }}

  /* Links */
  a {{
    color: var(--orange-dark);
    text-decoration: none;
    border-bottom: 1px dotted var(--orange);
  }}

  /* Lists */
  ul, ol {{ padding-left: 1.4em; margin: 0.4em 0 1em 0; }}
  li {{ margin: 0.15em 0; }}
  ul li::marker {{ color: var(--orange); }}
  ol li::marker {{ color: var(--orange-dark); font-weight: 600; }}

  /* Code */
  code {{
    background: var(--slate-100);
    color: var(--orange-dark);
    padding: 0.1em 0.35em;
    border-radius: 3px;
    font-family: "Cascadia Code", Consolas, "Courier New", monospace;
    font-size: 9.5pt;
  }}
  pre {{
    background: var(--slate-900);
    color: #E5E7EB;
    padding: 12px 14px;
    border-radius: 6px;
    border-left: 3px solid var(--orange);
    overflow-x: auto;
    font-family: "Cascadia Code", Consolas, "Courier New", monospace;
    font-size: 9pt;
    line-height: 1.5;
    page-break-inside: avoid;
  }}
  pre code {{
    background: none;
    color: inherit;
    padding: 0;
  }}

  /* Tables */
  table {{
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0 1.4em 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }}
  thead {{ background: var(--orange); color: white; }}
  th {{
    text-align: left;
    padding: 8px 10px;
    font-weight: 600;
    font-size: 9.5pt;
    letter-spacing: 0.02em;
  }}
  td {{
    padding: 7px 10px;
    border-bottom: 1px solid var(--slate-200);
    vertical-align: top;
  }}
  tbody tr:nth-child(even) {{ background: var(--slate-50); }}

  /* Blockquotes = callouts */
  blockquote {{
    background: var(--orange-tint);
    border-left: 3px solid var(--orange);
    margin: 1em 0;
    padding: 8px 14px;
    border-radius: 0 4px 4px 0;
    color: var(--slate-800);
  }}
  blockquote p {{ margin: 0.3em 0; }}

  hr {{
    border: 0;
    border-top: 1px solid var(--slate-200);
    margin: 2em 0;
  }}

  /* Mermaid: keep the SVG on one page and centered */
  .mermaid {{
    text-align: center;
    background: var(--slate-50);
    padding: 12px 8px;
    border-radius: 6px;
    margin: 1em 0 1.4em 0;
    page-break-inside: avoid;
  }}

  /* Task list checkboxes */
  ul.task-list {{ list-style: none; padding-left: 1em; }}
  input[type="checkbox"] {{
    margin-right: 6px;
  }}
</style>
</head>
<body>

<div class="cover">
  <div class="eyebrow">SAFETYVERSE · BY UPL</div>
  <h1>{doc_title}</h1>
  <p class="sub">{brand}</p>
  <div class="meta">
    <strong>Version:</strong> 2026-09  ·  <strong>Audience:</strong> {audience}<br>
    <strong>Live app:</strong> https://upl-fire-portal.onrender.com<br>
    <strong>Repository:</strong> https://github.com/paramshah1903/fire-portal
  </div>
</div>

{body}

<script>
  mermaid.initialize({{
    startOnLoad: true,
    theme: 'base',
    themeVariables: {{
      primaryColor: '#FFF5EE',
      primaryTextColor: '#0F172A',
      primaryBorderColor: '#F37021',
      lineColor: '#F37021',
      secondaryColor: '#F1F5F9',
      tertiaryColor: '#FFFFFF',
      fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif'
    }}
  }});
  // Tell the print driver "we're ready" once diagrams have rendered.
  // Chrome's --print-to-pdf waits for onload; mermaid runs after that.
  // We give it a beat then set a flag Puppeteer/CDP could poll — but
  // since we're using CLI, we rely on --virtual-time-budget instead.
</script>

</body>
</html>
"""

# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


def find_chrome() -> str:
    for p in CHROME_PATHS:
        if Path(p).exists():
            return p
    raise SystemExit(
        'Chrome / Edge not found. Install Chrome or edit CHROME_PATHS.')


def rewrite_mermaid_blocks(md_text: str) -> str:
    """Turn ```mermaid ... ``` blocks into <div class="mermaid">...</div>
    BEFORE handing to the markdown parser, so the parser doesn't
    HTML-escape our raw Mermaid definition."""
    pattern = re.compile(r'```mermaid\s*\n(.*?)```', re.DOTALL)

    def _replace(match: re.Match) -> str:
        block = match.group(1)
        # Keep the raw text; mermaid.js will parse it. Do NOT escape —
        # mermaid needs `->`, `{{}}`, and other syntax intact.
        return f'\n<div class="mermaid">\n{block}\n</div>\n'

    return pattern.sub(_replace, md_text)


def md_to_html(md_text: str) -> str:
    """Convert markdown to HTML body. Mermaid blocks are pre-swapped."""
    md_text = rewrite_mermaid_blocks(md_text)
    return markdown.markdown(
        md_text,
        extensions=[
            'fenced_code',
            'tables',
            'toc',
            'attr_list',
            'sane_lists',
        ],
    )


def build_html(md_path: Path, doc_title: str, brand: str,
               audience: str) -> str:
    md_text = md_path.read_text(encoding='utf-8')
    body = md_to_html(md_text)
    return TEMPLATE.format(
        title=html_lib.escape(doc_title),
        doc_title=html_lib.escape(doc_title),
        brand=html_lib.escape(brand),
        audience=html_lib.escape(audience),
        body=body,
    )


def html_to_pdf(chrome: str, html_path: Path, pdf_path: Path) -> None:
    """Drive headless Chrome to print HTML → PDF.
    Uses `--virtual-time-budget` so Mermaid.js has time to render
    before the snapshot is taken.
    """
    args = [
        chrome,
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--virtual-time-budget=8000',   # 8s for JS + Mermaid to finish
        '--run-all-compositor-stages-before-draw',
        '--print-to-pdf-no-header',
        f'--print-to-pdf={pdf_path}',
        html_path.absolute().as_uri(),
    ]
    print(f'  running Chrome headless...')
    result = subprocess.run(args, capture_output=True, text=True, timeout=180)
    if result.returncode != 0:
        print('stdout:', result.stdout[-500:])
        print('stderr:', result.stderr[-500:])
        raise SystemExit(f'Chrome exited with {result.returncode}')


def main() -> None:
    chrome = find_chrome()
    print(f'using: {chrome}')

    out_dir = HERE / 'pdf'
    out_dir.mkdir(exist_ok=True)

    for src, stem, doc_title, brand in DOCS:
        md_path = HERE / src
        if not md_path.exists():
            print(f'SKIP {src} — not found')
            continue

        print(f'\n[{src}]')
        audience = 'Developers & Ops' if 'DEVELOPER' in src else 'All end users'
        html_str = build_html(md_path, doc_title, brand, audience)

        html_path = out_dir / f'{stem}.html'
        pdf_path = out_dir / f'{stem}.pdf'

        html_path.write_text(html_str, encoding='utf-8')
        print(f'  wrote {html_path}  ({len(html_str)//1024} KB HTML)')
        html_to_pdf(chrome, html_path, pdf_path)
        size_kb = pdf_path.stat().st_size // 1024
        print(f'  wrote {pdf_path}  ({size_kb} KB)')


if __name__ == '__main__':
    main()
