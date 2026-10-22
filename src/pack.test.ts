import { describe, expect, it } from 'vitest'
import { escapeHtml, fileName, packHtml, scriptJson, staticList } from './pack'
import { parseSet, usable } from './sets'
import { SAMPLE_SETS } from './samples'

describe('packed file', () => {
  const set = usable(parseSet(SAMPLE_SETS[0].text).set)
  const html = packHtml(set)

  it('is one self-contained document that cannot reach the network', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain(`content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:"`)
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=|https?:\/\/(?!www\.w3\.org)/)
    expect(new TextEncoder().encode(html).length).toBeLessThan(60_000)
  })

  it('shows every question and answer without JavaScript', () => {
    expect(staticList(set)).toContain('<li><p class="sat-all-q">What is 3/4 of 20?</p>')
    expect(staticList(set)).toContain('<summary>Show the answer</summary><p>15 — 1/4 of 20 is 5, so 3/4 of 20 is 3 x 5 = 15.</p>')
  })

  it('escapes text in HTML and in the embedded data', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;')
    expect(scriptJson({ a: '</script><script>alert(1)</script>' })).not.toContain('</script')
    const evil = packHtml(usable(parseSet('1. </script><script>alert(1)</script>?\nAnswer: x').set))
    expect(evil.split('</script>').length).toBe(4) // only the three real script elements close
  })

  it('names the file after the title', () => {
    expect(fileName('Fractions of a number')).toBe('fractions-of-a-number-practice.html')
    expect(fileName('!!!')).toBe('practice-practice.html')
  })
})
