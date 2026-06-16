/**
 * Intake Schema — the "form recipe" that drives DynamicIntake.
 *
 * A schema describes any multi-step capture form that competitor research
 * surfaces — from a 1-field email gate to a 30-step Noom-style quiz.
 * The Deconstruct agent generates a schema by inspecting the competitor's
 * intake. The Page Assembler injects it into the page config. The
 * DynamicIntake renderer turns it into a working form at runtime.
 *
 * Never edit the shape carelessly — both the writer (Claude in Deconstruct)
 * and the reader (DynamicIntake) depend on it being stable.
 */

// ─── Question types ──────────────────────────────────────────────────────────

export type IntakeQuestionType =
  | 'single_choice'   // radio buttons — pick one
  | 'multi_choice'    // checkboxes — pick many
  | 'text'            // short free text
  | 'textarea'        // long free text
  | 'email'           // email with validation
  | 'phone'           // phone with light formatting
  | 'number'          // numeric input
  | 'date'            // date picker
  | 'scale';          // 1–10 scale

// Conditional branching — skip this step if a prior answer matches.
export type SkipCondition = {
  question_id: string;
  equals?: string | string[];        // exact-match
  not_equals?: string | string[];    // anti-match
};

export type IntakeQuestion = {
  id: string;                        // stable identifier — referenced by skip_if + saved as intake_data key
  type: IntakeQuestionType;
  question: string;                  // the prompt text shown to the visitor
  description?: string;              // optional subtext under the question
  options?: string[];                // for single_choice / multi_choice
  placeholder?: string;              // for text / number / email / phone
  required?: boolean;                // default true
  min?: number;                      // number / scale lower bound
  max?: number;                      // number / scale upper bound
  unit?: string;                     // e.g. "lbs", "years", "miles"
  skip_if?: SkipCondition;           // conditional branching
};

// ─── Capture rules ───────────────────────────────────────────────────────────

// Where the email/name capture happens inside the flow.
// - 'first'  — collected before any quiz questions (cold-traffic-friendly)
// - 'last'   — collected at the end after qualifying
// - number   — collected after step N (e.g. 3 = "email gate after Q3")
export type CapturePosition = 'first' | 'last' | number;

export type IntakeCapture = {
  email_step:  CapturePosition;
  name_step?:  CapturePosition;      // optional; if omitted, captured with email
  phone_required?: boolean;          // ask for phone in a final profile step
};

// ─── End action ──────────────────────────────────────────────────────────────

export type IntakeEndAction =
  | { kind: 'submit'; message?: string }                  // standard form submit
  | { kind: 'calendar_book'; calendly_url?: string }      // hand off to calendar
  | { kind: 'redirect'; url: string };                    // redirect to external

// ─── Full schema ─────────────────────────────────────────────────────────────

export type IntakeSchema = {
  /** Ordered question steps. Length = total quiz length. */
  steps: IntakeQuestion[];

  /** When and how to capture identity (email/name/phone). */
  capture: IntakeCapture;

  /** What happens when the visitor finishes. */
  end: IntakeEndAction;

  /** Visual progress indicator. */
  progress?: {
    show: boolean;
    style?: 'bar' | 'steps' | 'percent';
  };

  /** Provenance + diagnostic info. Never rendered. */
  meta?: {
    inferred_from_url?: string;
    inferred_at?: string;
    notes?: string;
  };
};

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Cheap structural validator. Returns the validated schema or null + reasons.
 * Used at write time (Deconstruct agent) and at read time (Page Assembler).
 */
export function validateIntakeSchema(input: unknown): {
  ok: boolean;
  schema: IntakeSchema | null;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { ok: false, schema: null, errors: ['schema must be an object'] };
  }
  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    errors.push('steps must be a non-empty array');
  }

  if (!obj.capture || typeof obj.capture !== 'object') {
    errors.push('capture is required');
  }

  if (!obj.end || typeof obj.end !== 'object') {
    errors.push('end is required');
  }

  if (errors.length > 0) return { ok: false, schema: null, errors };

  // Validate each step
  const validTypes: IntakeQuestionType[] = [
    'single_choice', 'multi_choice', 'text', 'textarea',
    'email', 'phone', 'number', 'date', 'scale',
  ];

  const ids = new Set<string>();
  for (const [i, raw] of (obj.steps as unknown[]).entries()) {
    if (!raw || typeof raw !== 'object') {
      errors.push(`step[${i}] must be an object`);
      continue;
    }
    const s = raw as Record<string, unknown>;
    if (typeof s.id !== 'string' || !s.id) errors.push(`step[${i}].id required`);
    if (typeof s.question !== 'string' || !s.question) errors.push(`step[${i}].question required`);
    if (typeof s.type !== 'string' || !validTypes.includes(s.type as IntakeQuestionType)) {
      errors.push(`step[${i}].type must be one of ${validTypes.join(', ')}`);
    }
    if ((s.type === 'single_choice' || s.type === 'multi_choice') &&
        (!Array.isArray(s.options) || s.options.length === 0)) {
      errors.push(`step[${i}] of type ${s.type} requires options[]`);
    }
    if (typeof s.id === 'string') {
      if (ids.has(s.id)) errors.push(`step[${i}].id "${s.id}" duplicated`);
      ids.add(s.id);
    }
  }

  if (errors.length > 0) return { ok: false, schema: null, errors };

  return { ok: true, schema: obj as unknown as IntakeSchema, errors: [] };
}

// ─── Defaults ────────────────────────────────────────────────────────────────

/** A safe-default schema used when no intake_pattern is available. */
export const DEFAULT_INTAKE_SCHEMA: IntakeSchema = {
  steps: [
    {
      id: 'email',
      type: 'email',
      question: 'Where should we send your results?',
      placeholder: 'you@example.com',
      required: true,
    },
  ],
  capture: { email_step: 'first' },
  end: { kind: 'submit', message: 'Thanks — keep an eye on your inbox.' },
  progress: { show: false },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Plain-English one-liner for the Blueprint tab. */
export function summarizeIntake(schema: IntakeSchema): string {
  const stepCount = schema.steps.length;
  const captureAt =
    schema.capture.email_step === 'first' ? 'email up front' :
    schema.capture.email_step === 'last'  ? 'email at end' :
    `email at step ${(schema.capture.email_step as number) + 1}`;
  const ending =
    schema.end.kind === 'calendar_book' ? 'calendar booking' :
    schema.end.kind === 'redirect'      ? 'redirect' :
    'submit';
  return `${stepCount}-step quiz, ${captureAt}, ${ending}`;
}
