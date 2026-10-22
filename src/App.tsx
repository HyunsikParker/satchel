import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { fileName, packHtml } from './pack'
import { SAMPLE_SETS } from './samples'
import { parseSet, usable, type PracticeSet } from './sets'
import './runtime.css'
import './runtime.js'

const KEY = 'satchel.editor.v1'

function loadText(): string {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved !== null) return saved
  } catch {
    // Storage blocked: start with the example.
  }
  return SAMPLE_SETS[0].text
}

function kb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export default function App() {
  const [text, setText] = useState(loadText)
  const [note, setNote] = useState('')
  const deferred = useDeferredValue(text)
  const { set, issues } = useMemo(() => parseSet(deferred), [deferred])
  const ready = useMemo(() => usable(set), [set])
  const packed = useMemo(() => packHtml(ready), [ready])
  const size = new TextEncoder().encode(packed).length

  useEffect(() => {
    try {
      localStorage.setItem(KEY, text)
    } catch {
      // Not saving is fine.
    }
  }, [text])

  const download = () => {
    if (!ready.questions.length) return
    const url = URL.createObjectURL(new Blob([packed], { type: 'text/html;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName(ready.title)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setNote(`Saved ${fileName(ready.title)} (${kb(size)}). Send it by message, Bluetooth or USB; it opens in any browser without internet.`)
  }

  return (
    <div className="app">
      <header className="masthead">
        <p className="brand"><span className="bag" aria-hidden="true" />Satchel</p>
        <h1>Pack a practice set that works without internet</h1>
        <p className="lede">
          Write your questions once. Satchel turns them into one small file that opens on any phone or computer, with no
          internet, no app and no login, and with large text, high contrast and no timer for every student.
        </p>
      </header>

      <main className="workspace">
        <section className="editor" aria-labelledby="editor-title">
          <div className="pane-head">
            <h2 id="editor-title">1. Write the questions</h2>
            <div className="samples" role="group" aria-label="Examples">
              {SAMPLE_SETS.map((s) => (
                <button key={s.id} type="button" className="chip" onClick={() => { setText(s.text); setNote('') }}>{s.label}</button>
              ))}
            </div>
          </div>
          <label htmlFor="source" className="sr-only">Questions in plain text</label>
          <textarea id="source" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={22} aria-describedby="format-help status-line" />
          <p id="status-line" className="status-line" aria-live="polite">
            {ready.questions.length ? `${plural(ready.questions.length, 'question')} ready` : 'No questions ready yet'}
            {issues.length > 0 && ` · ${plural(issues.length, 'thing')} to fix`}
          </p>
          {issues.length > 0 && (
            <ul className="issues">
              {issues.map((i, k) => <li key={k}>{i.message}</li>)}
            </ul>
          )}
          <details className="format" id="format-help">
            <summary>How to write questions</summary>
            <pre>{`# Title of the set
Notes students see first (optional)

1. A question with choices?
a) A wrong answer
b) The right answer *
Hint: an optional nudge
Why: an optional explanation, shown after answering

2. A question with a typed answer?
Answer: 1/2 | one half`}</pre>
            <p>Mark the right choice with <code>*</code>. Typed answers ignore capital letters and extra spaces, and number answers
              match in any form (<code>1/2</code>, <code>0.5</code>, <code>50%</code>). Separate other accepted answers with <code>|</code>.</p>
          </details>
        </section>

        <section className="preview" aria-labelledby="preview-title">
          <div className="pane-head">
            <h2 id="preview-title">2. Try it as a student</h2>
          </div>
          <Preview set={ready} />
          <div className="pack">
            <h2 className="pack-title">3. Pack it</h2>
            <div className="pack-actions">
              <button type="button" className="primary" onClick={download} disabled={!ready.questions.length}>
                Download the offline file <span className="size">({kb(size)})</span>
              </button>
              <button type="button" className="secondary" onClick={() => window.print()} disabled={!ready.questions.length}>Print a paper copy</button>
            </div>
            {note && <p className="note" role="status">{note}</p>}
            <p className="fine">One HTML file with everything inside. It keeps working when the phone is offline, remembers settings on the
              device, and shows every question with its answer even in browsers that block scripts.</p>
          </div>
        </section>
      </main>

      <section className="why" aria-labelledby="why-title">
        <h2 id="why-title">Who this is for</h2>
        <div className="cols">
          <div>
            <h3>Students without reliable internet</h3>
            <p>About 2.2 billion people are still offline, 96% of them in low- and middle-income countries
              (<a href="https://www.itu.int/en/mediacentre/Pages/PR-2025-11-17-Facts-and-Figures.aspx">ITU, November 2025</a>).
              A practice file that travels by message, Bluetooth or USB and needs no data afterwards reaches them.</p>
          </div>
          <div>
            <h3>Students who need a calmer screen</h3>
            <p>One question at a time, large tap targets, larger text and high contrast, full keyboard use, screen-reader labels,
              read-aloud with the device's own voices, and no timer.</p>
          </div>
          <div>
            <h3>Practice that sticks</h3>
            <p>Answering questions and getting feedback, then retrying the ones you missed, is one of the study methods with the
              strongest evidence (<a href="https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html">Dunlosky et al., 2013</a>).</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>Satchel runs in your browser. Your questions are not uploaded anywhere, and the page cannot make network requests.
          Open source, built for AccessED Hacks 2026.</p>
      </footer>

      <PrintCopy set={ready} />
    </div>
  )
}

function Preview({ set }: { set: PracticeSet }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!box.current) return
    if (!set.questions.length) {
      box.current.className = 'preview-box sat sat-empty'
      box.current.textContent = 'Add a question on the left to see it here.'
      return
    }
    window.Satchel.mount(box.current, set, { fresh: true, heading: 'h3' })
  }, [set])
  return <div ref={box} className="sat preview-box" />
}

function PrintCopy({ set }: { set: PracticeSet }) {
  return (
    <div className="print-only" aria-hidden="true">
      <h1>{set.title}</h1>
      {set.intro && set.intro.split('\n').map((p, k) => <p key={k}>{p}</p>)}
      <ol className="print-questions">
        {set.questions.map((q) => (
          <li key={q.id}>
            <p>{q.prompt}</p>
            {q.kind === 'choice' ? (
              <ul>{q.options.map((o, k) => <li key={k}>{String.fromCharCode(97 + k)}) {o.text}</li>)}</ul>
            ) : (
              <p className="blank">Answer: ______________________________</p>
            )}
          </li>
        ))}
      </ol>
      <section className="answer-key">
        <h2>Answers</h2>
        <ol>
          {set.questions.map((q) => (
            <li key={q.id}>{q.kind === 'choice' ? q.options.find((o) => o.correct)?.text : q.answers[0]}{q.why ? `. ${q.why}` : ''}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}
