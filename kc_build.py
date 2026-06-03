#!/usr/bin/env python3
"""
kc_build.py  —  Kell Commercial build toolkit
=============================================

A dependency-free helper for transforming a DUPLICATE of the Nice City Homes (NCH)
app into the "Kell Commercial" app. It does two jobs:

  1) AUDIT/SCRUB the codebase so NO Nice City Homes data survives into Kell Commercial
     (this is the project's #1 rule). It walks the repo, finds every NCH reference,
     and writes a report you can hand straight to emergent.sh. Optionally it can
     auto-apply the safe, unambiguous replacements.

  2) INIT the Kell Commercial build artifacts: a .env template, a brand config,
     a README, and the emergent.sh build instructions.

Usage
-----
  # See what NCH references exist (read-only, writes NCH_AUDIT_REPORT.md):
  python3 kc_build.py scan /path/to/kellcommercial

  # Apply ONLY the safe literal replacements, then re-scan to confirm:
  python3 kc_build.py scan /path/to/kellcommercial --apply

  # Generate the Kell Commercial config + emergent instructions into ./out:
  python3 kc_build.py init --out ./out

Nothing here touches NCH systems or Dad's data directly — it only reads/edits the
repo path you give it. Safe replacements never touch your admin email and never
auto-edit ambiguous tokens (those are reported for manual/emergent review).
"""

import argparse
import os
import re
import sys
from datetime import datetime

# ---- Brand defaults (override via init flags) -------------------------------
KC_NAME = "Kell Commercial"
KC_COLOR = "#A8201A"          # Kell Commercial brand red (matched to the logo)
KC_PHONE = "[FILL IN: Kell Commercial phone]"
ADMIN_EMAIL = "jacob@nicecityhomes.com"   # intended admin login — kept on purpose

# Files/dirs we never scan or edit
SKIP_DIRS = {".git", "node_modules", "dist", "build", ".next", "venv", "__pycache__", ".idea"}
SKIP_FILES = {"NCH_AUDIT_REPORT.md",   # our own report
              "CLAUDE.md", "RENTEC_SYNC_SPEC.md",
              "EMERGENT_INSTRUCTIONS.md", "README.md",
              "kc_build.py"}  # the scrubber's own ruleset — would self-flag otherwise
BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip",
              ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".mov", ".lock"}

# ---- Rule set ----------------------------------------------------------------
# Each rule: (label, compiled_regex, confidence, action, replacement)
#   confidence: SAFE  -> unambiguous, ok to auto-apply with --apply
#               REVIEW-> emergent/you must decide; never auto-applied
#   replacement: string for SAFE rules, or None for REVIEW
RULES = [
    ("Brand name",        re.compile(r"Nice City Homes", re.I),            "SAFE",   KC_NAME),
    ("Tagline",           re.compile(r"HOME OWNERSHIP SPECIALISTS", re.I), "SAFE",   ""),
    ("Brand color (hex)", re.compile(r"#?8B0000\b", re.I),                 "SAFE",   KC_COLOR),
    ("NCH DoorLoop URL",  re.compile(r"nicecityhomes\.app\.doorloop\.com"),"REVIEW", None),
    ("NCH website",       re.compile(r"(?<!@)\bnicecityhomes\.com\b"),     "REVIEW", None),
    ("Acronym 'NCH'",     re.compile(r"\bNCH\b"),                          "REVIEW", None),
    ("NCH phone",         re.compile(r"330[-.\s]?495[-.\s]?8192"),         "REVIEW", None),
    ("NCH address",       re.compile(r"6521\s+Beverly\s+Ave", re.I),       "REVIEW", None),
    ("Canton OH addr",    re.compile(r"Canton,?\s*OH\s*4472\d"),           "REVIEW", None),
    ("Partner: Mike Kell",re.compile(r"\bMike\s+Kell\b"),                  "REVIEW", None),
    ("Partner: Jack Kanam",re.compile(r"\bJack\s+Kanam\b"),                "REVIEW", None),
    ("Loan group label",  re.compile(r"\bR[123]\b"),                       "REVIEW", None),
    ("DoorLoop ref",      re.compile(r"DoorLoop", re.I),                   "REVIEW", None),
]

NOTES = {
    "Acronym 'NCH'": "May appear in code identifiers (e.g. nchData). Rename, don't blind-replace.",
    "Loan group label": "High false-positive risk (could be unrelated vars). Verify each hit.",
    "NCH website": "Keep " + ADMIN_EMAIL + " as the admin login; only swap public-site references.",
    "DoorLoop ref": "Remove only NCH-tied DoorLoop integration. Kell Commercial uses Rentec, not DoorLoop.",
    "Partner: Mike Kell": "'Kell' alone is shared with 'Kell Commercial' — never blind-replace 'Kell'.",
}


def iter_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn in SKIP_FILES:
                continue
            ext = os.path.splitext(fn)[1].lower()
            if ext in BINARY_EXT:
                yield os.path.join(dirpath, fn), True   # binary asset
            else:
                yield os.path.join(dirpath, fn), False


