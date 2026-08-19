// Deterministic guided-chat flow for the ScamSense Assistant. Gemini is never
// involved in choosing a step, a quick reply, or a detector suggestion — this
// file is the single source of truth for all of that. Gemini is only ever
// used for free-text messages (see AssistantPage.jsx), which never touch
// this state machine.

export const DETECTORS = {
  message: { key: 'message', label: 'Message Scan', available: true },
  url: { key: 'url', label: 'URL Scan', available: false },
  transaction: { key: 'transaction', label: 'Transaction Scan', available: true },
  screenshot: { key: 'screenshot', label: 'Screenshot Scan', available: true },
}

// Every step: assistant text, optional quickReplies (label + next step id),
// optional suggestions (detector keys to show as DetectorSuggestionCards).
export const STEPS = {
  welcome: {
    assistant: "Hi! Tell me what you're worried about and I'll help you figure out what to check.",
    quickReplies: [
      { label: 'Suspicious Message', next: 'message_link' },
      { label: 'Website or URL', next: 'url_opened' },
      { label: 'Transaction', next: 'transaction_sent' },
      { label: 'Screenshot', next: 'screenshot_suggest' },
      { label: "I'm Not Sure", next: 'not_sure' },
    ],
  },

  // ---- MESSAGE ----
  message_link: {
    assistant: 'Does the message contain a link?',
    quickReplies: [
      { label: 'Yes', next: 'message_link_yes' },
      { label: 'No', next: 'message_link_no' },
      { label: "I'm not sure", next: 'message_link_unsure' },
    ],
  },
  message_link_yes: {
    assistant:
      "Since a link is involved, it's worth checking both the message wording and the link itself before doing anything else.",
    suggestions: ['message', 'url'],
  },
  message_link_no: {
    assistant:
      'Got it, no link involved. Message Scan can take a closer look at the wording and warning signs.',
    suggestions: ['message'],
  },
  message_link_unsure: {
    assistant: "That's okay — Message Scan can help you check the message either way.",
    suggestions: ['message'],
  },

  // ---- URL ----
  url_opened: {
    assistant: 'Have you already opened the link?',
    quickReplies: [
      { label: 'Yes', next: 'url_entered_info' },
      { label: 'No', next: 'url_entered_info' },
      { label: "I'm not sure", next: 'url_entered_info' },
    ],
  },
  url_entered_info: {
    assistant: 'Did you enter any login, personal or payment information?',
    quickReplies: [
      { label: 'Yes', next: 'url_entered_yes' },
      { label: 'No', next: 'url_entered_no' },
      { label: "I'm not sure", next: 'url_entered_no' },
    ],
  },
  url_entered_yes: {
    assistant:
      "Since you've entered details, change that password now from a device you trust and keep an eye on the account. URL Scan can help you check the link itself.",
    suggestions: ['url'],
  },
  url_entered_no: {
    assistant:
      'Good, avoid entering anything further on that page. URL Scan can check whether the link is safe before you go any further.',
    suggestions: ['url'],
  },

  // ---- TRANSACTION ----
  transaction_sent: {
    assistant: 'Do you have your bank transcript on hand?',
    quickReplies: [
      { label: 'Yes', next: 'transcript_yes' },
      { label: 'No', next: 'transcript_no' },
      { label: "I'm not sure", next: 'transcript_no' },
    ],
  },
  transcript_yes: {
    assistant:
      "Please upload the transcript file before navigating forward.",
      expectsAttachment: 'transaction',
  },
  transcript_no: {
    assistant:
      "Please go to your mobile bank application to retrieve your bank transcript, then upload it in this chat before moving forward.",
      expectsAttachment: 'transaction',
  
  },

  // ---- SCREENSHOT ----
  // No quickReplies/suggestions here on purpose — attaching an image is the
  // only way forward from this step. AssistantPage's image-attachment
  // handling (not this state machine) produces the follow-up "I've got the
  // screenshot..." message and the Screenshot Scan suggestion card, entirely
  // deterministically, no Gemini call involved.
  screenshot_suggest: {
    assistant: "Sure. Attach the screenshot you'd like to check.",
    expectsAttachment: 'screenshot',
  },

  // ---- NOT SURE ----
  not_sure: {
    assistant: 'What did you receive or experience?',
    quickReplies: [
      { label: 'A message', next: 'message_link' },
      { label: 'A website/link', next: 'url_opened' },
      { label: 'A payment request', next: 'transaction_sent' },
      { label: 'A screenshot', next: 'screenshot_suggest' },
      { label: 'Something else', next: 'something_else' },
    ],
  },
  something_else: {
    assistant:
      "I don't have a specific check for that yet, but feel free to describe it and I'll do my best to help, or pick whichever detector feels closest.",
  },
}

export const WELCOME_STEP_ID = 'welcome'

// Deterministic response whenever the user sends an image attachment, from
// any step — this never goes through Gemini (see "OPTIONAL FREE-TEXT +
// IMAGE" behaviour: attaching an image always short-circuits to this,
// even if text was typed alongside it, so the Assistant never implies it
// looked at the screenshot).
export const IMAGE_ATTACHED_REPLY =
    "I've got the image. What would you like to do?"

export const TRANSACTION_ATTACHED_REPLY =
  "I've got the file. I can prepare it for Transaction Scan so you can review the flagged rows."
