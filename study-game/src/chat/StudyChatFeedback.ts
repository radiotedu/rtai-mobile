export interface StudyChatFailureFeedback {
  message: string
  hud: string
}

const GENERIC_FAILURE: StudyChatFailureFeedback = Object.freeze({
  message: 'Message could not be sent. Please try again.',
  hud: 'MESSAGE NOT SENT',
})

export function studyChatFailureFeedback(code: string): StudyChatFailureFeedback {
  if (code === 'CHAT_CONTENT_BLOCKED') {
    return {
      message: 'That message was not sent because it breaks the room safety rules. Rephrase it without abuse, personal contact details or links.',
      hud: 'MESSAGE BLOCKED',
    }
  }
  if (code === 'CHAT_RATE_LIMITED') {
    return {
      message: 'Slow down—you can send again in a moment.',
      hud: 'CHAT COOLDOWN',
    }
  }
  return GENERIC_FAILURE
}
