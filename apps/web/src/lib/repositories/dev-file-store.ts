import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import type { MissionObject, NotionSyncRecord } from "@/lib/schemas/mission";
import type { AuditEvent, Capability, Policy } from "@/lib/schemas/policy";
import type { Repository } from "./types";

type StoreShape = {
  intakes: Record<string, IntakeMissionBundle>;
  missions: Record<string, MissionObject>;
  notion_sync: Record<string, NotionSyncRecord>;
  audit_events: AuditEvent[];
  policies: Policy[];
  capabilities: Capability[];
};

/**
 * DEVELOPMENT-ONLY persistence adapter.
 * Used when DATABASE_URL is unavailable. Not production architecture.
 * Data lives under apps/web/.data/dev-store.json (gitignored).
 */
export class DevFileRepository implements Repository {
  private static mutationQueues = new Map<string, Promise<void>>();
  readonly adapterName = "dev-file" as const;
  private filePath: string;
  private ready: Promise<void>;

  constructor(baseDir?: string) {
    const root = baseDir ?? path.join(process.cwd(), ".data");
    this.filePath = path.join(root, "dev-store.json");
    this.ready = this.enqueueMutation(() => this.ensureSeeded());
  }

  private async ensureSeeded(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      const policies = await this.loadSeed<Policy[]>("policies.json");
      const capabilities = await this.loadSeed<Capability[]>("capabilities.json");
      const initial: StoreShape = {
        intakes: {},
        missions: {},
        notion_sync: {},
        audit_events: [],
        policies,
        capabilities,
      };
      await this.writeAtomic(initial);
    }
  }

  private async loadSeed<T>(name: string): Promise<T> {
    const candidates = [
      path.resolve(process.cwd(), "../../data/seeds", name),
      path.resolve(process.cwd(), "data/seeds", name),
      path.resolve(process.cwd(), "../data/seeds", name),
      path.resolve(process.cwd(), "../../../data/seeds", name),
    ];
    for (const p of candidates) {
      try {
        const raw = await fs.readFile(p, "utf8");
        return JSON.parse(raw) as T;
      } catch {
        /* try next */
      }
    }
    return [] as T;
  }

  private async read(): Promise<StoreShape> {
    await this.ready;
    const raw = await fs.readFile(this.filePath, "utf8");
    return JSON.parse(raw) as StoreShape;
  }

  private async writeAtomic(store: StoreShape): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporaryPath, JSON.stringify(store, null, 2), "utf8");
      await fs.rename(temporaryPath, this.filePath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  private enqueueMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const previous = DevFileRepository.mutationQueues.get(this.filePath) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(mutation);
    DevFileRepository.mutationQueues.set(
      this.filePath,
      current.then(
        () => undefined,
        () => undefined,
      ),
    );
    return current;
  }

  private async mutate(change: (store: StoreShape) => void): Promise<void> {
    await this.ready;
    await this.enqueueMutation(async () => {
      const raw = await fs.readFile(this.filePath, "utf8");
      const store = JSON.parse(raw) as StoreShape;
      change(store);
      await this.writeAtomic(store);
    });
  }

  async getIntakeById(id: string) {
    const s = await this.read();
    return s.intakes[id] ?? null;
  }

  async getIntakeByIdempotencyKey(key: string) {
    const s = await this.read();
    return Object.values(s.intakes).find((i) => i.idempotency_key === key) ?? null;
  }

  async listIntakes() {
    const s = await this.read();
    return Object.values(s.intakes).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async saveIntake(bundle: IntakeMissionBundle) {
    await this.mutate((store) => {
      store.intakes[bundle.intake_id] = bundle;
    });
  }

  async getMissionById(id: string) {
    const s = await this.read();
    return s.missions[id] ?? null;
  }

  async getMissionByIntakeId(intakeId: string) {
    const s = await this.read();
    return Object.values(s.missions).find((m) => m.source_intake_id === intakeId) ?? null;
  }

  async getMissionByIntakeIdAndVersion(intakeId: string, intakeVersion: string) {
    const s = await this.read();
    return (
      Object.values(s.missions).find(
        (m) => m.source_intake_id === intakeId && m.source_intake_version === intakeVersion,
      ) ?? null
    );
  }

  async listMissions() {
    const s = await this.read();
    return Object.values(s.missions).sort((a, b) =>
      (b.mission_id || "").localeCompare(a.mission_id || ""),
    );
  }

  async saveMission(mission: MissionObject) {
    await this.mutate((store) => {
      store.missions[mission.mission_id] = mission;
    });
  }

  async getNotionSync(missionId: string) {
    const s = await this.read();
    return s.notion_sync[missionId] ?? null;
  }

  async saveNotionSync(record: NotionSyncRecord) {
    await this.mutate((store) => {
      store.notion_sync[record.mission_id] = record;
    });
  }

  async appendAudit(event: AuditEvent) {
    await this.mutate((store) => {
      store.audit_events.push(event);
    });
  }

  async listAudit(filter: { mission_id?: string; intake_id?: string; correlation_id?: string }) {
    const s = await this.read();
    return s.audit_events
      .filter((e) => (filter.mission_id ? e.mission_id === filter.mission_id : true))
      .filter((e) => (filter.intake_id ? e.intake_id === filter.intake_id : true))
      .filter((e) => (filter.correlation_id ? e.correlation_id === filter.correlation_id : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async listPolicies() {
    const s = await this.read();
    return s.policies;
  }

  async listCapabilities() {
    const s = await this.read();
    return s.capabilities;
  }
}
