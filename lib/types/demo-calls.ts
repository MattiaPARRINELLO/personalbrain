export type DemoCallOutcome =
  | "success"
  | "rate_limited"
  | "invalid_json"
  | "invalid_input"
  | "configuration_error"
  | "empty_response"
  | "provider_error"
  | "timeout";

export interface DemoCallSource {
  kind: string;
  title: string;
}

export interface DemoCallEntry {
  id: string;
  createdAt: string;
  requestId: string;
  ip: string;
  forwardedFor: string;
  realIp: string;
  userAgent: string;
  referer: string;
  model: string;
  input: string | null;
  response: string | null;
  error: string | null;
  sources: DemoCallSource[];
  status: number;
  outcome: DemoCallOutcome;
  durationMs: number;
}

export interface DemoCallData {
  calls: DemoCallEntry[];
}
