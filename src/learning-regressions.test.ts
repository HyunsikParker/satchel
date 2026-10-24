import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import './runtime.js'
import { parseSet, usable } from './sets'

const source = '# Quick practice\n1. Write one half as a decimal.\nAnswer: .5\nHint: Divide one by two.\n2. Pick the even number.\na) 3\nb) 4 *\nHint: It divides into two equal whole numbers.'

describe('numeric grading keeps place value and sign', () => {
  it.each([
    ['5', '.5'], ['.5', '5'], ['0', '0.0000000001'],
    ['9007199254740993', '9007199254740992'],
  ])('does not mark %s as the answer %s', (input, answer) => {
    expect(window.Satchel.isCorrectText(input, [answer])).toBe(false)
  })

  it('preserves the negative sign in a mixed number with a zero whole part', () => {
    expect(window.Satchel.isCorrectText('-0 1/2', ['-.5'])).toBe(true)
    expect(window.Satchel.isCorrectText('-0 1/2', ['.5'])).toBe(false)
  })
})

describe('a learner can use support controls and return to a saved session', () => {
  let root: HTMLElement
  const set = usable(parseSet(source).set)
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="practice"></div>'
    root = document.getElementById('practice')!
    window.Satchel.mount(root, set)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  })

  it.each(['Show a hint', 'Larger text', 'High contrast'])(
    'keeps a typed answer when using %s', (name) => {
      fireEvent.input(screen.getByLabelText('Your answer'), { target: { value: '.5' } })
      fireEvent.click(screen.getByRole('button', { name }))
      expect(screen.getByLabelText('Your answer')).toHaveValue('.5')
    },
  )

  it('keeps a selected choice when opening a hint', () => {
    fireEvent.input(screen.getByLabelText('Your answer'), { target: { value: '.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }))
    fireEvent.click(screen.getByLabelText('4'))
    fireEvent.click(screen.getByRole('button', { name: 'Show a hint' }))
    expect(screen.getByLabelText('4')).toBeChecked()
  })

  it('keeps keyboard focus on a reading control after it changes the view', () => {
    const control = screen.getByRole('button', { name: 'Larger text' })
    control.focus()
    fireEvent.click(control)
    expect(screen.getByRole('button', { name: 'Larger text' })).toHaveFocus()
  })

  it('continues at the current question with its draft answer after reopening', () => {
    fireEvent.input(screen.getByLabelText('Your answer'), { target: { value: '.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }))
    fireEvent.click(screen.getByLabelText('4'))
    window.Satchel.mount(root, set)
    fireEvent.click(screen.getByRole('button', { name: 'Continue at question 2' }))
    expect(screen.getByText('Question 2 of 2')).toBeVisible()
    expect(screen.getByLabelText('4')).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2 of 2 right')
  })

  it('keeps a saved session when reading preferences change on the welcome screen', () => {
    fireEvent.input(screen.getByLabelText('Your answer'), { target: { value: '.5' } })
    window.Satchel.mount(root, set)
    fireEvent.click(screen.getByRole('button', { name: 'Larger text' }))
    window.Satchel.mount(root, set)
    fireEvent.click(screen.getByRole('button', { name: 'Continue at question 1' }))
    expect(screen.getByLabelText('Your answer')).toHaveValue('.5')
    expect(root).toHaveClass('sat-large')
  })

  it('starts a clean session for another learner sharing the device', () => {
    fireEvent.input(screen.getByLabelText('Your answer'), { target: { value: '.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    window.Satchel.mount(root, set)
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
    expect(screen.getByLabelText('Your answer')).toHaveValue('')
    expect(screen.getByLabelText('Your answer')).toBeEnabled()
    expect(screen.queryByText('Right.')).not.toBeInTheDocument()
  })

  it('ignores a corrupted saved session without losing reading preferences', () => {
    localStorage.setItem(`satchel:${set.id}`, JSON.stringify({ v: 2, large: true, session: { screen: 'question', order: ['missing'], pos: 900 } }))
    expect(() => window.Satchel.mount(root, set)).not.toThrow()
    expect(screen.getByRole('button', { name: 'Start' })).toBeVisible()
    expect(root).toHaveClass('sat-large')
  })

  it('shows a useful storage failure message while practice remains usable', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable') })
    try {
      fireEvent.input(screen.getByLabelText('Your answer'), { target: { value: '.5' } })
      expect(screen.getByText('Your browser cannot save progress. Keep this file open to finish.')).toBeVisible()
      fireEvent.click(screen.getByRole('button', { name: 'Check' }))
      expect(screen.getByText('Right.')).toBeVisible()
    } finally { storage.mockRestore() }
  })
})

describe('an ambiguous teacher answer key is not silently graded', () => {
  it('reports conflicting marked and written answers', () => {
    const result = parseSet('1. Pick the even number.\na) 3\nb) 4 *\nAnswer: a')
    expect(result.issues.length).toBeGreaterThan(0)
    expect(usable(result.set).questions).toHaveLength(0)
  })

  it('reports option letters out of order instead of binding an answer by the wrong position', () => {
    const result = parseSet('1. Capital of France?\nb) Paris\na) Rome\nAnswer: b')
    expect(result.issues.length).toBeGreaterThan(0)
    expect(usable(result.set).questions).toHaveLength(0)
  })

  it('reports an answer that does not match any choice even when a choice has a star', () => {
    const result = parseSet('1. Capital of France?\na) Paris *\nb) Rome\nAnswer: London')
    expect(result.issues.length).toBeGreaterThan(0)
    expect(usable(result.set).questions).toHaveLength(0)
  })
})
