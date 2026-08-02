import type { SensitivityFlag } from "@/lib/schemas/intake";

export type RedactionRule = {
  id: string;
  description: string;
  sensitivity_flag?: SensitivityFlag;
  pattern: RegExp;
  replacement: string;
};

export type RedactionHit = {
  rule_id: string;
  description: string;
  sensitivity_flag?: SensitivityFlag;
};

export type RedactionResult = {
  text: string;
  redacted: boolean;
  rules_applied: RedactionHit[];
};

export const REDACTION_RULES: RedactionRule[] = [
  {
    id: "CREDENTIALS_PASSWORD",
    description: "Password / secret material",
    sensitivity_flag: "credentials",
    pattern: /\b(password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*\S+/gi,
    replacement: "[redacted:credentials]",
  },
  {
    id: "CREDENTIALS_BEARER",
    description: "Bearer / auth tokens",
    sensitivity_flag: "credentials",
    pattern: /\b(bearer\s+[a-z0-9\-._~+/]+=*)/gi,
    replacement: "[redacted:credentials]",
  },
  {
    id: "PERSONAL_EMAIL",
    description: "Email addresses",
    sensitivity_flag: "personal_data",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[redacted:personal_data]",
  },
  {
    id: "PERSONAL_PHONE",
    description: "Phone numbers",
    sensitivity_flag: "personal_data",
    pattern: /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g,
    replacement: "[redacted:personal_data]",
  },
  {
    id: "FINANCIAL_CARD",
    description: "Likely payment card numbers",
    sensitivity_flag: "financial",
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
    replacement: "[redacted:financial]",
  },
];

/** Truncation is not sensitivity redaction — used only for log length limits */
export function truncateForLog(value: string, max = 120): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…[truncated]`;
}

/**
 * Apply sensitivity redaction rules. Returns which rules fired.
 * Used for logs, audit display, and external outputs — not owner mission view.
 */
export function redactSensitiveText(value: string): RedactionResult {
  let text = value;
  const rules_applied: RedactionHit[] = [];
  for (const rule of REDACTION_RULES) {
    if (rule.pattern.test(text)) {
      // reset lastIndex for global regex
      rule.pattern.lastIndex = 0;
      text = text.replace(rule.pattern, rule.replacement);
      rules_applied.push({
        rule_id: rule.id,
        description: rule.description,
        sensitivity_flag: rule.sensitivity_flag,
      });
    }
    rule.pattern.lastIndex = 0;
  }
  return {
    text,
    redacted: rules_applied.length > 0,
    rules_applied,
  };
}

/**
 * Owner-facing confirmed request — full text, no unnecessary redaction.
 */
export function ownerVisibleRequest(rawRequest: string): {
  text: string;
  view: "owner";
  redacted: false;
} {
  return { text: rawRequest, view: "owner", redacted: false };
}

/**
 * Audit / log / external view — sensitive values redacted with rule attribution.
 */
export function auditVisibleRequest(rawRequest: string): {
  text: string;
  view: "audit";
  redacted: boolean;
  rules_applied: RedactionHit[];
} {
  const result = redactSensitiveText(rawRequest);
  return {
    text: result.text,
    view: "audit",
    redacted: result.redacted,
    rules_applied: result.rules_applied,
  };
}

/** @deprecated Prefer auditVisibleRequest / ownerVisibleRequest */
export function redactText(value: string, max = 120): string {
  const sensitive = redactSensitiveText(value);
  return truncateForLog(sensitive.text, max);
}

export function redactForAuditDisplay(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if ((k === "raw_request" || k === "raw_request_excerpt") && typeof v === "string") {
      const audited = auditVisibleRequest(v);
      out[k] = audited.text;
      out[`${k}_redaction`] = {
        redacted: audited.redacted,
        rules_applied: audited.rules_applied,
      };
    } else if (/secret|password|token|api_key|authorization/i.test(k) && typeof v === "string") {
      out[k] = "[redacted]";
      out[`${k}_redaction`] = {
        redacted: true,
        rules_applied: [
          {
            rule_id: "FIELD_NAME_SECRET",
            description: "Secret-like field name",
            sensitivity_flag: "credentials",
          },
        ],
      };
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      out[k] = redactForAuditDisplay(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function safeLogContext(ctx: Record<string, unknown>): Record<string, unknown> {
  return redactForAuditDisplay({ ...ctx });
}
