import {
  KeyRound,
  MessageSquareWarning,
  IdCard,
  Clock,
  ShieldAlert,
  EyeOff,
  Wallet,
  CircleDollarSign,
  Gift,
  CreditCard,
  Link2,
  Fingerprint,
  MonitorSmartphone,
  Paperclip,
  HelpCircle,
} from 'lucide-react'

// Display metadata for the fixed signal_type taxonomy the auditor is constrained to
// (see SignalType in gen_ai.py). Only the title/icon are static — the evidence text
// shown alongside each one always comes from the API response.
export const SIGNAL_META = {
  credential_request: { title: 'Login Details Requested', icon: KeyRound },
  otp_request: { title: 'OTP Request', icon: Fingerprint },
  personal_information_request: { title: 'Personal Information Request', icon: IdCard },
  urgent_account_threat: { title: 'Urgency or Pressure', icon: Clock },
  authority_pressure: { title: 'Authority Pressure', icon: ShieldAlert },
  secrecy_request: { title: 'Secrecy Request', icon: EyeOff },
  payment_request: { title: 'Unusual Payment Request', icon: Wallet },
  upfront_fee_request: { title: 'Upfront Fee Request', icon: CircleDollarSign },
  prize_or_reward_claim: { title: 'Suspicious Reward Claim', icon: Gift },
  unusual_payment_method: { title: 'Unusual Payment Method', icon: CreditCard },
  external_verification_link: { title: 'Suspicious External Link', icon: Link2 },
  impersonation_claim: { title: 'Impersonation', icon: MessageSquareWarning },
  remote_access_request: { title: 'Remote Access Request', icon: MonitorSmartphone },
  attachment_or_download_request: { title: 'Suspicious Attachment', icon: Paperclip },
}

export function getSignalMeta(signalType) {
  return (
    SIGNAL_META[signalType] ?? {
      title: signalType?.replaceAll('_', ' ') || 'Warning Sign',
      icon: HelpCircle,
    }
  )
}

export const EVIDENCE_QUALITY_LABEL = {
  clear: 'Clear evidence',
  partial: 'Partial evidence',
  weak: 'Weak evidence',
}
