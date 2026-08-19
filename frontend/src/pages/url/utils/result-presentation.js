// Turns one /api/url/predict payload into the wording, tones and recommended
// action the result card shows.
//
// The backend's fused verdict is the single source of truth. This module only
// maps it — it never recomputes a verdict, never softens one, and never lets
// the AI analyst's own words become the user's instruction. That matters
// because Gemini is a second opinion that can disagree: a link the model
// scores as phishing must still read as dangerous even when Gemini calls it
// safe.
//
// Everything here is derived from fields the backend sends (verdict_level,
// genai_agreement, whitelist_hit, ...), so no layer result is ever invented
// locally. Tones are returned as keys and mapped to classes by the card, which
// keeps this file pure and directly testable.

const LEVELS = new Set(['safe', 'warning', 'danger'])

// Mirrors services/url/url_service.py's genai_agreement(). An unrecognised or
// missing value falls back to 'unknown', whose wording claims nothing about
// which layer decided what.
const AGREEMENTS = new Set([
  'agree',
  'escalated',
  'resolved',
  'noted',
  'disagreed',
  'unavailable',
  'not_decisive',
])

// Agreements where the AI analyst's own reasoning is consistent with (or
// produced) the final verdict, so it can be shown as the main explanation.
const ANALYST_LED = new Set(['agree', 'escalated', 'resolved', 'noted'])

// Agreements where the AI analyst actually moved the verdict.
const ANALYST_DECIDED = new Set(['escalated', 'resolved'])

const ZONE_WORDING = {
  safe: 'In its normal, everyday-link range.',
  uncertain: 'Unclear either way, so we leaned on the AI analyst.',
  phishing: 'In its scam range.',
}

const RISK_WORDING = {
  low: 'Nothing alarming stood out.',
  medium: 'A few things were worth a second look.',
  high: 'Strong warning signs were spotted.',
}

const DISAGREEMENT_NOTE =
  'The AI analyst did not find additional warning signs, but it cannot clear a high-risk ' +
  'model result. ScamSense keeps the safer final verdict.'

const PARTIAL_DISAGREEMENT_NOTE =
  'The AI analyst found fewer warning signs than our risk score did, but it cannot clear a ' +
  'high-risk model result. ScamSense keeps the safer final verdict.'

function levelOf(result) {
  return LEVELS.has(result.verdict_level) ? result.verdict_level : 'warning'
}

function agreementOf(result) {
  if (result.whitelist_hit) return 'not_decisive'
  return AGREEMENTS.has(result.genai_agreement) ? result.genai_agreement : 'unknown'
}

function officialNameOf(result) {
  return typeof result.official_name === 'string' && result.official_name
    ? result.official_name
    : null
}

export function summaryFor(result) {
  const level = levelOf(result)
  const agreement = agreementOf(result)
  const officialName = officialNameOf(result)

  switch (agreement) {
    case 'not_decisive':
      return officialName
        ? `This matches ${officialName}'s official domain, one of the sites we recognise.`
        : 'This is one of the official sites we recognise.'
    case 'disagreed':
      return 'Our risk score flagged this link. The AI analyst did not agree, but it cannot clear a high-risk score, so we kept the safer verdict.'
    case 'unavailable':
      return level === 'safe'
        ? 'The AI analyst was unavailable, so this result comes from our risk score alone.'
        : 'The AI analyst was unavailable, so we kept the safer verdict from our risk score.'
    case 'escalated':
      return result.zone === 'uncertain'
        ? 'Our risk score was unclear, and the AI analyst spotted warning signs.'
        : 'Our risk score looked normal, but the AI analyst spotted warning signs.'
    case 'resolved':
      return 'Our risk score was unclear, and the AI analyst found nothing alarming.'
    case 'noted':
      return 'Our risk score found nothing alarming, though the AI analyst had a couple of small reservations.'
    case 'agree':
      if (level === 'danger') return 'Our risk score and the AI analyst both flagged this link.'
      if (level === 'warning') return 'Both of our checks had reservations about this link.'
      return 'Neither our risk score nor the AI analyst found anything alarming.'
    default:
      // Unknown layer state: describe the outcome, never the layers.
      return level === 'safe'
        ? 'Our checks did not find anything alarming.'
        : 'Our checks flagged this link, so treat it as unsafe.'
  }
}

export function stepsFor(result) {
  const agreement = agreementOf(result)
  const officialName = officialNameOf(result)
  const genai = result.genai_analysis || {}
  const score = scoreFor(result)

  const officialStep = result.whitelist_hit
    ? {
        title: 'Official site check',
        detail: officialName
          ? `Matches ${officialName}'s official domain, so this check decided the result.`
          : 'Matches an official domain we recognise, so this check decided the result.',
        toneKey: 'safe',
      }
    : {
        title: 'Official site check',
        detail: 'Not one of the official sites we know, so we kept checking.',
        toneKey: 'neutral',
      }

  const scoreStep = result.whitelist_hit
    ? {
        title: 'Risk score',
        detail: `Model risk ${score} out of 100 — the official-domain match had already decided this result.`,
        toneKey: 'neutral',
      }
    : {
        title: 'Risk score',
        detail: ZONE_WORDING[result.zone] || 'Passed on for a closer look.',
        toneKey: toneKeyForZone(result.zone),
      }

  return [officialStep, scoreStep, analystStepFor(result, agreement, genai)]
}

