window.__ModuleLoader__.load({
  id: 'dsh-web-link',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef, useState, useCallback } = React

    const PANEL_ID = 'deepseek-web-link'
    const CHAT_URL = 'https://chat.deepseek.com/'
    const NS = 'deepseek-web-link'
    // Fixed identities keep one guest/session across panel switches and reloads,
    // so the chat login survives. This is only a request to the desktop bridge;
    // the bridge decides and issues the actual partition.
    const PARTITION_KEY = 'deepseek-web-link'

    const DICT = {
      zh: {
        panel: 'DeepSeek 网页版',
        loading: '正在加载原生 DeepSeek 网页版…',
        retry: '重试',
        unsupported: '当前环境不支持内嵌浏览器（需要 DSH 桌面版）。',
        crashed: '内嵌页面已退出，请重试。',
        timeout: '加载超时，请重试。',
        failed: '加载失败',
      },
      en: {
        panel: 'DeepSeek Web',
        loading: 'Loading the native DeepSeek web app…',
        retry: 'Retry',
        unsupported: 'Embedded browser is unavailable here (DSH Desktop required).',
        crashed: 'The embedded page exited. Please retry.',
        timeout: 'Loading timed out. Please retry.',
        failed: 'Load failed',
      },
    }

    function EntryIcon({ size }) {
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, style: { display: 'block' },
      },
        h('circle', { cx: 12, cy: 12, r: 9 }),
        h('path', { d: 'M3 12h18M12 3c2.6 2.6 4 5.7 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.7-4-9s1.4-6.4 4-9Z' }),
      )
    }

    const guestStyle = { width: '100%', height: '100%', border: '0', background: 'transparent', display: 'flex' }
    const hostStyle = { position: 'relative', width: '100%', height: '100%', flex: '1', minHeight: 0, display: 'flex' }
    const noticeStyle = {
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
      background: 'var(--dsw-alias-bg-body, transparent)',
      color: 'var(--dsw-alias-label-primary)',
    }
    const buttonStyle = {
      padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14,
      border: '1px solid var(--dsw-alias-border-l2)',
      background: 'var(--dsw-alias-button-ghost-active-fill)',
      color: 'var(--dsw-alias-label-primary)',
    }

    function attached(element) {
      try { return element !== null && element !== undefined && element.isConnected === true }
      catch { return false }
    }

    function loadUrl(element, url) {
      if (!attached(element)) return false
      try {
        const pending = element.loadURL(url)
        if (pending && typeof pending.catch === 'function') pending.catch(function () {})
        return true
      } catch { return false }
    }

    // The panel that hosts the Electron <webview>. Everything is guarded so a
    // dead guest stays inside the panel and never blanks the whole app.
    function ChatPanel({ t }) {
      const hostRef = useRef(null)
      const [failure, setFailure] = useState(undefined)
      const [loading, setLoading] = useState(true)
      const [attempt, setAttempt] = useState(0)

      const retry = useCallback(() => {
        setFailure(undefined)
        setLoading(true)
        setAttempt(function (v) { return v + 1 })
      }, [])

      useEffect(function () {
        const host = hostRef.current
        const bridge = globalThis.dshDesktop && globalThis.dshDesktop.browser
        if (host === null) return
        if (bridge === undefined || bridge === null || typeof bridge.acquire !== 'function') {
          setFailure(t('unsupported'))
          setLoading(false)
          return
        }

        let disposed = false
        let failed = false
        let lease = undefined
        let watchdog = undefined
        let unsubscribeOpen = undefined
        const element = document.createElement('webview')
        Object.assign(element.style, guestStyle)
        element.setAttribute('allowpopups', '')
        // DeepSeek flags the default Electron UA as an "unusual environment"
        // and shows a privacy advisory. Use a normal desktop Chrome UA so the
        // chat page behaves as it does in a regular browser. This only drops
        // the Electron marker; it does not impersonate another browser engine.
        try {
          const cleanUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
          element.setAttribute('useragent', cleanUA)
        } catch (_) { /* UA override is best-effort */ }

        const fail = function (error) {
          if (disposed || failed) return
          failed = true
          try { element.remove() } catch (_) {}
          if (watchdog !== undefined) { clearTimeout(watchdog); watchdog = undefined }
          if (typeof unsubscribeOpen === 'function') {
            try { unsubscribeOpen() } catch (_) {}
          }
          const msg = (error && error.message) || error
          setLoading(false)
          setFailure(msg ? (t('failed') + ': ' + msg) : (error && error.key ? t(error.key) : t('crashed')))
        }

        const onDomReady = function () {
          if (disposed || failed) return
          if (watchdog !== undefined) { clearTimeout(watchdog); watchdog = undefined }
          if (!loadUrl(element, CHAT_URL)) fail({ key: 'crashed' })
          else setLoading(false)
        }
        const onStopLoading = function () {
          if (disposed || failed) return
          setLoading(false)
        }
        const onFailLoad = function (event) {
          if (disposed || failed) return
          if (!event || event.isMainFrame !== true) return
          if (event.errorCode === -3) return // ERR_ABORTED from a superseded navigation
          fail(event.errorDescription || event.errorCode || { key: 'crashed' })
        }
        const onGuestGone = function () { fail({ key: 'crashed' }) }

        const listeners = [
          ['dom-ready', onDomReady],
          ['did-stop-loading', onStopLoading],
          ['did-fail-load', onFailLoad],
          ['render-process-gone', onGuestGone],
          ['destroyed', onGuestGone],
        ]
        let listenersReady = false
        try {
          listeners.forEach(function (pair) {
            element.addEventListener(pair[0], pair[1], pair[0] === 'dom-ready' ? { once: true } : undefined)
          })
          listenersReady = true
        } catch (error) { fail(error) }

        const start = async function () {
          try {
            const reservation = await bridge.acquire(PARTITION_KEY)
            if (disposed || failed) {
              try { Promise.resolve(bridge.release(reservation.lease)).catch(function () {}) } catch (_) {}
              return
            }
            lease = reservation.lease
            // The desktop shell checks these exact bootstrap attributes when it
            // approves the guest attachment. Set them before appending.
            element.setAttribute('name', reservation.lease)
            element.setAttribute('partition', reservation.partition)
            element.setAttribute('src', 'about:blank#' + reservation.lease)
            try {
              unsubscribeOpen = bridge.onOpenRequested(reservation.lease, function (raw) {
                if (disposed || failed || typeof raw !== 'string') return
                try {
                  const u = new URL(raw)
                  if (u.protocol === 'https:' || u.protocol === 'http:') loadUrl(element, raw)
                } catch (_) {}
              })
            } catch (_) {}
            host.appendChild(element)
            watchdog = setTimeout(function () {
              watchdog = undefined
              if (disposed || failed) return
              let url = undefined
              try { url = element.getURL() } catch (_) {}
              if (typeof url !== 'string' || url.length === 0) fail({ key: 'timeout' })
            }, 15000)
          } catch (error) { fail(error) }
        }
        if (listenersReady) void start()

        return function () {
          disposed = true
          if (watchdog !== undefined) { clearTimeout(watchdog); watchdog = undefined }
          if (typeof unsubscribeOpen === 'function') {
            try { unsubscribeOpen() } catch (_) {}
          }
          listeners.forEach(function (pair) {
            try { element.removeEventListener(pair[0], pair[1]) } catch (_) {}
          })
          try { element.remove() } catch (_) {}
          const released = lease
          lease = undefined
          if (released !== undefined) {
            try { Promise.resolve(bridge.release(released)).catch(function () {}) } catch (_) {}
          }
        }
      }, [attempt, t])

      return h('div', { style: hostStyle },
        h('div', { ref: hostRef, style: guestStyle }),
        (loading || failure) && h('div', { style: noticeStyle },
          failure
            ? h('div', {},
                h('div', { style: { marginBottom: 8 } }, failure),
                h('button', { type: 'button', onClick: retry, style: buttonStyle }, t('retry'))
              )
            : h('div', {}, t('loading'))
        )
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICT), 'deepseek-web-link: dictionaries')
        const t = ctx.locale.bind(NS)

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ t }),
        }, ChatPanel))

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 5,
          label: () => t('panel'),
          locale: NS,
        }, function PanelIcon({ size }) {
          return h(EntryIcon, { size })
        }))
      },
    }
  },
})
