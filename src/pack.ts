// Builds the downloadable practice file: one HTML document with the questions, the runtime and its styles inside it.
// It opens from a phone's downloads folder or a USB stick with no internet and no install. Without JavaScript the same
// file still shows every question with the answer behind a "Show the answer" toggle.

import runtimeCss from './runtime.css?raw'
import runtimeJs from './runtime.js?raw'
import type { PracticeSet, Question } from './sets'

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** JSON that is safe inside a <script> element. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

function rightAnswer(q: Question): string {
  return q.kind === 'text' ? q.answers[0] : q.options.find((o) => o.correct)?.text ?? ''
}

/** The question list as plain HTML: the no-JavaScript fallback and the printable worksheet. */
export function staticList(set: PracticeSet): string {
  const items = set.questions.map((q) => {
    const opts = q.kind === 'choice' ? `<ul class="sat-all-o">${q.options.map((o) => `<li>${escapeHtml(o.text)}</li>`).join('')}</ul>` : ''
    const why = q.why ? ` — ${escapeHtml(q.why)}` : ''
    return `<li><p class="sat-all-q">${escapeHtml(q.prompt)}</p>${opts}<details><summary>Show the answer</summary><p>${escapeHtml(rightAnswer(q))}${why}</p></details></li>`
  })
  const intro = set.intro ? `<div class="sat-intro">${set.intro.split('\n').map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>` : ''
  return `<h1 class="sat-title">${escapeHtml(set.title)}</h1>${intro}<ol class="sat-all">${items.join('')}</ol>`
}

export function packHtml(set: PracticeSet): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:">
<title>${escapeHtml(set.title)} · practice</title>
<style>
html, body { margin: 0; background: #fffdf7; }
.page { max-width: 760px; margin: 0 auto; padding: 8px; }
.made { font: 13px/1.5 system-ui, sans-serif; color: #4f5a53; text-align: center; margin: 18px 0 8px; }
${runtimeCss}
</style>
</head>
<body>
<main class="page">
<div id="satchel" class="sat">${staticList(set)}</div>
<p class="made">Made with Satchel. Works offline: keep this file and open it any time.</p>
</main>
<script id="satchel-data" type="application/json">${scriptJson(set)}</script>
<script>
${runtimeJs}
</script>
<script>
(function () {
  try {
    var data = JSON.parse(document.getElementById('satchel-data').textContent);
    window.Satchel.mount(document.getElementById('satchel'), data, {});
  } catch (e) { /* the question list above stays readable */ }
})();
</script>
</body>
</html>
`
}

export function fileName(title: string): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 50)
  return `${slug || 'practice'}-practice.html`
}
