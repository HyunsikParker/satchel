// Reads practice questions written in plain text. The format is meant to be typed by a teacher without a manual:
//
//   # Fractions                      title (optional)
//   Some notes for students.         anything before the first question is shown first
//   1. What is 3/4 of 20?            a question: "1." "1)" "Q:" or "Q1."
//   a) 12                            options: "a)" "b." "-" or "*" ...
//   b) 15 *                          ... the right one marked with * at the start or end, or "(correct)"
//   Hint: Find 1/4 first.            optional
//   Why: 1/4 of 20 is 5, so 3/4 is 15.   optional explanation shown after answering
//   2. Write 0.5 as a fraction.
//   Answer: 1/2 | one half           a typed answer; | separates accepted answers

export interface Option {
  text: string
  correct: boolean
}

export interface Question {
  id: string
  prompt: string
  kind: 'choice' | 'text'
  options: Option[]
  answers: string[]
  hint: string | null
  why: string | null
}

export interface PracticeSet {
  id: string
  title: string
  intro: string
  questions: Question[]
}

export interface Issue {
  line: number
  message: string
}

const TITLE = /^\s*(?:#+\s*|title\s*:\s*)(.+)$/i
const QUESTION = /^\s*(?:q(?:uestion)?\s*\d*\s*[:.)]|\d{1,3}\s*[.)])\s*(.+)$/i
const OPTION = /^\s*(?:\*\s*)?(?:[a-hA-H]\s*[.)]|[-•–]|\*|\(\s?[xX✓]?\s?\)|\[\s?[xX✓]?\s?\])\s+(.+)$/
const ANSWER = /^\s*(?:answer|ans|a)\s*:\s*(.+)$/i
const HINT = /^\s*hint\s*:\s*(.+)$/i
const WHY = /^\s*(?:why|explanation|because|feedback)\s*:\s*(.+)$/i

/** A short, stable id for a set, so progress saved on a device belongs to the right set. */
export function hashText(s: string): string {
  let h = 0x811c9dc5
  for (const ch of s) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

function optionFrom(line: string): Option | null {
  const m = OPTION.exec(line)
  if (!m) return null
  const raw = line.trim()
  let text = m[1].trim()
  let correct = /^\*/.test(raw) || /^[[(]\s?[xX✓]\s?[\])]/.test(raw)
  const end = /\s*(?:\*|\(correct\)|✓)\s*$/i
  if (end.test(text)) {
    correct = true
    text = text.replace(end, '')
  }
  return { text: text.trim(), correct }
}

export function parseSet(source: string): { set: PracticeSet; issues: Issue[] } {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const issues: Issue[] = []
  let title = ''
  const intro: string[] = []
  const questions: (Question & { line: number })[] = []
  let current: (Question & { line: number }) | null = null
  let lastField: 'prompt' | 'hint' | 'why' | null = null

  lines.forEach((raw, k) => {
    const line = raw.trimEnd()
    const n = k + 1
    if (!line.trim()) {
      lastField = null
      return
    }
    const t = TITLE.exec(line)
    if (t && !title && !current) {
      title = t[1].trim()
      return
    }
    const q = QUESTION.exec(line)
    if (q && !ANSWER.test(line)) {
      current = { id: `q${questions.length + 1}`, prompt: q[1].trim(), kind: 'text', options: [], answers: [], hint: null, why: null, line: n }
      questions.push(current)
      lastField = 'prompt'
      return
    }
    if (!current) {
      intro.push(line.trim())
      return
    }
    const h = HINT.exec(line)
    if (h) {
      current.hint = h[1].trim()
      lastField = 'hint'
      return
    }
    const w = WHY.exec(line)
    if (w) {
      current.why = w[1].trim()
      lastField = 'why'
      return
    }
    const a = ANSWER.exec(line)
    if (a) {
      const value = a[1].trim()
      // "Answer: b" picks an option by its letter.
      if (current.options.length && /^[a-h]$/i.test(value)) {
        const i = value.toLowerCase().charCodeAt(0) - 97
        if (current.options[i]) current.options[i].correct = true
        else issues.push({ line: n, message: `Question ${questions.length} has no option "${value}".` })
      } else {
        current.answers.push(...value.split('|').map((x) => x.trim()).filter(Boolean))
      }
      lastField = null
      return
    }
    const o = optionFrom(line)
    if (o) {
      current.options.push(o)
      lastField = null
      return
    }
    // A line that continues the previous field.
    if (lastField === 'prompt' && !current.options.length) current.prompt += ` ${line.trim()}`
    else if (lastField === 'hint') current.hint += ` ${line.trim()}`
    else if (lastField === 'why') current.why += ` ${line.trim()}`
    else issues.push({ line: n, message: `Line ${n} was not understood: "${line.trim().slice(0, 40)}". Start options with a), b) or -, and answers with "Answer:".` })
  })

  for (const q of questions) {
    const k = questions.indexOf(q) + 1
    if (q.options.length) {
      q.kind = 'choice'
      if (q.options.length < 2) issues.push({ line: q.line, message: `Question ${k} has only one option.` })
      if (!q.options.some((o) => o.correct)) {
        if (q.answers.length) {
          // "Answer: Paris" with options: mark the option with that text.
          const hit = q.options.find((o) => q.answers.some((a) => a.toLowerCase() === o.text.toLowerCase()))
          if (hit) hit.correct = true
        }
        if (!q.options.some((o) => o.correct)) issues.push({ line: q.line, message: `Question ${k} has no right answer marked. Put * after the right option.` })
      }
      q.answers = []
    } else if (!q.answers.length) {
      issues.push({ line: q.line, message: `Question ${k} needs options or an "Answer:" line.` })
    }
  }
  if (!questions.length && source.trim()) issues.push({ line: 1, message: 'No questions found. Number each question: "1. What is…?"' })

  const clean = questions.map(({ line: _line, ...q }) => q)
  return {
    set: { id: hashText(source), title: title || 'Practice', intro: intro.join('\n'), questions: clean },
    issues,
  }
}

/** Questions that can be practised: a choice question with a right option, or a typed question with an answer. */
export function usable(set: PracticeSet): PracticeSet {
  return { ...set, questions: set.questions.filter((q) => (q.kind === 'choice' ? q.options.some((o) => o.correct) && q.options.length > 1 : q.answers.length > 0)) }
}
