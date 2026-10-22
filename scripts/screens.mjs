// Captures the Devpost gallery screenshots from the live build:
// node scripts/screens.mjs https://hyunsikparker.github.io/satchel/ ../submission/screens
import { chromium } from '@playwright/test'
import { resolve } from 'node:path'

const [url, out] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome' })

const desk = await browser.newPage({ viewport: { width: 1360, height: 960 }, deviceScaleFactor: 2 })
await desk.goto(url)
await desk.evaluate(() => localStorage.clear())
await desk.goto(url)
await desk.screenshot({ path: `${out}/01-workspace.png` })

const preview = desk.locator('.preview-box')
await preview.getByRole('button', { name: 'Start' }).click()
await preview.getByLabel('12').check()
await preview.getByRole('button', { name: 'Check' }).click()
await preview.screenshot({ path: `${out}/02-feedback.png` })

const [download] = await Promise.all([desk.waitForEvent('download'), desk.getByRole('button', { name: /Download the offline file/ }).click()])
const file = resolve(out, 'fractions-practice.html')
await download.saveAs(file)

const offline = await browser.newContext({ offline: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 })
const phone = await offline.newPage()
await phone.goto('file://' + file)
await phone.getByRole('button', { name: 'Larger text' }).click()
await phone.getByRole('button', { name: 'Start' }).click()
await phone.getByRole('button', { name: 'Next question' }).waitFor({ state: 'detached' }).catch(() => {})
await phone.getByLabel('12').check()
await phone.getByRole('button', { name: 'Check' }).click()
await phone.getByRole('button', { name: 'Next question' }).click()
await phone.getByLabel('Your answer').fill('0.5')
await phone.getByRole('button', { name: 'Check' }).click()
await phone.screenshot({ path: `${out}/03-offline-phone.png` })
await offline.close()

const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 760, height: 900 }, deviceScaleFactor: 2 })
const plain = await noJs.newPage()
await plain.goto('file://' + file)
await plain.locator('.sat-all > li').first().locator('summary').click()
await plain.screenshot({ path: `${out}/04-no-script.png` })
await noJs.close()

const print = await browser.newPage({ viewport: { width: 820, height: 1100 }, deviceScaleFactor: 2 })
await print.goto(url)
await print.emulateMedia({ media: 'print' })
await print.screenshot({ path: `${out}/05-paper-copy.png` })
await browser.close()
console.log('saved')
