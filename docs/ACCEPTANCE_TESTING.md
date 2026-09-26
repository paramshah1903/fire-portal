# End-to-end acceptance test

Follows the workflow described in the spec (section 41). Assumes the
app has been installed and the seed data has been loaded — see
[README.md](../README.md) for setup.

Two terminals:

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm run dev
```

Open <http://localhost:5173>.

Demo credentials:

| Role          | Username       | Password         |
| ------------- | -------------- | ---------------- |
| Super Admin   | `admin`        | `Admin@123`      |
| Central Admin | `centraladmin` | `Central@123`    |
| Unit Admin    | `unitadmin`    | `UnitAdmin@123`  |
| Inspector    | `inspector`   | `Inspector@123` |
| Viewer        | `viewer`       | `Viewer@123`     |

---

## Steps

### 1. Admin logs in
- Go to the app → redirected to `/login`.
- Sign in as `admin / Admin@123`.
- ✅ Dashboard renders with KPI grid + charts (all real numbers).

### 2. Admin selects a unit
- Sidebar → **Masters → Units** → see 3 seeded units (UPL Unit A / B / C).

### 3. Admin creates an equipment type
- Sidebar → **Masters → Equipment Types** → 5 types already seeded.
- Click **New type**, fill in Key + Name (e.g. `WATER_MIST` / "Water Mist System"), Frequency 30 → **Create type**.
- ✅ Type appears in the list.

### 4. Admin creates a checklist template
- Sidebar → **Masters → Checklist Templates** → 5 templates seeded.
- Click **New template**, name it "Water Mist System Check", pick the new equipment type → **Create template**.
- On the detail page click **New draft version** → the editor opens.
- Add a section ("Visual"), add 2 questions (one PASS_FAIL, one YES_NO with Safety-critical + Auto CA on fail).
- **Save draft**, then **Publish version** → confirmation → the version becomes v1 CURRENT.

### 5. Admin creates equipment
- Sidebar → **Masters → Equipment** → click **New equipment**.
- Code `WM-A-0001`, Name "Water Mist Zone 1", Type "Water Mist System", Unit UNIT-A, status ACTIVE → **Create equipment**.

### 6. System generates a unique QR
- Open the new equipment → **QR Code** tab.
- ✅ A rendered QR is shown with a unique `EQ-…` value and the encoded URL.
- Click **Download PNG** → the file downloads.
- Click **Open print label** → new tab with a print-ready label.

### 7. Inspector logs in
- Sign out, sign in as `inspector / Inspector@123`.

### 8. Inspector scans the QR
- Sidebar → **Operations → Scan** → click **Start camera** and point at the printed / on-screen QR, OR paste the `EQ-…` value in **Manual entry** → **Lookup**.
- ✅ Equipment details appear with an **Open equipment** button.

### 9. Equipment details appear
- Click **Open equipment** → equipment detail page with tabs Overview / QR Code / Inspection History / Current Checklist / Corrective Actions.

### 10. Inspector starts the monthly inspection
- Sidebar → **Operations → Inspections** → find WM-A-0001 in the monthly schedule (status "Due") → click **Start**.

### 11. Correct checklist loads
- The perform page opens with the "Water Mist System Check" v1 template — the two questions from step 4.

### 12. Inspector answers questions
- Answer the PASS_FAIL question with **PASS**.
- Answer the safety-critical YES/NO with **NO** (intentional failure).
- ✅ Progress bar turns red; a "Safety-critical failure" badge appears.
- Type overall remarks if you like.

### 13. Safety-critical failure causes non-compliant outcome
- Click **Submit inspection** → the confirmation modal shows a red safety-critical warning.
- Type your name → **Submit as FAILED (safety-critical)**.
- ✅ Redirected to the inspection detail: result **FAIL · safety-critical**.

### 14. Required corrective action is created
- On the inspection detail, under the failed question you should see an amber "Auto-created corrective action" panel with a `CA-A-…` code, `HIGH` priority, `OPEN` status.
- Sidebar → **Operations → Corrective Actions** → the new CA appears at the top.

### 15. Inspector submits the inspection
- Already done in step 13. The inspection is now `COMPLETED` and immutable.

### 16. Inspection becomes a historical record
- Try to re-open the same equipment for inspection this month → **Start** button shows **View** instead; clicking it opens the read-only detail. Backend enforces `ALREADY_COMPLETED_THIS_PERIOD` for a fresh start attempt.

### 17. Dashboard updates
- Sidebar → **Dashboard** — you'll see the completed inspection reflected in the KPI tiles (Completed, Failed equipment, Open corrective actions all bump).

### 18. Corrective action appears
- Already visible in step 14.

### 19. Authorized user manages the corrective action
- As inspector, open the CA → click **Mark in progress**, then **Mark as resolved** with remarks.
- Sign in as `unitadmin / UnitAdmin@123` → open the CA → click **Close corrective action** with closure remarks.
- ✅ Status becomes CLOSED. Try to edit → 400 `CA_CLOSED`.

### 20. Equipment history displays the inspection
- Sidebar → **Masters → Equipment** → open WM-A-0001 → **Inspection History** tab → the inspection is listed with FAIL · SC.

### 21. Reports display the inspection / compliance
- Sidebar → **Reports**:
  - **Compliance** → periods with the failure appear in the summary bar.
  - **Failed equipment** → WM-A-0001 shows up with 0 open CA (it was closed above).
  - **Corrective actions** → the closed CA appears with resolution + closure timestamps.
  - **Equipment history** → pick WM-A-0001, see one row.
- On each report try **Export CSV** and **Export Excel** — files download.
- Try **Print / PDF** → the browser dialog opens with only the KPI bar + table visible.

### 22. Audit logs record important actions
- Sidebar → **System → Audit Logs** (visible only for `SUPER_ADMIN` / `CENTRAL_ADMIN`).
- Filter by **Action = `corrective_action.close`** → see the closure event.
- Filter by **Action = `inspection.submit`** → see the submission with metadata `{ result: "FAIL", hasSafetyCriticalFailure: true }`.
- Filter by **Action = `auth.login.success`** → see every login recorded.

---

## Reset for a fresh run

```bash
cd backend
npm run db:reset          # drops + re-migrates + reseeds (destructive!)
npm run db:seed           # only if reset didn't reseed
```

Or use `npm run db:backup` beforehand to snapshot the current state.

---

## Common issues

- **Camera won't start on the Scan page** — browsers require HTTPS (or `localhost`) for `getUserMedia`. Use the Manual entry fallback in the meantime.
- **Login rate-limited (`429 RATE_LIMITED`)** — 20 attempts per 15 min per IP. Wait or restart the backend to reset the in-memory counter.
- **Session expired mid-flow** — sessions slide on activity but the absolute cap is 30 days. Sign in again.
- **CORS error** — set `CORS_ORIGIN` in `backend/.env` to your frontend origin (default `http://localhost:5173`).
