/**
 * Demo scenario factory.
 *
 * Two categories of scenarios:
 *
 *   - Anomaly scenarios — single event_type from a single source/service,
 *     designed to trip the matching detection rule and surface an alert
 *     within ~1 minute.
 *
 *   - Traffic scenarios — paint healthy or mixed traffic onto the volume
 *     chart for demo "background" and to show non-anomalous flows. Useful
 *     to illustrate that detection rules don't false-trigger on healthy
 *     activity, and to give the AI an interesting baseline.
 *
 * Each scenario builds individual events on demand so callers can fire
 * any count without the factory caring about the total. Distributions
 * are seeded by `index` for repeatability across re-renders.
 */
import { newEventId, utcNowIso8601 } from "@/lib/api/ingest";
import type { SyntheticEvent } from "@/lib/api/ingest";
import { getCustomScenarioSnapshot } from "@/lib/store/custom-scenario";
import type { Severity } from "@/lib/types/api";

export type ScenarioCategory = "anomaly" | "traffic" | "custom";

/**
 * Describes a detection rule this scenario can plausibly trigger.
 *
 * Mirrors the thresholds in `lambdas/detection/handler.py`:
 *   - failed_login_burst:    >= 10 failed_login from one IP / 5 min
 *   - api_error_spike:       >= 10 api_error for one service / 5 min
 *   - payment_failure_burst: >= 5  payment_failed for one service / 5 min
 *
 * `eventRatio` is the fraction of the scenario's fired events that count
 * toward the rule. A pure single-type scenario (e.g. credential stuffing)
 * has ratio 1; a weighted mix has the rule's distribution weight.
 */
export interface TriggerRule {
  readonly ruleName: string;
  readonly threshold: number;
  readonly eventRatio: number;
}

export interface TriggerPrediction {
  readonly ruleName: string;
  readonly expectedCount: number;
  readonly threshold: number;
  /** Minimum scenario count required to (deterministically) trigger this rule. */
  readonly neededCount: number;
  readonly willTrigger: boolean;
}

export interface ScenarioDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: ScenarioCategory;
  /** Primary anomaly type label for UI hints. */
  readonly anomalyType?: string;
  /**
   * Detection rules this scenario can trigger. Empty for pure-traffic
   * scenarios that don't produce anomaly-relevant event types.
   */
  readonly triggers: readonly TriggerRule[];
  readonly defaultCount: number;
  readonly minCount: number;
  readonly maxCount: number;
  readonly buildEvent: (index: number) => SyntheticEvent;
}

export const CUSTOM_SCENARIO_ID = "custom" as const;

/** Predict whether `count` events from this scenario will trigger any detection rule. */
export function predictTriggers(scenario: ScenarioDefinition, count: number): TriggerPrediction[] {
  return scenario.triggers.map((rule) => {
    const expected = Math.floor(count * rule.eventRatio);
    return {
      ruleName: rule.ruleName,
      expectedCount: expected,
      threshold: rule.threshold,
      neededCount: Math.ceil(rule.threshold / rule.eventRatio),
      willTrigger: expected >= rule.threshold,
    };
  });
}

// --- Static lookup tables -----------------------------------------------

const CRED_STUFFING_IP = "198.51.100.42";
const ERROR_SPIKE_SERVICE = "checkout-service";
const ERROR_ENDPOINTS = ["/api/checkout", "/api/orders", "/api/cart", "/api/payments"] as const;
const ERROR_STATUS = [500, 502, 503, 504, 500] as const;
const SUCCESS_API_ENDPOINTS = ["/api/profile", "/api/orders", "/api/cart", "/api/products", "/health"] as const;
const SUCCESS_API_STATUS = [200, 201, 200, 200, 200, 204] as const;
const SUCCESS_SERVICES = ["api-gateway", "checkout-service", "login-service", "payment-service"] as const;
const PAYMENT_REASONS = [
  "card_declined",
  "insufficient_funds",
  "gateway_timeout",
  "fraud_review",
] as const;

// --- Single-type event builders ----------------------------------------

function buildSuccessfulLogin(index: number): SyntheticEvent {
  return {
    event_id: newEventId(),
    timestamp: utcNowIso8601(),
    service: "login-service",
    event_type: "successful_login",
    severity: "info",
    user_id: `user_${1000 + index}`,
    ip_address: `203.0.113.${(index % 250) + 1}`,
    endpoint: "/api/login",
  };
}

