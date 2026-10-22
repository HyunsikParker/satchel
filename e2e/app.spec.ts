import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'

function watch(page: Page) {
  const errors: string[] = []
  const requests: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => {
    const url = r.url()
    if (!url.startsWith('http://127.0.0.1:4173') && !url.startsWith('blob:') && !url.startsWith('data:') && !url.startsWith('file:')) requests.push(url)
  })
  return { errors, requests }
}

async function a11y(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()
  if (result.violations.length) console.log(JSON.stringify(result.violations.flatMap((v) => v.nodes.map((n) => ({ id: v.id, t: n.target })))).slice(0, 2000))
  return result.violations.map((v) => v.id)
}

test('teacher writes questions, tries them and packs an offline file', async ({ page }) => {
  const seen = watch(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pack a practice set that works without internet')
  await expect(page.locator('#status-line')).toHaveText('5 questions ready')

  // The preview is the same runtime the students get; try a question by keyboard.
  const preview = page.locator('.preview-box')
  await preview.getByRole('button', { name: 'Start' }).click()
  await expect(preview.getByText('Question 1 of 5')).toBeVisible()
  await expect(preview.getByRole('heading', { level: 3 })).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('ArrowDown') // radio group: moves to and selects the second option
  await page.keyboard.press('Enter')
  await expect(preview.getByRole('status')).toContainText('Right.')

  // Editing the text updates the preview and reports problems in plain words.
  await page.getByRole('button', { name: 'Everyday English words' }).click()
  await expect(page.locator('#status-line')).toHaveText('4 questions ready')
  await page.getByLabel('Questions in plain text').fill('# Quick check\n1. Pick one\na) x\nb) y\n2. Capital of France?\nAnswer: Paris')
  await expect(page.locator('#status-line')).toHaveText('1 question ready · 1 thing to fix')
  await expect(page.locator('.issues')).toHaveText('Question 1 has no right answer marked. Put * after the right option.')

  await page.getByRole('button', { name: 'Photosynthesis (science)' }).click()
  const download = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Download the offline file/ }).click()]).then(([d]) => d)
  expect(download.suggestedFilename()).toBe('how-plants-make-food-practice.html')
  await download.saveAs('test-results/plants-practice.html')
  await expect(page.getByRole('status').filter({ hasText: 'Saved how-plants-make-food-practice.html' })).toBeVisible()

  expect(await a11y(page)).toEqual([])
  expect(seen.errors).toEqual([])
  expect(seen.requests).toEqual([])
})

test('the packed file works offline, by keyboard, and without JavaScript', async ({ browser }) => {
  const file = 'file://' + resolve('test-results/plants-practice.html')
  const context = await browser.newContext({ offline: true })
  const page = await context.newPage()
  const seen = watch(page)
  await page.goto(file)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How plants make food')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByLabel('Carbon dioxide').check()
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByRole('status')).toContainText('Right.')
  await page.getByRole('button', { name: 'Next question' }).click()
  await page.getByLabel('Your answer').fill('Chlorophyll')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('Right.')
  await page.getByRole('button', { name: 'High contrast' }).click()
  await expect(page.locator('#satchel')).toHaveClass(/sat-contrast/)
  expect(await a11y(page)).toEqual([])
  expect(seen.errors).toEqual([])
  expect(seen.requests).toEqual([])
  await context.close()

  const noJs = await browser.newContext({ javaScriptEnabled: false })
  const plain = await noJs.newPage()
  await plain.goto(file)
  await expect(plain.locator('.sat-all > li')).toHaveCount(4)
  await plain.locator('.sat-all > li').first().getByText('Show the answer').click()
  await expect(plain.locator('.sat-all > li').first()).toContainText('Carbon dioxide — Leaves take in carbon dioxide')
  await noJs.close()
})

test('phone width: no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Download the offline file/ })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
