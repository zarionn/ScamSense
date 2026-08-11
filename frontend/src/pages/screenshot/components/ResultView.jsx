import ResultSummary from './ResultSummary'
import WarningSignsSection from './WarningSignsSection'
import DomainAnalysisCard from './DomainAnalysisCard'
import AnswerContextCard from './AnswerContextCard'
import SafetyRecommendationsCard from './SafetyRecommendationsCard'
import AIExplanationCard from './AIExplanationCard'

export default function ResultView({ file, previewUrl, result }) {
  const {
    classifier,
    effective_caution_level: effectiveCautionLevel,
    response_message: responseMessage,
    audit,
    required_actions: requiredActions = [],
    exposure_questions: exposureQuestions = [],
    exposure_answers: answers = {},
    confirmed_exposures: confirmedExposures = [],
    uncertain_exposures: uncertainExposures = [],
    defaulted_exposures: defaultedExposures = [],
  } = result

  const observations = audit?.observations ?? []
  const domainAnalysis = audit?.domain_analysis

  // These mirror each card's own "nothing to show" guard so the grid can decide
  // whether to reserve a column for it at all, rather than rendering an empty
  // cell next to a card that returns null.
  const hasSafetyRecommendations = requiredActions.length > 0
  const hasDomainAnalysis = Boolean(domainAnalysis?.domain_visible)
  const relevantAnswerDimensions = new Set([...confirmedExposures, ...uncertainExposures])
  const hasAnswerContext =
    exposureQuestions.some((q) => relevantAnswerDimensions.has(q.dimension)) ||
    defaultedExposures.includes('general_contact')

  return (
    <div className="space-y-5">
      <ResultSummary
        file={file}
        previewUrl={previewUrl}
        classifier={classifier}
        effectiveCautionLevel={effectiveCautionLevel}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className={hasSafetyRecommendations ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <WarningSignsSection observations={observations} />
        </div>
        {hasSafetyRecommendations && (
          <div className="lg:col-span-5">
            <SafetyRecommendationsCard actions={requiredActions} />
          </div>
        )}

        {hasDomainAnalysis && (
          <div className={hasAnswerContext ? 'lg:col-span-7' : 'lg:col-span-12'}>
            <DomainAnalysisCard domainAnalysis={domainAnalysis} />
          </div>
        )}
        {hasAnswerContext && (
          <div className={hasDomainAnalysis ? 'lg:col-span-5' : 'lg:col-span-12'}>
            <AnswerContextCard
              exposureQuestions={exposureQuestions}
              answers={answers}
              confirmedExposures={confirmedExposures}
              uncertainExposures={uncertainExposures}
              defaultedExposures={defaultedExposures}
            />
          </div>
        )}

        <div className="lg:col-span-12">
          <AIExplanationCard message={responseMessage} />
        </div>
      </div>
    </div>
  )
}
