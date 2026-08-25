(() => {
  'use strict'

  const retryKey = 'radiotedu.study.loader-retry.v1'
  const retryWindowMs = 2 * 60 * 1000
  const firstAttemptTimeoutMs = 14 * 1000
  const retryAttemptTimeoutMs = 8 * 1000

  const readRetryTime = () => {
    try {
      const value = Number(window.sessionStorage.getItem(retryKey))
      return Number.isFinite(value) && value > 0 ? value : 0
    } catch {
      return 0
    }
  }

  const writeRetryTime = (value) => {
    try {
      if (value > 0) window.sessionStorage.setItem(retryKey, String(value))
      else window.sessionStorage.removeItem(retryKey)
    } catch {
      // Social still provides a manual recovery action when storage is denied.
    }
  }

  const isReady = () => {
    const state = document.documentElement.dataset.studyReady
    return Boolean(state && state !== 'loading' && state !== 'recovery')
  }

  const retryTime = readRetryTime()
  const alreadyRetried = retryTime > 0 && Date.now() - retryTime < retryWindowMs
  if (retryTime > 0 && !alreadyRetried) writeRetryTime(0)

  let observer
  const stopWatching = () => {
    window.clearTimeout(timeout)
    observer?.disconnect()
    writeRetryTime(0)
  }

  observer = new MutationObserver(() => {
    if (isReady()) stopWatching()
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-study-ready'] })

  const showRecovery = () => {
    observer.disconnect()
    document.documentElement.dataset.studyReady = 'recovery'
    const boot = document.querySelector('[data-study-boot]')
    const stage = boot?.querySelector('.study-entry-stage')
    if (!boot || !stage) return

    boot.setAttribute('aria-busy', 'false')
    stage.innerHTML = `
      <p class="study-entry-kicker">SOCIAL WORLD · SAFE RECOVERY</p>
      <h1>Social needs a fresh start.</h1>
      <p class="study-entry-copy">The game package did not finish starting. Your account and Gold were not changed.</p>
      <nav class="study-entry-actions" aria-label="Social recovery actions">
        <button class="study-entry-primary" type="button" data-study-recovery-reload><span><strong>Reload Social</strong><small>Download a fresh world package</small></span></button>
        <a class="study-entry-secondary" href="https://radiotedu.com/"><span><strong>RadioTEDU home</strong><small>Leave Social safely</small></span></a>
      </nav>
    `
    stage.querySelector('[data-study-recovery-reload]')?.addEventListener('click', () => {
      writeRetryTime(0)
      const url = new URL('./', document.baseURI)
      url.searchParams.set('study-recovery', String(Date.now()))
      window.location.replace(url.href)
    })
  }

  const recover = () => {
    if (isReady()) {
      stopWatching()
      return
    }
    if (alreadyRetried) {
      showRecovery()
      return
    }

    writeRetryTime(Date.now())
    const url = new URL(window.location.href)
    url.searchParams.set('study-recovery', String(Date.now()))
    window.location.replace(url.href)
  }

  const timeout = window.setTimeout(recover, alreadyRetried ? retryAttemptTimeoutMs : firstAttemptTimeoutMs)
})()
