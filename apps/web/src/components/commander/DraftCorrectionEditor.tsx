"use client";

import { useState, type FormEvent } from "react";
import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import type { DraftCorrection } from "@/lib/schemas/draft-correction";

const lines = (value: string) =>
  value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export function DraftCorrectionEditor({
  bundle,
  busy,
  onSave,
  onClose,
}: {
  bundle: IntakeMissionBundle;
  busy: boolean;
  onSave: (patch: DraftCorrection) => Promise<void>;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState(bundle.mission_summary);
  const [outcome, setOutcome] = useState(bundle.desired_outcome);
  const [criteria, setCriteria] = useState(bundle.success_criteria.join("\n"));
  const [constraints, setConstraints] = useState(bundle.constraints.join("\n"));
  const [workstreams, setWorkstreams] = useState(
    bundle.draft_workstreams.map((w) => ({
      id: w.id,
      name: w.name,
      purpose: w.purpose,
      outputs: w.expected_outputs.join("\n"),
    })),
  );
  function update(id: string, key: "name" | "purpose" | "outputs", value: string) {
    setWorkstreams((rows) => rows.map((w) => (w.id === id ? { ...w, [key]: value } : w)));
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    void onSave({
      intake_id: bundle.intake_id,
      expected_updated_at: bundle.updated_at,
      mission_summary: summary,
      desired_outcome: outcome,
      success_criteria: lines(criteria),
      constraints: lines(constraints),
      workstreams: workstreams.map((w) => ({
        id: w.id,
        name: w.name,
        purpose: w.purpose,
        expected_outputs: lines(w.outputs),
      })),
    });
  }
  return (
    <form className="panel mt-4 space-y-3 p-4" onSubmit={submit}>
      <h2 className="text-xl font-bold">แก้ร่างเดิม / Edit existing draft</h2>
      <p>{bundle.intake_id} — บันทึกเท่านั้น ไม่ยืนยัน ไม่ส่ง Linear ไม่เรียก Worker</p>
      <p className="text-sm">
        คงความเสี่ยงและข้ออนุมัติเดิม แผนนี้เป็นร่าง; Blueprint และ routing ต้องตรวจแยกก่อน dispatch
      </p>
      <fieldset disabled={busy} className="space-y-3">
        <div className="field">
          <label htmlFor="edit-summary">สรุปภารกิจ</label>
          <textarea
            id="edit-summary"
            required
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="edit-outcome">ผลลัพธ์ที่ต้องการ</label>
          <textarea
            id="edit-outcome"
            required
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="edit-criteria">เกณฑ์สำเร็จ — หนึ่งข้อต่อบรรทัด</label>
          <textarea
            id="edit-criteria"
            required
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="edit-constraints">ข้อจำกัด — หนึ่งข้อต่อบรรทัด</label>
          <textarea
            id="edit-constraints"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
          />
        </div>
        {workstreams.map((w) => (
          <section key={w.id} className="panel space-y-2 p-3">
            <h3 className="font-bold">{w.id}</h3>
            <div className="field">
              <label htmlFor={`name-${w.id}`}>ชื่องาน</label>
              <input
                id={`name-${w.id}`}
                required
                value={w.name}
                onChange={(e) => update(w.id, "name", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`purpose-${w.id}`}>เป้าหมายงาน</label>
              <textarea
                id={`purpose-${w.id}`}
                required
                value={w.purpose}
                onChange={(e) => update(w.id, "purpose", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`outputs-${w.id}`}>ผลส่งมอบ — หนึ่งข้อต่อบรรทัด</label>
              <textarea
                id={`outputs-${w.id}`}
                required
                value={w.outputs}
                onChange={(e) => update(w.id, "outputs", e.target.value)}
              />
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={workstreams.length <= 1}
              onClick={() => setWorkstreams((rows) => rows.filter((row) => row.id !== w.id))}
            >
              นำ {w.id} ออกจากร่าง
            </button>
          </section>
        ))}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" type="submit" disabled={!workstreams.length}>
            บันทึกการแก้ไขร่าง
          </button>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            ปิดโดยไม่บันทึก
          </button>
        </div>
      </fieldset>
    </form>
  );
}