def scan(root, apply_safe=False):
    root = os.path.abspath(root)
    if not os.path.isdir(root):
        print(f"ERROR: not a directory: {root}")
        sys.exit(1)

    hits = []          # (rel, lineno, label, conf, note, linetext)
    asset_flags = []   # binary files that look NCH-branded
    safe_changes = 0

    for path, is_binary in iter_files(root):
        rel = os.path.relpath(path, root)
        if is_binary:
            base = os.path.basename(path).lower()
            if "nch" in base or "nicecity" in base or "logo" in base:
                asset_flags.append(rel)
            continue
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
        except Exception:
            continue

        changed = False
        for i, line in enumerate(lines, 1):
            new_line = line
            for label, rx, conf, repl in RULES:
                if rx.search(line):
                    hits.append((rel, i, label, conf, NOTES.get(label, ""), line.rstrip()))
                    if apply_safe and conf == "SAFE":
                        new_line = rx.sub(repl, new_line)
            if apply_safe and new_line != line:
                lines[i - 1] = new_line
                changed = True
                safe_changes += 1
        if changed:
            with open(path, "w", encoding="utf-8") as f:
                f.writelines(lines)

    write_report(root, hits, asset_flags, apply_safe, safe_changes)
    print_summary(hits, asset_flags, apply_safe, safe_changes)


def print_summary(hits, asset_flags, applied, safe_changes):
    safe = [h for h in hits if h[3] == "SAFE"]
    review = [h for h in hits if h[3] == "REVIEW"]
    print("\n=== NCH AUDIT SUMMARY ===")
    print(f"  SAFE   (brand strings)   : {len(safe)} hits")
    print(f"  REVIEW (manual/emergent) : {len(review)} hits")
    print(f"  Binary assets to replace : {len(asset_flags)}")
    if applied:
        print(f"  Safe replacements applied: {safe_changes} lines edited")
        print("  -> Re-run without --apply to confirm SAFE count is now ~0.")
    print("  Full detail written to NCH_AUDIT_REPORT.md")
    if review:
        print("\n  Top REVIEW items (hand these to emergent):")
        for rel, ln, label, conf, note, txt in review[:8]:
            print(f"    - {rel}:{ln}  [{label}]")
    print("=========================\n")


def write_report(root, hits, asset_flags, applied, safe_changes):
    out = os.path.join(root, "NCH_AUDIT_REPORT.md")
    safe = [h for h in hits if h[3] == "SAFE"]
    review = [h for h in hits if h[3] == "REVIEW"]
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"# NCH Audit Report — Kell Commercial\n\n")
        f.write(f"_Generated {datetime.now():%Y-%m-%d %H:%M} against `{root}`_\n\n")
        f.write("**Goal:** zero Nice City Homes data, branding, or references remain "
                "in the Kell Commercial app.\n\n")
        f.write(f"- SAFE brand-string hits: **{len(safe)}**"
                + (f" (auto-replaced this run: {safe_changes} lines)\n" if applied else "\n"))
        f.write(f"- REVIEW hits (decide each): **{len(review)}**\n")
        f.write(f"- Binary assets flagged: **{len(asset_flags)}**\n\n")

        if asset_flags:
            f.write("## Binary assets to replace by hand\n")
            for rel in asset_flags:
                f.write(f"- `{rel}`\n")
            f.write("\n")

        f.write("## REVIEW hits — manual / emergent decisions\n")
        if not review:
            f.write("_None._\n\n")
        else:
            by_label = {}
            for h in review:
                by_label.setdefault(h[2], []).append(h)
            for label, items in by_label.items():
                f.write(f"\n### {label} ({len(items)})\n")
                if items[0][4]:
                    f.write(f"> {items[0][4]}\n\n")
                for rel, ln, _l, _c, _n, txt in items:
                    f.write(f"- `{rel}:{ln}` — `{txt.strip()[:120]}`\n")

        f.write("\n## SAFE hits — brand strings\n")
        if not safe:
            f.write("_None remaining._\n")
        else:
            for rel, ln, label, _c, _n, txt in safe:
                f.write(f"- `{rel}:{ln}` [{label}] — `{txt.strip()[:120]}`\n")


def init(out_dir, name, color, phone, email):
    os.makedirs(out_dir, exist_ok=True)

    env = f"""# Kell Commercial — environment / secrets template
# Fill these in, then add them as secrets in emergent.sh. Do NOT commit real values.

# Rentec Direct Open API (Utilities -> API Keys in your Rentec account)
RENTEC_API_KEY=

# Google Drive document folder
GOOGLE_DRIVE_FOLDER_ID=
GOOGLE_CREDENTIALS_JSON=

# Notifications
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
NOTIFY_FROM_EMAIL=

# Users
ADMIN_EMAIL={email}
VIEWER_EMAIL=
"""
    _w(os.path.join(out_dir, ".env.example"), env)

    brand = f"""{{
  "name": "{name}",
  "primaryColor": "{color}",
  "background": "#FFFFFF",
  "phone": "{phone}",
  "adminEmail": "{email}",
  "logoPath": "assets/kellcommercial-logo.png",
  "tagline": ""
}}
"""
    _w(os.path.join(out_dir, "brand.config.json"), brand)

    _w(os.path.join(out_dir, "EMERGENT_INSTRUCTIONS.md"), EMERGENT_MD.format(
        name=name, color=color, email=email))

    _w(os.path.join(out_dir, "README.md"), README_MD)

    print(f"Wrote build artifacts to {os.path.abspath(out_dir)}:")
    for fn in [".env.example", "brand.config.json", "EMERGENT_INSTRUCTIONS.md", "README.md"]:
        print(f"  - {fn}")


