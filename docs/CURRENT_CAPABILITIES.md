# AIPOS Current Capabilities

> **n8n Phase 1–2 operational SoT:** [`docs/PRODUCTION_SOURCE_OF_TRUTH.md`](./PRODUCTION_SOURCE_OF_TRUTH.md) — Mission Intake Pilot `7fLPHiiyt7sre5RR` / active version `760150d8-…` is **PRODUCTION PASS / FROZEN**.  
> This inventory describes the **in-repo Next.js app** and related docs. Do not treat older “Phase 2 incomplete / n8n PLANNED” language as overturning that n8n production verdict.

**Document status:** Analysis of repository + reconciled 2026-08-12 for dual Phase vocabularies  
**Repository tip analyzed:** `5da6723` on `main` (`fix: install Tailwind native optional dependencies in CI (#5)`) — historical tip; see PRODUCTION_SOURCE_OF_TRUTH for live n8n  
**Scope of evidence:** commits on `main` from governance baseline through CI fix; n8n production IDs verified live 2026-08-12  
**Generated from:** repository contents under `docs/`, `packages/schemas/`, `apps/web/`, `scripts/aipos/`, `.github/`, `AGENTS.md`, `README.md`  
**Not claimed:** App PostgreSQL production default, ADR-005 Human approval, or ADR-006 Router/Dispatcher production

---

## Executive Summary

AIPOS ปัจจุบันทำหน้าที่เป็น **Mission Intake MVP + Development Governance Platform** ไม่ใช่ Mission Operating System ที่วางแผน/มอบหมาย/รันงานอัตโนมัติเต็มรูป

**ทำได้แล้ว**

- กำหนดขอบเขตและสัญญา (Architecture Contract, Phase 1 decisions, API/schema contracts)
- บังคับพฤติกรรม agent/นักพัฒนาผ่าน `AGENTS.md`, Doctor, PR template, CI
- รันเว็บแอป Mission Intake แบบ local ได้ครบ flow หลัก: chat intake → analyze → understanding → user confirm → Mission Object → audit → Notion sync **แบบ mock**
- มี quality gate อัตโนมัติ: format, lint, unit tests, build, secret scan, doctor (`pr`), npm audit (critical)

**ยังไม่ใช่เป้าหมายของ Phase นี้ (และยังไม่มีใน runtime จริง)**

- Planning Engine / Subtask creation
- Capability Matching / Assignment / Specialist execution
- Real Notion verified write + readback ใน production
- PostgreSQL/Neon ใช้งานจริงเป็น default runtime
- n8n runtime orchestration
- Autonomous multi-agent execution
- **Artifact** — **NOT STARTED**
- **Review** (post-execution human review) — **NOT STARTED** (อย่าสับสนกับ Intake Confirm)
- **Closeout** — **NOT STARTED**
- **Monitoring** — **PARTIAL / THIN** (มีแค่ mission list + audit + Notion sync badge; ไม่มี alerting/SLO)

สรุปสั้นๆ: **AIPOS ตอนนี้ช่วย “ควบคุมการพัฒนา + รับ mission เข้าสู่ระบบอย่างมีวินัย” ได้แล้ว แต่ยังไม่ช่วย “ดำเนิน mission จนจบด้วย specialists”**

---

## 1. Development Governance

ปัจจุบัน AIPOS ช่วยควบคุมการพัฒนาในลักษณะ “กฎ + เครื่องมือตรวจ + ท่อ CI” มากกว่า “ระบบที่บังคับทุกอย่างบน GitHub Settings โดยอัตโนมัติ”

### Git workflow

- Default branch คือ `main`; remote คือ GitHub (`nitisbird-wq/aipos`)
- มีแนวทางแยก baseline commit ใน `docs/GIT_BASELINE_SPLIT.md` และประวัติจริงบน `main` สอดคล้องแนวนี้ (docs → schemas → app → style → tooling → CI → CI fix)
- มี PR template (`.github/pull_request_template.md`) บังคับกรอก Mission/ADR/Risk/Testing/Rollback

