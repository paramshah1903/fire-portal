# SafetyVerse — User Manual

*Everything you need to know to use the SafetyVerse portal, organised by
your role. If you don't know your role, ask your admin — this manual
tells you exactly what you can do.*

**Live URL:** `https://upl-fire-portal.onrender.com`
**Best on:** any modern browser (Chrome, Edge, Safari, Firefox) on
desktop or phone.

---

## Table of contents

1. [Signing in](#1-signing-in)
2. [What am I allowed to do? — Role guide](#2-what-am-i-allowed-to-do--role-guide)
3. [Super Admin manual](#3-super-admin-manual)
4. [Central Admin manual](#4-central-admin-manual)
5. [Unit Admin manual](#5-unit-admin-manual)
6. [Inspector manual](#6-inspector-manual)
7. [Viewer manual](#7-viewer-manual)
8. [Common workflows](#8-common-workflows)
9. [Frequently asked questions](#9-frequently-asked-questions)
10. [Getting help](#10-getting-help)

---

## 1. Signing in

1. Open <https://upl-fire-portal.onrender.com>
2. Enter your **Username** and **Password**
3. Click **Sign in**

> **Tip — First login:** Your admin will give you a temporary password.
> Change it immediately from **Users → your row → Reset password**
> (only your admin can do this in the current release; a self-serve
> password change is on the roadmap).

**Trouble signing in?**
- *"Unable to reach the server"* → refresh the page, then try again.
  The app spins down after 15 minutes of inactivity and can take
  ~30 seconds to wake up.
- *"Invalid username or password"* → check caps lock, then ask your
  admin to reset your password.

---

## 2. What am I allowed to do? — Role guide

There are **5 roles** in SafetyVerse. Your role decides what you see and
what you can do.

| Role | You can… | You cannot… |
|------|----------|-------------|
| **Super Admin** | Everything, across every unit | (nothing — full access) |
| **Central Admin** | Manage equipment, templates, inspections, reports across all units | Delete users or change roles |
| **Unit Admin** | Manage equipment, users, and inspections **for your unit only** | See or change data in other units |
| **Inspector** | Perform inspections, raise corrective actions in your unit | Manage equipment, users, or templates |
| **Viewer** | Read-only access to dashboards, equipment, and reports | Change anything |

**The sidebar shows only what you can access** — if you don't see a
menu item, it's because your role doesn't allow it. That's by design,
not a bug.

---

## 3. Super Admin manual

You have full system access. Your primary job is **onboarding new
units, users, and equipment types**, and **overseeing compliance across
the whole company**.

### 3.1 First-week checklist

- [ ] Change the seeded `admin` password (Users page → edit `admin` → Reset password)
- [ ] Create real user accounts for each unit's team
- [ ] Create Units (one per physical plant)
- [ ] Create Departments inside each Unit
- [ ] Confirm the seeded Equipment Types match your reality (Fire Extinguisher, Hydrant, Hose Reel, etc.); create new ones if needed
- [ ] Create at least one **Checklist Template** per Equipment Type and publish v1
- [ ] Import equipment via CSV (Equipment → Import) or add individually

### 3.2 Common tasks

**Create a new Unit**
Masters → Units → **New unit** → fill code, name, location → Create.

**Create a new user**
Administration → Users → **New user** → pick role, unit (if not
Central/Super), username, password → Create.
> Users must be assigned to a Unit if their role is Unit Admin or Inspector.
> Central Admin and Super Admin see all units.

**Reset a user's password**
Users → click the user row → **Reset password** → generate or type new
one → save. The user must change it themselves on next login.

**Create a Checklist Template**
Masters → Checklist Templates → **New template**:
1. Give it a name (e.g. "Monthly Fire Extinguisher Check")
2. Pick the Equipment Type it applies to
3. Optionally set Frequency in days (leave blank to use the Equipment
   Type's default frequency)
4. Optionally add **Printed header** (shown on PDF export), **Printed
   footer**, and **Signature line**
5. Optionally restrict to specific units (leave all unchecked to apply
   to every unit)
6. Click Create — a **Draft v1** is created

Then open the template → **Continue draft v1** → add sections and
questions → **Publish**.

**Bulk import equipment via CSV**
Masters → Equipment → **Import**:
1. Download the CSV template
2. Fill it in (one row per equipment; keep column headers as-is)
3. Upload → preview → confirm

### 3.3 What only you can do

- Manage the base equipment types (add new types like "Sprinkler")
- Deactivate users (Users → row → toggle Active)
- Access the **Audit Logs** (System → Audit Logs) to see who did what
- View data across **every unit** without any filter

---

## 4. Central Admin manual

You oversee fire safety across all units but don't touch user
accounts. Your primary jobs are **template management, compliance
tracking, and corrective-action follow-through**.

### 4.1 Daily routine

1. **Open Dashboard** — check the compliance summary; note any unit
   with high overdue count
2. **Check Overdue inspections** (Inspections tab → filter Status =
   Overdue) — ping the relevant Unit Admin to chase
3. **Review new corrective actions** (Corrective Actions tab) — assign,
   set priorities, follow up
4. **End of day**: check "Failed equipment" report for anything
   safety-critical

### 4.2 Common tasks

**Publish a new checklist version**
When a question needs to change (add / edit / remove):
1. Open the template → **New draft version** — this clones the current
   published version
2. Edit sections and questions freely in the draft
3. **Publish** — the previous version is archived; new inspections
   from now on use the new version
> Old inspections keep the version they were captured against, so
> reports for historical periods remain accurate.

**Assign a corrective action**
Corrective Actions → click the CA code → **Assign** → pick the
Assignee (usually a Unit Admin or Inspector) → set target date.

**Close a corrective action**
Only Central Admin (and Super Admin) can close CAs. Open the CA → once
it's in RESOLVED status, click **Close** → add closure remarks +
optional evidence photo.

### 4.3 Reports you'll use most

- **Compliance report** — for a date range: per-equipment,
  completed / due / overdue / pass / fail. Export to Excel for the
  monthly review.
- **Unit compliance** — one row per unit with completion + pass rates.
  Great for management review meetings.
- **Corrective actions** — status, priority, days-open, average
  time-to-close.
- **Inspections by equipment type** — for auditors: pick a type, get
  every completed inspection with every answer as a column.

---

## 5. Unit Admin manual

You run fire safety for **one unit**. You never see other units' data.
Your primary jobs are **keeping the equipment master current, making
sure inspections happen on time, and following up on failures in your
unit**.

### 5.1 Daily routine

1. **Dashboard** — check your unit's compliance stats for the current
   month
2. **Overdue inspections** — nudge inspectors, or perform inspections
   yourself
3. **Open corrective actions** — check the ones assigned to your unit;
   move them to IN_PROGRESS as work starts, RESOLVED when done (Central
   Admin will close them)

### 5.2 Common tasks

**Add or edit equipment**
Masters → Equipment → **New equipment** (or click a row to edit):
- **Code** — auto-generated but overridable
- **Type** — pick from the list
- **Serial / Asset / Location** — these appear on every inspection and
  on the printed PDF, so fill them in
- **Department** — helps narrow down location
- **QR value** — auto-generated; you can print the QR label from the
  equipment detail page

**Print QR labels**
Two ways:
- **One at a time:** Equipment → click the equipment → **Label** →
  Print / Save as PDF
- **Bulk:** QR Management → Bulk QR Labels → pick equipment → **Print**
  → the browser dialog gives you a printable sheet of QR stickers

Stick the labels on the physical equipment. Any phone camera that
scans them opens SafetyVerse at the right equipment.

**Perform an inspection yourself**
Inspections → Monthly schedule → click **Start** next to an equipment.
See §6 (Inspector manual) for the checklist flow.

### 5.3 What you can't do (and who to ask)

| I need to… | Ask… |
|------------|------|
| Create a new user | Super Admin |
| Add a new equipment type | Super Admin |
| Change a checklist template | Central Admin |
| Close a corrective action | Central Admin |
| See another unit's data | You can't — that's by design |

---

## 6. Inspector manual

You do the physical inspections. Your primary tool is **your phone
camera**. Most of your time in SafetyVerse is on the mobile screen.

### 6.1 The core flow — scanning a QR

1. Open your phone camera → point at the QR sticker on the equipment
2. Tap the notification → SafetyVerse opens in your browser
3. If you're not signed in, log in with your credentials
4. You land on the equipment page → tap **Start inspection**
5. Fill each question:
   - **Pass / Fail** — tap the button
   - **Yes / No** — tap the button
   - **Numeric** — type the number (with the specified unit if any)
   - **Text / Remarks** — type in the box
   - **Dropdown** — pick from the list
   - **Photo** — tap **+ Add photo** → your camera opens → snap →
     attached to that question
6. Add optional overall remarks at the bottom
7. Tap **Submit inspection** → type your name to confirm → **Submit**
8. Done. You get an **Inspection Number** like `INS-2026-000042` that
   goes on the record.

### 6.2 Things to know

- **Safety-critical questions** are marked with a red **Safety** badge.
  A "Fail" on one of these marks the whole inspection as safety-critical
  and immediately raises a corrective action.
- **Mandatory questions** must be answered before you can submit — the
  submit button stays disabled until they're all done.
- If you can't complete an inspection right away, tap **Save progress**
  — your answers stay there and you can resume later from Inspections.
- Once submitted, an inspection **cannot be edited**. It becomes a
  permanent record. Only re-inspection creates a new record.

### 6.3 Raising a corrective action manually

Sometimes you spot an issue that doesn't map to a checklist question
(e.g. bracket is loose). Raise a CA manually:
1. Corrective Actions → **New corrective action**
2. Pick the equipment, describe the issue, set priority
3. Optionally attach evidence photos
4. Submit — Central Admin will assign and follow through

### 6.4 If the QR won't scan

- Make sure the QR sticker is clean and not creased
- Try again with better lighting
- Fallback: open SafetyVerse manually → Scan (in the sidebar) → the
  in-app scanner works even in dim conditions
- Manual fallback: Equipment → search by code → open → Start inspection

---

## 7. Viewer manual

You have **read-only access**. You can see everything but change
nothing.

### 7.1 What you can do

- **Dashboard** — see compliance stats
- **Equipment** — browse the master, click an item to see history
- **Inspections** — view completed inspections, open the detail page,
  even **Print / Save as PDF** — read-only exports work
- **Corrective Actions** — see the list, open the detail page
- **Reports** — every report, plus CSV / Excel export

### 7.2 What you can't do

- Start a new inspection
- Edit anything
- See users' passwords or personal info
- Access Audit Logs (Super Admin only)

Typical Viewer users: management stakeholders, external auditors,
company safety officers who oversee but don't operate.

---

## 8. Common workflows

### 8.1 Print a completed inspection as PDF

1. Open the completed inspection (Inspections → click the row)
2. Top-right → **Print / Save as PDF**
3. Browser dialog opens → destination = **Save as PDF** → Save
4. The PDF includes:
   - Template header (if configured)
   - Equipment details (serial, asset, location, etc.)
   - All questions and answers
   - Signature block
   - Template footer (if configured)

### 8.2 Export a report as Excel

1. Reports → pick a report → apply filters (date range, unit, type)
2. Top-right → **Export Excel** (or CSV)
3. File downloads → open in Excel / Google Sheets

### 8.3 Track a specific equipment's full history

Two options:
- **Reports → Equipment inspection log** → search + pick the equipment
  → get every completed inspection with every answer as a column
- **Reports → Equipment history** → simpler summary (dates, pass/fail,
  inspector)

### 8.4 See "all inspections of one equipment type"

Reports → **Inspections by equipment type** → pick the type → get one
row per completed inspection across every equipment of that type, with
every checklist question as a column.

---

## 9. Frequently asked questions

**Q: Can I fill an inspection that was due last month?**
Yes. Inspections → All inspections tab → find the pending one → **Resume**.

**Q: I made a typo in a submitted inspection — can I edit it?**
No, submitted inspections are immutable by design. Ask your Central
Admin to raise a **re-inspection** (they can start a new inspection for
the same equipment for the same period).

**Q: My phone camera won't scan the QR.**
See §6.4 above — clean the sticker, try better lighting, or use the
in-app Scan page.

**Q: The app is slow to load.**
The free hosting tier spins down after 15 minutes of inactivity. First
request wakes it (~30 seconds). Subsequent requests are fast.

**Q: I uploaded a photo but now it's gone.**
On the current free hosting tier, uploaded photos are stored on
ephemeral disk and get wiped when the container restarts (~ every day
or when a new version deploys). Structured data (inspections,
corrective actions, users) is safe in the persistent database.
Photo persistence needs an object-storage upgrade — talk to your admin.

**Q: How do I know my role?**
Top-right of the app, above the "Sign out" button, shows your name and
role (Super Admin, Central Admin, Unit Admin, Inspector, Viewer).

**Q: How do I switch to dark mode?**
Click the sun / moon icon in the top nav (next to Sign out). Your
choice is saved.

**Q: How often should inspections happen?**
Depends on the Equipment Type's `inspectionFrequencyDays` setting.
Default is 30 days (monthly) for most fire safety equipment. Your
Super Admin controls this per type.

---

## 10. Getting help

- **In-app**: hover over any icon or badge for a tooltip
- **This manual**: bookmark it — it's the source of truth
- **Your admin**: your Unit Admin for unit-specific things, Central
  Admin for cross-unit or template questions, Super Admin for user /
  access issues
- **Bugs or feature requests**: raise through the internal IT process
  or your Safety Officer

---

**Version:** 2026-09 — matches the SafetyVerse pilot release
**Maintained by:** UPL Fire Safety / IT
