# Satchel

**Pack a practice set that works without internet.** Write questions once in plain text; Satchel turns them into one
small HTML file that opens on any phone or computer with no internet, no app and no login, with large text, high contrast,
read-aloud and no timer.

Live demo: https://hyunsikparker.github.io/satchel/

## The barrier

Most online practice tools assume a steady connection, a recent device and an account. About 2.2 billion people are still
offline, and 96% of them live in low- and middle-income countries
([ITU, November 2025](https://www.itu.int/en/mediacentre/Pages/PR-2025-11-17-Facts-and-Figures.aspx)). Many more have a
connection only at school or only when they can pay for data, share one phone with their family, or use an old phone that
struggles with heavy web apps. Quiz platforms also bring timers, small tap targets and drag-and-drop questions that are
hard to use with a screen reader, a keyboard or low vision.

A teacher who wants to send practice home usually ends up photographing a worksheet.

## What it does

1. **Write the questions** in plain text: number each question, mark the right choice with `*`, or give a typed answer
   with `Answer:`. Hints and explanations are optional. Satchel shows how many questions are ready and explains, in plain
   words, any line it could not read ("Question 2 has no right answer marked. Put * after the right option.").
2. **Try it as a student** in the live preview, which runs the same code as the packed file.
3. **Pack it.** *Download the offline file* saves one HTML file of about 20-30 KB with the questions, the code and the
   styles inside it. Send it by message, Bluetooth, email or USB; it opens from the downloads folder in any browser and
   needs no data after that. *Print a paper copy* prints a worksheet with an answer key on a separate page.

For the student, the file offers:
- one question at a time, with large tap targets and no timer;
- choices as real radio buttons and typed answers in a labelled text box, all usable by keyboard and screen reader;
- typed answers that forgive capital letters, extra spaces and the form of a number (`1/2`, `0.5`, `.5` and `50%` all
  match), plus any other accepted answers the teacher lists;
- a hint on request, the right answer and the explanation after each check, and at the end the questions they missed,
  with *Practise the ones I missed*;
- larger text and high contrast, remembered on the device; read-aloud with the device's own voices when it has them;
- a version that still works when scripts are blocked: every question with the answer behind *Show the answer*.

## Why practice questions

Answering questions with feedback, then going back to the ones you missed, is one of the two study methods rated most
useful in a review of ten common techniques
([Dunlosky et al., 2013](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html)).
Satchel does not change what is taught; it gets that kind of practice to students who cannot use the usual online tools.

## Privacy and safety

- The Satchel page has no server and no analytics, and its Content Security Policy blocks every network request
  (`connect-src 'none'`). Questions are kept in the browser's local storage so they survive a reload.
- The packed file carries its own policy, `default-src 'none'`, so it cannot load or send anything either. It stores only
  the student's reading settings and answers on their own device.
- Text from the questions is always inserted as text, never as HTML, so a question cannot inject code into the page.
- The examples are general knowledge written for Satchel. No learner data is used.

## How it was checked

- 14 unit tests (`npm test`): the question format (the three examples, other ways of marking answers, questions that run
  onto two lines, unreadable lines and missing answers reported), the answer checker (numbers in different forms,
  capitals and spaces, near misses rejected), the practice flow in a simulated browser (one question at a time, feedback,
  focus moving to the question and then to *Next*, practising missed questions, settings remembered, question text never
  treated as HTML) and the packed file (self-contained, readable without scripts, escaping, size under 60 KB).
- 3 browser tests (`npm run test:e2e`, Playwright on the production build): writing and editing questions with the
  preview by keyboard, packing and downloading the file, then opening that file **with the network switched off** and
  answering by keyboard, switching to high contrast, and opening it again **with JavaScript disabled**; axe accessibility
  scans with no violations on the page and on the packed file; no console errors; no network requests; phone width.
- The runtime is written in ES5 so it runs in old phone browsers; `esbuild --target=es5` accepts it without errors.

## Run it locally

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # unit tests
npm run test:e2e   # browser tests on the production build
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
- Read-aloud depends on the voices installed on the device.

## Credits and disclosure

- Built during AccessED Hacks 2026 (started October 22, 2026). No pre-existing project code.
- **AI assistance:** built with Claude (Anthropic), an AI coding assistant, which wrote the code, the tests and this
  README.
- Libraries: React, Vite and TypeScript for the teacher's page; Vitest, Testing Library, Playwright and axe-core for
  tests. The packed file uses no libraries.

## License

MIT
