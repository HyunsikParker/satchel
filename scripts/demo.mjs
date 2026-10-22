// Records the narrated walkthrough: node scripts/demo.mjs https://hyunsikparker.github.io/satchel/ OUT_DIR
// then, from the Bounty tools: calibrate.py OUT_DIR/timeline.json --visual 2,5 and compose.py OUT_DIR/timeline.json OUT.mp4
// The narrated numbers are checked against the page as the recording runs; the run stops if one is wrong.
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [url, out] = process.argv.slice(2)
const TTS = '/Volumes/Crucial X9/workstation/Bounty/tts-narration/bin/bounty-tts'
mkdirSync(join(out, 'rec'), { recursive: true })

const expectText = async (page, sel, want) => {
  const got = (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ')
  if (!got.includes(want)) throw new Error(`narration check failed: ${sel} lacks "${want}"`)
}
const box = (page) => page.locator('.preview-box')

const scenes = [
  {
    text: 'Satchel turns practice questions that a teacher types as plain text into one small file that works without internet, on any phone, with a keyboard or a screen reader. This example has five fractions questions, and all five are ready.',
    run: async (page) => {
      await expectText(page, '.status-line', '5 questions ready')
      await page.waitForTimeout(8000)
      await page.locator('#source').evaluate((el) => el.scrollTo({ top: 120, behavior: 'smooth' }))
    },
  },
  {
    text: 'In the preview, the student sees one question at a time, with large targets and no timer. A wrong answer shows the right one, and why.',
    run: async (page) => {
      await box(page).getByRole('button', { name: 'Start' }).click()
      await page.waitForTimeout(3500)
      await box(page).getByLabel('12').check()
      await page.waitForTimeout(900)
      await box(page).getByRole('button', { name: 'Check' }).click()
      await expectText(page, '.preview-box', 'Not this time. The answer is: 15')
    },
  },
  {
    text: 'Typed answers accept any form the teacher allows, so one half counts as right. A hint is there when the student asks for it.',
    run: async (page) => {
      await box(page).getByRole('button', { name: 'Next question' }).click()
      await page.waitForTimeout(800)
      await box(page).getByRole('textbox').pressSequentially('one half', { delay: 90 })
      await box(page).getByRole('button', { name: 'Check' }).click()
      await expectText(page, '.preview-box', 'Right.')
      await page.waitForTimeout(1800)
      await box(page).getByRole('button', { name: 'Next question' }).click()
      await box(page).getByLabel('True').check()
      await box(page).getByRole('button', { name: 'Check' }).click()
      await page.waitForTimeout(1200)
      await box(page).getByRole('button', { name: 'Next question' }).click()
      await page.waitForTimeout(600)
      await box(page).getByRole('button', { name: 'Show a hint' }).click()
    },
  },
  {
    text: 'At the end, the student sees what they missed and can practise just those two again. Larger text and high contrast are remembered on the device.',
    run: async (page) => {
      await box(page).getByLabel('3/5').check()
      await box(page).getByRole('button', { name: 'Check' }).click()
      await box(page).getByRole('button', { name: 'Next question' }).click()
      await box(page).getByRole('textbox').fill('5/8')
      await box(page).getByRole('button', { name: 'Check' }).click()
      await box(page).getByRole('button', { name: 'See my results' }).click()
      await expectText(page, '.preview-box', '3 of 5 right')
      await expectText(page, '.preview-box', 'Practise the 2 I missed')
      await page.waitForTimeout(5000)
      await box(page).getByRole('button', { name: 'Larger text' }).click()
      await page.waitForTimeout(1200)
      await box(page).getByRole('button', { name: 'High contrast' }).click()
    },
  },
  {
    text: 'The teacher downloads one HTML file of about twenty-five kilobytes. It opens from the downloads folder with no data, and if scripts are blocked it still lists every question with its answer. A paper copy prints with the answers on their own page.',
    run: async (page) => {
      await expectText(page, '.pack-actions', '(25 KB)')
      await box(page).getByRole('button', { name: 'High contrast' }).click()
      await box(page).getByRole('button', { name: 'Larger text' }).click()
      await page.locator('.pack').evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      await page.waitForTimeout(1500)
      await page.getByRole('button', { name: /Download the offline file/ }).click()
    },
  },
]

// 1. Narration, one WAV per scene, reused while the scene text is unchanged.
scenes.forEach((s, k) => {
  s.wav = `s${k + 1}.wav`
  const receiptPath = join(out, `s${k + 1}.json`)
  const textPath = join(out, `s${k + 1}.txt`)
  const cached = existsSync(receiptPath) && existsSync(textPath) && readFileSync(textPath, 'utf8') === s.text
  if (!cached) {
    // The runtime logs model loading before the receipt; the receipt is the last top-level JSON object.
    const stdout = execFileSync(TTS, ['--text', s.text, '--output', join(out, s.wav)], { encoding: 'utf8' })
    writeFileSync(receiptPath, stdout.slice(stdout.startsWith('{') ? 0 : stdout.lastIndexOf('\n{') + 1))
    writeFileSync(textPath, s.text)
  }
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'))
  s.duration = receipt.duration_seconds
  if (!(s.duration > 0)) throw new Error(`scene ${k + 1}: no duration in the TTS receipt`)
  console.log(`scene ${k + 1}: ${s.duration}s`)
})

// 2. Record a clean run paced by the narration.
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  bypassCSP: true,
  acceptDownloads: true,
  recordVideo: { dir: join(out, 'rec'), size: { width: 1280, height: 800 } },
})
await context.addInitScript(() => {
  // Repaint a 2-pixel element every frame so the screencast keeps emitting frames on static scenes.
  const tick = () => {
    let el = document.getElementById('__keep_paint')
    if (!el && document.body) {
      el = document.createElement('div')
      el.id = '__keep_paint'
      Object.assign(el.style, { position: 'fixed', right: '0', bottom: '0', width: '2px', height: '2px', pointerEvents: 'none', zIndex: '2147483647' })
      document.body.appendChild(el)
    }
    if (el) el.style.opacity = el.style.opacity === '0.01' ? '0.02' : '0.01'
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
const page = await context.newPage()
const v0 = Date.now()
await page.goto(url)
await page.evaluate(() => localStorage.clear())
await page.goto(url)
await page.locator('.preview-box').waitFor()
await page.addStyleTag({ content: 'html { scroll-behavior: smooth; }' })
await page.waitForTimeout(400)
const t0 = Date.now()
const timeline = { video: 'rec.webm', trim_start_ms: t0 - v0, scenes: [] }
for (const s of scenes) {
  const start = Date.now() - t0
  timeline.scenes.push({ start_ms: start + 400, wav: s.wav, text: s.text, duration_s: s.duration })
  await page.waitForTimeout(400)
  await s.run(page)
  const left = start + 400 + s.duration * 1000 + 600 - (Date.now() - t0)
  if (left > 0) await page.waitForTimeout(left)
}
await page.waitForTimeout(900)
await context.close()
await browser.close()
const webm = readdirSync(join(out, 'rec')).find((f) => f.endsWith('.webm'))
renameSync(join(out, 'rec', webm), join(out, 'rec.webm'))
writeFileSync(join(out, 'timeline.json'), JSON.stringify(timeline, null, 1))
console.log('recorded', ((Date.now() - t0) / 1000).toFixed(1), 's after a', timeline.trim_start_ms, 'ms load', existsSync(join(out, 'rec.webm')) ? '' : '(no video!)')
