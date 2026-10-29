// Record a checked, captioned offline workflow with fictional questions and answers.
// Usage: node scripts/demo.mjs http://127.0.0.1:4177 OUTPUT_DIRECTORY
import { chromium, expect } from '@playwright/test'
import { mkdirSync, renameSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [url, output] = process.argv.slice(2)
if (!url || !output || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error('Use a local preview URL and an output directory')
const out = resolve(output)
mkdirSync(out, { recursive: true })
const questions = '# Fractions and numbers\n1. Write one half as a decimal.\nAnswer: .5\nHint: Divide one by two.\nWhy: One divided by two is 0.5.\n2. Pick the even number.\na) 3\nb) 4 *\n3. Write one thousand as a number.\nAnswer: 1000\nWhy: One thousand is written as 1000.'
const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', acceptDownloads: true, recordVideo: { dir: out, size: { width: 1280, height: 900 } } })
const page = await context.newPage()
const video = page.video(), started = Date.now(), scenes = [], errors = [], offlineRequests = []
let offline = false, packedBytes = 0, firstReport, retryReport
page.on('pageerror', e => errors.push(e.message))
page.on('request', r => { if (offline && /^https?:/.test(r.url())) offlineRequests.push(r.url()) })
const center = selector => page.locator(selector).first().evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
async function scene(text, action, seconds = 6) {
  const start = (Date.now() - started) / 1000
  await action()
  await page.screenshot({ path: join(out, 'scene-' + String(scenes.length + 1).padStart(2, '0') + '.png') })
  await page.waitForTimeout(seconds * 1000)
  scenes.push({ start, end: (Date.now() - started) / 1000, text })
}
const practicePath = join(out, 'fictional-practice.html')
try {
  await page.goto(url)
  await scene('Satchel packs a practice set into one HTML file. The questions and answers in this demonstration are fictional.', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
  await scene('Write questions in plain text. These three include a typed fraction, a multiple-choice question and a number.', async () => {
    await page.getByLabel('Questions in plain text').fill(questions)
    await expect(page.locator('.status-line')).toContainText('3 questions ready')
    await page.locator('#source').evaluate(el => el.scrollTo({ top: 0 }))
  })
  await scene('A missing answer key blocks download. Correcting the question makes the complete set available again.', async () => {
    await page.getByLabel('Questions in plain text').fill(questions.replace('b) 4 *', 'b) 4'))
    await expect(page.getByRole('button', { name: /Download the offline file/ })).toBeDisabled()
    await expect(page.getByText('Fix the issues above before downloading or printing.')).toBeVisible()
    await center('.pack')
    await page.waitForTimeout(3000)
    await page.getByLabel('Questions in plain text').fill(questions)
    await expect(page.getByRole('button', { name: /Download the offline file/ })).toBeEnabled()
    await center('.pack')
  })
  await scene('Download the actual HTML file. The recording then opens that file with network access disabled in the browser.', async () => {
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: /Download the offline file/ }).click()
    await (await pending).saveAs(practicePath)
    packedBytes = statSync(practicePath).size
    expect(packedBytes).toBeLessThan(60 * 1024)
    await context.setOffline(true)
    offline = true
    await page.goto(pathToFileURL(practicePath).href)
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible()
  })
  await scene('This downloaded set is about ' + Math.round(packedBytes / 1024) + ' KB. It opens directly from a file; no account or installation is needed.', async () => {
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page.getByLabel('Your answer')).toBeVisible()
  })
  await scene('Hints, larger text and high contrast keep the unfinished answer. Here, 5 is deliberately the wrong answer.', async () => {
    await page.getByLabel('Your answer').fill('5')
    await page.getByRole('button', { name: 'Show a hint' }).click()
    await page.getByRole('button', { name: 'Larger text' }).click()
    await page.getByRole('button', { name: 'High contrast' }).click()
    await expect(page.getByLabel('Your answer')).toHaveValue('5')
    await center('#satchel')
  }, 8)
  await scene('Reload the same file and continue at question 1. The unfinished answer is restored in this tested Chrome browser.', async () => {
    await page.reload()
    await expect(page.getByRole('button', { name: 'Continue at question 1', exact: true })).toBeVisible()
    await page.waitForTimeout(2500)
    await page.getByRole('button', { name: 'Continue at question 1', exact: true }).click()
    await expect(page.getByLabel('Your answer')).toHaveValue('5')
  }, 7)
  await scene('Checking shows the right answer and explanation. The other two answers are correct, including 1,000 with a grouping comma.', async () => {
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await expect(page.locator('#satchel')).toContainText('Not this time.')
    await page.waitForTimeout(2500)
    await page.getByRole('button', { name: 'Next question' }).click()
    await page.getByLabel('4', { exact: true }).check()
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: 'Next question' }).click()
    await page.getByLabel('Your answer').fill('1,000')
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await expect(page.locator('#satchel')).toContainText('Right.')
  })
  await scene('The result is 2 of 3 right. Reloading preserves the completed attempt, and the missed question can be practised again.', async () => {
    await page.getByRole('button', { name: 'See my results' }).click()
    await expect(page.locator('#satchel')).toContainText('2 of 3 right')
    await page.reload()
    await page.getByRole('button', { name: 'See saved results' }).click()
    await expect(page.getByRole('button', { name: 'Practise the 1 I missed' })).toBeVisible()
  }, 8)
  await scene('Save a real text report while offline. It records checked answers, explanations and hint use; the copyable view contains the same text.', async () => {
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save practice report (.txt)' }).click()
    const download = await pending
    expect(download.suggestedFilename()).toBe('satchel-practice-report.txt')
    const reportPath = join(out, 'practice-report.txt')
    await download.saveAs(reportPath)
    firstReport = readFileSync(reportPath, 'utf8')
    expect(firstReport).toContain('This attempt: 2 of 3 right.')
    expect(firstReport).toContain('Your answer: 5\nResult: Not right\nAccepted answer: .5\nHint opened: Yes')
    expect(firstReport).toContain('Your answer: 1,000\nResult: Right')
    expect(firstReport).toContain('Explanation: One divided by two is 0.5.')
    await page.getByText('View or copy report', { exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Practice report' })).toHaveValue(firstReport)
    await center('.sat-report')
  }, 10)
  await scene('Retry only the missed question. The answer 1/2 is accepted as equivalent to .5; the retry is labelled separately.', async () => {
    await page.getByRole('button', { name: 'Practise the 1 I missed' }).click()
    await page.getByLabel('Your answer').fill('1/2')
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: 'Check', exact: true }).click()
    await page.getByRole('button', { name: 'See my results' }).click()
    await expect(page.locator('#satchel')).toContainText('1 of 1 right')
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save practice report (.txt)' }).click()
    const reportPath = join(out, 'retry-report.txt')
    await (await pending).saveAs(reportPath)
    retryReport = readFileSync(reportPath, 'utf8')
    expect(retryReport).toContain('retry of missed questions, not a new score for the whole set')
    expect(retryReport).toContain('Your answer: 1/2')
    expect(retryReport).not.toContain('Question 2:')
    expect(retryReport).not.toContain('Question 3:')
    await center('#satchel')
  }, 8)
  await scene('A report can be saved or copied for the learner to share. Nothing is handed in automatically. These are practice records, not verified grades.', async () => {
    await page.getByText('View or copy report', { exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Practice report' })).toHaveValue(retryReport)
    await center('.sat-report')
  }, 9)
  expect(errors).toEqual([])
  expect(offlineRequests).toEqual([])
} finally {
  await context.close()
  await browser.close()
}
renameSync(await video.path(), join(out, 'demo.webm'))
const stamp = seconds => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23)
writeFileSync(join(out, 'demo.vtt'), 'WEBVTT\n\n' + scenes.map((s, i) => (i + 1) + '\n' + stamp(s.start) + ' --> ' + stamp(s.end) + '\n' + s.text + '\n').join('\n'))
writeFileSync(join(out, 'timeline.json'), JSON.stringify({ recorded_at: new Date().toISOString(), source_url: url, fictional_inputs: true, network_disabled_after_download: true, packed_file_bytes: packedBytes, offline_http_requests: offlineRequests, errors, scenes, wall_duration_s: (Date.now() - started) / 1000 }, null, 2) + '\n')
console.log(JSON.stringify({ scenes: scenes.length, packed_file_bytes: packedBytes, wall_duration_s: (Date.now() - started) / 1000, out }))
