import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export default function URLTechDetails({ result }) {
  const genai = result.genai_analysis || {}

  return (
    <Accordion>
      <AccordionItem value="url-technical-details">
        <AccordionTrigger>Technical details</AccordionTrigger>
        <AccordionContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Whitelist hit</dt>
            <dd className="font-mono text-foreground">{String(result.whitelist_hit)}</dd>

            <dt className="text-muted-foreground">ML probability</dt>
            <dd className="font-mono text-foreground">{result.probability.toFixed(4)}</dd>

            <dt className="text-muted-foreground">ML zone</dt>
            <dd className="font-mono text-foreground">{result.zone}</dd>

            <dt className="text-muted-foreground">Final verdict level</dt>
            <dd className="font-mono text-foreground">{result.verdict_level}</dd>

            <dt className="text-muted-foreground">GenAI risk level</dt>
            <dd className="font-mono text-foreground">{genai.risk_level || 'unknown'}</dd>

            <dt className="text-muted-foreground">Brand impersonation</dt>
            <dd className="font-mono text-foreground">
              {String(genai.is_brand_impersonation ?? false)}
            </dd>

            <dt className="text-muted-foreground">Target brand</dt>
            <dd className="break-all font-mono text-foreground">{genai.target_brand ?? 'none'}</dd>

            <dt className="text-muted-foreground">Checked at</dt>
            <dd className="font-mono text-foreground">
              {new Date(result.checked_at).toLocaleString('en-SG')}
            </dd>
          </dl>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
