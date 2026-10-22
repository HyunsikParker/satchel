import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import './runtime.js'
import { parseSet, usable } from './sets'
import { SAMPLE_SETS } from './samples'

describe('answer checking', () => {
  it('accepts the same answer written differently', () => {
    const ok = window.Satchel.isCorrectText
    expect(ok('  One  Half. ', ['1/2', 'one half'])).toBe(true)
    expect(ok('0.5', ['1/2'])).toBe(true)
    expect(ok('.5', ['1/2'])).toBe(true)
    expect(ok('50%', ['0.5'])).toBe(true)
    expect(ok('1 1/2', ['1.5'])).toBe(true)
    expect(ok('1,000', ['1000'])).toBe(true)
    expect(ok('0.51', ['1/2'])).toBe(false)
    expect(ok('', ['1/2'])).toBe(false)
    expect(ok('chlorophyl', ['chlorophyll'])).toBe(false)
  })
})

describe('practice runtime', () => {
  let root: HTMLElement
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="r"></div>'
    root = document.getElementById('r')!
  })

  it('runs a set one question at a time and offers the missed ones again', () => {
    const set = usable(parseSet(SAMPLE_SETS[0].text).set)
    window.Satchel.mount(root, set, { fresh: true })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByText('Question 1 of 5')).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('What is 3/4 of 20?')

    // A check without an answer asks for one.
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('status').textContent).toBe('Choose an answer first.')

    // Wrong choice: the right answer and the explanation appear, and the choices are marked.
    fireEvent.click(screen.getByLabelText('12'))
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('status').textContent).toContain('Not this time. The answer is: 15')
    expect(screen.getByRole('status').textContent).toContain('1/4 of 20 is 5')
    expect(root.querySelector('.is-wrong')?.textContent).toContain('12')
    expect(document.activeElement?.textContent).toBe('Next question')

    // Typed answer in another form is accepted.
    fireEvent.click(screen.getByRole('button', { name: 'Next question' }))
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '0.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('status').textContent).toContain('Right.')

    for (let k = 0; k < 3; k++) {
      fireEvent.click(screen.getByRole('button', { name: /Next question|See my results/ }))
      const form = root.querySelector('form')!
      const radio = form.querySelector('input[type=radio]') as HTMLInputElement | null
      if (radio) fireEvent.click(radio)
      else fireEvent.change(within(form).getByLabelText('Your answer'), { target: { value: '5/8' } })
      fireEvent.click(within(form).getByRole('button', { name: 'Check' }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'See my results' }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('4 of 5 right')
    fireEvent.click(screen.getByRole('button', { name: 'Practise the 1 I missed' }))
    expect(screen.getByText('Question 1 of 1')).toBeTruthy()
  })

  it('shows text from the set as text, never as markup', () => {
    const set = usable(parseSet('1. <img src=x onerror="window.hacked=1">?\nAnswer: <b>x</b>').set)
    window.Satchel.mount(root, set, { fresh: true })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(root.querySelector('img')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('<img src=x onerror="window.hacked=1">?')
  })

  it('remembers reading settings on the device', () => {
    const set = usable(parseSet(SAMPLE_SETS[1].text).set)
    window.Satchel.mount(root, set, { fresh: true })
    fireEvent.click(screen.getByRole('button', { name: 'Larger text' }))
    expect(root.className).toContain('sat-large')
    window.Satchel.mount(root, set, {})
    expect(root.className).toContain('sat-large')
  })
})
