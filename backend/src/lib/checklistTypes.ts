/**
 * Question types for checklist questions. Stored as strings for
 * SQLite portability. Frontend mirrors this list.
 */
export const QUESTION_TYPES = [
  'PASS_FAIL',
  'YES_NO',
  'NUMERIC',
  'TEXT',
  'DROPDOWN',
  'RADIO',
  'CHECKBOX',
  'DATE',
  'PHOTO',
  'REMARKS',
] as const;

/**
 * Question types that carry a list of options in `optionsJson`.
 * DROPDOWN / RADIO are single-select; CHECKBOX is multi-select.
 */
export const OPTION_BASED_QUESTION_TYPES: readonly QuestionType[] = [
  'DROPDOWN',
  'RADIO',
  'CHECKBOX',
];

export type QuestionType = (typeof QUESTION_TYPES)[number];

export function isQuestionType(value: unknown): value is QuestionType {
  return (
    typeof value === 'string' &&
    (QUESTION_TYPES as readonly string[]).includes(value)
  );
}

export const CHECKLIST_VERSION_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
] as const;

export type ChecklistVersionStatus = (typeof CHECKLIST_VERSION_STATUSES)[number];

/**
 * Question types whose PASS/FAIL semantics have a natural "fail"
 * answer that we can detect for safety-critical rules and
 * auto-corrective-action creation. Text / numeric / photo have no
 * inherent pass/fail — pass/fail is decided by the inspector.
 */
export const FAILABLE_QUESTION_TYPES: readonly QuestionType[] = [
  'PASS_FAIL',
  'YES_NO',
];
