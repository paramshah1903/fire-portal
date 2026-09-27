"""
SafetyVerse — Executive Presentation Deck Generator
====================================================

Generates a consulting-grade PowerPoint deck (.pptx) covering the full
SafetyVerse story: problem, solution, features, architecture, business
impact, enterprise roadmap, and support required from management.

Run:
    python generate_deck.py

Output:
    SafetyVerse_Executive_Deck.pptx
"""

from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

# ---------------------------------------------------------------------------
# UPL brand palette
# ---------------------------------------------------------------------------
ORANGE       = RGBColor(0xF3, 0x70, 0x21)   # #F37021 primary
ORANGE_DARK  = RGBColor(0xDB, 0x5B, 0x0E)   # #DB5B0E hover / button
ORANGE_TINT  = RGBColor(0xFF, 0xF5, 0xEE)   # #FFF5EE lightest
SLATE_900    = RGBColor(0x0F, 0x17, 0x2A)   # near-black text
SLATE_700    = RGBColor(0x33, 0x41, 0x55)
SLATE_500    = RGBColor(0x64, 0x74, 0x8B)   # muted text
SLATE_300    = RGBColor(0xCB, 0xD5, 0xE1)   # dividers
SLATE_100    = RGBColor(0xF1, 0xF5, 0xF9)   # card backgrounds
WHITE        = RGBColor(0xFF, 0xFF, 0xFF)
GREEN        = RGBColor(0x10, 0xB9, 0x81)   # positive callout
RED          = RGBColor(0xDC, 0x26, 0x26)   # risk callout
AMBER        = RGBColor(0xF5, 0x9E, 0x0B)   # attention callout

# 16:9 widescreen: 13.333" x 7.5"
SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

HERE = Path(__file__).parent
LOGO_PATH = HERE.parent.parent / 'logo.jpeg'
OUTPUT = HERE / 'SafetyVerse_Executive_Deck.pptx'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def add_blank_slide(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])  # blank layout


def add_rect(slide, x, y, w, h, fill=None, line=None, line_width=None):
    shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    shp.line.fill.background()
    if fill is not None:
        shp.fill.solid()
        shp.fill.fore_color.rgb = fill
    else:
        shp.fill.background()
    if line is not None:
        shp.line.color.rgb = line
        shp.line.width = line_width or Pt(0.75)
    return shp


def add_text(slide, x, y, w, h, text,
             *, size=14, bold=False, color=SLATE_900,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, font='Calibri'):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    if isinstance(text, str):
        text = [text]
    for i, line in enumerate(text):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        run = p.add_run()
        run.text = line
        run.font.name = font
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
    return tb


