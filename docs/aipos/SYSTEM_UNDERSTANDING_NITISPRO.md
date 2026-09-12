# Nitis Pro AIPOS — System Understanding & Handoff Brief

- **Purpose of this doc:** ยืนยันความเข้าใจระบบทั้งหมดของ "nitispro / AIPOS" ในมุมของ coding agent, สรุปสถานะจริง, และเสนอ ขั้นตอน / แนวทาง / สิ่งที่ต้องทำ / ข้อควรระวัง / สิ่งที่ควรแก้เพิ่ม
- **Written:** 2026-09-10 · scope = PR #21 branch `cursor/master-continuity-strategy-169c`
- **Not a source of truth.** Operational truth = Notion [AIPOS CURRENT STATE](https://app.notion.com/p/3cdbc165be4c81c48e73e5899ae5f0e3). Repo continuity truth = `docs/aipos/CURRENT_STATE.md`. เอกสารนี้เป็น briefing/ความเห็น ไม่แทนที่สัญญาใดๆ

---

## 1. ระบบนี้คืออะไร (ภาพรวมที่ตรงกับความจริง)

AIPOS = **Mission Operating System** ที่ตั้งใจให้รับงาน (mission) จาก Owner → เข้าใจ → วาง Blueprint → route ไปหา executor ที่เหมาะสม → รัน → verify → ส่งมอบ → ติดตามต่อ โดยมี **AIPOS Core เป็น control plane** (ไม่ใช่ ChatGPT / Notion / n8n เป็นผู้ตัดสิน)

**ระดับความสุกจริงตอนนี้: Level 2–3 (Governed → บางส่วน AI-Assisted)** ไม่ใช่ Level 4 เต็มรูป

มี **2 ความจริงที่ต้องแยกให้ขาด**:

| # | ระบบ | สถานะ | ที่อยู่ |
|---|---|---|---|
| A | **Production Mission Intake Pilot v0.1** | **PRODUCTION PASS** (Phase 1–2) | n8n workflow `7fLPHiiyt7sre5RR` v`760150d8…`, Notion writeback PASS, smoke exec 37 / MIS-3 / NIT-9 |
| B | **Repo control-plane implementation** (Owner Mission Operating Standard) | Stage 0–6 COMPLETE/verified, **Stage 7 ยังไม่ผ่าน** | `apps/web` (Next.js) บน PR #21 (draft) |

> ⚠️ อย่าเอา "Phase 1–2 PRODUCTION PASS" มาอ้างว่า live Linear dispatch / Phase 3 routing เสร็จแล้ว — คนละเรื่องกัน

---

## 2. สถาปัตยกรรม & Source-of-Truth (ห้ามเบลอ)

```text
Browser (responsive)
    │
Next.js App (apps/web — API + UI)  ← AIPOS Core control plane
    │
┌───┴────────────┐
│  App Database  │  ← runtime SSOT: intakes, missions, audit, sync, control-plane state
└───┬────────────┘
    │ verified write only (Architecture Contract §1)
┌───▼────────────┐
│ Notion Registry│  ← ops / knowledge SSOT (projection ของ Digital Brain)
└────────────────┘

GitHub  ← code + schema + ADR + architecture SSOT (ไม่ใช่ mission runtime)
Linear  ← operational work status (workstream/issue)
n8n     ← execution truth (เฟสหลัง)
```

**กฎ SoT ที่ผูก agent (`AGENTS.md`):**
- GitHub เป็นเจ้าของ: code, schema, ADR (markdown), architecture docs, CI
- Notion เป็นเจ้าของ: operator profile / identity-role, Mission Registry (human ops), operational knowledge
- App DB เป็นเจ้าของ: runtime transactions (intake, mission, audit, sync, execution jobs)
- ห้ามพูดคำว่า "SSOT" ลอยๆ โดยไม่ระบุ data class
- Mission ต้องสร้างสำเร็จ **แม้ Notion sync fail** (`sync_status=failed` เท่านั้นที่สะท้อนผล external)

---

## 3. Persistence & adapters

| เงื่อนไข | พฤติกรรม |
|---|---|
| `DATABASE_URL` ไม่ตั้ง | **DEV file store** `apps/web/.data/dev-store.json` (dev-only, มี label ใน UI/log) |
| `DATABASE_URL` + `FORCE_POSTGRES=true` | **PostgreSQL runtime adapter** (App DB SSOT) — Phase 2 foundation |
| `NOTION_ADAPTER` (default `mock`) | local/CI ไม่เขียน Notion จริง; `mock_synced` ห้ามนำเสนอเป็น verified |
| `LINEAR_ADAPTER` (default `mock`) | live ต้องมี `LINEAR_API_KEY` + `LINEAR_TEAM_ID`; ถ้า misconfigured → fail closed กลับ mock |
| `ANALYZE_PROVIDER` (default `none`) | intake analyze เป็น rule-based stub ไม่เรียก LLM |

**DEV file store** เพิ่งถูก hardened (commit `875cd4e`): per-file mutation queue + atomic temp-rename เพื่อกัน lost-update ใน 1 Node process เดียว — **ยังไม่มี cross-process lock**; production ต้องเป็น PostgreSQL

---

## 4. Owner Mission Operating Standard (AIPOS-STD-003) — 7 stages

Standard นี้คือ "ระบบตอบโจทย์ Owner" ที่ PR #21 กำลัง implement แบบ additive (ไม่แตะ frozen Phase 1–2)

| Stage | ชื่อ | สถานะ | หลักฐาน / API |
|---|---|---|---|
| 0 | PR verification gate | ✅ COMPLETE | `PR21_STAGE0_VERIFICATION.md` |
| 1 | **Mission Blueprint & Stage Map** | ✅ COMPLETE | `mission-blueprint.v1`, revisions, explicit approve event, evidence-only progress. `GET/POST /api/missions/{id}/blueprint`, `…/blueprint/approve`. Dispatch อ่าน blueprint ที่ persist + approved เท่านั้น (request body approve ไม่ได้) |
| 2 | **Capability & Team Intelligence** | ✅ COMPLETE | Living `capability-registry.v1`, states VERIFIED/PARTIAL/UNVERIFIED/UNAVAILABLE/REVERIFY_REQUIRED/DEGRADED, expiry/retest/downgrade. Routing = KEEP/ASSIST/HANDOFF/SPLIT/HUMAN_REQUIRED, fail closed ถ้า requirement ไม่ครอบคลุม |
| 3 | **Stage Artifact Pipeline** | ✅ COMPLETE | Immutable `stage-artifact.v1` snapshots, lineage/parent/rollback/checksum, QA evidence ก่อน promote, accept → canonical handoff. UI: compare/download/preview/rollback/accept |
| 4 | **Policy Intelligence** | ✅ COMPLETE | Audit-backed `policy-inbox.v1`, provenance/scope/priority/confidence, dedupe + conflict fail-closed, promote ต้อง review + explicit approve |
| 5 | **Persistent Mission Navigation** | ✅ COMPLETE | `mission-navigation.v1`: primary/active mission, DoD, checkpoint, interruption stack, idempotent resume, stale reminder read-only. `GET/POST /api/mission-navigation` |
| 6 | **Scope & WIP Control** | ✅ COMPLETE | `scope-guard.v1`: MUST_NOW/SHOULD_NEXT/LATER/REJECT, WIP limit (finish-before-expand), material change → parked จน trade-off approve. Forecast API (min/max stage & mission ranges + assumptions) |
| 7 | **Live integrations** (Linear E2E → worker → n8n → production gate) | 🔴 **UNVERIFIED / GATED** | ดู §7 |

**หลักการยอมรับงาน (ข้อ 17):** feature ไม่ใช่ "SHIPPED" เพราะมี schema / doc / mock / unit test — SHIPPED เมื่อ runtime behavior จริงถูก implement, verify ด้วยหลักฐานตัวแทน, Owner เห็นได้ที่จำเป็น, และ recover ได้

---

## 5. Runtime modules (control plane) — `apps/web/src/lib/services/`

| Module | หน้าที่ |
|---|---|
| `control-plane-state.ts` | canonical mission control state (เก็บผ่าน audit event `control_plane:state_upsert`) |
| `control-plane-pipeline.ts` | E2E: mission → supervisor → strategy → decompose → **capability route (fail closed)** → human gate → **dispatch** → worker packages → verify → integrate → health |
| `aipos-supervisor.ts` | init state + supervisor assessment |
| `mission-strategist.ts` / `decomposer.ts` | strategy + outcome-driven workstreams (reject generic titles) |
| `capability-router.ts` / `capability-registry.ts` | best-fit routing จาก Living Registry |
| `workstream-dispatcher.ts` | **idempotent dispatcher**: search-by-correlation-id ก่อน create; fail closed ถ้า search error; repair write-back |
| `runtime-reconcile.ts` | reconcile canonical state หลัง external action (บันทึก evidence, patch workstream) |
| `verifier.ts` / `result-integrator.ts` / `verifier-integrator.ts` | independent verify + integrate + recovery task |
| `health-supervisor.ts` | HEALTHY/WARNING/BLOCKED/CRITICAL + findings (stale, dup workstream, orphan Linear mapping, state divergence, SLA breach…) |
| `human-gate.ts` / `authority.ts` | human gate policy bridge, authority evaluator |
| `evidence.ts` / `handoff.ts` / `recovery.ts` | evidence promotion guards, canonical handoff builder, SBI/GROW recovery planner |
| `linear/client.ts` | mock default / live opt-in GraphQL adapter + read-only Stage 7 preflight |

**Correlation ID = idempotency key** ทุก transition และ external call

---

## 6. Governance & Anti-Hallucination (backend contract, ไม่ใช่แค่ prompt)

**Epistemic labels** (ทุก operational fact): `confirmed` / `reported` / `inferred` / `hypothesis` / `unknown`
- unlabeled claims เรื่อง identity/authority/external state → reject หรือ downgrade เป็น `unknown`
- `hypothesis` ห้ามเป็นฐานของ external write

**Three-State Reporting:**
| State | ภาษาที่อนุญาต |
|---|---|
| `session_only` | ห้ามพูด "saved" / "sent" |
| `app_persisted` | "Saved in AIPOS" (มี App DB record id) |
| `external_verified` | "Synced to Notion (page id…)" (external write + readback id) |

**Gates G0–G5:** G0 real mission · G1 outcome/criteria/role · G2 sensitivity + destinations · G3 authority L3–L4 · G4 external write **after confirm only** · G5 readback verified id

**Gate services (มีไฟล์แยก + test):** `readiness-gate`, `handling-gate`, `mapping-gate` — Authority/G5 ใน app live path ยัง **ไม่ครบเทียบเท่า**

**Execution Authorization Envelope:** หลัง Blueprint approve → ไปต่อได้เองสำหรับ safe discovery / reversible L0–L1 / in-scope decomposition / drafting-testing-verify-logging / non-blocking handoff. **หยุดถาม** เฉพาะ: credential/connector permission, destructive/hard-to-reverse, production deploy, financial/legal/high-impact, authority conflict, material scope/cost/time/architecture/risk change

**ADR:**
- ADR-006 = **Control Tower / Governance Enforcement** (Proposed) — ห้าม rename/rewrite
- ADR-007 = **Capability Orchestration / Mission Decompose + Route** (**Approved 2026-09-12** — D-007.5: ADR-005 Superseded; D-007.6: Option B L0–L1 AI workers, Stage 7B proof authorized)

---

## 7. Stage 7 — สถานะจริง + สิ่งที่ทำวันนี้ (2026-09-10)

### 7.1 สิ่งที่ทำไปในเซสชันนี้

1. **พบ defect จริง (verify แบบ read-only กับ Linear API):** live client ใช้ `issueSearch(query:)` ซึ่ง **Linear deprecate แล้ว** — API ตอบ `{"errors":[{"message":"deprecated","code":"INPUT_ERROR","statusCode":400}]}`. dispatcher จับ error ของ search แล้ว fail closed → **ทุก real dispatch จะถูก BLOCK ก่อน create**. read-only preflight ไม่เคยเจอเพราะมันเรียกแค่ `viewer` + `team(id:)` ไม่ได้เรียก search
2. **แก้:** `apps/web/src/lib/linear/client.ts` → ใช้ `searchIssues(term:, first: 25)` + คง exact `correlation_id=` marker match. ไม่แตะ mutation path, idempotency เดิม
3. **Regression test:** `client.test.ts` assert ว่า query ใช้ `searchIssues(term:` และไม่มี `issueSearch`, และยัง resolve marker ที่ถูกต้องผ่าน fuzzy hits ได้; อัปเดต transport mock ใน `control-plane-e2e.test.ts`
4. **สร้าง harness:** `apps/web/scripts/linear-e2e-dispatch.ts` = `npm run linear:e2e` (Owner-runnable):
   - preflight (viewer + exact team)
   - seed **1 reversible mission + 1 workstream** ใน store แยก `.data-stage7-e2e/` (gitignored, ไม่แตะข้อมูล Owner และไม่แตะ `INT-5D7A2B1143C8`), Notion บังคับ mock
   - dispatch 1 workstream ผ่าน live adapter (`issueCreate` จริง 1 ครั้ง)
   - assert issue id/identifier + reconciliation `workstream_id → linear_issue_id` status `DISPATCHED`
   - re-run → assert reuse เดิม (idempotency, ไม่เขียนซ้ำ)
   - independent `searchIssues` readback → assert ตรง
   - print evidence JSON, **ไม่ลบ/archive issue**; fixed idempotency key + persistent store ทำให้ re-run ชี้ที่ issue เดิมตัวเดียว
5. **Verify local:** web suite **124 passed** / 7 PostgreSQL-gated skipped · ESLint clean · Prettier clean (ไฟล์ที่แก้) · Next.js 15.5.25 build passed · Doctor `pass=32 fail=0 critical=0`
6. **Read-only preflight จาก coding environment:** `ok=true, adapter=live, authenticated=true`, team `Nitis Pro : AIPOS` / `NIT` / `acee324a-f2d8-416d-96ef-237298e82986`, `write_performed=false`

### 7.2 สิ่งที่ **ยังไม่ทำ** และทำไม (Human Gate ที่ยังปิดอยู่)

`npm run linear:e2e` ตัวจริง **agent ไม่รัน** เพราะ:
- **ADR-007 Approved 2026-09-12** — D-007.6 Option B: Stage 7B Real Worker (L0–L1) authorized; see ADR-007 §D-007.6 for forbidden-actions list
- Blueprint/routing review ของ one-workstream dispatch ยังไม่ทำ
- `INT-5D7A2B1143C8` ยังต้อง repair + readback (harness ไม่ได้ใช้ draft นั้น แต่ standing Human Gate ครอบทุก Real Linear write)
- creating a Linear issue = external write บน workspace ของ Owner → ต้องมี explicit per-action approval

Harness แค่ทำให้ gated action เป็น **1 คำสั่งที่ reproducible** — ไม่ได้ยกเลิก gate

---

## 8. ขั้นตอน & แนวทางต่อจากนี้ (อัปเดต 2026-09-12)

### 8.1 ✅ สำเร็จแล้ว — ก่อน Stage 7B (ปิด gate แล้ว)

1. ✅ **ADR-007 อนุมัติแล้ว (2026-09-12)** — D-007.5: ADR-005 Superseded; D-007.6: Option B L0–L1 AI workers
2. **Repair `INT-5D7A2B1143C8`** — ยังค้างอยู่ (ต้องทำในเครื่อง Owner); ไม่บล็อก Stage 7B proof
3. ✅ **Stage 7A Linear E2E** — PASS (NIT-22, commit `9385fdb`, 2026-09-11)

### 8.2 ✅ Stage 7A เสร็จแล้ว — ห้ามรันซ้ำ (NIT-22 มีอยู่แล้ว)

ห้ามรัน `npm run linear:e2e` ซ้ำ — NIT-22 ใน Linear ยังคงอยู่โดยตั้งใจ

### 8.3 Stage 7B — Real Worker Proof (AUTHORIZED, 2026-09-12)

### 8.3 หลัง Linear E2E ผ่าน (ตามลำดับที่ standard กำหนด)

8. Real Worker Execution → 9. Health/Recovery live runtime → 10. n8n integration → 11. Full Mission E2E → 12. Production Gate
   *(ทุกขั้นมี Human Gate ของตัวเอง; ห้ามข้าม)*

---

## 9. สิ่งที่ต้องทำ / ควรทำ (Do's)

- ✅ อ่าน binding docs ก่อนแก้ code: `AIPOS_ARCHITECTURE_CONTRACT.md`, `AIPOS_PHASE_1_DECISIONS.md`, `HARD_CONTROL_AND_ANTI_HALLUCINATION.md`, `OWNER_MISSION_OPERATING_STANDARD.md`, relevant `adr/`
- ✅ อ้าง Requirement/Decision ID / Contract section / ADR ทุกครั้งที่เปลี่ยนพฤติกรรม
- ✅ เพิ่ม/แก้ Vitest ใน commit เดียวกับ business logic ที่เปลี่ยน (AGENTS.md: "tests follow business logic")
- ✅ รัน gate ก่อน handoff: `npm run test` · `npm run lint` · `npm run build` · `npm run doctor`
- ✅ keep PR #21 **Draft** จน Owner gate; conventional commits; commit เล็ก reviewable
- ✅ ใช้ Three-State language อย่างเคร่งครัด — mock ≠ verified
- ✅ external write เฉพาะหลัง confirm + readback (G4/G5)
- ✅ additive เท่านั้นต่อ frozen Phase 1–2 (n8n `7fLPHiiyt7sre5RR`, Notion Mission/Project registry, production Linear)

## 10. ข้อควรระวัง (Cautions)

- ⚠️ **ห้าม silent scope expansion** — ถ้าคำขอกระทบ MVP scope / architecture / governance → หยุดแล้วถาม
- ⚠️ **ห้ามแก้ locked decisions โดยไม่มี ADR ใหม่ + human approval**
- ⚠️ **ห้าม deploy production / mutate live Notion-Neon / rotate secret** เว้นแต่ Owner สั่งชัด + ให้ target
- ⚠️ `core.autocrlf=true` บน Windows checkout ทำให้ `npm run format:check` ฟ้อง ~93 ไฟล์ (CRLF) — เป็น artifact ของ environment ไม่ใช่ของจริง; CI (Linux, LF) ผ่าน. **อย่า `prettier --write` ทั้ง repo** เพื่อ "แก้" — จะกลายเป็น diff ปลอม 90+ ไฟล์. แก้เฉพาะไฟล์ที่ตัวเองแตะ
- ⚠️ DEV file store กัน lost-update ได้แค่ 1 process — **ห้ามถือว่า production-safe**
- ⚠️ `INT-5D7A2B1143C8` = Owner-local ID จาก evidence เก่า ไม่ใช่ record ใน coding workspace; drift ยังไม่ resolved จนกว่า Owner pull+restart+repair+readback
- ⚠️ `.env.local` ในเครื่องนี้มี **live Linear credential จริง** — `linear:preflight` (read-only) ปลอดภัย แต่ `linear:e2e` เขียนจริง; อย่ารันโดยไม่ผ่าน gate §8.1
- ⚠️ ห้าม commit `.env*`, secret, `AIPOS_AUDIT_REPORT.md`, `.data*`
- ⚠️ `gh` CLI ไม่มีในเครื่องนี้ → `npm run status` (ใช้ `gh pr view`) จะไม่ทำงาน; ใช้ GitHub REST API แทนได้ (repo public)

## 11. สิ่งที่ควรแก้ / เพิ่ม — ความคิดเห็นของผม

**ลำดับความสำคัญสูง**

1. ~~**ADR-007 full text + approval**~~ ✅ **DONE (2026-09-12)** — ADR-007 Approved; D-007.5 ADR-005 Superseded; D-007.6 Option B L0–L1 Stage 7B authorized
2. **Authority Gate / G5 ใน app live path** — `CURRENT_CAPABILITIES.md` ระบุเองว่า Authority gate "ยังไม่มีหลักฐานรองรับ" เทียบเท่า Handling/Mapping gate. ก่อน live worker execution ควรมี `authority-gate.ts` + test ที่ enforce L3–L4 / high-impact ทุก path จริง
3. **Cross-process concurrency สำหรับ DEV store หรือบังคับ Postgres ใน integration** — ตอนนี้ containment เป็น in-process เท่านั้น; lost-update class เคยเกิดจริงกับ Owner data (`INT-5D7A2B1143C8`). แนะนำ: (ก) integration/E2E ที่แตะ mission state ให้ require Postgres, หรือ (ข) เพิ่ม file-lock (`proper-lockfile`) + version/optimistic-concurrency check ใน `DevFileRepository`
4. **`linear/client.ts` live path hardening** — จาก defect วันนี้ เห็นชัดว่า live GraphQL ไม่มี contract test กับ schema จริง. เพิ่ม: (ก) nightly/manual `linear:preflight` + `searchIssues` shape check เป็น scheduled check, (ข) pin Linear API เวอร์ชันถ้าทำได้, (ค) log `LINEAR_GQL` error แบบมี field path เพื่อ debug เร็วขึ้น

**ลำดับกลาง**

5. **`.gitattributes`** — เพิ่ม `* text=auto eol=lf` + `*.ts text eol=lf` เพื่อจบปัญหา CRLF/format:check บน Windows ถาวร (ตอนนี้ทุก dev Windows เจอ noise เดียวกัน)
6. **E2E เข้า CI** — Playwright smoke + `test:e2e-thai` ยังไม่เป็น blocking job; ถ้าจะมั่นใจเรื่อง UI/Thai font/responsive ควรยกขึ้น required (อย่างน้อย smoke)
7. **`npm run status` fallback ไม่มี `gh`** — เพิ่ม path ที่ใช้ GitHub REST API (curl) เมื่อ `gh` ไม่มี เพื่อให้ Developer Control Center ใช้ได้บนเครื่องที่ไม่ได้ลง gh
8. **in-repo ADR-001** — `docsadrADR-001-github-centered-architecture.md.txt` เป็นไฟล์ชื่อเพี้ยน + `adr/ADR-001` เนื้อหาว่าง; ควร normalize ให้ ADR corpus จริงจัง (ADR-001..007) ไม่ชี้ไฟล์ว่าง
9. **Health Supervisor เป็น scheduled job** — `evaluateAllMissionsHealth()` มีแล้วแต่ไม่มี trigger; ควรมี cron/route ที่เรียกจริงเพื่อให้ stale/drift detection ทำงาน ไม่ใช่แค่เรียกตอน pipeline

**ลำดับต่ำ / cleanup**

10. `docs/REPO_STRUCTURE.md` ล้าสมัย (ไม่มี `apps/web/src/app/api/...`, `scripts/`, `adr/` layout ปัจจุบัน) — อัปเดตให้ตรง
11. Forecast/scope API มี test แต่ยังไม่มี UI surface ครบตาม standard ข้อ 14 (completion forecast + assumptions บน Mission view) — ตรวจว่า `/missions/[id]` แสดงครบ
12. รวม `STAGE1..7_*_VERIFICATION.md` ให้มี index เดียว (ตอนนี้ต้องไล่เปิดทีละไฟล์)

---

## 12. ไฟล์ที่เปลี่ยนในเซสชันนี้ (สำหรับ review)

| ไฟล์ | เปลี่ยนอะไร |
|---|---|
| `apps/web/src/lib/linear/client.ts` | `issueSearch` (deprecated) → `searchIssues(term:)` |
| `apps/web/src/lib/linear/client.test.ts` | regression test สำหรับ `searchIssues` + exact-marker match |
| `apps/web/src/lib/services/control-plane-e2e.test.ts` | transport mock → `searchIssues` shape |
| `apps/web/scripts/linear-e2e-dispatch.ts` | **ใหม่** — Stage 7 E2E dispatch harness |
| `apps/web/package.json` / `package.json` | `linear:e2e` script |
| `.gitignore` | ignore `.data-stage7-e2e/` |
| `docs/aipos/STAGE7_LIVE_EXECUTION_GATE.md` | บันทึก defect + fix + harness + gate ที่ยังปิด |
| `docs/aipos/CURRENT_STATE.md` | อัปเดต Stage 7 bullet |
| `docs/aipos/SYSTEM_UNDERSTANDING_NITISPRO.md` | **ใหม่** — เอกสารนี้ |
