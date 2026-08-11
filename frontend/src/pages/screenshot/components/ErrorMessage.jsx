import { AlertTriangle } from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

export default function ErrorMessage({ message, onRetry }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>We couldn't check that screenshot</AlertTitle>
      <AlertDescription>
        {message}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 block font-medium underline underline-offset-2"
          >
            Try again
          </button>
        )}
      </AlertDescription>
    </Alert>
  )
}