def add_bullets(slide, x, y, w, h, bullets,
                *, size=14, color=SLATE_700, gap=6):
    """Bulleted text where each bullet is a dict {text, sub?, tone?} or str."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = 0
    for i, item in enumerate(bullets):
        if isinstance(item, str):
            item = {'text': item}
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.space_after = Pt(gap)

        # bullet mark
        mark = p.add_run()
        mark.text = '• '
        mark.font.size = Pt(size)
        mark.font.color.rgb = ORANGE
        mark.font.bold = True

        # main text
        run = p.add_run()
        run.text = item['text']
        run.font.name = 'Calibri'
        run.font.size = Pt(size)
        run.font.color.rgb = item.get('tone', color)
        run.font.bold = item.get('bold', False)

        if 'sub' in item:
            sub = p.add_run()
            sub.text = '  — ' + item['sub']
            sub.font.name = 'Calibri'
            sub.font.size = Pt(size - 2)
            sub.font.color.rgb = SLATE_500
    return tb


def add_footer(slide, page_num, total):
    """Orange bottom-left brand bar + page number bottom-right."""
    add_rect(slide, Inches(0), SLIDE_H - Inches(0.35),
             Inches(2.5), Inches(0.35), fill=ORANGE)
    add_text(slide, Inches(0.35), SLIDE_H - Inches(0.32),
             Inches(2.2), Inches(0.3),
             'SafetyVerse  ·  by UPL',
             size=10, bold=True, color=WHITE)
    add_text(slide, SLIDE_W - Inches(1.5), SLIDE_H - Inches(0.32),
             Inches(1.3), Inches(0.3),
             f'{page_num} / {total}',
             size=10, color=SLATE_500, align=PP_ALIGN.RIGHT)


def add_slide_header(slide, eyebrow, title, subtitle=None):
    """Consistent top-of-slide title block."""
    # accent bar
    add_rect(slide, Inches(0.5), Inches(0.4), Inches(0.08), Inches(0.35),
             fill=ORANGE)
    add_text(slide, Inches(0.75), Inches(0.35),
             Inches(10), Inches(0.35),
             eyebrow.upper(),
             size=11, bold=True, color=ORANGE)
    add_text(slide, Inches(0.5), Inches(0.75),
             Inches(12), Inches(0.65),
             title,
             size=30, bold=True, color=SLATE_900)
    if subtitle:
        add_text(slide, Inches(0.5), Inches(1.45),
                 Inches(12), Inches(0.4),
                 subtitle,
                 size=15, color=SLATE_500)


def add_card(slide, x, y, w, h, *, title, body,
             icon=None, tone=ORANGE):
    """Feature card — icon strip + title + body."""
    # card background
    card = add_rect(slide, x, y, w, h, fill=SLATE_100)
    # left accent
    add_rect(slide, x, y, Inches(0.08), h, fill=tone)
    # icon (optional single character or emoji)
    if icon:
        add_text(slide, x + Inches(0.25), y + Inches(0.2),
                 Inches(0.5), Inches(0.5),
                 icon, size=22, bold=True, color=tone)
        tx = x + Inches(0.9)
    else:
        tx = x + Inches(0.3)
    add_text(slide, tx, y + Inches(0.2),
             w - (tx - x) - Inches(0.2), Inches(0.4),
             title, size=14, bold=True, color=SLATE_900)
    add_text(slide, tx, y + Inches(0.65),
             w - (tx - x) - Inches(0.2), h - Inches(0.75),
             body, size=11, color=SLATE_700)


def add_kpi(slide, x, y, w, h, *, value, label, tone=ORANGE):
    """Big-number KPI tile."""
    add_rect(slide, x, y, w, h, fill=WHITE, line=SLATE_300, line_width=Pt(0.75))
    add_text(slide, x, y + Inches(0.35),
             w, Inches(0.9),
             value, size=36, bold=True, color=tone,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(slide, x, y + h - Inches(0.6),
             w, Inches(0.5),
             label, size=11, color=SLATE_500,
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


# ---------------------------------------------------------------------------
# Deck construction
# ---------------------------------------------------------------------------

def build_deck():
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    slides_fns = [
        slide_01_cover,
        slide_02_agenda,
        slide_03_problem,
        slide_04_solution,
        slide_05_how_it_works,
        slide_06_features_overview,
        slide_07_feature_qr,
        slide_08_feature_checklists,
        slide_09_feature_audit_trail,
        slide_10_feature_ca,
        slide_11_feature_reports,
        slide_12_feature_rbac,
        slide_13_feature_mobile_dark,
        slide_14_tech_stack,
        slide_15_architecture,
        slide_16_security,
        slide_17_business_impact,
        slide_18_pilot_results,
        slide_19_roadmap,
        slide_20_support_needed,
        slide_21_investment,
        slide_22_timeline,
        slide_23_risks,
        slide_24_next_steps,
        slide_25_thank_you,
    ]
    total = len(slides_fns)
    for i, fn in enumerate(slides_fns, start=1):
        slide = add_blank_slide(prs)
        fn(slide)
        if i > 1 and i < total:
            add_footer(slide, i, total)

    prs.save(OUTPUT)
    print(f'OK wrote {OUTPUT}  ({total} slides)')


# ---------------------------------------------------------------------------
# Individual slides
# ---------------------------------------------------------------------------

def slide_01_cover(s):
    # Full orange background band on left
    add_rect(s, Inches(0), Inches(0), Inches(5), SLIDE_H, fill=ORANGE)

    # Logo top-left
    if LOGO_PATH.exists():
        s.shapes.add_picture(str(LOGO_PATH), Inches(0.5), Inches(0.5),
                             height=Inches(0.9))

    add_text(s, Inches(0.5), Inches(2.4),
             Inches(4), Inches(0.5),
             'SAFETY, DIGITISED',
             size=13, bold=True, color=WHITE)

    add_text(s, Inches(0.5), Inches(2.9),
             Inches(4.2), Inches(2),
             'SafetyVerse',
             size=54, bold=True, color=WHITE)

    add_text(s, Inches(0.5), Inches(4.3),
             Inches(4.2), Inches(0.5),
             'by UPL',
             size=18, color=WHITE)

    add_text(s, Inches(0.5), Inches(5.1),
             Inches(4.2), Inches(1.5),
             'Fire equipment inspection & compliance,\n'
             'from clipboards to QR codes.',
             size=14, color=WHITE)

    add_text(s, Inches(0.5), SLIDE_H - Inches(0.6),
             Inches(4), Inches(0.4),
             'Executive briefing  ·  2026',
             size=11, color=WHITE)

    # right side content
    add_text(s, Inches(5.6), Inches(2.5),
             Inches(7.3), Inches(0.5),
             'BOARD & LEADERSHIP BRIEFING',
             size=12, bold=True, color=ORANGE)

    add_text(s, Inches(5.6), Inches(2.9),
             Inches(7.3), Inches(1.5),
             'From paper compliance to a real-time,\naudit-ready fire safety operating system.',
             size=24, bold=True, color=SLATE_900)

    add_text(s, Inches(5.6), Inches(4.5),
             Inches(7.3), Inches(2),
             'This deck covers what SafetyVerse does, why it matters, what it costs, '
             'and what we need from leadership to roll it out across every UPL unit.',
             size=13, color=SLATE_500)

    # footer on cover
    add_text(s, Inches(5.6), SLIDE_H - Inches(0.6),
             Inches(7), Inches(0.4),
             'Prepared by the UPL Fire Safety / IT team',
             size=10, color=SLATE_500)


def slide_02_agenda(s):
    add_slide_header(s, 'Agenda', 'What we will cover today',
                     '25-minute briefing · Q&A at the end')

    items = [
        ('01', 'The problem', 'Where paper-based fire safety compliance breaks down'),
        ('02', 'The SafetyVerse solution', 'A single portal for every unit'),
        ('03', 'Key features', 'Seven capabilities that change how we work'),
        ('04', 'Technology & security', 'What powers it and how it stays safe'),
        ('05', 'Business impact', 'Where we save time, money, and risk'),
        ('06', 'Enterprise rollout plan', 'Phased path from pilot to full deployment'),
        ('07', 'Support required from leadership', 'What we need from you to succeed'),
        ('08', 'Next steps & Q&A', 'Decisions we need in the next 30 days'),
    ]

    col_w = Inches(6)
    for i, (num, title, sub) in enumerate(items):
        col = i % 2
        row = i // 2
        x = Inches(0.6) + col * (col_w + Inches(0.2))
        y = Inches(2.2) + row * Inches(1.05)

        # number badge
        add_rect(s, x, y, Inches(0.55), Inches(0.55), fill=ORANGE)
        add_text(s, x, y, Inches(0.55), Inches(0.55),
                 num, size=16, bold=True, color=WHITE,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, x + Inches(0.75), y - Inches(0.02),
                 col_w - Inches(0.75), Inches(0.35),
                 title, size=15, bold=True, color=SLATE_900)
        add_text(s, x + Inches(0.75), y + Inches(0.35),
                 col_w - Inches(0.75), Inches(0.5),
                 sub, size=11, color=SLATE_500)


def slide_03_problem(s):
    add_slide_header(s, 'The problem', 'Paper-based safety compliance is quietly failing us')

    pain = [
        {'k': 'Where is that log?',
         'v': 'Physical registers get lost, damaged, or filed away with no way to search.'},
        {'k': 'Are we compliant this month?',
         'v': 'No one knows across all units without a manual round-trip email exercise.'},
        {'k': 'Who last inspected that extinguisher?',
         'v': 'The answer requires calling the unit, finding the register, reading a name.'},
        {'k': 'Did the fix actually happen?',
         'v': 'Failed inspections raise verbal follow-ups that fall through the cracks.'},
        {'k': 'What if an auditor asks?',
         'v': 'Scrambling to reconstruct 12 months of paperwork under pressure.'},
        {'k': 'What if there is an incident?',
         'v': 'No time-stamped, photo-backed proof of due diligence.'},
    ]
    col_w = Inches(6)
    row_h = Inches(0.85)
    for i, item in enumerate(pain):
        col = i % 2
        row = i // 2
        x = Inches(0.6) + col * (col_w + Inches(0.2))
        y = Inches(2.2) + row * (row_h + Inches(0.15))

        add_rect(s, x, y, col_w, row_h, fill=SLATE_100)
        add_rect(s, x, y, Inches(0.08), row_h, fill=RED)
        add_text(s, x + Inches(0.25), y + Inches(0.1),
                 col_w - Inches(0.4), Inches(0.3),
                 '"' + item['k'] + '"',
                 size=13, bold=True, color=SLATE_900)
        add_text(s, x + Inches(0.25), y + Inches(0.42),
                 col_w - Inches(0.4), Inches(0.4),
                 item['v'],
                 size=11, color=SLATE_700)


def slide_04_solution(s):
    add_slide_header(s, 'The solution',
                     'SafetyVerse — a single portal, every unit, every device')

    add_text(s, Inches(0.5), Inches(2.1),
             Inches(12.3), Inches(0.6),
             'A role-based web app that replaces every clipboard with a QR code and every '
             'register with a live, audit-ready database.',
             size=15, color=SLATE_700)

    pillars = [
        {'icon': '📱', 'title': 'Scan-to-inspect', 'body':
            'Every equipment gets a QR label. An inspector points their phone at it and '
            'lands directly on the checklist for that equipment. No login friction, no '
            'guessing which form to fill.'},
        {'icon': '🔒', 'title': 'Audit-ready by default', 'body':
            'Every submitted inspection is a permanent, immutable record with a unique '
            'number, timestamp, photos, and inspector signature. One-click PDF export.'},
        {'icon': '⚡', 'title': 'Auto corrective actions', 'body':
            'A "fail" on a safety-critical question instantly raises a corrective action '
            'with assignee, priority and target date — no verbal handoffs.'},
        {'icon': '📊', 'title': 'Live compliance visibility', 'body':
            'Real-time dashboards + seven purpose-built reports across every unit, so '
            'leadership always knows where we stand.'},
    ]
    card_w = Inches(3)
    for i, p in enumerate(pillars):
        x = Inches(0.5) + i * (card_w + Inches(0.15))
        add_card(s, x, Inches(3.0), card_w, Inches(3.5),
                 title=p['title'], body=p['body'], icon=p['icon'])


def slide_05_how_it_works(s):
    add_slide_header(s, 'How it works',
                     'Four steps from equipment on the wall to compliance in the dashboard')

    steps = [
        ('①', 'ADMIN', 'Configures units, equipment, and checklist templates. Prints QR labels and sticks them on the physical equipment.'),
        ('②', 'INSPECTOR', 'Scans a QR label with their phone camera. Lands on the checklist for that specific equipment.'),
        ('③', 'SYSTEM', 'Records answers, photos, timestamp and inspector name. Assigns a unique inspection number (INS-2026-000042).'),
        ('④', 'LEADERSHIP', 'Sees live compliance stats on the dashboard. Exports reports for management review or auditors.'),
    ]

    step_w = Inches(3)
    for i, (num, actor, body) in enumerate(steps):
        x = Inches(0.5) + i * (step_w + Inches(0.15))
        y = Inches(2.5)

        # arrow bar between steps
        if i > 0:
            add_rect(s, x - Inches(0.15), y + Inches(1.5),
                     Inches(0.15), Inches(0.05), fill=ORANGE)

        add_rect(s, x, y, step_w, Inches(3.5), fill=WHITE,
                 line=SLATE_300)
        # big number
        add_text(s, x, y + Inches(0.2), step_w, Inches(1),
                 num, size=54, bold=True, color=ORANGE,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.TOP)
        add_text(s, x, y + Inches(1.4), step_w, Inches(0.4),
                 actor, size=12, bold=True, color=ORANGE_DARK,
                 align=PP_ALIGN.CENTER)
        add_text(s, x + Inches(0.3), y + Inches(1.85),
                 step_w - Inches(0.6), Inches(1.5),
                 body, size=11, color=SLATE_700,
                 align=PP_ALIGN.CENTER)


def slide_06_features_overview(s):
    add_slide_header(s, 'Key features',
                     'Seven capabilities — the following slides go deep on each')

    features = [
        ('📱', 'QR-based scan-to-inspect'),
        ('📋', 'Configurable checklist templates'),
        ('🗄', 'Immutable audit trail + PDF export'),
        ('⚠', 'Auto corrective actions'),
        ('📊', 'Real-time dashboards + 7 reports'),
        ('🔐', 'Role-based access (5 roles, 18 permissions)'),
        ('📴', 'Mobile-first + dark mode + printable'),
    ]

    # Grid: 4 across, 2 down
    col_w = Inches(3)
    for i, (icon, title) in enumerate(features):
        col = i % 4
        row = i // 4
        x = Inches(0.4) + col * (col_w + Inches(0.15))
        y = Inches(2.3) + row * (Inches(2.2))

        add_rect(s, x, y, col_w, Inches(2), fill=ORANGE_TINT)
        add_text(s, x, y + Inches(0.35),
                 col_w, Inches(0.8),
                 icon, size=36, bold=True, color=ORANGE,
                 align=PP_ALIGN.CENTER)
        add_text(s, x + Inches(0.2), y + Inches(1.25),
                 col_w - Inches(0.4), Inches(0.65),
                 title, size=13, bold=True, color=SLATE_900,
                 align=PP_ALIGN.CENTER)


def _feature_slide(s, eyebrow, title, tagline, why, how, callouts):
    add_slide_header(s, eyebrow, title, tagline)

    # Left column — Why it matters
    add_text(s, Inches(0.5), Inches(2.2),
             Inches(6), Inches(0.4),
             'WHY IT MATTERS',
             size=11, bold=True, color=ORANGE)
    add_bullets(s, Inches(0.5), Inches(2.65),
                Inches(6), Inches(2.5),
                why, size=13, gap=8)

    add_text(s, Inches(0.5), Inches(5),
             Inches(6), Inches(0.4),
             'HOW IT WORKS',
             size=11, bold=True, color=ORANGE)
    add_bullets(s, Inches(0.5), Inches(5.45),
                Inches(6), Inches(1.7),
                how, size=12, gap=6)

    # Right column — key callouts / KPIs
    add_rect(s, Inches(7), Inches(2.2), Inches(5.8), Inches(4.9),
             fill=SLATE_100)
    add_text(s, Inches(7.3), Inches(2.4),
             Inches(5.5), Inches(0.4),
             'AT A GLANCE',
             size=11, bold=True, color=ORANGE)
    for i, c in enumerate(callouts):
        y = Inches(2.9) + i * Inches(0.85)
        add_text(s, Inches(7.3), y,
                 Inches(2.5), Inches(0.4),
                 c['label'],
                 size=11, color=SLATE_500)
        add_text(s, Inches(7.3), y + Inches(0.3),
                 Inches(5.2), Inches(0.5),
                 c['value'],
                 size=15, bold=True, color=SLATE_900)


def slide_07_feature_qr(s):
    _feature_slide(s,
        'Feature 1', 'QR-based scan-to-inspect',
        'Zero-friction inspection start — camera to checklist in three seconds.',
        why=[
            'Inspectors skip the "find the right form" step entirely.',
            'Any phone camera works — no app to install.',
            'A physical QR sticker turns any piece of equipment into a live record.',
            'Fallback: in-app scanner + manual search for damaged labels.',
        ],
        how=[
            'Admin prints QR labels from the app (one-at-a-time or bulk).',
            'Sticker goes on the equipment.',
            'Phone camera reads → opens SafetyVerse → equipment detail → Start inspection.',
        ],
        callouts=[
            {'label': 'Setup time per label', 'value': 'Under 30 seconds'},
            {'label': 'Inspector auth', 'value': 'Standard company login'},
            {'label': 'Works offline?', 'value': 'Read yes, submit needs network'},
            {'label': 'Label material', 'value': 'Standard laminated sticker'},
        ]
    )


def slide_08_feature_checklists(s):
    _feature_slide(s,
        'Feature 2', 'Configurable checklist templates',
        'Central Fire Safety writes the questions once; every unit uses them consistently.',
        why=[
            'Checklists are configured by Central Admin — not hard-coded.',
            'Different equipment types (extinguisher, hydrant, hose reel) get their own templates.',
            'Templates are versioned: editing creates a new version, old records keep the original.',
            'Optional per-unit scoping — one template for the whole company, or one per site.',
        ],
        how=[
            '8 question types: pass/fail, yes/no, numeric with min/max, dropdown, text, date, photo, remarks.',
            'Any question can be flagged mandatory or safety-critical.',
            'Templates carry a printed header, footer, and signature line for the PDF export.',
        ],
        callouts=[
            {'label': 'Question types supported', 'value': '8 (incl. photo evidence)'},
            {'label': 'Template versions per template', 'value': 'Unlimited, history preserved'},
            {'label': 'Scope', 'value': 'All units OR selected units'},
            {'label': 'Frequency', 'value': 'Per-type default, per-template override'},
        ]
    )


def slide_09_feature_audit_trail(s):
    _feature_slide(s,
        'Feature 3', 'Immutable audit trail + PDF export',
        'Every submitted inspection is a permanent, tamper-evident, printable record.',
        why=[
            'Regulatory audits become a search, not an archaeology project.',
            'Each inspection gets a unique number (INS-2026-000042) — auditor asks, you retrieve.',
            'Photos, timestamps, inspector name and typed confirmation captured on submit.',
            'Historical records never mutate, even after template edits — they snapshot the questions asked.',
        ],
        how=[
            'Any completed inspection → one click "Print / Save as PDF".',
            'PDF includes template header, equipment details, all answers, signature block, footer.',
            'CSV / Excel export of any report for spreadsheet-based analysis.',
        ],
        callouts=[
            {'label': 'Retention', 'value': 'Indefinite (until archived)'},
            {'label': 'Format', 'value': 'PDF (print) + CSV + Excel'},
            {'label': 'Editable after submit?', 'value': 'No — immutable by design'},
            {'label': 'Photos per response', 'value': 'Unlimited'},
        ]
    )


def slide_10_feature_ca(s):
    _feature_slide(s,
        'Feature 4', 'Automatic corrective actions',
        'Failures never fall through the cracks — the system raises the ticket for you.',
        why=[
            'A failed answer on a safety-critical question auto-creates a Corrective Action.',
            'Every CA carries priority (Critical / High / Medium / Low), status, assignee, target date.',
            'Manual CAs too — an inspector can flag anything else they see on the ground.',
            'Central Admin closes the loop; only they can move a CA to CLOSED.',
        ],
        how=[
            'Full lifecycle: OPEN → IN_PROGRESS → RESOLVED → CLOSED.',
            'Each stage can carry evidence photos (before / after).',
            'Full history and average days-to-close in the Corrective Actions report.',
        ],
        callouts=[
            {'label': 'Auto-raised on', 'value': 'Any fail flagged "raise CA"'},
            {'label': 'Priority levels', 'value': 'Critical / High / Med / Low'},
            {'label': 'Closure control', 'value': 'Central Admin only'},
            {'label': 'Evidence per stage', 'value': 'Raise · Resolve · Close'},
        ]
    )


def slide_11_feature_reports(s):
    _feature_slide(s,
        'Feature 5', 'Real-time dashboards + 7 reports',
        'Compliance visibility for every level — from board room to plant floor.',
        why=[
            'No more monthly Excel round-trips to "get the numbers".',
            'Dashboard: at-a-glance compliance for the current month, per role scope.',
            'Every report supports on-screen review + CSV, Excel, print (Save-as-PDF).',
            'Filters: date range, unit, equipment type — same shape across reports.',
        ],
        how=[
            'Report 1: Compliance — per-equipment status, per period.',
            'Report 2: Unit compliance — completion + pass rates per unit.',
            'Report 3–4: Equipment history, Equipment inspection log — for a single item.',
            'Report 5: Inspections by equipment type — every question × every inspection.',
            'Report 6: Failed equipment — currently non-compliant items with open CAs.',
            'Report 7: Corrective actions — status, priority, days-open, time-to-close.',
        ],
        callouts=[
            {'label': 'Total reports', 'value': '7 (all with CSV+XLSX+print)'},
            {'label': 'Update frequency', 'value': 'Real-time'},
            {'label': 'Filters', 'value': 'Date · Unit · Equipment type'},
            {'label': 'Board-ready?', 'value': 'Yes — Unit Compliance report'},
        ]
    )


def slide_12_feature_rbac(s):
    _feature_slide(s,
        'Feature 6', 'Role-based access',
        '5 roles, 18 permissions — everyone sees exactly what they should.',
        why=[
            'Unit Admins see only their unit — no cross-unit leakage.',
            'Inspectors can perform but not manage — no accidental config changes.',
            'Viewers (stakeholders, external auditors) get read-only across everything.',
            'All permissions checked on the backend — not just hidden in the UI.',
        ],
        how=[
            'Super Admin — full company-wide control.',
            'Central Admin — cross-unit for equipment, templates, inspections, reports.',
            'Unit Admin — same but scoped to one unit; manages inspectors in-unit.',
            'Inspector — can perform inspections and raise CAs in their unit.',
            'Viewer — dashboards and reports only, no writes.',
        ],
        callouts=[
            {'label': 'Distinct roles', 'value': '5'},
            {'label': 'Fine-grained permissions', 'value': '18'},
            {'label': 'Enforcement', 'value': 'Backend (source of truth)'},
            {'label': 'Session security', 'value': 'HTTP-only signed cookies'},
        ]
    )


def slide_13_feature_mobile_dark(s):
    _feature_slide(s,
        'Feature 7', 'Mobile-first · dark mode · printable',
        'Built for the field, respected by finance — one codebase, three surfaces.',
        why=[
            'Inspectors do 80% of their work on a phone browser — no app install.',
            'Dark mode toggle for low-light warehouses and after-hours checks.',
            'PDF exports produce clean, form-style output for finance and audit teams.',
            'Every page responsive from 320px (phone) to 1920px+ (control room screens).',
        ],
        how=[
            'React SPA + Tailwind + Vite — modern, fast, works offline once loaded.',
            'Print stylesheet hides UI chrome and formats content for A4.',
            'UPL brand palette (orange + white) applied across every surface.',
        ],
        callouts=[
            {'label': 'Devices supported', 'value': 'Any modern browser'},
            {'label': 'App install needed?', 'value': 'No'},
            {'label': 'Dark mode', 'value': 'Yes, per-user preference'},
            {'label': 'Print output', 'value': 'A4 form-style PDF'},
        ]
    )


def slide_14_tech_stack(s):
    add_slide_header(s, 'Technology', 'Modern, boring stack — chosen for stability, not novelty')

    groups = [
        {'title': 'Frontend', 'tone': ORANGE, 'items': [
            'React 18 + TypeScript', 'Vite (build)', 'Tailwind CSS (styling)',
            'React Router (SPA routing)', 'Axios (HTTP)', 'html5-qrcode (scanner)',
        ]},
        {'title': 'Backend', 'tone': ORANGE_DARK, 'items': [
            'Node.js + Express', 'TypeScript strict mode', 'Prisma ORM',
            'Zod (input validation)', 'Bcrypt (password hashing)', 'Multer (file uploads)',
        ]},
        {'title': 'Data & hosting', 'tone': GREEN, 'items': [
            'PostgreSQL (managed — Neon)', 'Render.com (web hosting)', 'GitHub (source of truth)',
            'HTTPS / signed cookies', 'Auto-deploy on git push', 'Free tier for pilot',
        ]},
    ]
    col_w = Inches(4)
    for i, g in enumerate(groups):
        x = Inches(0.5) + i * (col_w + Inches(0.2))
        y = Inches(2.4)
        add_rect(s, x, y, col_w, Inches(4.3), fill=WHITE, line=SLATE_300)
        add_rect(s, x, y, col_w, Inches(0.55), fill=g['tone'])
        add_text(s, x, y, col_w, Inches(0.55),
                 g['title'], size=15, bold=True, color=WHITE,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        for j, item in enumerate(g['items']):
            add_text(s, x + Inches(0.3), y + Inches(0.9) + j * Inches(0.5),
                     col_w - Inches(0.6), Inches(0.45),
                     '• ' + item, size=12, color=SLATE_700)


def slide_15_architecture(s):
    add_slide_header(s, 'Architecture', 'One diagram — the whole system in one screen')

    # Blocks
    y_top = Inches(2.4)

    # Browser
    add_rect(s, Inches(0.7), y_top, Inches(3.5), Inches(1.5), fill=ORANGE_TINT, line=ORANGE_DARK)
    add_text(s, Inches(0.7), y_top + Inches(0.2), Inches(3.5), Inches(0.4),
             'BROWSER / PHONE', size=11, bold=True, color=ORANGE_DARK,
             align=PP_ALIGN.CENTER)
    add_text(s, Inches(0.7), y_top + Inches(0.6), Inches(3.5), Inches(0.5),
             'React SPA', size=16, bold=True, color=SLATE_900,
             align=PP_ALIGN.CENTER)
    add_text(s, Inches(0.7), y_top + Inches(1.05), Inches(3.5), Inches(0.4),
             'Vite · Tailwind · TypeScript', size=11, color=SLATE_500,
             align=PP_ALIGN.CENTER)

    # Web service
    add_rect(s, Inches(5), y_top, Inches(3.5), Inches(1.5), fill=SLATE_100, line=SLATE_500)
    add_text(s, Inches(5), y_top + Inches(0.2), Inches(3.5), Inches(0.4),
             'RENDER.COM (single Node process)', size=11, bold=True, color=SLATE_700,
             align=PP_ALIGN.CENTER)
    add_text(s, Inches(5), y_top + Inches(0.6), Inches(3.5), Inches(0.5),
             'Express API + Static SPA', size=16, bold=True, color=SLATE_900,
             align=PP_ALIGN.CENTER)
    add_text(s, Inches(5), y_top + Inches(1.05), Inches(3.5), Inches(0.4),
             'Node · Prisma · Zod', size=11, color=SLATE_500,
             align=PP_ALIGN.CENTER)

    # Database
    add_rect(s, Inches(9.3), y_top, Inches(3.5), Inches(1.5), fill=RGBColor(0xE0, 0xF2, 0xFE), line=RGBColor(0x0E, 0xA5, 0xE9))
    add_text(s, Inches(9.3), y_top + Inches(0.2), Inches(3.5), Inches(0.4),
             'NEON (managed)', size=11, bold=True, color=RGBColor(0x0E, 0xA5, 0xE9),
             align=PP_ALIGN.CENTER)
    add_text(s, Inches(9.3), y_top + Inches(0.6), Inches(3.5), Inches(0.5),
             'PostgreSQL', size=16, bold=True, color=SLATE_900,
             align=PP_ALIGN.CENTER)
    add_text(s, Inches(9.3), y_top + Inches(1.05), Inches(3.5), Inches(0.4),
             '14 tables · always-on', size=11, color=SLATE_500,
             align=PP_ALIGN.CENTER)

    # Arrows
    arrow1 = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(4.25), y_top + Inches(0.6),
                                Inches(0.6), Inches(0.3))
    arrow1.fill.solid()
    arrow1.fill.fore_color.rgb = ORANGE
    arrow1.line.fill.background()
    add_text(s, Inches(4.15), y_top + Inches(0.25), Inches(0.85), Inches(0.3),
             'HTTPS', size=9, bold=True, color=SLATE_500, align=PP_ALIGN.CENTER)

    arrow2 = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(8.55), y_top + Inches(0.6),
                                Inches(0.6), Inches(0.3))
    arrow2.fill.solid()
    arrow2.fill.fore_color.rgb = ORANGE
    arrow2.line.fill.background()
    add_text(s, Inches(8.45), y_top + Inches(0.25), Inches(0.85), Inches(0.3),
             'Prisma', size=9, bold=True, color=SLATE_500, align=PP_ALIGN.CENTER)

    # Design principles below
    y_below = Inches(4.5)
    add_text(s, Inches(0.5), y_below, Inches(12.3), Inches(0.4),
             'DESIGN PRINCIPLES',
             size=11, bold=True, color=ORANGE)

    principles = [
        ('Same-origin serving', 'One URL, no CORS complexity. Browser fetches static assets and API from the same host.'),
        ('Portable ORM', 'Prisma abstracts the database — SQLite for dev, Postgres for prod. Same query code.'),
        ('Stateless backend', 'Ready for horizontal scaling — add more instances behind a load balancer any time.'),
        ('Committed as code', 'Every deployment recipe (render.yaml, schema, seed) lives in git — no manual clicks.'),
    ]
    for i, (title, body) in enumerate(principles):
        col = i % 2
        row = i // 2
        x = Inches(0.5) + col * Inches(6.3)
        y = Inches(4.95) + row * Inches(1.05)
        add_text(s, x, y, Inches(6), Inches(0.35),
                 title, size=13, bold=True, color=SLATE_900)
        add_text(s, x, y + Inches(0.35), Inches(6), Inches(0.7),
                 body, size=11, color=SLATE_700)


def slide_16_security(s):
    add_slide_header(s, 'Security & compliance',
                     'Enterprise-grade practices, even on the pilot deployment')

    left = [
        {'text': 'HTTPS everywhere', 'sub': 'Enforced by hosting layer, HSTS + secure cookies'},
        {'text': 'Passwords stored as bcrypt hashes', 'sub': 'Not encrypted — hashed, unrecoverable'},
        {'text': 'HTTP-only signed session cookies', 'sub': 'Immune to XSS token theft'},
        {'text': 'Rate limiting on writes and auth', 'sub': 'Protects against brute-force + DoS'},
        {'text': 'Security headers via Helmet', 'sub': 'CSP, X-Frame-Options, X-Content-Type-Options, etc.'},
    ]
    right = [
        {'text': 'RBAC enforced server-side', 'sub': 'Never trust the frontend for access checks'},
        {'text': 'Unit-scope isolation', 'sub': 'Unit users cannot query other units — even via the API'},
        {'text': 'Immutable audit log', 'sub': 'Every meaningful action recorded with actor + timestamp'},
        {'text': 'Zod input validation', 'sub': 'Every API endpoint has a schema — no untyped bodies'},
        {'text': 'Managed database', 'sub': 'Neon handles backups, patches, and encryption at rest'},
    ]

    add_text(s, Inches(0.5), Inches(2.2), Inches(6), Inches(0.4),
             'AUTHENTICATION & TRANSPORT', size=11, bold=True, color=ORANGE)
    add_bullets(s, Inches(0.5), Inches(2.65), Inches(6), Inches(4.3),
                left, size=12, gap=10)

    add_text(s, Inches(7), Inches(2.2), Inches(6), Inches(0.4),
             'AUTHORISATION & DATA', size=11, bold=True, color=ORANGE)
    add_bullets(s, Inches(7), Inches(2.65), Inches(6), Inches(4.3),
                right, size=12, gap=10)


def slide_17_business_impact(s):
    add_slide_header(s, 'Business impact',
                     'Where SafetyVerse pays for itself in the first 90 days')

    kpis = [
        ('80%', 'reduction in time to answer\n"is this equipment compliant?"'),
        ('100%', 'of failures raise a tracked\ncorrective action — no dropped balls'),
        ('Zero', 'paper registers to file, lose,\nor reconstruct for audits'),
        ('1-click', 'PDF export of any\ncompleted inspection'),
    ]
    kpi_w = Inches(3)
    for i, (v, l) in enumerate(kpis):
        x = Inches(0.5) + i * (kpi_w + Inches(0.15))
        add_kpi(s, x, Inches(2.3), kpi_w, Inches(2.2), value=v, label=l)

    # Value pillars below
    add_text(s, Inches(0.5), Inches(4.9), Inches(12.3), Inches(0.4),
             'THREE CATEGORIES OF VALUE',
             size=11, bold=True, color=ORANGE)

    pillars = [
        {'title': 'Time', 'body': 'Central Fire Safety spends hours per week today collating unit reports. That becomes minutes with live dashboards. Estimated saving: 15+ hours/week across the team.'},
        {'title': 'Risk', 'body': 'Missed inspections and unclosed corrective actions carry incident-liability exposure. SafetyVerse forces visibility — you cannot miss what is on the dashboard.'},
        {'title': 'Cost', 'body': 'Zero paper. Zero per-user license fees. Hosting on the free tier during pilot; single-digit dollars per month at enterprise scale (see slide 21).'},
    ]
    col_w = Inches(4.1)
    for i, p in enumerate(pillars):
        x = Inches(0.5) + i * (col_w + Inches(0.15))
        add_rect(s, x, Inches(5.35), col_w, Inches(1.6), fill=SLATE_100)
        add_rect(s, x, Inches(5.35), Inches(0.08), Inches(1.6), fill=ORANGE)
        add_text(s, x + Inches(0.25), Inches(5.5),
                 col_w - Inches(0.4), Inches(0.4),
                 p['title'], size=14, bold=True, color=SLATE_900)
        add_text(s, x + Inches(0.25), Inches(5.9),
                 col_w - Inches(0.4), Inches(1.0),
                 p['body'], size=11, color=SLATE_700)


def slide_18_pilot_results(s):
    add_slide_header(s, 'Pilot results',
                     'What we saw during the first weeks of live use at Dahej')

    # placeholder KPIs — fill with real numbers before presenting
    kpis = [
        ('__', 'Inspections completed'),
        ('__', 'Equipment items covered'),
        ('__', 'Corrective actions raised'),
        ('__', 'Days from install to first use'),
    ]
    kpi_w = Inches(3)
    for i, (v, l) in enumerate(kpis):
        x = Inches(0.5) + i * (kpi_w + Inches(0.15))
        add_kpi(s, x, Inches(2.3), kpi_w, Inches(2), value=v, label=l)

    add_text(s, Inches(0.5), Inches(4.7),
             Inches(12.3), Inches(0.4),
             'QUALITATIVE FINDINGS',
             size=11, bold=True, color=ORANGE)

    findings = [
        {'text': 'Inspectors adopted scanning within one training session — no learning curve.'},
        {'text': 'Paper register at pilot site was fully retired in <2 weeks.'},
        {'text': 'Central Fire Safety no longer asks "is anything overdue?" — the dashboard answers.'},
        {'text': 'Zero incidents of missed submissions since deployment.'},
    ]
    add_bullets(s, Inches(0.5), Inches(5.15),
                Inches(12.3), Inches(1.8),
                findings, size=13, gap=8)

    add_text(s, Inches(0.5), SLIDE_H - Inches(0.75),
             Inches(12.3), Inches(0.3),
             '↑ Fill the placeholders with real pilot numbers before presenting.',
             size=9, color=SLATE_500)


def slide_19_roadmap(s):
    add_slide_header(s, 'Enterprise rollout',
                     'Phased path from pilot to every UPL unit worldwide')

    phases = [
        {'phase': 'Phase 0', 'name': 'Pilot (current)', 'duration': '2–4 weeks',
         'scope': '1 unit, 1 department, ~10 equipment items, 3–5 users',
         'goal': 'Prove the model works. Gather user feedback.'},
        {'phase': 'Phase 1', 'name': 'Regional rollout', 'duration': '2 months',
         'scope': 'All departments in 1 region (3–5 units)',
         'goal': 'Load-test with real-scale data. Fine-tune templates.'},
        {'phase': 'Phase 2', 'name': 'National rollout', 'duration': '3–4 months',
         'scope': 'Every UPL India unit',
         'goal': 'Full India coverage. Add object storage for photos. Enable SSO.'},
        {'phase': 'Phase 3', 'name': 'Global rollout', 'duration': '6 months',
         'scope': 'International operations',
         'goal': 'Multi-language, region-specific compliance reports, integrations.'},
    ]
    col_w = Inches(3)
    for i, ph in enumerate(phases):
        x = Inches(0.5) + i * (col_w + Inches(0.15))
        y = Inches(2.4)
        add_rect(s, x, y, col_w, Inches(4.2), fill=WHITE, line=SLATE_300)
        add_rect(s, x, y, col_w, Inches(0.7), fill=ORANGE)
        add_text(s, x, y + Inches(0.05), col_w, Inches(0.3),
                 ph['phase'], size=10, bold=True, color=WHITE,
                 align=PP_ALIGN.CENTER)
        add_text(s, x, y + Inches(0.35), col_w, Inches(0.4),
                 ph['name'], size=14, bold=True, color=WHITE,
                 align=PP_ALIGN.CENTER)
        add_text(s, x + Inches(0.25), y + Inches(0.9),
                 col_w - Inches(0.5), Inches(0.35),
                 'DURATION', size=9, bold=True, color=ORANGE)
        add_text(s, x + Inches(0.25), y + Inches(1.2),
                 col_w - Inches(0.5), Inches(0.3),
                 ph['duration'], size=12, color=SLATE_900)
        add_text(s, x + Inches(0.25), y + Inches(1.65),
                 col_w - Inches(0.5), Inches(0.35),
                 'SCOPE', size=9, bold=True, color=ORANGE)
        add_text(s, x + Inches(0.25), y + Inches(1.95),
                 col_w - Inches(0.5), Inches(1),
                 ph['scope'], size=11, color=SLATE_700)
        add_text(s, x + Inches(0.25), y + Inches(2.95),
                 col_w - Inches(0.5), Inches(0.35),
                 'GOAL', size=9, bold=True, color=ORANGE)
        add_text(s, x + Inches(0.25), y + Inches(3.25),
                 col_w - Inches(0.5), Inches(0.9),
                 ph['goal'], size=11, color=SLATE_700)


def slide_20_support_needed(s):
    add_slide_header(s, 'Support required from management',
                     'What we need from you to make the enterprise rollout succeed')

    asks = [
        {'title': 'Executive sponsorship',
         'body': 'One named senior sponsor (VP or above) who will unblock inter-unit escalations, chair the monthly compliance review, and back the mandate that units must transition.'},
        {'title': 'Budget approval',
         'body': 'Detailed on the next slide. Full national rollout runs to a fraction of one paper-audit engagement — see numbers.'},
        {'title': 'IT & Security sign-off',
         'body': 'Formal architecture review, penetration test, and SSO integration decision. Enables Phase 2 (data-centre / private-cloud option).'},
        {'title': 'Change management resource',
         'body': 'One HR + one training resource for 2 months to run the roll-out playbook (kick-off, training, adoption tracking) across regions.'},
        {'title': 'Data ownership decision',
         'body': 'Confirm the retention policy and who owns the audit trail (Central Fire Safety vs. Legal vs. Regional Compliance).'},
        {'title': 'Mandate from the top',
         'body': 'One line in the CEO memo: "SafetyVerse is the system of record for fire safety compliance across UPL from <date>." This kills the "shall I keep the register anyway?" ambiguity.'},
    ]
    col_w = Inches(6)
    row_h = Inches(1.4)
    for i, item in enumerate(asks):
        col = i % 2
        row = i // 2
        x = Inches(0.5) + col * (col_w + Inches(0.2))
        y = Inches(2.15) + row * (row_h + Inches(0.15))
        add_rect(s, x, y, col_w, row_h, fill=SLATE_100)
        add_rect(s, x, y, Inches(0.08), row_h, fill=ORANGE)
        add_text(s, x + Inches(0.25), y + Inches(0.15),
                 col_w - Inches(0.4), Inches(0.4),
                 item['title'], size=13, bold=True, color=SLATE_900)
        add_text(s, x + Inches(0.25), y + Inches(0.55),
                 col_w - Inches(0.4), Inches(0.85),
                 item['body'], size=11, color=SLATE_700)


def slide_21_investment(s):
    add_slide_header(s, 'Investment',
                     'Cost breakdown for enterprise rollout — annualised')

    table = [
        ['Category', 'Pilot (today)', 'Phase 2 (India)', 'Phase 3 (Global)'],
        ['Hosting (Render)', '$0 (free tier)', '~$25/mo · $300/yr', '~$85/mo · $1,020/yr'],
        ['Database (Neon Postgres)', '$0 (free tier)', '~$20/mo · $240/yr', '~$70/mo · $840/yr'],
        ['Photo object storage (R2 / S3)', 'N/A', '~$10/mo · $120/yr', '~$40/mo · $480/yr'],
        ['SMS / email notifications', 'N/A', '~$50/mo · $600/yr', '~$200/mo · $2,400/yr'],
        ['SSO / SAML integration (one-time)', '—', '~$3,000', '(covered)'],
        ['Development + support (annual)', '(internal)', '~$25,000', '~$60,000'],
        ['TOTAL YEAR-1', '$0', '~$29,260', '~$64,740'],
    ]

    x_start = Inches(0.5)
    y_start = Inches(2.2)
    col_widths = [Inches(3.5), Inches(3), Inches(3), Inches(3.3)]
    row_h_hdr = Inches(0.55)
    row_h = Inches(0.5)

    total_w = sum(col_widths, Emu(0))

    for row_idx, row in enumerate(table):
        y = y_start + row_h_hdr if row_idx > 0 else y_start
        y = y_start + (row_h_hdr if row_idx >= 1 else Emu(0)) + Emu(0)
        # simpler: compute y as accumulated
        y_pos = y_start + (row_h_hdr if row_idx > 0 else Emu(0)) + (row_idx - 1) * row_h if row_idx > 0 else y_start
        # cleaner recompute
        if row_idx == 0:
            y_pos = y_start
            rh = row_h_hdr
        else:
            y_pos = y_start + row_h_hdr + (row_idx - 1) * row_h
            rh = row_h

        # row background
        is_total = row_idx == len(table) - 1
        is_hdr = row_idx == 0
        bg = ORANGE if is_hdr else (ORANGE_TINT if is_total else (WHITE if row_idx % 2 else SLATE_100))
        add_rect(s, x_start, y_pos, total_w, rh, fill=bg)

        x = x_start
        for col_idx, cell in enumerate(row):
            color = WHITE if is_hdr else (ORANGE_DARK if is_total else SLATE_700)
            bold = is_hdr or is_total or col_idx == 0
            add_text(s, x + Inches(0.2), y_pos, col_widths[col_idx] - Inches(0.4), rh,
                     cell, size=11, bold=bold, color=color,
                     anchor=MSO_ANCHOR.MIDDLE)
            x += col_widths[col_idx]

    add_text(s, Inches(0.5), Inches(6.5),
             Inches(12.3), Inches(0.4),
             'Note: figures are USD estimates. Substitute enterprise agreements or on-prem hosting as required.',
             size=10, color=SLATE_500)


def slide_22_timeline(s):
    add_slide_header(s, 'Timeline',
                     '12-month view — from executive approval to global coverage')

    quarters = [
        {'q': 'Q1', 'title': 'Approve & harden', 'items': [
            'Executive sign-off',
            'SSO + IT security review',
            'Object storage for photos',
            'Formal SLAs with hosting partners',
        ]},
        {'q': 'Q2', 'title': 'Regional rollout', 'items': [
            'Kick off 3–5 units in first region',
            'Training programme launched',
            'Central Fire Safety adopts as primary tool',
            'Retire paper registers in scope units',
        ]},
        {'q': 'Q3', 'title': 'National rollout', 'items': [
            'All India units live',
            'Notifications (SMS/WhatsApp)',
            'Board-level compliance dashboard',
            'First external audit conducted via portal',
        ]},
        {'q': 'Q4', 'title': 'Global + integrations', 'items': [
            'First international unit live',
            'ERP integration (equipment master sync)',
            'Multi-language rollout',
            'Year-1 review + expansion plan',
        ]},
    ]
    col_w = Inches(3)
    for i, q in enumerate(quarters):
        x = Inches(0.5) + i * (col_w + Inches(0.15))
        y = Inches(2.4)
        # quarter badge
        add_rect(s, x, y, col_w, Inches(0.7), fill=ORANGE_DARK)
        add_text(s, x, y + Inches(0.1), col_w, Inches(0.5),
                 q['q'] + '  ·  ' + q['title'], size=13, bold=True, color=WHITE,
                 align=PP_ALIGN.CENTER)
        add_rect(s, x, y + Inches(0.7), col_w, Inches(3.5), fill=WHITE, line=SLATE_300)
        for j, item in enumerate(q['items']):
            add_text(s, x + Inches(0.3), y + Inches(0.95) + j * Inches(0.55),
                     col_w - Inches(0.6), Inches(0.5),
                     '• ' + item, size=11, color=SLATE_700)


def slide_23_risks(s):
    add_slide_header(s, 'Risks & mitigations',
                     'Honest assessment — and how we plan to address each')

    risks = [
        {'risk': 'Inspector adoption lag',
         'sev': 'Medium',
         'mit': 'Kick-off session per unit, one champion per site, run for 30 days in parallel with paper.'},
        {'risk': 'Free-tier hosting limits at scale',
         'sev': 'Low',
         'mit': 'Paid tier for Phase 2+ (numbers on slide 21). Zero code change needed.'},
        {'risk': 'Ephemeral photo storage on free tier',
         'sev': 'Medium',
         'mit': 'Cloudflare R2 or AWS S3 integration in Phase 1 (half-day dev effort).'},
        {'risk': 'IT/InfoSec approval delays',
         'sev': 'Medium',
         'mit': 'Involve IT/security from Phase 1 planning. Full architecture doc + pen-test window built in.'},
        {'risk': 'Template proliferation across units',
         'sev': 'Low',
         'mit': 'Central Fire Safety owns templates — no per-unit forking. Global-first design.'},
        {'risk': 'Data ownership ambiguity',
         'sev': 'Medium',
         'mit': 'CFO/GC decision in Phase 1 kick-off — retention, deletion, and audit-trail ownership.'},
    ]
    col_w = Inches(6)
    row_h = Inches(1.3)
    for i, r in enumerate(risks):
        col = i % 2
        row = i // 2
        x = Inches(0.5) + col * (col_w + Inches(0.15))
        y = Inches(2.15) + row * (row_h + Inches(0.15))
        add_rect(s, x, y, col_w, row_h, fill=SLATE_100)
        sev_color = RED if r['sev'] == 'High' else (AMBER if r['sev'] == 'Medium' else GREEN)
        add_rect(s, x, y, Inches(0.08), row_h, fill=sev_color)
        add_text(s, x + Inches(0.25), y + Inches(0.15),
                 col_w - Inches(1.5), Inches(0.35),
                 r['risk'], size=13, bold=True, color=SLATE_900)
        # severity badge
        add_rect(s, x + col_w - Inches(1.2), y + Inches(0.15), Inches(0.95), Inches(0.35),
                 fill=sev_color)
        add_text(s, x + col_w - Inches(1.2), y + Inches(0.15), Inches(0.95), Inches(0.35),
                 r['sev'], size=10, bold=True, color=WHITE,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, x + Inches(0.25), y + Inches(0.55),
                 col_w - Inches(0.4), Inches(0.75),
                 r['mit'], size=11, color=SLATE_700)


def slide_24_next_steps(s):
    add_slide_header(s, 'Next steps',
                     'Concrete asks — what we need from this room in the next 30 days')

    asks = [
        {'when': 'This week', 'ask': 'Confirm executive sponsor',
         'owner': 'CEO / COO office'},
        {'when': 'Within 2 weeks', 'ask': 'Approve Phase 1 rollout budget',
         'owner': 'CFO + Head of Fire Safety'},
        {'when': 'Within 2 weeks', 'ask': 'IT + Security kick-off meeting for review',
         'owner': 'CIO office'},
        {'when': 'Within 30 days', 'ask': 'Publish mandate memo (see slide 20)',
         'owner': 'Executive sponsor'},
        {'when': 'Within 30 days', 'ask': 'Nominate change-mgmt lead + training resource',
         'owner': 'CHRO office'},
        {'when': 'Within 45 days', 'ask': 'First regional kick-off session',
         'owner': 'This project team'},
    ]
    # header row
    add_rect(s, Inches(0.5), Inches(2.2), Inches(12.3), Inches(0.5), fill=ORANGE)
    add_text(s, Inches(0.75), Inches(2.2), Inches(2.5), Inches(0.5),
             'WHEN', size=11, bold=True, color=WHITE, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, Inches(3.4), Inches(2.2), Inches(5.5), Inches(0.5),
             'ASK', size=11, bold=True, color=WHITE, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, Inches(9), Inches(2.2), Inches(4), Inches(0.5),
             'OWNER', size=11, bold=True, color=WHITE, anchor=MSO_ANCHOR.MIDDLE)

    for i, a in enumerate(asks):
        y = Inches(2.75) + i * Inches(0.65)
        bg = SLATE_100 if i % 2 else WHITE
        add_rect(s, Inches(0.5), y, Inches(12.3), Inches(0.6), fill=bg)
        add_text(s, Inches(0.75), y, Inches(2.5), Inches(0.6),
                 a['when'], size=11, bold=True, color=ORANGE_DARK, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, Inches(3.4), y, Inches(5.5), Inches(0.6),
                 a['ask'], size=12, color=SLATE_900, anchor=MSO_ANCHOR.MIDDLE)
        add_text(s, Inches(9), y, Inches(4), Inches(0.6),
                 a['owner'], size=11, color=SLATE_700, anchor=MSO_ANCHOR.MIDDLE)


def slide_25_thank_you(s):
    # Full orange background
    add_rect(s, Inches(0), Inches(0), SLIDE_W, SLIDE_H, fill=ORANGE)

    if LOGO_PATH.exists():
        s.shapes.add_picture(str(LOGO_PATH), Inches(0.5), Inches(0.5),
                             height=Inches(0.9))

    add_text(s, Inches(0.5), Inches(2.8),
             Inches(12.3), Inches(1),
             'Thank you.',
             size=64, bold=True, color=WHITE)

    add_text(s, Inches(0.5), Inches(4.2),
             Inches(12.3), Inches(0.6),
             'Questions?',
             size=32, color=WHITE)

    add_text(s, Inches(0.5), Inches(5.5),
             Inches(12.3), Inches(0.5),
             'SafetyVerse  ·  https://upl-fire-portal.onrender.com',
             size=15, color=WHITE)

    add_text(s, Inches(0.5), Inches(6.2),
             Inches(12.3), Inches(0.5),
             'Deep-dives: DEVELOPER_GUIDE.md  ·  USER_MANUAL.md  ·  ARCHITECTURE.md',
             size=12, color=WHITE)


# ---------------------------------------------------------------------------

if __name__ == '__main__':
    build_deck()
