import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import './runtime.js'
import { parseSet, usable } from './sets'

const lesson = '# Review without losing my place\n1. Half as a decimal?\nAnswer: 0.5\n2. An even number?\na) 3\nb) 4 *'

describe('large numbers typed with thousands separators', () => {
  it.each(['1,000,000', '12,345,678', '-1,234,567.5', '1,234,567,890'])('accepts %s without dropping a separator', (answer) => {
    expect(window.Satchel.isCorrectText(answer, [answer.replace(/,/g, '')])).toBe(true)
    expect(window.Satchel.isCorrectText(answer.replace(/,/g, ''), [answer])).toBe(true)
  })

  it.each(['1,00,000', '1,2345', '1234,567', '1,234,56', '1,234.5,678'])('does not silently repair malformed grouping: %s', (answer) => {
    expect(window.Satchel.isCorrectText(answer, [answer.replace(/,/g, '')])).toBe(false)
  })
})

describe('a practice choice must have a visible, unambiguous answer', () => {
  it.each([
    '1. Pick four.\na) *\nb) 3',
    '1. Pick four.\na) 4 *\nb) 4',
    '1. Pick the phrase.\na) one  half *\nb) one half',
  ])('blocks a broken choice rather than grading identical or empty buttons', (source) => {
    const result = parseSet(source)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(usable(result.set).questions).toHaveLength(0)
  })
})

it('permits deliberately different capitalization in a spelling question', () => {
  expect(parseSet('1. Which word starts with a capital?\na) paris\nb) Paris *').issues).toEqual([])
})

describe('reading all the questions is not a request to erase an attempt', () => {
  const set = usable(parseSet(lesson).set)
  let root: HTMLElement
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="practice"></div>'
    root = document.getElementById('practice')!
    window.Satchel.mount(root, set)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    fireEvent.input(screen.getByLabelText('Your answer'), { target: { value: '.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }))
    fireEvent.click(screen.getByLabelText('4'))
    window.Satchel.mount(root, set)
  })

  it('returns from all questions to the saved draft and keeps the first result', () => {
    fireEvent.click(screen.getByRole('button', { name: 'See all questions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue at question 2' }))
    expect(screen.getByLabelText('4')).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2 of 2 right')
  })

  it('returns from all questions to completed results without starting a new attempt', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Continue at question 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    window.Satchel.mount(root, set)
    fireEvent.click(screen.getByRole('button', { name: 'See all questions' }))
    fireEvent.click(screen.getByRole('button', { name: 'See saved results' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('2 of 2 right')
  })
})