// Kept separate because this is the step most likely to mislead: a "low" AI
// result must never render as a green tick when the final verdict is danger.
function analystStepFor(result, agreement, genai) {
  const title = 'AI analyst review'

  if (agreement === 'not_decisive') {
    return {
      title,
      detail: 'Ran, but the official-domain match had already decided this result.',
      toneKey: 'neutral',
    }
  }
  if (agreement === 'unavailable') {
    return { title, detail: 'Could not complete this check.', toneKey: 'neutral' }
  }
  if (agreement === 'disagreed') {
    return {
      title,
      detail: 'Did not find extra warning signs, but it cannot clear our risk score.',
      toneKey: 'neutral',
    }
  }
  if (agreement === 'unknown') {
    return { title, detail: 'Reviewed this link.', toneKey: 'neutral' }
  }
  if (genai.is_brand_impersonation) {
    return {
      title,
      detail: `Flagged as pretending to be ${genai.target_brand || 'a trusted brand'}.`,
      toneKey: 'danger',
    }
  }
  return {
    title,
    detail: RISK_WORDING[genai.risk_level] || 'The review finished without a clear rating.',
    toneKey: toneKeyForRisk(genai.risk_level),
  }
}

// What the "What our AI analyst found" section says. Raw Gemini reasoning is
// only used when it does not contradict the final verdict; otherwise it moves
// into the collapsed technical details and this explains the disagreement.
export function analystNoteFor(result) {
  const agreement = agreementOf(result)
  const genai = result.genai_analysis || {}
  const reasoning = typeof result.explanation === 'string' ? result.explanation.trim() : ''

  if (ANALYST_LED.has(agreement) && reasoning) {
    return { text: reasoning, isAnalystOpinion: true }
  }

  if (agreement === 'disagreed') {
    return {
      text: genai.risk_level === 'low' ? DISAGREEMENT_NOTE : PARTIAL_DISAGREEMENT_NOTE,
      isAnalystOpinion: false,
    }
  }
  if (agreement === 'unavailable') {
    return {
      text: 'The AI analyst could not complete this check, so ScamSense kept the safer verdict from its other checks.',
      isAnalystOpinion: false,
    }
  }
  if (agreement === 'not_decisive') {
    return {
      text: "The official-domain match decided this result. The AI analyst's own notes are in the technical details below.",
      isAnalystOpinion: false,
    }
  }
  return {
    text: "ScamSense combined its checks to reach the verdict above. The AI analyst's own notes are in the technical details below.",
    isAnalystOpinion: false,
  }
}

// Derived from the fused verdict only. Gemini's advice never reaches this
// block, so a safe-sounding second opinion cannot become the instruction on a
// high-risk result — not even if it arrives in the payload's `advice` field.
export function recommendedActionFor(result) {
  const level = levelOf(result)

  if (level === 'danger') {
    return (
      'Do not open this link or enter personal information. Visit the organisation through ' +
      'its official app or type its official website address yourself.'
    )
  }
  if (level === 'warning') {
    return (
      'Do not enter passwords, card details or personal information on this page. If it ' +
      'claims to be from an organisation you use, open that organisation’s official app ' +
      'or type its website address yourself.'
    )
  }

  const officialName = officialNameOf(result)
  if (result.whitelist_hit) {
    return officialName
      ? `This matches an official ${officialName} domain. If the link came from an unexpected message, you can still open ${officialName} through its official app instead.`
      : 'This matches an official domain we recognise. If the link came from an unexpected message, you can still reach that organisation through its official app instead.'
  }
  return (
    'Nothing alarming stood out, but stay careful: never share passwords or one-time ' +
    'passwords, and type an address yourself if a link arrived unexpectedly.'
  )
}

export function scoreFor(result) {
  const probability = Number(result.probability)
  if (!Number.isFinite(probability)) return 0
  return Math.round(Math.min(Math.max(probability, 0), 1) * 100)
}

// The ring shows the model's own score, which is not the final answer once the
// whitelist and the AI analyst have had their say — so it is labelled as the
// model's, and its accessible name repeats the final verdict.
export function scoreLabelFor() {
  return 'Model risk'
}

export function scoreAriaLabelFor(result) {
  return `Model risk ${scoreFor(result)} out of 100. Final verdict: ${headlineFor(result)}.`
}

export function headlineFor(result) {
  if (typeof result.verdict === 'string' && result.verdict.trim()) return result.verdict.trim()
  return levelOf(result) === 'safe' ? 'Looks safe' : 'Be careful'
}

// Label for the raw Gemini text kept in the collapsed technical details.
export function analystOpinionLabelFor(result) {
  return ANALYST_DECIDED.has(agreementOf(result))
    ? "The AI analyst's own words. This opinion contributed to the final verdict."
    : "The AI analyst's own words. This is a secondary opinion and did not determine the final verdict."
}

export function toneKeyForLevel(level) {
  return LEVELS.has(level) ? level : 'warning'
}

export function toneKeyForZone(zone) {
  if (zone === 'safe') return 'safe'
  if (zone === 'uncertain') return 'warning'
  if (zone === 'phishing') return 'danger'
  return 'neutral'
}

export function toneKeyForRisk(riskLevel) {
  if (riskLevel === 'low') return 'safe'
  if (riskLevel === 'medium') return 'warning'
  if (riskLevel === 'high') return 'danger'
  return 'neutral'
}

export function buildResultPresentation(result) {
  return {
    level: toneKeyForLevel(result.verdict_level),
    agreement: agreementOf(result),
    headline: headlineFor(result),
    summary: summaryFor(result),
    steps: stepsFor(result),
    analystNote: analystNoteFor(result),
    recommendedAction: recommendedActionFor(result),
    analystOpinionLabel: analystOpinionLabelFor(result),
    score: scoreFor(result),
    scoreLabel: scoreLabelFor(result),
    scoreAriaLabel: scoreAriaLabelFor(result),
  }
}
