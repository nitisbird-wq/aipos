import type { IntakeMissionBundle } from "@/lib/schemas/intake";
import type { MissionObject, NotionSyncRecord } from "@/lib/schemas/mission";
import type { AuditEvent, Capability, Policy } from "@/lib/schemas/policy";

/** Atomic mapping persist for confirm (intake + mission + audit + pending notion_sync). */
export type PersistConfirmedMappingInput = {
  bundle: IntakeMissionBundle;
  mission: MissionObject;
  audit: AuditEvent;
  notionSyncPending: NotionSyncRecord;
};

export type PersistConfirmedMappingResult = {
  /** false when an existing mission for this intake+version was returned (idempotent / race). */
  created: boolean;
  mission: MissionObject;
};

export type Repository = {
  /** Adapter identity — never silent about persistence mode. */
  adapterName: "postgres" | "dev-file";
  getIntakeById(id: string): Promise<IntakeMissionBundle | null>;
  getIntakeByIdempotencyKey(key: string): Promise<IntakeMissionBundle | null>;
  listIntakes(): Promise<IntakeMissionBundle[]>;
  saveIntake(bundle: IntakeMissionBundle): Promise<void>;

  getMissionById(id: string): Promise<MissionObject | null>;
  getMissionByIntakeId(intakeId: string): Promise<MissionObject | null>;
  getMissionByIntakeIdAndVersion(
    intakeId: string,
    intakeVersion: string,
  ): Promise<MissionObject | null>;
  listMissions(): Promise<MissionObject[]>;
  saveMission(mission: MissionObject): Promise<void>;

  getNotionSync(missionId: string): Promise<NotionSyncRecord | null>;
  saveNotionSync(record: NotionSyncRecord): Promise<void>;

  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(filter: {
    mission_id?: string;
    intake_id?: string;
    correlation_id?: string;
  }): Promise<AuditEvent[]>;

  listPolicies(): Promise<Policy[]>;
  listCapabilities(): Promise<Capability[]>;

  /**
   * Persist confirm mapping atomically:
   * intake + mission + mapping audit + notion_sync pending row.
   * On unique conflict (intake+version or mission id), returns existing mission
   * without appending a second mapping audit.
   */
  persistConfirmedMapping(
    input: PersistConfirmedMappingInput,
  ): Promise<PersistConfirmedMappingResult>;
};
