import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import './runtime.js'
import { parseSet, usable } from './sets'

const set = usable(parseSet('# Quick practice\n1. One half as a decimal?\nAnswer: .5\nHint: Divide one by two.\nWhy: One divided by two is 0.5.\n2. Pick the even number.\na) 3\nb) 4 *').set)
let root: HTMLElement
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
function finish(first = '5', second = '4') {
  fireEvent.input(screen.getByLabelText('Your answer'), { target: { value: first } })
  click('Show a hint')
  click('Check')
  click('Next question')
  fireEvent.click(screen.getByLabelText(second))
  click('Check')
  click('See my results')
}
function report() {
  fireEvent.click(screen.getByText('View or copy report'))
  return (screen.getByRole('textbox', { name: 'Practice report' }) as HTMLTextAreaElement).value
}
beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<div id="practice"></div>'
  root = document.getElementById('practice')!
  window.Satchel.mount(root, set)
  click('Start')
})
afterEach(() => { vi.restoreAllMocks() })

describe('offline practice reports', () => {
  it('records actual answers, hints and feedback after a mixed attempt', () => {
    finish()
    const text = report()
    expect(text).toContain('This attempt: 1 of 2 right.')
    expect(text).toContain('Your answer: 5\nResult: Not right\nAccepted answer: .5\nHint opened: Yes')
    expect(text).toContain('Your answer: 4\nResult: Right\nAccepted answer: 4\nHint opened: No')
    expect(text).toContain('Explanation: One divided by two is 0.5.')
    expect(text).toContain('this is not a verified grade')
    expect(text).toContain('Nothing was sent to a teacher or uploaded.')
  })
  it('preserves the checked answers and hint use when results are reopened', () => {
    finish()
    const original = report()
    window.Satchel.mount(root, set)
    click('See saved results')
    expect(report()).toBe(original)
  })
  it('reports only the retry questions with their original question numbers', () => {
    finish('.5', '3')
    click('Practise the 1 I missed')
    fireEvent.click(screen.getByLabelText('4'))
    click('Check')
    click('See my results')
    window.Satchel.mount(root, set)
    click('See saved results')
    const text = report()
    expect(text).toContain('This attempt: 1 of 1 right.')
    expect(text).toContain('This is a retry of missed questions, not a new score for the whole set.')
    expect(text).toContain('Question 2: Pick the even number.')
    expect(text).not.toContain('Question 1:')
    expect(text).not.toContain('Your answer: 3')
  })
  it('keeps older saved scores without inventing missing answers', () => {
    finish()
    const key = `satchel:${set.id}`
    const saved = JSON.parse(localStorage.getItem(key)!)
    delete saved.session.answers
    localStorage.setItem(key, JSON.stringify(saved))
    window.Satchel.mount(root, set)
    click('See saved results')
    const text = report()
    expect(text).toContain('This attempt: 1 of 2 right.')
    expect(text.match(/Your answer: Not recorded by the earlier player\./g)).toHaveLength(2)
    expect(text).toContain('Hint opened: Not recorded')
  })
  it('starts a new report when another learner starts over', () => {
    finish()
    click('Start over')
    finish('.5', '3')
    const text = report()
    expect(text).not.toContain('Your answer: 5\n')
    expect(text).toContain('Your answer: .5\n')
    expect(text).toContain('Your answer: 3\n')
  })
  it('still offers a report when browser progress storage fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable') })
    finish()
    expect(report()).toContain('Your answer: 5\n')
  })
  it('opens a selectable report if downloading is unavailable', () => {
    finish()
    Object.defineProperty(window.URL, 'createObjectURL', { value: undefined, configurable: true })
    click('Save practice report (.txt)')
    const field = screen.getByRole('textbox', { name: 'Practice report' }) as HTMLTextAreaElement
    expect(field).toBeVisible()
    expect(field).toHaveFocus()
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe(field.value.length)
    expect(screen.getByText('Your browser could not start the download. Copy the report below instead.')).toBeVisible()
  })
})