### Commit strategy

- ใช้ conventional commits (`docs:`, `feat:`, `chore:`, `style:`, `ci:`, `fix:`) จากประวัติจริง
- ห้าม commit secrets / runtime artifacts ตาม Doctor + `.gitignore` + `AGENTS.md`

### Architecture contract

- `docs/AIPOS_ARCHITECTURE_CONTRACT.md` เป็นสัญญา enforceable สำหรับ Intake MVP (SoT, verification, ownership, idempotency, sync failure, status vocabulary)
- `AGENTS.md` ผูก agents ให้ต้องอ่านและเคารพสัญญาเหล่านี้ก่อนเปลี่ยนพฤติกรรม

### ADR

- Phase 1 ผูกกับ Notion ADR-004 ในเอกสาร (`docs/AIPOS_PHASE_1_DECISIONS.md`)
- โฟลเดอร์ `adr/` มีไฟล์ชื่อ ADR-001 แต่ **เนื้อหาว่าง** → สำหรับ in-repo ADR markdown ที่ใช้งานได้จริง: **ยังไม่มีหลักฐานรองรับ** นอกจากเอกสารอ้างอิงใน `docs/`

### Domain contract

- มี JSON Schema ใน `packages/schemas/` และ Zod ใน `apps/web/src/lib/schemas/`
- มี seeds นโยบาย/capability ใน `data/seeds/`
- Mission schema ห้าม `assigned_specialist` ใน MVP (หลักฐานในโค้ด/สคีมา)

### Review process

- มี CODEOWNERS (`.github/CODEOWNERS`) และ PR checklist
- Branch protection / “Require review from CODEOWNERS” ถูกระบุว่าต้องตั้งใน GitHub Settings; Doctor รายงานเป็น `N/A` จาก local/CI checkout → **การบังคับ review บน remote ยังไม่มีหลักฐานรองรับใน repo นี้**

### Doctor

- `scripts/aipos/` ตรวจ Git, Security, Governance docs, Quality scripts, n8n (N/A ใน MVP), CI/CD
- โปรไฟล์ `local` / `pr` / `production` มีอยู่
- ผลล่าสุดที่รันได้ในสภาพแวดล้อมนี้: **READY** (pass สูง, fail=0) สำหรับ `local` และ `pr`

### GitHub Actions

- `.github/workflows/ci.yml` รันบน `push`/`pull_request` ไป `main`/`master`
- หลัง CI fix (`5da6723`) pipeline บน `main` **สำเร็จ** (secret scan + verify)

### Secret scanning

- CI ใช้ Gitleaks CLI แบบ pin version
- Doctor มี secret pattern / sensitive tracked files checks

### Dependency governance

- Dependabot สำหรับ npm และ GitHub Actions (`.github/dependabot.yml`)
- CI บล็อก `npm audit --audit-level=critical`; high เป็น advisory (`continue-on-error`)
- มี open Dependabot PRs ในประวัติ remote แต่ไม่ถือว่า merge/ผ่านโดยอัตโนมัติ

---

## 2. AI Assisted Development

ส่วนนี้แยก **ความสามารถของผลิตภัณฑ์ AIPOS** กับ **ความสามารถของ coding agents ที่ถูกผูกด้วย repo rules**

### Current (มีหลักฐานใน Repository)

