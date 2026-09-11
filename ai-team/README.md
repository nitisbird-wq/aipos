# ai-team/ — ทีม AI ส่วนตัวของนิธิศ

## นี่คืออะไร

โฟลเดอร์นี้จำลองรูปแบบจากคลิป **"สร้าง AI Agent ด้วย Claude Code | เปลี่ยน Terminal ให้กลายเป็นทีมงานผู้เชี่ยวชาญ"**
และ **"LTD OS — My AI Team"** (Data Kraft Studio) มาปรับใช้กับงานของ พ.ต.ท.นิธิศ: content pipeline,
investment/business research, และงานส่วนตัว/ธุรกิจอื่นที่มีรูปแบบ "รับโจทย์ → หาข้อมูล → ตรวจสอบ → สรุป/เขียน → เผยแพร่"

**สำคัญที่สุด: โฟลเดอร์นี้แยกขาดจากระบบ Mission Intake หลักของ AIPOS โดยเจตนา** ดูหัวข้อ
"ความสัมพันธ์กับ AIPOS หลัก" ด้านล่างก่อนแก้ไขอะไรที่นี่หรือเชื่อมกลับเข้า `apps/web`

---

## เปรียบเทียบ: LTD OS (ในคลิป) vs AIPOS ปัจจุบัน

| มิติ | LTD OS (คลิป/ภาพหน้าจอ) | AIPOS ปัจจุบัน (Nitis Pro) |
|---|---|---|
| ระดับ governance | แทบไม่มี — ผู้ใช้คนเดียว รันด้วย `bypass permissions on`, ทดลองไว | สูงมาก — ADR, Control Tower (ADR-006), gate, SoT boundaries, three-state honesty |
| พื้นผิวการทำงาน | Terminal (Claude Code CLI) + Excalidraw (แผนผัง) + web dashboard เล็กๆ (ติดตาม pipeline) | Next.js app (`apps/web`) + Postgres/Drizzle + Notion sync + n8n (แผน) |
| Orchestrator | Claudy = ตัว Claude Code เอง "route งาน ไม่ทำงานเอง" | ยังไม่มี — Mission Decomposer/routing ถูก "reserve" ไว้ใน ADR-007 (status: Reserved, รออนุมัติ) |
| Specialist agents | มีจริง ทำงานจริง: Minnie (idea card), Reese (research), Chris (critic), Vera (fact audit), Rae (writer), Libby/Indie (librarian) | ยังไม่มี — เป็นแค่แนวคิดที่ระบุไว้ใน ADR-007 ("Capability routing / operator selection") ที่ยัง "ห้าม implement" ตาม stub ปัจจุบัน |
| Knowledge loop | มีจริง: Knowledge Base ~200 insights / 13 theses, "memory feeds back" เข้า Reese ทุกรอบ | มีแค่แนวคิดใน role-map (`nitis-pro-aipos` skill, ROLE 4: "สร้าง Knowledge System") ยังไม่มี implementation จริง |
| Gate ก่อนเข้า memory | Chris + Vera ต้อง "pass" ก่อนเข้า KB, ไม่ผ่านคือ "revise" กลับไป Reese | คล้ายกันในเชิงหลักการ (Control Tower guard matrix, three-state honesty) แต่ใช้กับ Mission object ไม่ใช่ความรู้/insight |
| ขอบเขต/โดเมน | Content creation + investment research ของคนคนเดียว | หลายบทบาท: งานสอบสวน, บังคับบัญชา, ข่าวกรอง, ธุรกิจสหกรณ์, การเรียนรู้, งานเขียน, ระบบ, ครอบครัว, การตัดสินใจ (ดู `nitis-pro-aipos` skill) — กว้างและมี stake สูงกว่ามาก |

**สรุปช่องว่าง (gap) ที่สำคัญที่สุด:** AIPOS มี "สมอง" (role map, governance) ที่ละเอียดกว่า LTD OS มาก
แต่ยังไม่มี "มือ" — ไม่มี specialist subagent ที่ทำงานจริงแบบ Reese/Chris/Vera/Rae และไม่มี knowledge
loop ที่ทำงานจริงแบบ Libby ส่วน LTD OS มี "มือ" ที่ทำงานได้จริงแต่ไม่มี "สมอง" (ไม่มี governance,
ไม่แยกบทบาทผู้ใช้, ไม่มี audit trail)

**ai-team/ คือการเอา "มือ" แบบ LTD OS มาต่อกับ "สมอง" แบบ AIPOS โดยยังไม่แตะระบบที่ถูกล็อกไว้**

---

## ความสัมพันธ์กับ AIPOS หลัก (อ่านก่อนแก้ไข)

- **ไม่ใช่ npm workspace** — `package.json` root มี `workspaces: ["apps/*", "packages/*"]` เท่านั้น
  ดังนั้น `ai-team/` จะไม่ถูกดึงเข้า build/lint/test/CI ของ aipos โดยอัตโนมัติ (ตั้งใจ)
- **ไม่แตะ**: `apps/web`, Control Tower (ADR-006), Notion Mission/Project Registry, n8n production
  workflow (`7fLPHiiyt7sre5RR`), หรือ Phase 1 locked decisions
- **ADR-007 (Capability Orchestration)** สถานะปัจจุบัน = *Reserved, awaiting Human Architecture
  Approval* และระบุชัดว่า "Expanding or implementing Phase 3 router/dispatcher" อยู่นอกขอบเขตของ
  stub ปัจจุบัน — `ai-team/` คือ **ต้นแบบทดลองที่แยกขาด (sandbox)** ไม่ใช่การ implement ADR-007
