// Adapts the backend's exposure-question payload (see exposure_question_payload() /
// resolve_exposure_answers() in gen_ai.py) to and from the official shadcn Questionnaire
// component's data model. The backend format never changes — only this file knows how
// to translate between the two shapes.
//
// Normalized internal question:
// {
//   id, name,                 // stable identifier — the backend's `dimension`
//   type: "single" | "multiple" | "text",
//   prompt,                   // question text
//   description,              // optional real reason this was asked (from triggered_by)
//   required, skippable,
//   options: [{ value, label, description? }],
//   input: { label?, placeholder?, multiline? },
//   condition: { questionId, values } | null,
//   severity,                 // kept for display (badge/indicator), not part of the wizard
// }

import { getSignalMeta } from './observations'

const SEVERITY_ORDER = { critical: 0, high: 1, moderate: 2 }

const OPTION_LABELS = { yes: 'Yes', no: 'No', unsure: 'Not sure' }

function labelForOption(value) {
  return OPTION_LABELS[value] ?? value
}

// The severity badge already says "High"/"Critical"/"Moderate" — repeating that as
// "High severity" body text is redundant. Instead, when the backend supplied real
// evidence for why this question is being asked (`triggered_by`, the visual-auditor
// signal types that led to it), surface that as the description. Questions with no
// triggering signal (e.g. the general_contact baseline probe) get no description at
// all rather than an invented one.
function buildReason(triggeredBy) {
  if (!Array.isArray(triggeredBy) || triggeredBy.length === 0) return undefined
  const titles = [...new Set(triggeredBy.map((signal) => getSignalMeta(signal).title))]
  const label = titles.length > 1 ? 'Detected warning signs' : 'Detected warning sign'
  return `${label}: ${titles.join(', ')}`
}

// The backend only ever sends single-choice questions today (answer_options is always
// ["yes","no","unsure"]). This still branches on shape defensively so a future
// multi-select or freeform question from the backend is handled correctly without
// changing this adapter.
function normalizeQuestion(question) {
  const base = {
    id: question.dimension,
    name: question.dimension,
    prompt: question.question,
    severity: question.severity,
    description: buildReason(question.triggered_by),
    required: question.required ?? true,
    skippable: question.skippable ?? false,
    condition: question.condition ?? null,
  }

  if (Array.isArray(question.answer_options) && question.answer_options.length > 0) {
    return {
      ...base,
      type: question.multiple ? 'multiple' : 'single',
      options: question.answer_options.map((value) => ({
        value,
        label: labelForOption(value),
      })),
    }
  }

  return {
    ...base,
    type: 'text',
    input: { placeholder: 'Type your answer…' },
  }
}

export function toQuestionnaireModel(exposureQuestions) {
  return [...(exposureQuestions ?? [])]
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99))
    .map(normalizeQuestion)
}

// Only questions with no condition, or whose condition is satisfied by the answers
// gathered so far, are visible. Not exercised by today's backend (no question carries
// a `condition`), but keeps hidden questions out of both rendering and submission if a
// future question does.
export function isQuestionVisible(question, answers) {
  if (!question.condition) return true
  const { questionId, values } = question.condition
  const answer = answers[questionId]
  if (answer === undefined) return false
  return Array.isArray(answer) ? answer.some((v) => values.includes(v)) : values.includes(answer)
}

export function visibleQuestions(model, answers) {
  return model.filter((question) => isQuestionVisible(question, answers))
}

// Metadata for the Questionnaire root's `items` prop (shortcuts, required/multiple
// flags, choice values) — the visible JSX (title/description/choices) is rendered
// separately from this same normalized model so both always stay in sync.
export function toQuestionnaireItems(model, answers = {}) {
  return visibleQuestions(model, answers).map((question) => ({
    name: question.name,
    required: question.required,
    multiple: question.type === 'multiple',
    choices: question.type === 'text' ? undefined : question.options.map((o) => ({ value: o.value })),
  }))
}

// Converts a submitted <form>'s FormData back into exactly the shape
// /api/respond expects: { [dimension]: "yes" | "no" | "unsure" }.
// - single-choice  -> formData.get(name)            (scalar string)
// - multiple-choice -> formData.getAll(name)          (string array)
// - text            -> formData.get(name)            (string)
// - a skipped optional question has no entry in FormData at all, so it is
//   simply absent from the result rather than submitted as null.
// - questions hidden by an unmet condition are excluded even if stale FormData
//   somehow contained them.
export function answersFromFormData(formData, model) {
  const answers = {}
  // First pass without condition filtering, so isQuestionVisible can see prior answers.
  const raw = {}
  for (const question of model) {
    if (question.type === 'multiple') {
      const values = formData.getAll(question.name)
      if (values.length > 0) raw[question.name] = values
    } else {
      const value = formData.get(question.name)
      if (value !== null && value !== '') raw[question.name] = value
    }
  }

  for (const question of model) {
    if (!isQuestionVisible(question, raw)) continue
    if (question.name in raw) answers[question.name] = raw[question.name]
  }

  return answers
}
