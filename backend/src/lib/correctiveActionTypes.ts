export const CA_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type CaPriority = (typeof CA_PRIORITIES)[number];

export const CA_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
] as const;
export type CaStatus = (typeof CA_STATUSES)[number];

export const CA_ATTACHMENT_STAGES = [
  'EVIDENCE',
  'RESOLUTION',
  'CLOSURE',
] as const;
export type CaAttachmentStage = (typeof CA_ATTACHMENT_STAGES)[number];

export function isCaPriority(v: unknown): v is CaPriority {
  return (
    typeof v === 'string' && (CA_PRIORITIES as readonly string[]).includes(v)
  );
}
export function isCaStatus(v: unknown): v is CaStatus {
  return typeof v === 'string' && (CA_STATUSES as readonly string[]).includes(v);
}
export function isCaAttachmentStage(v: unknown): v is CaAttachmentStage {
  return (
    typeof v === 'string' &&
    (CA_ATTACHMENT_STAGES as readonly string[]).includes(v)
  );
}
