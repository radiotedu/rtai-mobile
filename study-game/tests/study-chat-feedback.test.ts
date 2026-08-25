import { describe, expect, it } from 'vitest'

import { studyChatFailureFeedback } from '../src/chat/StudyChatFeedback'

describe('studyChatFailureFeedback', () => {
  it('explains blocked content without exposing the matched rule', () => {
    expect(studyChatFailureFeedback('CHAT_CONTENT_BLOCKED')).toEqual({
      message: 'That message was not sent because it breaks the room safety rules. Rephrase it without abuse, personal contact details or links.',
      hud: 'MESSAGE BLOCKED',
    })
  })

  it('keeps rate-limit and unknown failures distinct', () => {
    expect(studyChatFailureFeedback('CHAT_RATE_LIMITED')).toEqual({
      message: 'Slow down—you can send again in a moment.',
      hud: 'CHAT COOLDOWN',
    })
    expect(studyChatFailureFeedback('UNKNOWN')).toEqual({
      message: 'Message could not be sent. Please try again.',
      hud: 'MESSAGE NOT SENT',
    })
  })
})
