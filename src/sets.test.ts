import { describe, expect, it } from 'vitest'
import { parseSet, usable } from './sets'
import { SAMPLE_SETS } from './samples'

describe('parseSet', () => {
  it('reads the fractions example', () => {
    const { set, issues } = parseSet(SAMPLE_SETS[0].text)
    expect(issues).toEqual([])
    expect(set.title).toBe('Fractions of a number')
    expect(set.intro).toBe('Work out each answer, then check it. There is no time limit.')
    expect(set.questions.map((q) => q.kind)).toEqual(['choice', 'text', 'choice', 'choice', 'text'])
    expect(set.questions[0].options).toEqual([
      { text: '12', correct: false },
      { text: '15', correct: true },
      { text: '18', correct: false },
      { text: '5', correct: false },
    ])
    expect(set.questions[0].hint).toBe('Find 1/4 of 20 first.')
    expect(set.questions[1].answers).toEqual(['1/2', 'one half', 'a half'])
    expect(set.questions[2].options.map((o) => [o.text, o.correct])).toEqual([['True', true], ['False', false]])
  })

  it('reads every example without problems', () => {
    for (const s of SAMPLE_SETS) expect(parseSet(s.text).issues).toEqual([])
  })

  it('accepts other ways of marking answers', () => {
    const { set } = parseSet('Q1. Capital of Kenya?\n(x) Nairobi\n( ) Mombasa\nQ2. Pick the even number\na. 3\nb. 4\nAnswer: b\nQ3: Largest planet?\n- Mars\n- Jupiter (correct)\n4) 2 + 2 =\nAnswer: 4')
    expect(set.questions.map((q) => (q.kind === 'choice' ? q.options.find((o) => o.correct)?.text : q.answers[0]))).toEqual(['Nairobi', '4', 'Jupiter', '4'])
  })

  it('joins a question that runs onto a second line and names lines it cannot read', () => {
    const { set, issues } = parseSet('1. A long question\nthat continues here?\na) yes *\nb) no\n\n2. No answer here\n\nsomething odd')
    expect(set.questions[0].prompt).toBe('A long question that continues here?')
    expect(issues.map((i) => i.message)).toEqual([
      'Line 8 was not understood: "something odd". Start options with a), b) or -, and answers with "Answer:".',
      'Question 2 needs options or an "Answer:" line.',
    ])
    expect(usable(set).questions).toHaveLength(1)
  })

  it('reports a choice question with no right answer', () => {
    const { issues } = parseSet('1. Pick one\na) x\nb) y')
    expect(issues[0].message).toBe('Question 1 has no right answer marked. Put * after the right option.')
  })

  it('gives the same id to the same text', () => {
    expect(parseSet('1. a?\nAnswer: b').set.id).toBe(parseSet('1. a?\nAnswer: b').set.id)
    expect(parseSet('1. a?\nAnswer: b').set.id).not.toBe(parseSet('1. a?\nAnswer: c').set.id)
  })
})
