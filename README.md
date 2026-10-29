# Satchel

**Pack a practice set that works without internet.** Write questions in plain text, try them in the student preview,
and download one HTML file. Students can answer at their own pace, with hints, feedback, larger text and high contrast.
No account or app to install.

Live demo: https://hyunsikparker.github.io/satchel/ · Video walkthrough (1 min 3 s, captions):
https://hyunsikparker.github.io/satchel/demo.html

The video is recorded from the live page by `scripts/demo.mjs` (Playwright), which checks the numbers the narration
quotes against the page as it records. The narration is a synthetic voice (Qwen3-TTS, run locally).

## The barrier

Satchel is designed for a student who can download work at school but has no reliable connection at home. ITU estimated
that 2.2 billion people remained offline in 2025, with 96% in low- and middle-income countries
([ITU, November 2025](https://www.itu.int/en/mediacentre/Pages/PR-2025-11-17-Facts-and-Figures.aspx)). Satchel keeps a small
practice set usable after it reaches the learner. It does not provide a device or the initial file transfer.

## What it does

1. **Write the questions** in plain text: number each question, mark the right choice with `*`, or give a typed answer
   with `Answer:`. Hints and explanations are optional. Satchel shows how many questions are ready and explains, in plain
   words, any line it could not read ("Question 2 has no right answer marked. Put * after the right option.").
2. **Try it as a student** in the live preview, which runs the same code as the packed file.
3. **Pack it.** *Download the offline file* saves one self-contained HTML file with the questions, the code and the
   styles inside it. Send it by message, Bluetooth, email or USB; it opens from the downloads folder in a browser and
   needs no data after that. *Print a paper copy* prints a worksheet with an answer key on a separate page.

For the student, the file offers:
- one question at a time, with large tap targets and no timer;
- choices as real radio buttons and typed answers in a labelled text box, all usable by keyboard and screen reader;
- typed answers that forgive capital letters, extra spaces and the form of a number (`1/2`, `0.5`, `.5` and `50%` all
  match), correctly grouped large numbers (`1,000,000` and `1000000`), plus any other accepted answers the teacher lists;
- a hint on request, the right answer and the explanation after each check, and at the end the questions they missed,
  with *Practise the ones I missed*;
- saved progress, including an unfinished answer, when the browser allows local storage. Reopen the same file in the same
  browser and choose *Continue at question…*. The full question list also offers a return to the saved attempt or results.
  On a shared device, *Start again* clears the previous attempt;
- larger text and high contrast, without losing the current answer; read-aloud when a local English voice is available;
- a version that still works when scripts are blocked: every question with the answer behind *Show the answer*.

Conflicting answers, missing keys, empty or identical options, and unreadable lines block download and print until
corrected, so a broken question cannot silently disappear from the set. The three downloaded files in the browser tests
are about 27–29 KB; size grows with the questions.

## Why practice questions

Practice testing received a high utility rating in a review of ten learning techniques
([Dunlosky et al., 2013](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html)).
Satchel supports that activity with questions and feedback. We have not measured learning outcomes with students.

## Privacy and storage

The editor processes questions locally, with no analytics or upload service. Its `connect-src 'none'` policy blocks
fetch and similar connections. The offline file uses `default-src 'none'` with only its inline code, styles and data
images permitted. The player makes no network requests. Question text is escaped in the file and inserted with
`textContent`, never treated as user-supplied HTML. Examples are general knowledge; no learner records are used.

Editor drafts, settings and practice progress are stored in the browser. Local-file storage varies by browser.
Private browsing, clearing storage, moving a file or changing browsers may prevent continuation. If saving fails during
practice, the player tells the learner to keep the file open to finish. Version 1 settings are retained when encountered,
but its incomplete progress format cannot be resumed. Previously downloaded files keep their original behaviour.

## How it was checked

`npm run check` passes 47 unit tests, the production build and 6 Chrome browser tests.

- Parsing: all examples, alternate notation, unreadable lines, missing answers, conflicting keys and option letters out of order.
- Grading: equivalent numbers, decimal place value, tiny values, unsafe integer rounding, negative mixed numbers and
  complete thousands-separator groups, including malformed groups that must not be silently corrected.
- Practice: hints and reading controls preserve answers; keyboard focus stays on the reading control; reopening restores
  progress; reading the full question list keeps the saved attempt available; restart clears an attempt; corrupt or
  blocked storage degrades safely.
- Download: an actual file opened offline, closed and reopened with its draft restored, completed and retried. A separate
  check opens a downloaded file with JavaScript disabled and reveals its answers.
- Accessibility: no axe violations in the tested editor and player states; keyboard interactions; no horizontal overflow
  at 375px with larger text and high contrast. Phone and desktop screenshots were inspected.
- Security and size: escaping checks, no external requests from the offline player, and sample files below 60 KB.

The player passes `esbuild --target=es5`. This verifies syntax, not support for every browser. Current Chrome is the tested
browser; physical old phones and screen-reader software remain untested.

## Run it locally

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run check      # unit tests, build and browser tests
```

## Code map

- `src/sets.ts` reads the plain-text question format and reports problems.
- `src/runtime.js` and `src/runtime.css` are the practice player, shared by the preview and the packed file.
- `src/pack.ts` builds the single offline HTML file and its no-script fallback.
- `src/App.tsx` and `src/styles.css` are the teacher's page.

## Limits

- One question type at a time: multiple choice (one right answer) or a short typed answer. No images, audio or maths
  notation yet.
- Results stay on the student's device; there is no class dashboard, by design, since the file has no way to send them.
- Read-aloud requires a local English voice.
- Number comparison is limited to JavaScript's safe numeric range; larger values require matching written answers.
  This is a short-answer checker, not a symbolic maths engine.
- Local progress is for one learner at a time; it is not a secure assessment record.

## Credits and disclosure

- Built during AccessED Hacks 2026 (started October 22, 2026). No pre-existing project code.
- **AI assistance:** Claude (Anthropic) generated the initial implementation, tests and documentation. Codex (OpenAI)
  assisted with the October 24 grading, answer preservation and resume features, and the October 30 number-grouping,
  choice-validation and review-navigation fixes, with tests and documentation for both updates.
- The 1 minute 3 second video shows the October 22 version. Current resume and validation features are in the live app.
- Libraries: React, Vite and TypeScript for the teacher's page; Vitest, Testing Library, Playwright and axe-core for
  tests. The packed file uses no libraries.

## License

MIT
