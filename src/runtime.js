/* Satchel practice runtime. Plain ES5 so the packed file runs in old phone browsers, with no network access and no
 * libraries. The same code runs the preview in the Satchel page and the downloaded file. All text from the set is
 * inserted with textContent, never as HTML. */
(function () {
  'use strict';

  var VERSION = 1;

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] === null || attrs[k] === undefined || attrs[k] === false) continue;
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'className') node.className = attrs[k];
        else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), attrs[k]);
        else node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
      }
    }
    if (kids) for (var i = 0; i < kids.length; i++) if (kids[i]) node.appendChild(typeof kids[i] === 'string' ? document.createTextNode(kids[i]) : kids[i]);
    return node;
  }

  function normalize(s) {
    return String(s).toLowerCase().replace(/[−–]/g, '-').replace(/\s+/g, ' ').replace(/^[\s"'“”‘’.,;:!?]+|[\s"'“”‘’.,;:!?]+$/g, '');
  }

  /** "1/2", "0.5", ".5", "1 1/2", "50%", "1,000" as numbers; null when the text is not a number. */
  function toNumber(s) {
    // Trailing punctuation goes ("5."), a leading point stays (".5").
    var t = String(s).toLowerCase().replace(/[\u2212\u2013]/g, '-').replace(/\s+/g, ' ').replace(/^\s+|[\s.,;:!?]+$/g, '').replace(/(\d),(\d{3})\b/g, '$1$2');
    var m;
    if ((m = /^(-?\d+)\s+(\d+)\/(\d+)$/.exec(t))) return (Math.abs(+m[1]) + (+m[2]) / (+m[3])) * (+m[1] < 0 ? -1 : 1);
    if ((m = /^(-?\d+)\/(\d+)$/.exec(t))) return +m[2] === 0 ? null : (+m[1]) / (+m[2]);
    if ((m = /^(-?\d*\.?\d+)\s*%$/.exec(t))) return (+m[1]) / 100;
    if (/^-?\d*\.?\d+$/.test(t)) return +t;
    return null;
  }

  function isCorrectText(input, answers) {
    var a = normalize(input);
    if (!a) return false;
    var n = toNumber(input);
    for (var i = 0; i < answers.length; i++) {
      if (normalize(answers[i]) === a) return true;
      var m = toNumber(answers[i]);
      if (n !== null && m !== null && Math.abs(n - m) <= 1e-9 * Math.max(1, Math.abs(m))) return true;
    }
    return false;
  }

  function storageGet(key) {
    try { return JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked: progress is not kept */ }
  }

  function localVoice() {
    try {
      if (!window.speechSynthesis) return null;
      var list = window.speechSynthesis.getVoices();
      for (var i = 0; i < list.length; i++) if (list[i].localService && /^en/i.test(list[i].lang)) return list[i];
    } catch (e) { /* no speech */ }
    return null;
  }

  function mount(root, set, options) {
    options = options || {};
    // Keep the host element's own classes (the Satchel page styles its preview box through them).
    var baseClass = (' ' + root.className + ' ').replace(/ sat(?:-large|-contrast|-empty)?(?= )/g, ' ').replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
    var H = options.heading || 'h1'; // the preview inside the Satchel page uses h2 under the page's own h1
    var key = 'satchel:' + set.id;
    var saved = options.fresh ? null : storageGet(key);
    var state = {
      screen: 'start', // start | question | end | all
      order: [],
      pos: 0,
      results: {},
      checked: false,
      lastCorrect: false,
      showHint: false,
      picked: null, // the option index or typed text of the last answer, kept when the screen is redrawn
      large: !!(saved && saved.large),
      contrast: !!(saved && saved.contrast)
    };
    if (saved && saved.v === VERSION && saved.results) state.results = saved.results;

    function save() {
      storageSet(key, { v: VERSION, results: state.results, large: state.large, contrast: state.contrast });
    }

    function byId(id) {
      for (var i = 0; i < set.questions.length; i++) if (set.questions[i].id === id) return set.questions[i];
      return null;
    }

    function rightAnswer(q) {
      if (q.kind === 'text') return q.answers[0];
      for (var i = 0; i < q.options.length; i++) if (q.options[i].correct) return q.options[i].text;
      return '';
    }

    var live = el('p', { className: 'sr-only', 'aria-live': 'polite' });
    function announce(text) {
      live.textContent = '';
      setTimeout(function () { live.textContent = text; }, 30);
    }

    function start(ids) {
      state.order = ids;
      state.pos = 0;
      state.checked = false;
      state.showHint = false;
      state.picked = null;
      state.screen = 'question';
      render(true);
    }

    function allIds() {
      var ids = [];
      for (var i = 0; i < set.questions.length; i++) ids.push(set.questions[i].id);
      return ids;
    }

    function missedIds() {
      var ids = [];
      for (var i = 0; i < state.order.length; i++) if (state.results[state.order[i]] === 'wrong') ids.push(state.order[i]);
      return ids;
    }

    function speak(text) {
      var v = localVoice();
      if (!v) return;
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.voice = v;
      window.speechSynthesis.speak(u);
    }

    function toolbar() {
      var bar = el('div', { className: 'sat-tools', role: 'group', 'aria-label': 'Reading options' }, [
        el('button', { type: 'button', className: 'sat-tool', 'aria-pressed': state.large ? 'true' : 'false', text: 'Larger text', onclick: function () { state.large = !state.large; save(); render(false); } }),
        el('button', { type: 'button', className: 'sat-tool', 'aria-pressed': state.contrast ? 'true' : 'false', text: 'High contrast', onclick: function () { state.contrast = !state.contrast; save(); render(false); } })
      ]);
      return bar;
    }

    function startScreen() {
      var done = 0;
      for (var k in state.results) if (Object.prototype.hasOwnProperty.call(state.results, k) && byId(k)) done++;
      var kids = [
        el(H, { className: 'sat-title', text: set.title, tabindex: '-1' }),
        el('p', { className: 'sat-count', text: set.questions.length + (set.questions.length === 1 ? ' question' : ' questions') + ' · works without internet · no timer' })
      ];
      if (set.intro) {
        var parts = set.intro.split('\n');
        var box = el('div', { className: 'sat-intro' });
        for (var i = 0; i < parts.length; i++) box.appendChild(el('p', { text: parts[i] }));
        kids.push(box);
      }
      var actions = el('div', { className: 'sat-actions' }, [
        el('button', { type: 'button', className: 'sat-primary', text: done ? 'Start again' : 'Start', onclick: function () { state.results = {}; save(); start(allIds()); } }),
        el('button', { type: 'button', className: 'sat-secondary', text: 'See all questions', onclick: function () { state.screen = 'all'; render(true); } })
      ]);
      kids.push(actions);
      return kids;
    }

    function questionScreen() {
      var q = byId(state.order[state.pos]);
      var total = state.order.length;
      var form = el('form', { className: 'sat-form', novalidate: true });
      var feedback = el('div', { className: 'sat-feedback', role: 'status' });
      var heading = el(H, { className: 'sat-prompt', id: 'sat-prompt', text: q.prompt, tabindex: '-1' });
      var progress = el('p', { className: 'sat-progress', text: 'Question ' + (state.pos + 1) + ' of ' + total });
      var meter = el('div', { className: 'sat-meter', 'aria-hidden': 'true' }, [el('span', { className: 'sat-fill sat-w' + Math.round(((state.pos) / total) * 20) })]);
      var field;
      if (q.kind === 'choice') {
        field = el('fieldset', { className: 'sat-options' }, [el('legend', { className: 'sr-only', text: q.prompt })]);
        for (var i = 0; i < q.options.length; i++) {
          var id = 'sat-o' + i;
          var input = el('input', { type: 'radio', name: 'answer', id: id, value: String(i), disabled: state.checked, checked: state.checked && state.picked === i });
          var label = el('label', { 'for': id, className: 'sat-option' }, [input, el('span', { text: q.options[i].text })]);
          if (state.checked && q.options[i].correct) label.className += ' is-right';
          else if (state.checked && state.picked === i) label.className += ' is-wrong';
          field.appendChild(label);
        }
      } else {
        field = el('div', { className: 'sat-text' }, [
          el('label', { 'for': 'sat-input', text: 'Your answer' }),
          el('input', { type: 'text', id: 'sat-input', name: 'answer', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', disabled: state.checked, value: state.checked ? state.picked : null })
        ]);
      }
      form.appendChild(field);
      var buttons = el('div', { className: 'sat-actions' });
      if (!state.checked) {
        buttons.appendChild(el('button', { type: 'submit', className: 'sat-primary', text: 'Check' }));
        if (q.hint && !state.showHint) buttons.appendChild(el('button', { type: 'button', className: 'sat-secondary', text: 'Show a hint', onclick: function () { state.showHint = true; render(false); var f = root.querySelector('.sat-hint'); if (f) announce('Hint: ' + q.hint); } }));
      } else {
        buttons.appendChild(el('button', { type: 'button', className: 'sat-primary sat-next', text: state.pos + 1 < total ? 'Next question' : 'See my results', onclick: function () {
          if (state.pos + 1 < total) { state.pos++; state.checked = false; state.showHint = false; state.picked = null; render(true); } else { state.screen = 'end'; render(true); }
        } }));
      }
      form.appendChild(buttons);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (state.checked) return;
        var right = false;
        var answered = false;
        if (q.kind === 'choice') {
          var picked = form.querySelector('input[name=answer]:checked');
          if (picked) { answered = true; state.picked = +picked.value; right = !!q.options[+picked.value].correct; }
        } else {
          var value = form.querySelector('#sat-input').value;
          if (value.replace(/\s/g, '')) { answered = true; state.picked = value; right = isCorrectText(value, q.answers); }
        }
        if (!answered) {
          feedback.className = 'sat-feedback is-empty';
          feedback.textContent = q.kind === 'choice' ? 'Choose an answer first.' : 'Type an answer first.';
          return;
        }
        state.checked = true;
        state.lastCorrect = right;
        state.results[q.id] = right ? 'right' : 'wrong';
        save();
        render(false);
        var next = root.querySelector('.sat-next');
        if (next) next.focus();
      });
      var hint = q.hint && state.showHint ? el('p', { className: 'sat-hint' }, [el('strong', { text: 'Hint: ' }), q.hint]) : null;
      if (state.checked) {
        feedback.className = 'sat-feedback ' + (state.lastCorrect ? 'is-right' : 'is-wrong');
        feedback.appendChild(el('p', { className: 'sat-verdict', text: state.lastCorrect ? 'Right.' : 'Not this time. The answer is: ' + rightAnswer(q) }));
        if (q.why) feedback.appendChild(el('p', { text: q.why }));
      }
      var tools = [];
      if (localVoice()) tools.push(el('button', { type: 'button', className: 'sat-link', text: 'Read aloud', onclick: function () {
        var text = q.prompt;
        if (q.kind === 'choice') for (var j = 0; j < q.options.length; j++) text += '. Option ' + (j + 1) + ': ' + q.options[j].text;
        speak(text);
      } }));
      return [progress, meter, heading, hint, form, feedback].concat(tools.length ? [el('div', { className: 'sat-under' }, tools)] : []);
    }

    function endScreen() {
      var right = 0;
      for (var i = 0; i < state.order.length; i++) if (state.results[state.order[i]] === 'right') right++;
      var missed = missedIds();
      var kids = [
        el(H, { className: 'sat-title', text: right + ' of ' + state.order.length + ' right', tabindex: '-1' }),
        el('p', { className: 'sat-count', text: missed.length ? 'Practising the ones you missed again is the quickest way to remember them.' : 'Every answer was right.' })
      ];
      if (missed.length) {
        var list = el('ul', { className: 'sat-missed' });
        for (var j = 0; j < missed.length; j++) {
          var q = byId(missed[j]);
          list.appendChild(el('li', null, [el('span', { text: q.prompt }), el('span', { className: 'sat-key', text: 'Answer: ' + rightAnswer(q) })]));
        }
        kids.push(list);
      }
      var actions = el('div', { className: 'sat-actions' });
      if (missed.length) actions.appendChild(el('button', { type: 'button', className: 'sat-primary', text: 'Practise the ' + missed.length + ' I missed', onclick: function () { start(missed); } }));
      actions.appendChild(el('button', { type: 'button', className: missed.length ? 'sat-secondary' : 'sat-primary', text: 'Start over', onclick: function () { state.results = {}; save(); start(allIds()); } }));
      kids.push(actions);
      return kids;
    }

    function allScreen() {
      var list = el('ol', { className: 'sat-all' });
      for (var i = 0; i < set.questions.length; i++) {
        var q = set.questions[i];
        var item = el('li', null, [el('p', { className: 'sat-all-q', text: q.prompt })]);
        if (q.kind === 'choice') {
          var opts = el('ul', { className: 'sat-all-o' });
          for (var j = 0; j < q.options.length; j++) opts.appendChild(el('li', { text: q.options[j].text }));
          item.appendChild(opts);
        }
        item.appendChild(el('details', null, [el('summary', { text: 'Show the answer' }), el('p', { text: rightAnswer(q) + (q.why ? ' — ' + q.why : '') })]));
        list.appendChild(item);
      }
      return [
        el(H, { className: 'sat-title', text: set.title, tabindex: '-1' }),
        list,
        el('div', { className: 'sat-actions' }, [el('button', { type: 'button', className: 'sat-primary', text: 'Practise one at a time', onclick: function () { start(allIds()); } })])
      ];
    }

    function render(moveFocus) {
      var body = state.screen === 'question' ? questionScreen() : state.screen === 'end' ? endScreen() : state.screen === 'all' ? allScreen() : startScreen();
      while (root.firstChild) root.removeChild(root.firstChild);
      root.className = (baseClass ? baseClass + ' ' : '') + 'sat' + (state.large ? ' sat-large' : '') + (state.contrast ? ' sat-contrast' : '');
      root.appendChild(toolbar());
      var main = el('div', { className: 'sat-main' });
      for (var i = 0; i < body.length; i++) if (body[i]) main.appendChild(body[i]);
      root.appendChild(main);
      root.appendChild(live);
      if (moveFocus) { // only after the student acts, never when the set is first shown
        var h = root.querySelector(H);
        if (h) h.focus();
      }
    }

    render(false);
    return {
      restart: function () { state.screen = 'start'; render(false); },
      state: state
    };
  }

  var api = { mount: mount, isCorrectText: isCorrectText, toNumber: toNumber, version: VERSION };
  if (typeof window !== 'undefined') window.Satchel = api;
})();
