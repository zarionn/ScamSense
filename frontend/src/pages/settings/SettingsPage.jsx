import { useId, useState } from 'react'
import { Monitor, Moon, RotateCcw, Sun, Trash2 } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useTheme } from '@/providers/theme-provider'
import PreferenceRow from './components/PreferenceRow'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export default function SettingsPage({
  typingAnimation,
  onTypingAnimationChange,
  guidedSuggestions,
  onGuidedSuggestionsChange,
  reducedMotion,
  onReducedMotionChange,
  onClearAssistantChat,
  onResetSettings,
}) {
  const { theme, setTheme } = useTheme()
  const themeGroupId = useId()
  const [clearChatDone, setClearChatDone] = useState(false)
  const [resetDone, setResetDone] = useState(false)

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4">
      <PageHeader title="Settings" description="Personalise how ScamSense looks and behaves." />

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how ScamSense looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={theme}
            onValueChange={setTheme}
            aria-labelledby={themeGroupId}
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            <span id={themeGroupId} className="sr-only">
              Theme
            </span>
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon
              const selected = theme === option.value
              return (
                <Label
                  key={option.value}
                  htmlFor={`theme-${option.value}`}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 transition-colors ${
                    selected
                      ? 'border-primary bg-accent text-accent-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <RadioGroupItem value={option.value} id={`theme-${option.value}`} />
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="text-sm font-medium">{option.label}</span>
                </Label>
              )
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Assistant preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Assistant Preferences</CardTitle>
          <CardDescription>Frontend presentation only — the Assistant's guidance and Gemini behaviour are unchanged.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <PreferenceRow
            id="pref-typing-animation"
            label="Show typing animation"
            description="Show a brief typing indicator before guided Assistant responses."
            checked={typingAnimation}
            onCheckedChange={onTypingAnimationChange}
          />
          <Separator />
          <PreferenceRow
            id="pref-guided-suggestions"
            label="Show guided suggestions"
            description="Show quick reply options to help guide the conversation."
            checked={guidedSuggestions}
            onCheckedChange={onGuidedSuggestionsChange}
          />
        </CardContent>
      </Card>

      {/* Accessibility */}
      <Card>
        <CardHeader>
          <CardTitle>Accessibility</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferenceRow
            id="pref-reduced-motion"
            label="Reduced Motion"
            description="Reduce non-essential interface animations."
            checked={reducedMotion}
            onCheckedChange={onReducedMotionChange}
          />
        </CardContent>
      </Card>

      {/* Privacy & session */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy &amp; Session</CardTitle>
          <CardDescription>
            Manage what's kept in this browser session. This never affects Screenshot Scan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Clear Assistant Chat</p>
              <p className="text-sm text-muted-foreground">
                Resets the current Assistant conversation. Does not affect Screenshot Scan or any
                detector.
              </p>
            </div>
            <AlertDialog onOpenChange={() => setClearChatDone(false)}>
              <AlertDialogTrigger
                render={
                  <Button variant="outline" className="shrink-0">
                    <Trash2 aria-hidden="true" />
                    Clear Chat
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Assistant chat?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {clearChatDone
                      ? 'The Assistant conversation has been cleared.'
                      : 'This resets the current Assistant conversation back to the welcome message. Screenshot Scan and other detectors are not affected.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{clearChatDone ? 'Close' : 'Cancel'}</AlertDialogCancel>
                  {!clearChatDone && (
                    <AlertDialogAction
                      onClick={() => {
                        onClearAssistantChat()
                        setClearChatDone(true)
                      }}
                    >
                      Clear Chat
                    </AlertDialogAction>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Reset settings */}
      <Card>
        <CardHeader>
          <CardTitle>Reset Settings</CardTitle>
          <CardDescription>
            Restores appearance and Assistant preferences to their defaults. Does not affect
            detector results or any conversation content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog onOpenChange={() => setResetDone(false)}>
            <AlertDialogTrigger
              render={
                <Button variant="outline">
                  <RotateCcw aria-hidden="true" />
                  Reset Settings
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all settings?</AlertDialogTitle>
                <AlertDialogDescription>
                  {resetDone
                    ? 'Settings have been restored to their defaults.'
                    : 'This restores theme, typing animation, guided suggestions, and reduced motion to their defaults. Detector results and conversation content are not affected.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{resetDone ? 'Close' : 'Cancel'}</AlertDialogCancel>
                {!resetDone && (
                  <AlertDialogAction
                    onClick={() => {
                      onResetSettings()
                      setResetDone(true)
                    }}
                  >
                    Reset Settings
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