| ความสามารถ | หลักฐาน | ขอบเขตจริง |
|---|---|---|
| บังคับ AI/agent อ่านสัญญาและไม่ขยาย scope เงียบๆ | `AGENTS.md`, Architecture Contract, Phase 1 Decisions | Governance ของการพัฒนา ไม่ใช่ runtime planner |
| วิเคราะห์ requirement / ตรวจสถาปัตยกรรม (โดย agent ที่ทำงานใน repo) | เอกสาร binding + PR template บังคับอ้าง ADR/Contract | อาศัยมนุษย์/agent ภายนอก (Cursor/ChatGPT); ไม่มี “Architecture Review Engine” ในแอป |
| วิเคราะห์ CI / build error และเสนอแผนแก้ | หลักฐานเชิงปฏิบัติจาก CI fix (Tailwind oxide optional deps) + workflow ที่ fail ชัดเจนที่ Build | เป็นกระบวนการพัฒนา ไม่ใช่ฟีเจอร์ในแอป |
| Review code / contract / risk ผ่าน checklist | PR template (Architecture, Security, AI authority, Three-State) | Manual + agent-assisted; ไม่มี review bot ใน repo |
| Mission analysis แบบ rule-based ในแอป | `ANALYZE_PROVIDER=none`, `apps/web/src/lib/services/analyze.ts` | ไม่เรียก LLM ภายนอกโดย default |
| Epistemic honesty ระดับ intake assumptions | schema `source: inferred\|user_stated\|knowledge`, chat understanding แยก assumptions | ยังไม่ครบชุด Hard Control G0–G5 ทั้งระบบ |

สิ่งที่ **ยังไม่มีหลักฐานรองรับ** ใน repo ว่าเป็นฟีเจอร์อัตโนมัติของ AIPOS Core:

- Requirement decomposition engine ในตัวแอป
- Automated architecture diff reviewer
- Automated risk scoring ข้ามทุก mission แบบ policy engine เต็มรูป
- Code review bot / contract conformance bot นอก Doctor แบบ static checks

### Near Future (ตามเอกสาร Phase 1 / backlog — ยังไม่ implement ครบ)

- Know-Me sync จาก Notion Identity/Role เข้า runtime (`docs/OPERATOR_PROFILE_AND_KNOW_ME.md`, D3)
- Hard Control เต็มชุด: epistemic + Three-State API + Evidence/Handoff + G0–G5 (`docs/HARD_CONTROL_AND_ANTI_HALLUCINATION.md`, D4)
- Grounded LLM analyze หลังมี Postgres live + Notion verified (D4 foundation / D6)
- Governance v1: compatibility matrix, traceability matrix, decision lifecycle (`docs/GOVERNANCE_V1_BACKLOG.md`)
- Planning → confirm-once → L0–L1 execution (D2/D6) — **นอก MVP Intake**

---

## 3. Mission Intake

### สิ่งที่รองรับแล้ว (MVP v0.1 — มีโค้ด/เทส)

| ความสามารถ | สถานะใน repo |
|---|---|
| **Intake** (web chat-first Mission Commander + REST intakes) | มี UI `/intake`, API `/api/chat`, `/api/intakes*` |
| **Analyze** | rule-based stub (`ANALYZE_PROVIDER=none`); optional provider ถูกเตรียมใน `.env.example` |
| **Understanding / correct / cancel** | มีใน chat flow + intake services + tests |
| **Confirmation** | ต้องมี user session/actor; confirm สร้าง Mission |
| **Readiness / Handling / Mapping gates** | มี implementation + Vitest (`readiness-gate`, `handling-gate`, `mapping-gate`) |
| **Mission Object** | `status=ready` แปลว่า **ready_for_planning**; `planning_status=not_started`; `subtask_ids=[]` |
| **Audit / transitions** | transition commands + audit APIs/tests; ห้ามตรง PATCH status ตามสัญญา/AC |
| **Notion Sync Contract** | schema + service + mock adapter; `mock_synced` แยกจาก verified; real adapter ปฏิเสธ write ใน MVP |
| **Dashboard / Detail / Governance viewer** | `/missions`, `/missions/[id]`, `/governance` (policies seed, read-only) |
| **Idempotency / retry semantics** | มีเทสครอบคลุมส่วนสำคัญของ sync/mapping ตาม Architecture Contract |

### ข้อจำกัดที่ยังมี (ชัดจาก README / code / docs)