function buildFailedLogin(index: number): SyntheticEvent {
  return {
    event_id: newEventId(),
    timestamp: utcNowIso8601(),
    service: "login-service",
    event_type: "failed_login",
    severity: "warning",
    user_id: `victim_${100 + index}`,
    ip_address: CRED_STUFFING_IP,
    endpoint: "/api/login",
  };
}

function buildApiCall(index: number): SyntheticEvent {
  return {
    event_id: newEventId(),
    timestamp: utcNowIso8601(),
    service: SUCCESS_SERVICES[index % SUCCESS_SERVICES.length],
    event_type: "api_call",
    severity: "info",
    endpoint: SUCCESS_API_ENDPOINTS[index % SUCCESS_API_ENDPOINTS.length],
    status_code: SUCCESS_API_STATUS[index % SUCCESS_API_STATUS.length],
  };
}

function buildApiError(index: number): SyntheticEvent {
  return {
    event_id: newEventId(),
    timestamp: utcNowIso8601(),
    service: ERROR_SPIKE_SERVICE,
    event_type: "api_error",
    severity: "error",
    endpoint: ERROR_ENDPOINTS[index % ERROR_ENDPOINTS.length],
    status_code: ERROR_STATUS[index % ERROR_STATUS.length],
    error_message: "Synthetic dashboard-triggered error",
  };
}

function buildPaymentSuccess(index: number): SyntheticEvent {
  return {
    event_id: newEventId(),
    timestamp: utcNowIso8601(),
    service: "payment-service",
    event_type: "payment_success",
    severity: "info",
    user_id: `customer_${500 + index}`,
  };
}

function buildPaymentFailed(index: number): SyntheticEvent {
  const reason = PAYMENT_REASONS[index % PAYMENT_REASONS.length];
  return {
    event_id: newEventId(),
    timestamp: utcNowIso8601(),
    service: "payment-service",
    event_type: "payment_failed",
    severity: "error" satisfies Severity,
    user_id: `customer_${500 + index}`,
    error_message: `Payment failed: ${reason}`,
  };
}

// --- Realistic mix builder ---------------------------------------------

interface WeightedKind {
  readonly weight: number;
  readonly build: (index: number) => SyntheticEvent;
}

const REALISTIC_MIX: ReadonlyArray<WeightedKind> = [
  { weight: 60, build: buildSuccessfulLogin },
  { weight: 10, build: buildFailedLogin },
  { weight: 20, build: buildApiCall },
  { weight: 5, build: buildApiError },
  { weight: 4, build: buildPaymentSuccess },
  { weight: 1, build: buildPaymentFailed },
];

const TOTAL_WEIGHT = REALISTIC_MIX.reduce((sum, kind) => sum + kind.weight, 0);

/**
 * Deterministic-but-varied weighted sampler using a small linear
 * congruential generator seeded by `index`. Avoids `Math.random()` so
 * sequential indices land on stable kinds (helps with debugging without
 * losing the realistic distribution feel).
 */
function buildRealisticMix(index: number): SyntheticEvent {
  const seed = (index * 2654435761) >>> 0;
  const roll = seed % TOTAL_WEIGHT;
  let cursor = 0;
  for (const kind of REALISTIC_MIX) {
    cursor += kind.weight;
    if (roll < cursor) {
      return kind.build(index);
    }
  }
  // Unreachable; satisfies the type checker.
  return REALISTIC_MIX[0].build(index);
}

// --- Scenario registry -------------------------------------------------

// Detection thresholds — must match `lambdas/detection/handler.py`.
const FAILED_LOGIN_THRESHOLD = 10;
const API_ERROR_THRESHOLD = 10;
const PAYMENT_FAILURE_THRESHOLD = 5;

