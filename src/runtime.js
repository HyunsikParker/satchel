/* Satchel practice runtime. Plain ES5 syntax for wider compatibility, with no network requests and no
 * libraries. The same code runs the preview in the Satchel page and the downloaded file. All text from the set is
 * inserted with textContent, never as HTML. */
(function () {
  'use strict';

  var VERSION = 2;

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
    var t = String(s).toLowerCase().replace(/[\u2212\u2013]/g, '-').replace(/\s+/g, ' ').replace(/^\s+|[\s.,;:!?]+$/g, '');
    // Validate each complete numeric part before removing thousands separators.
    // A partial replacement can reject 1,000,000 or silently accept 1234,567.
    var badGrouping = false;
    t = t.replace(/[\d.,]+/g, function (part) {
      if (part.indexOf(',') === -1) return part;
      if (!/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(part)) badGrouping = true;
      return part.replace(/,/g, '');
    });
    if (badGrouping) return null;
    var m, n = null;
    if ((m = /^(-?\d+)\s+(\d+)\/(\d+)$/.exec(t))) n = +m[3] === 0 ? null : (Math.abs(+m[1]) + (+m[2]) / (+m[3])) * (m[1].charAt(0) === '-' ? -1 : 1);
    else if ((m = /^(-?\d+)\/(\d+)$/.exec(t))) n = +m[2] === 0 ? null : (+m[1]) / (+m[2]);
    else if ((m = /^(-?\d*\.?\d+)\s*%$/.exec(t))) n = (+m[1]) / 100;
    else if (/^-?\d*\.?\d+$/.test(t)) n = +t;
    // Beyond this range distinct integers can round to the same JavaScript number.
    if (m) for (var i = 1; i < m.length; i++) if (Math.abs(+m[i]) > 9007199254740991) return null;
    return n !== null && isFinite(n) && Math.abs(n) <= 9007199254740991 ? n : null;
  }

  function isCorrectText(input, answers) {
    var a = normalize(input);
    if (!a) return false;
    var n = toNumber(input);
    for (var i = 0; i < answers.length; i++) {
      var m = toNumber(answers[i]);
      if (n !== null || m !== null) {
        if (n !== null && m !== null && (n === m || (n !== 0 && m !== 0 && n % 1 !== 0 && m % 1 !== 0 && Math.abs(n - m) <= 4e-15 * Math.max(Math.abs(n), Math.abs(m))))) return true;
      } else if (normalize(answers[i]) === a) return true;
    }
    return false;
  }

  function storageGet(key) {
    try { return JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
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
      answers: {}, // checked answers for the current practice report
      retry: false,
      checked: false,
      lastCorrect: false,
      showHint: false,
      picked: null, // the option index or typed text of the last answer, kept when the screen is redrawn
      large: !!(saved && saved.large),
      contrast: !!(saved && saved.contrast)
    };
    var resume = validSession(saved && saved.v === VERSION ? saved.session : null);
    var storageFailed = false;

    function validSession(session) {
      if (!session || (session.screen !== 'question' && session.screen !== 'end') || !Array.isArray(session.order) || !session.order.length || session.order.length > set.questions.length) return null;
      for (var i = 0; i < session.order.length; i++) if (typeof session.order[i] !== 'string' || !byId(session.order[i]) || session.order.indexOf(session.order[i]) !== i) return null;
      if (typeof session.pos !== 'number' || session.pos % 1 !== 0 || session.pos < 0 || session.pos >= session.order.length) return null;
      var q = byId(session.order[session.pos]);
      if (session.picked !== null && (q.kind === 'text' ? typeof session.picked !== 'string' : typeof session.picked !== 'number' || session.picked % 1 !== 0 || session.picked < 0 || session.picked >= q.options.length)) return null;
      if (typeof session.checked !== 'boolean' || typeof session.lastCorrect !== 'boolean' || typeof session.showHint !== 'boolean' || !session.results || typeof session.results !== 'object') return null;
      var results = {}, answers = {};
      for (var j = 0; j < session.order.length; j++) {
        var id = session.order[j], result = session.results[id];
        if (result === 'right' || result === 'wrong') results[id] = result;
        var answer = session.answers && session.answers[id];
        if (results[id] && answer && typeof answer.text === 'string' && typeof answer.hintUsed === 'boolean') {
          answers[id] = { text: answer.text, hintUsed: answer.hintUsed };
        }
        if ((j < session.pos || session.screen === 'end' || (j === session.pos && session.checked)) && !results[id]) return null;
      }
      if (session.checked && (session.picked === null || (results[q.id] === 'right') !== session.lastCorrect)) return null;
      return { screen: session.screen, order: session.order.slice(), pos: session.pos, results: results, answers: answers, retry: session.retry === true, checked: session.checked, picked: session.picked, lastCorrect: session.lastCorrect, showHint: session.showHint };
    }

    function save() {
      if (state.screen === 'question' || state.screen === 'end') {
        resume = { screen: state.screen, order: state.order.slice(), pos: state.pos, results: state.results, answers: state.answers, retry: state.retry, checked: state.checked, picked: state.picked, lastCorrect: state.lastCorrect, showHint: state.showHint };
      }
      storageFailed = !storageSet(key, { v: VERSION, session: resume, large: state.large, contrast: state.contrast });
      var notice = root.querySelector('.sat-storage');
      if (notice) notice.hidden = !storageFailed;
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

    function start(ids, retry) {
      state.order = ids;
      state.retry = !!retry;
      state.pos = 0;
      state.checked = false;
      state.showHint = false;
      state.picked = null;
      state.screen = 'question';
      for (var i = 0; i < ids.length; i++) { delete state.results[ids[i]]; delete state.answers[ids[i]]; }
      save();
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
      function toggle(name) {
        state[name] = !state[name];
        save();
        render(false);
        root.querySelector('[data-setting="' + name + '"]').focus();
      }
      var bar = el('div', { className: 'sat-tools', role: 'group', 'aria-label': 'Reading options' }, [
        el('button', { type: 'button', className: 'sat-tool', 'data-setting': 'large', 'aria-pressed': state.large ? 'true' : 'false', text: 'Larger text', onclick: function () { toggle('large'); } }),
        el('button', { type: 'button', className: 'sat-tool', 'data-setting': 'contrast', 'aria-pressed': state.contrast ? 'true' : 'false', text: 'High contrast', onclick: function () { toggle('contrast'); } })
      ]);
      return bar;
    }

    function resumeButton() {
      if (!resume) return null;
      return el('button', { type: 'button', className: 'sat-primary', text: resume.screen === 'end' ? 'See saved results' : 'Continue at question ' + (resume.pos + 1), onclick: function () {
        for (var k in resume) if (Object.prototype.hasOwnProperty.call(resume, k)) state[k] = resume[k];
        render(true);
      } });
    }

    function startScreen() {
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
      var actions = el('div', { className: 'sat-actions' });
      if (resume) actions.appendChild(resumeButton());
      actions.appendChild(el('button', { type: 'button', className: resume ? 'sat-secondary' : 'sat-primary', text: resume ? 'Start again' : 'Start', onclick: function () { state.results = {}; start(allIds()); } }));
      actions.appendChild(
        el('button', { type: 'button', className: 'sat-secondary', text: 'See all questions', onclick: function () { state.screen = 'all'; render(true); } })
      );
      if (resume) kids.push(el('p', { className: 'sat-count', text: 'Progress is saved in this browser. Sharing the device? Choose Start again.' }));
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
          var input = el('input', { type: 'radio', name: 'answer', id: id, value: String(i), disabled: state.checked, checked: state.picked === i, onchange: function (e) { state.picked = +e.target.value; save(); } });
          var label = el('label', { 'for': id, className: 'sat-option' }, [input, el('span', { text: q.options[i].text })]);
          if (state.checked && q.options[i].correct) label.className += ' is-right';
          else if (state.checked && state.picked === i) label.className += ' is-wrong';
          field.appendChild(label);
        }
      } else {
        field = el('div', { className: 'sat-text' }, [
          el('label', { 'for': 'sat-input', text: 'Your answer' }),
          el('input', { type: 'text', id: 'sat-input', name: 'answer', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', disabled: state.checked, value: state.picked, oninput: function (e) { state.picked = e.target.value; save(); } })
        ]);
      }
      form.appendChild(field);
      form.appendChild(feedback); // the result sits between the answer and the button that moves on
      var buttons = el('div', { className: 'sat-actions' });
      if (!state.checked) {
        buttons.appendChild(el('button', { type: 'submit', className: 'sat-primary', text: 'Check' }));
        if (q.hint && !state.showHint) buttons.appendChild(el('button', { type: 'button', className: 'sat-secondary', text: 'Show a hint', onclick: function () { state.showHint = true; save(); render(false); root.querySelector('.sat-hint').focus(); } }));
      } else {
        buttons.appendChild(el('button', { type: 'button', className: 'sat-primary sat-next', text: state.pos + 1 < total ? 'Next question' : 'See my results', onclick: function () {
          if (state.pos + 1 < total) { state.pos++; state.checked = false; state.showHint = false; state.picked = null; } else { state.screen = 'end'; }
          save(); render(true);
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
        state.answers[q.id] = { text: q.kind === 'choice' ? q.options[state.picked].text : state.picked, hintUsed: state.showHint };
        save();
        render(false);
        announce((right ? 'Right. ' : 'Not this time. The answer is: ' + rightAnswer(q) + '. ') + (q.why || ''));
        var next = root.querySelector('.sat-next');
        if (next) next.focus();
      });
      var hint = q.hint && state.showHint ? el('p', { className: 'sat-hint', tabindex: '-1' }, [el('strong', { text: 'Hint: ' }), q.hint]) : null;
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
      return [progress, meter, heading, hint, form].concat(tools.length ? [el('div', { className: 'sat-under' }, tools)] : []);
    }

    function endScreen() {
      var right = 0;
      for (var i = 0; i < state.order.length; i++) if (state.results[state.order[i]] === 'right') right++;
      var missed = missedIds();
      var kids = [
        el(H, { className: 'sat-title', text: right + ' of ' + state.order.length + ' right', tabindex: '-1' }),
        el('p', { className: 'sat-count', text: missed.length ? 'You can practise the questions you missed.' : 'Every answer was right.' })
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
      if (missed.length) actions.appendChild(el('button', { type: 'button', className: 'sat-primary', text: 'Practise the ' + missed.length + ' I missed', onclick: function () { start(missed, true); } }));
      actions.appendChild(el('button', { type: 'button', className: missed.length ? 'sat-secondary' : 'sat-primary', text: 'Start over', onclick: function () { state.results = {}; save(); start(allIds()); } }));
      kids.push(actions);
      kids.push(reportControls(right));
      return kids;
    }

    function practiceReport(right) {
      var lines = [
        'Satchel practice report', set.title, 'Set reference: ' + set.id, '',
        'This attempt: ' + right + ' of ' + state.order.length + ' right.',
        'Questions in this attempt: ' + state.order.length + ' of ' + set.questions.length + ' in the set.',
        state.retry ? 'This is a retry of missed questions, not a new score for the whole set.' : 'This report covers the attempt shown on the results screen.',
        'Practice only. Hints and retries are available; this is not a verified grade.', ''
      ];
      for (var i = 0; i < state.order.length; i++) {
        var q = byId(state.order[i]), answer = state.answers[q.id], number = 0;
        for (var j = 0; j < set.questions.length; j++) if (set.questions[j].id === q.id) number = j + 1;
        lines.push('Question ' + number + ': ' + q.prompt);
        lines.push('Your answer: ' + (answer ? answer.text : 'Not recorded by the earlier player.'));
        lines.push('Result: ' + (state.results[q.id] === 'right' ? 'Right' : 'Not right'));
        lines.push('Accepted answer: ' + rightAnswer(q));
        lines.push('Hint opened: ' + (answer ? (answer.hintUsed ? 'Yes' : 'No') : 'Not recorded'));
        if (q.why) lines.push('Explanation: ' + q.why);
        lines.push('');
      }
      lines.push('Created on this device. Nothing was sent to a teacher or uploaded.');
      return lines.join('\n');
    }

    function reportControls(right) {
      var text = practiceReport(right);
      var field = el('textarea', { className: 'sat-report-text', 'aria-label': 'Practice report', readonly: true, rows: '12', spellcheck: 'false' });
      field.value = text;
      var details = el('details', { className: 'sat-report-copy' }, [el('summary', { text: 'View or copy report' }), field]);
      var status = el('p', { className: 'sat-count', role: 'status', hidden: true });
      function saveReport() {
        try {
          if (!window.Blob || !window.URL || !window.URL.createObjectURL) throw new Error('Download unavailable');
          var url = window.URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
          var link = el('a', { href: url, download: 'satchel-practice-report.txt' });
          if (!('download' in link)) { window.URL.revokeObjectURL(url); throw new Error('Download unavailable'); }
          root.appendChild(link);
          link.click();
          root.removeChild(link);
          window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
          status.textContent = 'Download requested. Check your downloads for satchel-practice-report.txt. If it is missing, use View or copy report.';
        } catch (e) {
          details.open = true;
          status.textContent = 'Your browser could not start the download. Copy the report below instead.';
          field.focus();
          field.select();
        }
        status.hidden = false;
      }
      return el('div', { className: 'sat-report' }, [
        el('p', { text: 'Keep this attempt to review or share with your teacher. The report includes your answers and any hints you opened.' }),
        el('button', { type: 'button', className: 'sat-secondary', text: 'Save practice report (.txt)', onclick: saveReport }),
        status, details
      ]);
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
        el('div', { className: 'sat-actions' }, [
          resumeButton(),
          el('button', { type: 'button', className: resume ? 'sat-secondary' : 'sat-primary', text: resume ? 'Start again' : 'Practise one at a time', onclick: function () { start(allIds()); } })
        ])
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
      root.appendChild(el('p', { className: 'sat-storage', role: 'status', hidden: !storageFailed, text: 'Your browser cannot save progress. Keep this file open to finish.' }));
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
