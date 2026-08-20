import { exchangeStudyTeduCode, verifyStudyAccountSession } from './account/StudyAuthClient'

const status = document.querySelector<HTMLElement>('[data-study-auth-callback-status]')!
const closeButton = document.querySelector<HTMLButtonElement>('[data-study-auth-callback-close]')!
const url = new URL(location.href)
const code = url.searchParams.get('erp_code') || ''
const result = url.searchParams.get('erp_status') || ''

history.replaceState(history.state, '', url.pathname)

function fail(message: string) {
  status.textContent = message
  closeButton.hidden = false
}

function notifyOpener() {
  const message = { type: 'radiotedu:account-login-complete' }
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel('radiotedu-account-auth')
    channel.postMessage(message)
    channel.close()
  }
  if (window.opener && !window.opener.closed) window.opener.postMessage(message, location.origin)
}

closeButton.addEventListener('click', () => window.close())

async function complete() {
  if (result !== 'success' || !code) {
    fail('TEDÜ Log in was cancelled or could not be completed. You can close this window and try again.')
    return
  }
  try {
    await exchangeStudyTeduCode(code)
    const session = await verifyStudyAccountSession()
    if (!session.user?.id) throw new Error('The signed-in account could not be verified.')
    status.textContent = 'Account verified. Returning to Study World…'
    notifyOpener()
    setTimeout(() => window.close(), 250)
  } catch (error) {
    fail(error instanceof Error ? error.message : 'TEDÜ Log in could not be completed.')
  }
}

void complete()