- Default persistence คือ **DEV file store** ไม่ใช่ Postgres production
- Default Notion คือ **mock**; ห้ามเคลม `external_verified` จาก mock
- ไม่มี specialist execution / assignment / planning
- Auth เป็น single-operator session แบบง่าย
- Authority Gate มีในเอกสาร/สัญญาณ risk (`authority_approval`) แต่ **ยังไม่มีหลักฐานรองรับ** ว่ามี gate service แยกไฟล์เทียบเท่า Handling/Mapping ที่ enforce ครบทุก path
- E2E/smoke มีสคริปต์/Playwright config แต่ไม่ได้เป็น blocking gate หลักใน CI verify (CI เน้น unit/build/doctor)
- Responsive เป็น requirement + มี smoke spec; การยืนยันครบทุก device ใน CI: **หลักฐานจำกัด**

---

## 4. Quality Pipeline

Pipeline ที่ใช้งานได้จริงในปัจจุบัน:

```text
Developer
    ↓
Cursor (AI coding agent ภายใต้ AGENTS.md)
    ↓
Git (conventional commits, clean tree)
    ↓
GitHub (PR + template + CODEOWNERS ข้อความ)
    ↓
GitHub Actions (Gitleaks → npm ci --include=optional → format/lint/test/build → doctor pr → audit)
    ↓
Doctor (local/pr checks)
    ↓
Merge (มนุษย์; ตัวอย่างที่เกิดแล้ว: PR #5)
```

### อธิบายแต่ละขั้น

1. **Developer** — กำหนด mission ของงานพัฒนา ภายใต้ขอบเขต MVP และ Phase 1 decisions  
2. **Cursor** — ช่วยเขียน/แก้โค้ด แต่ถูกผูกไม่ให้ invent scope, ไม่ deploy production, ต้องอ้างสัญญา  
3. **Git** — เก็บ SSOT ของโค้ด/สคีมา/เอกสารสถาปัตยกรรม  
4. **GitHub** — remote collaboration, PR, Dependabot  
5. **GitHub Actions** — บังคับคุณภาพและ secret scan ก่อนเชื่อถือ branch  
6. **Doctor** — ตรวจความพร้อมของ repo governance/security/tooling ตาม profile  
7. **Merge** — ยังเป็น human authority; ไม่มีหลักฐาน auto-merge/orchestrated release

---

## 5. Current Automation

### เกิดขึ้นแล้ว (อัตโนมัติ)

- CI workflow (secret scan, install+optional native bindings, format, lint, unit tests, build, doctor `pr`, critical audit)
- Dependabot PR generation (npm / actions)
- Doctor report generation (`AIPOS_AUDIT_REPORT.md` — generated/gitignored)
- Deterministic intake analyze stub (ไม่เรียก LLM)
- Mock Notion sync path หลัง confirm
- Unit test suite (9 files / 46 tests ณ เวลาตรวจล่าสุด)

### ยัง Manual (หรือนอก automation หลัก)

- การตัดสินใจ merge / production deploy / ใส่ secrets จริง
- การตั้ง branch protection บน GitHub
- การเปิดใช้ Postgres (`DATABASE_URL` + migrations + `FORCE_POSTGRES`) และ real Notion token/DB
- การรัน Playwright E2E / browser install ใน CI เป็นประจำ: **ยังไม่มีหลักฐานรองรับว่าเป็น required job**
- การ verify ADR ใน Notion governance registry (`verified: true` fields)
- การแตกงาน planning/assignment/execution หลัง Mission `ready`
- Code review เชิงสถาปัตยกรรมโดยมนุษย์/agent นอก checklist

---

## 6. Current Limitations

สิ่งที่ยังไม่มี (หรือมีแค่เอกสาร/โครง ไม่ใช่ runtime ที่ใช้งานได้):

