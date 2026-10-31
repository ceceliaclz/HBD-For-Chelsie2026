import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const base = process.argv[2] ?? 'https://ceceliaclz.github.io/HBD-For-Chelsie2026/'
const root = base.endsWith('/') ? base : `${base}/`
const failures = []

function note(name, ok, detail) {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`
  console.log(line)
  if (!ok) failures.push(line)
}

function launchChrome(userDataDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-allow-origins=*',
      `--user-data-dir=${userDataDir}`,
      '--remote-debugging-port=0',
      'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    let buf = ''
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error('Chrome 没有启动'))
    }, 15000)
    proc.stderr.on('data', (chunk) => {
      buf += chunk.toString()
      const match = buf.match(/DevTools listening on ws:\/\/(127\.0\.0\.1:\d+)/)
      if (!match) return
      clearTimeout(timer)
      resolve({ proc, http: `http://${match[1]}` })
    })
    proc.on('exit', (code) => {
      if (code) reject(new Error(`Chrome 退出 ${code}`))
    })
  })
}

async function openPage(http, url) {
  const tab = await fetch(`${http}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }).then((response) => response.json())
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve)
    ws.addEventListener('error', () => reject(new Error('打不开页面调试通道')))
  })
  let nextId = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const done = pending.get(message.id)
    if (!done) return
    pending.delete(message.id)
    if (message.error) done.reject(new Error(message.error.message))
    else done.resolve(message.result)
  })
  function send(method, params = {}) {
    const id = ++nextId
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }
  await send('Runtime.enable')
  await send('Page.enable')
  return {
    close: () => ws.close(),
    eval: async (expression) => {
      const result = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text || '页面脚本失败')
      }
      return result.result.value
    },
  }
}

async function waitFor(page, expression, timeoutMs) {
  const started = Date.now()
  let last = null
  while (Date.now() - started < timeoutMs) {
    last = await page.eval(expression)
    if (last) return last
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return last
}

async function withChrome(run) {
  const dir = await mkdtemp(join(tmpdir(), 'couple-map-qa-'))
  const chrome = await launchChrome(dir)
  try {
    await run(chrome.http)
  } finally {
    chrome.proc.kill()
    await new Promise((resolve) => setTimeout(resolve, 400))
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

const rabbitUrl = `${root}?as=rabbit&qa=${Date.now()}`

await withChrome(async (http) => {
  const page = await openPage(http, rabbitUrl)
  try {
    const opened = await waitFor(page, `(() => {
      const home = document.querySelector('.home-page')
      const text = document.body.innerText || ''
      if (!home || !text.includes('洛杉矶') || !text.includes('2026-10-04')) return null
      const loading = document.querySelector('.app-loading')
      let infinite = false
      for (const sheet of [...document.styleSheets]) {
        let rules = []
        try { rules = [...sheet.cssRules] } catch { continue }
        for (const rule of rules) {
          const selector = rule.selectorText || ''
          if (!selector.split(',').some((part) => part.trim() === '.app-loading')) continue
          const animation = rule.style && (rule.style.animation || '')
          if (animation.includes('infinite')) infinite = true
        }
      }
      const pins = [...document.querySelectorAll('.pin')]
      const hulun = pins.find((pin) => (pin.textContent || '').includes('呼伦贝尔'))
      return {
        text,
        infinite,
        stillLoading: Boolean(loading),
        pinCount: pins.length,
        hulunHasDate: Boolean(hulun && hulun.querySelector('.pin__date')),
        hulunFound: Boolean(hulun),
      }
    })()`, 15000)

    note('兔子链接打开共用地图', Boolean(opened && opened.pinCount >= 12 && !opened.stillLoading), opened ? `${opened.pinCount} 个标记` : '15 秒后仍没有地图')
    note('加载页不再一直闪', Boolean(opened && !opened.infinite))
    const text = opened?.text || ''
    for (const expected of ['2026-10-04', '2026-10-01', '2026-09-25', '2026-05-01', '2025-08-22', '洛杉矶', '拉斯维加斯', '旧金山', '阿鲁沙', '大阪']) {
      note(`能看到 ${expected}`, text.includes(expected))
    }
    note('呼伦贝尔没有编造日期', Boolean(opened?.hulunFound && !opened.hulunHasDate))

    if (!opened) return

    const sheet = await page.eval(`(async () => {
      const name = [...document.querySelectorAll('.pin__name')].find((el) => (el.textContent || '').includes('洛杉矶'))
      if (!name) return { opened: false, value: '', title: '' }
      name.click()
      const started = Date.now()
      let input = null
      while (Date.now() - started < 2000) {
        input = document.querySelector('.place-sheet__date input')
        const title = document.querySelector('.place-sheet h2')
        if (input && title && title.textContent === '洛杉矶') break
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      const title = document.querySelector('.place-sheet h2')
      return {
        opened: Boolean(input),
        value: input ? input.value : '',
        title: title ? title.textContent : '',
      }
    })()`)
    note('洛杉矶日期可以打开且仍是 2026-10-04', sheet.opened && sheet.title === '洛杉矶' && sheet.value === '2026-10-04', `${sheet.title || '没打开'} ${sheet.value}`)

    const photos = await page.eval(`(async () => {
      const input = document.querySelector('.place-sheet input[type=file]')
      if (!input) return { staged: false, reason: '没有相册入口' }
      const data = new DataTransfer()
      data.items.add(new File([Uint8Array.from([1, 2, 3])], 'qa.png', { type: 'image/png' }))
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files').set.call(input, data.files)
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await new Promise((resolve) => setTimeout(resolve, 200))
      const addButton = [...document.querySelectorAll('button.place-sheet__add')].find((el) => (el.textContent || '').includes('确认添加'))
      const preview = document.querySelectorAll('.photo-picks img').length
      const film = document.querySelectorAll('.place-sheet__film img, .place-sheet__pile img').length
      const close = document.querySelector('.place-sheet__close')
      if (close) close.click()
      return {
        staged: preview > 0,
        canConfirm: Boolean(addButton && addButton.disabled === false),
        film,
      }
    })()`)
    note('相册选完可以直接确认添加', photos.staged && photos.canConfirm && photos.film === 0)
  } finally {
    page.close()
  }
})

await withChrome(async (http) => {
  const page = await openPage(http, root)
  try {
    const cover = await waitFor(page, `(() => {
      const panel = document.querySelector('.onboarding-page')
      if (!panel) return null
      const bg = getComputedStyle(panel).backgroundColor
      return { bg, text: document.body.innerText || '' }
    })()`, 10000)
    note('封面是手账纸色', cover?.bg === 'rgb(243, 234, 223)', cover?.bg || '没有封面')
    note('封面文案还在', Boolean(cover?.text.includes('把两个人的远方')))
    note('封面可以选择兔子和啾啾', Boolean(cover?.text.includes('兔子') && cover?.text.includes('啾啾')))
  } finally {
    page.close()
  }
})

if (failures.length) {
  console.log(`\n没通过 ${failures.length} 项`)
  process.exit(1)
}
console.log('\n全部通过')