export const SCENARIOS: readonly ScenarioDefinition[] = [
  {
    id: "realistic_traffic",
    title: "Realistic traffic mix",
    description: "Weighted 60/10/20/5/4/1 distribution. At ≥100 events the failed_login share triggers failed_login_burst.",
    category: "traffic",
    triggers: [
      { ruleName: "failed_login_burst", threshold: FAILED_LOGIN_THRESHOLD, eventRatio: 0.1 },
      { ruleName: "api_error_spike", threshold: API_ERROR_THRESHOLD, eventRatio: 0.05 },
      { ruleName: "payment_failure_burst", threshold: PAYMENT_FAILURE_THRESHOLD, eventRatio: 0.01 },
    ],
    defaultCount: 100,
    minCount: 10,
    maxCount: 500,
    buildEvent: buildRealisticMix,
  },
  {
    id: "successful_login_burst",
    title: "Successful login burst",
    description: "Healthy successful_login events from many user IDs. Will not trigger any detection rule.",
    category: "traffic",
    triggers: [],
    defaultCount: 30,
    minCount: 5,
    maxCount: 500,
    buildEvent: buildSuccessfulLogin,
  },
  {
    id: "api_call_burst",
    title: "API call burst",
    description: "Healthy api_call events across services and endpoints. Will not trigger any detection rule.",
    category: "traffic",
    triggers: [],
    defaultCount: 30,
    minCount: 5,
    maxCount: 500,
    buildEvent: buildApiCall,
  },
  {
    id: "payment_success_burst",
    title: "Payment success burst",
    description: "Healthy payment_success events. Will not trigger any detection rule.",
    category: "traffic",
    triggers: [],
    defaultCount: 20,
    minCount: 5,
    maxCount: 500,
    buildEvent: buildPaymentSuccess,
  },
  {
    id: "credential_stuffing",
    title: "Credential stuffing burst",
    description: "Failed logins from a single IP — triggers failed_login_burst at count ≥ 10.",
    category: "anomaly",
    anomalyType: "failed_login_burst",
    triggers: [{ ruleName: "failed_login_burst", threshold: FAILED_LOGIN_THRESHOLD, eventRatio: 1 }],
    defaultCount: 25,
    minCount: 1,
    maxCount: 500,
    buildEvent: buildFailedLogin,
  },
  {
    id: "api_error_spike",
    title: "API error spike",
    description: "api_error events from checkout-service — triggers api_error_spike at count ≥ 10.",
    category: "anomaly",
    anomalyType: "api_error_spike",
    triggers: [{ ruleName: "api_error_spike", threshold: API_ERROR_THRESHOLD, eventRatio: 1 }],
    defaultCount: 30,
    minCount: 1,
    maxCount: 500,
    buildEvent: buildApiError,
  },
  {
    id: "payment_failure_burst",
    title: "Payment failure burst",
    description: "payment_failed events — triggers payment_failure_burst at count ≥ 5.",
    category: "anomaly",
    anomalyType: "payment_failure_burst",
    triggers: [{ ruleName: "payment_failure_burst", threshold: PAYMENT_FAILURE_THRESHOLD, eventRatio: 1 }],
    defaultCount: 20,
    minCount: 1,
    maxCount: 500,
    buildEvent: buildPaymentFailed,
  },
  {
    id: CUSTOM_SCENARIO_ID,
    title: "Custom scenario",
    description: "Define your own event_type, service, severity, and optional fields.",
    category: "custom",
    triggers: [],
    defaultCount: 10,
    minCount: 1,
    maxCount: 500,
    buildEvent: buildCustomEvent,
  },
];

function buildCustomEvent(index: number): SyntheticEvent {
  const config = getCustomScenarioSnapshot();
  const statusCode = config.statusCode.trim() === "" ? undefined : Number(config.statusCode);

  const event: SyntheticEvent = {
    event_id: newEventId(),
    timestamp: utcNowIso8601(),
    service: config.service.trim() || "custom-service",
    event_type: config.eventType,
    severity: config.severity,
  };

  // Optional fields are only attached when non-empty so we honor the
  // wire schema (no empty strings or NaNs going to the ingest API).
  return {
    ...event,
    ...(config.endpoint.trim() ? { endpoint: config.endpoint.trim() } : {}),
    ...(typeof statusCode === "number" && Number.isFinite(statusCode) ? { status_code: statusCode } : {}),
    ...(config.ipAddress.trim() ? { ip_address: config.ipAddress.trim() } : {}),
    ...(config.userId.trim() ? { user_id: `${config.userId.trim()}_${index}` } : {}),
    ...(config.errorMessage.trim() ? { error_message: config.errorMessage.trim() } : {}),
  };
}

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}