- **ถ้าในอนาคตอยากดึงแนวคิดจาก `ai-team/` (เช่น orchestrator pattern, knowledge loop) กลับเข้า
  `apps/web` จริง ต้องผ่านกระบวนการอนุมัติ ADR-007 ก่อน** — ห้าม merge เงียบๆ ตามกฎใน `AGENTS.md`
  ("No silent scope expansion", "No changing locked decisions without ADR")
- Root `AGENTS.md` (secrets, scope, ownership) ยังใช้บังคับทั่วทั้ง repo รวมถึงที่นี่ — แต่ gate เฉพาะของ
  Mission Intake (Control Tower, Notion Mission Registry, frozen n8n) ไม่เกี่ยวกับโฟลเดอร์นี้

---

## สถาปัตยกรรม (แม็ปจากทั้ง 2 ไดอะแกรมในภาพ)

```
INPUT (Paint = คุณ, team inbox/ideas/PDFs)
   │
   ▼  task
CLAUDY (= คุณสั่ง Claude Code เองที่ root ของ repo นี้ — orchestrator, "route ไม่ทำงานเอง")
   │
   ├─▶ minnie-idea-cards      → ai-team/research/output/<slug>-idea-card.md
   │
   ├─▶ reese-researcher       → ai-team/research/output/<slug>-research-doc.md
   │        (อ่าน sources.md + knowledge-base/ ที่เกี่ยวข้องก่อนเริ่ม — "memory feeds back")
   │
   ├─▶ chris-critic  ─┐
   ├─▶ vera-fact-auditor ─┴─▶ ต้อง PASS ทั้งคู่ก่อนไปต่อ (ไม่งั้น REVISE กลับ reese-researcher)
   │
   ├─▶ librarian (Libby/Indie) → เขียนเข้า ai-team/knowledge-base/insights/ , theses/ เท่านั้น
   │
   ├─▶ rae-writer             → ai-team/content/library/<slug>/<channel>.md
   │
   └─▶ chris-critic (script review รอบสุดท้าย) → PASS ก่อนอัปเดต pipeline/board.md เป็น Published

STANDALONE (ไม่อยู่ใน pipeline, เรียกใช้ตามต้องการ):
  nick-portfolio-reviewer  — ตรวจพอร์ตแบบ blind
  dale-analytics           — อ่านผล analytics ของ content
```

---

## Roles → Subagents

| ในคลิป | subagent ที่นี่ | ไฟล์ |
|---|---|---|
| Minnie | idea card writer | `.claude/agents/minnie-idea-cards.md` |
| Reese | researcher | `.claude/agents/reese-researcher.md` |
| Chris | critic (research + script review) | `.claude/agents/chris-critic.md` |
| Vera | fact auditor | `.claude/agents/vera-fact-auditor.md` |
| Libby / Indie | librarian (เขียนเข้า KB) | `.claude/agents/librarian.md` |
| Rae | writer | `.claude/agents/rae-writer.md` |
| Nick | blinded portfolio reviewer (standalone) | `.claude/agents/nick-portfolio-reviewer.md` |
| Dale | analytics reader (standalone) | `.claude/agents/dale-analytics.md` |
| Claudy | คือคุณสั่ง Claude Code เองตรงๆ ที่ root repo | ไม่มีไฟล์ — เป็นพฤติกรรม ดู `ai-team/AGENTS.md` |

---

## วิธีใช้งาน

เปิด Claude Code ที่ root ของ `aipos/` แล้วสั่งงานตรงๆ เช่น:

> "ใช้ minnie-idea-cards ทำ idea card จากโน้ตนี้: ..."
> "ให้ reese-researcher ทำ research doc เรื่อง X โดยอ้างอิง ai-team/research/sources.md"
> "หลัง Chris กับ Vera pass แล้ว ให้ librarian สกัด insight เข้า KB แล้วให้ rae-writer เขียน YouTube script"

คุณ (หรือ Claude Code เอง เมื่อสั่งเป็น mission-level) ทำหน้าที่ Claudy — สั่งงานทีละสเตจ หรือสั่งครบ pipeline
รวดเดียวก็ได้ อัปเดตสถานะงานใน `ai-team/pipeline/board.md` เอง

---

## สิ่งที่ยังไม่ทำ (ตั้งใจ, MVP)

- ไม่มี mobile dashboard แบบในภาพ — ใช้ `pipeline/board.md` (ตาราง markdown) แทนไปก่อน
- ไม่มี SEC EDGAR auto-fetch จริง — มีแค่ placeholder ใน `research/sources.md`
- ไม่มี NotebookLM — ใช้ WebSearch/WebFetch ของ Claude Code แทนในเบื้องต้น
- ไม่มีการเชื่อมกลับ apps/web/ADR-007 — ต้องรออนุมัติตามที่เขียนไว้ด้านบน

## Next steps ที่แนะนำ (ตามลำดับ)

1. ลองรัน pipeline เต็มรอบกับหัวข้อจริง 1 เรื่อง (content หรือ research) เพื่อดูว่า handoff ระหว่าง
   agent จริงหรือไม่ ก่อนลงทุนสร้างเครื่องมืออัตโนมัติเพิ่ม (เช่น sec-fetch)
2. ถ้ารูปแบบนี้ใช้ได้ผลจริงหลายรอบ ค่อยพิจารณาเขียนข้อเสนอ (ไม่ใช่ ADR อย่างเป็นทางการ — ต้อง Owner
   เป็นคนเปิด) ว่าจะดึงส่วนไหนกลับเข้า ADR-007 ได้บ้าง
3. อย่าขยาย `ai-team/` ให้กลายเป็น production system เอง (เช่น ต่อ DB จริง, ต่อ Notion จริง) โดยไม่คุย
   กับตัวเองในฐานะ Mission owner ก่อน — จะชนกับกฎ "no silent scope expansion" ใน root `AGENTS.md`
