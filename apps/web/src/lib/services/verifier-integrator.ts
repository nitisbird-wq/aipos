/**
 * Compatibility facade: Verifier → Recovery → Result Integrator.
 * Prefer importing from verifier.ts / recovery.ts / result-integrator.ts directly.
 */
export {
  evaluateHandoffVerification,
  verifyHandoff,
  verifyHandoff as verifyAndIntegrateHandoff,
  type VerificationDecision,
  type VerificationOutcome,
} from "@/lib/services/verifier";
export {
  integrateMissionResults,
  type MissionIntegrationSummary,
} from "@/lib/services/result-integrator";