| รายการ | สถานะหลักฐาน |
|---|---|
| Planning Engine | **NOT STARTED** — schema มี `planning_*` แต่สถานะคง `not_started`; ไม่มี engine |
| Assignment / Capability Matching automation | **NOT STARTED** — capabilities seed เป็นข้อมูล; ห้าม auto-route ใน MVP |
| Specialists (Claude/Cursor/n8n/etc. as executors) | นอก scope; ไม่ถูกเรียกใน code paths ของ Intake |
| Execution | **NOT STARTED** |
| Artifact | **NOT STARTED** — ไม่มี artifact service / API / ตาราง |
| Review (ผลงานหลัง execute) | **NOT STARTED** — มีแค่ Intake Confirm ก่อนสร้าง Mission |
| Closeout | **NOT STARTED** — เอกสาร D5 เท่านั้น; ไม่มี API/UI/`completed` mission status |
| Monitoring | **PARTIAL / THIN** — dashboard list + audit + sync badge; ไม่มี health/alerting |
| Runtime Orchestrator (AIPOS เป็นตัวรัน mission ยาว) | Core ทำ intake/gates/audit/sync contract เท่านั้น |
| PostgreSQL Production เป็น default | schema/drizzle พร้อม; runtime default = file store (Phase 2 adapter เป็น opt-in) |
| Real Notion Sync + G5 readback | mock only ใน MVP; real writes disabled; **ทิศทาง App DB → Notion เท่านั้น** |
| n8n Runtime (App Doctor / in-repo MVP) | Doctor may say N/A for **app** MVP — **not** a denial of n8n Mission Intake Pilot production (see PRODUCTION_SOURCE_OF_TRUTH) |
| Full Hard Control G0–G5 + Evidence/Handoff objects | เอกสารครบ; implementation บางส่วนใน intake เท่านั้น |
| In-repo ADR corpus | ADR-005 **present (Proposed)**; ADR-006 **present**; ADR-001 ไฟล์เดิมว่าง |
| Traceability matrix / architecture version graph | backlog ยังไม่ส่งมอบ |
| Multi-tenant / strong auth | single operator assumption |

---

## 7. Roadmap

| ระยะ | สิ่งที่มี/จะเพิ่ม | หลักฐานอ้างอิง |
|---|---|---|
| **n8n Phase 1–2 (production)** | Chat → CONFIRM → Notion verified Mission → Linear parent | `docs/PRODUCTION_SOURCE_OF_TRUTH.md`; `7fLPHiiyt7sre5RR` / `760150d8-…`; smoke MIS-3 / NIT-9 |
| **Current (App repo)** | Governance docs + domain schemas + Mission Intake app + tooling + CI | ประวัติ `main` |
| ↓ | | |
| **App Phase 2** | Postgres runtime adapter (opt-in) + Real Notion verified sync (app path ยังค้าง) + Three-State | D6; PR #8 — **≠** n8n Phase 2 production |
| ↓ | | |
| **Phase 3a (App-DB)** | Planning → Subtasks → Assignment | ADR-005 (**Proposed**); `docs/PHASE_3_*.md` |
| ↓ | | |
| **Phase 3 (n8n Capability Orchestration)** | Decompose → Route → Dispatch; Decomposer first; Router/Dispatcher HELD | ADR-006; `MISSION_DECOMPOSER_CONTRACT.md`; draft `xizHBNDiy9W4RLM4` inactive |
| ↓ | | |
| **Phase 3b+ / Execution** | Execution via n8n adapter + artifacts + review | D2/D6 |
| ↓ | | |
| **Full AIPOS** | Closeout/feedback, specialists at scale, policy CRUD | Phase 1 decisions |

### Traffic lights (do not mark green without code evidence)

| Capability | Traffic light |
|---|---|
| Artifact | **NOT STARTED** |
| Review | **NOT STARTED** |
| Closeout | **NOT STARTED** |
| Monitoring | **PARTIAL / THIN** |
| n8n Mission Intake Phase 1–2 | **PRODUCTION PASS** |
| ADR-006 Router/Dispatcher | **HELD** |

หมายเหตุ: **ห้าม** อ่านเอกสารเก่าแล้วสรุปว่า n8n Phase 2 ยังไม่เสร็จ — App Postgres/ADR-005 ยังไม่ใช่ production default
---

## 8. Overall Assessment

### ระดับโดยรวม

**Level 2 — Governed** (เข้าใกล้ Level 3 บางมิติ)

