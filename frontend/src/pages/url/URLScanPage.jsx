import { Info } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import URLChecker from './components/URLChecker'

export default function URLScanPage() {
  return (
    <div className="pt-4 sm:pt-10">
      <PageHeader
        align="center"
        title="URL Phishing Detector"
        description="Paste a suspicious link to check its address, risk patterns, and possible brand impersonation."
      />

      <div className="mx-auto w-full max-w-[900px] pt-2">
        <URLChecker />
      </div>

      <footer className="mx-auto mt-8 max-w-[900px] border-t border-border py-3.5">
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          ScamSense uses AI to identify possible phishing indicators, but results may not be
          100% accurate. When in doubt, verify the link through an official source.
        </p>
      </footer>
    </div>
  )
}