def _w(path, text):
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


README_MD = """# Kell Commercial Build Kit

Run order:

1. `python3 kc_build.py scan /path/to/kellcommercial`
   Reads the repo, writes `NCH_AUDIT_REPORT.md`. Nothing is changed.

2. Review the report. Then optionally auto-fix the safe brand strings:
   `python3 kc_build.py scan /path/to/kellcommercial --apply`
   (Commit first so git can show you the diff.)

3. Hand the REVIEW section of the report + `EMERGENT_INSTRUCTIONS.md`
   to emergent.sh to finish the transformation.

4. Replace flagged binary logo assets by hand with the Kell Commercial logo.

The script only ever reads/edits the repo path you give it. It never touches
NCH systems or Dad's portfolio data.
"""

EMERGENT_MD = """# Emergent.sh Build Prompt — {name}

Repo: `kellcommercial` (a duplicate of the Nice City Homes / NCH app).
Goal: turn it into a lighter, rebranded **{name}** app for a personal/family
property portfolio. Reuse the working code; strip what isn't needed.

## Rule #1 (read first)
This app must contain **zero Nice City Homes data, branding, or references.**
{name} is a completely separate entity. Run the audit script first
(`kc_build.py scan`) and use `NCH_AUDIT_REPORT.md` as your checklist — every
SAFE and REVIEW hit must be resolved before launch. If unsure whether something
is NCH-specific, remove it. NCH data and {name} data must never touch.

## Step 1 — Audit
Read the repo and confirm every item in `NCH_AUDIT_REPORT.md` is handled.
Report the tech stack, all pages/features, and all integrations.

## Step 2 — Strip to a lighter app
Keep only: **record keeping, task organization, payment tracking.**
Core nav: Properties & Units · Tenants & Leases · Payments · Documents · Tasks.
Remove: investor/turnkey/sales features, loan-group (R1/R2/R3) logic,
contractor/subcontractor modules, private-lender modules, NCH-tied DoorLoop
integration, multi-role complexity, and all NCH seed/demo data.

## Step 3 — Rebrand
Name -> {name}. Replace logo asset. Replace color {color} (suggested) for the
old crimson everywhere. Update titles, favicon, email headers/footers, metadata.

## Step 4 — Data model
A personal portfolio of ~25 properties **plus** one new {name} building modeled
as a single property with multiple child units (each unit has its own
tenant/lease/payment history). No NCH concepts.

## Step 5 — Rentec Direct Open API (payments)
Connect via the Rentec Direct Open API (REST/JSON). Key from Rentec
Utilities -> API Keys, stored as the `RENTEC_API_KEY` secret (never hardcoded).
Pull properties, units, tenants, leases, ledgers, payments. Provide a scheduled
sync + manual "Refresh now". Payments view per unit: due, paid, date, balance,
status (paid/partial/overdue). Handle API errors and rate limits gracefully.

## Step 6 — Access & notifications
Single admin/editor: {email} (only account that can edit). One view-only user
(Dad): read-only, set via `VIEWER_EMAIL`. Email notifications for
payment-received and payment-overdue to both, with on/off toggles.

## Step 7 — Google Drive documents
Connect the Documents module to one Drive folder (`GOOGLE_DRIVE_FOLDER_ID`).
Browse/open documents and attach them to a property or unit.

## Step 8 — Secrets
Remove every NCH env var/secret/sheet ID/Drive ID/DoorLoop link/API key from the
original. Add only the {name} set (see `.env.example`). List the final secrets.

## Step 9 — Deliverables
Audit confirmation, list of everything removed, final secrets list, and a running
deployable app with the five sections, Rentec sync, Drive docs, and notifications.
Keep it simple and maintainable — one editor.
"""


def main():
    p = argparse.ArgumentParser(description="Kell Commercial build toolkit")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("scan", help="Audit a repo for NCH references")
    sp.add_argument("path", help="Path to the kellcommercial repo")
    sp.add_argument("--apply", action="store_true",
                    help="Auto-apply SAFE brand replacements (commit first!)")

    ip = sub.add_parser("init", help="Generate Kell Commercial build artifacts")
    ip.add_argument("--out", default="./out")
    ip.add_argument("--name", default=KC_NAME)
    ip.add_argument("--color", default=KC_COLOR)
    ip.add_argument("--phone", default=KC_PHONE)
    ip.add_argument("--email", default=ADMIN_EMAIL)

    args = p.parse_args()
    if args.cmd == "scan":
        scan(args.path, apply_safe=args.apply)
    elif args.cmd == "init":
        init(args.out, args.name, args.color, args.phone, args.email)


if __name__ == "__main__":
    main()