| Level | ชื่อ | ตรงกับ AIPOS ตอนนี้หรือไม่ |
|---|---|---|
| 1 | Source Controlled | ผ่านแล้ว (GitHub + ประวัติ commit ชัด) |
| **2** | **Governed** | **ตรงที่สุด** — สัญญา, Doctor, CI, agent rules, PR governance |
| 3 | AI Assisted | **บางส่วน** — agent-assisted development แข็ง; AI product runtime ยังเป็น stub |
| 4 | Mission Operating System | **ยังไม่ถึง** — intake/mapping เท่านั้น ไม่มี plan/assign/execute |
| 5 | Autonomous Orchestration | **ยังไม่ถึง** |

### คะแนนรายหมวด (1–10)

| หมวด | คะแนน | เหตุผลสั้นๆ |
|---|---:|---|
| Architecture | **8** | Contract/SoT/status vocabulary ชัดและ enforceable ในเอกสาร; ช่องว่างคือ ADR in-repo ว่างและ semantic rename ยังค้าง |
| Governance | **8** | `AGENTS.md`, Doctor, PR template, CODEOWNERS, Phase 1 locks แข็งแรง; branch protection enforcement ยังไม่พิสูจน์ใน repo |
| Code Quality | **7** | Vitest ครอบ gates/services สำคัญ, prettier/eslint/build ผ่าน; E2E ยังไม่เป็น gate หลัก |
| Automation | **7** | CI ครบและเขียวหลัง oxide fix; Dependabot มี; ยังไม่มี release/deploy/orchestration automation |
| AI Readiness | **6** | พร้อมให้ AI ช่วยพัฒนาภายใต้กฎ; runtime AI analyze/Know-Me/Hard Control ยังไม่ครบ |
| CI/CD | **8** | Actions + gitleaks + doctor + audit + optional native deps; CD/production deploy **ยังไม่มีหลักฐานรองรับ** |
| Mission Readiness | **5** | Intake MVP ใช้งาน local ได้จริง แต่ mock Notion + file store + ไม่มี planning/execution ทำให้ยังไม่พร้อมเป็น operating system |

### จุดแข็ง

- ขอบเขต MVP ถูกเขียนและสะท้อนในโค้ดชัด (ไม่แกล้งมี specialist)
- Three-State / mock vs verified ถูกแยกใน sync path
- ท่อคุณภาพหลัง CI fix พร้อมใช้เป็นเกณฑ์รวมงาน
- เอกสารgovernance หนาและ actionable สำหรับ agents

### จุดอ่อน / ควรพัฒนาต่อ

1. เปิด Postgres + real Notion verified ก่อนขยาย autonomy (ตาม D4 foundation)  
2. เติม Hard Control ที่ยังเป็นเอกสารให้เป็นโค้ด/เทส (โดยเฉพาะ Authority/G5 จริง)  
3. ทำให้ in-repo ADR และ traceability matrix มีของจริง ไม่ชี้ไปไฟล์ว่าง  
4. ยกระดับ E2E/smoke เข้า CI ถ้าต้องการความมั่นใจด้าน UI  
5. พิสูจน์ branch protection บน GitHub ให้ Doctor/`production` profile มีหลักฐาน  
6. อย่าขยายไป Planning/Execution จนกว่า foundation และ verification จะพร้อม

---

## Evidence Snapshot (repository)

| Item | Value |
|---|---|
| Tip commit | `5da6723` — CI Tailwind optional deps fix merged via PR #5 |
| Prior governance CI commit | `1d26531` — repository governance workflow |
| App entry | `apps/web` Next.js Mission Intake |
| Default adapters | `NOTION_ADAPTER=mock`, `ANALYZE_PROVIDER=none`, DEV file store |
| Automated tests observed | 9 files / 46 unit tests passing in verification environment |
| Doctor | READY on `local` / `pr` profiles in verification environment |
| Out of scope confirmed by docs+code | specialists, real subtasks, n8n runtime, production Notion writes |

**Honesty note:** เอกสารนี้เป็นการประเมินความสามารถจาก repository ปัจจุบันเท่านั้น ไม่ใช่ใบรับรอง production readiness และไม่แก้โค้ด/สคีมา/เอกสารเดิมอื่น
