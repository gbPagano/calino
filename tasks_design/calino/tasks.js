/* Calino — Tasks page renderer.
   Builds on the existing chrome: call window.renderCalino() first to get the
   real toolbar + sidebar, then renderCalinoTasks() swaps the title to "Tasks"
   and replaces the main panel with the task list.

   Task data here is a representative spread (every section populated) so the
   design pattern reads clearly — dates are relative to TODAY (2026-05-30).     */

(function () {
  const TODAY = '2026-05-30';
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const WD  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const checkSvg =
    '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5l2.5 2.5L11 4"/></svg>';
  const plusSvg =
    '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 2v10M2 7h10"/></svg>';

  const C = (window.CALINO && window.CALINO.colors) || {
    rose:'#c2697f', blue:'#5b7fb5', green:'#5d9a78', amber:'#bf944e', plum:'#8a6aa8'
  };

  // p: priority 'high'|'med'|'low'  ·  due: ISO or null  ·  done: completed
  let TASKS = [
    { id: 1,  title: 'Buy birthday gift for Sarah',   note: 'She mentioned wanting a new book',        c: C.rose,  p: 'low',  due: '2026-05-09' },
    { id: 2,  title: 'Book flight for conference',     note: 'Early-bird pricing ends this week',        c: C.green, p: 'high', due: '2026-05-10' },
    { id: 3,  title: 'Review Q1 goals',                note: 'Prepare notes for the performance review', c: C.plum,  p: 'med',  due: '2026-05-15' },
    { id: 4,  title: 'Submit expense report',          note: 'Finance closes the books today',           c: C.rose,  p: 'high', due: '2026-05-30' },
    { id: 5,  title: 'Renew car insurance',            note: 'Policy lapses at midnight',                c: C.rose,  p: 'med',  due: '2026-05-30' },
    { id: 6,  title: 'Plan weekend trip',              note: 'Research destinations, book a place',      c: C.green, p: 'med',  due: '2026-06-02' },
    { id: 7,  title: 'Schedule dentist appointment',   note: "It's been six months since the last visit",c: C.blue,  p: 'low',  due: '2026-06-04' },
    { id: 8,  title: 'Update documentation',           note: 'API docs need refreshing after the release', c: C.green, p: 'med', due: '2026-06-11' },
    { id: 9,  title: 'Water the plants',               note: '',                                          c: C.green, p: 'low',  due: null },
    { id: 10, title: 'Sketch ideas for the redesign',  note: 'No rush — whenever inspiration strikes',   c: C.plum,  p: 'low',  due: null },
    { id: 11, title: 'Confirm dinner reservation',     note: 'Cafe Rouge, table for four',               c: C.rose,  p: 'med',  due: '2026-05-27', done: true },
    { id: 12, title: 'Send invoice to client',         note: '',                                          c: C.green, p: 'high', due: '2026-05-26', done: true },
    { id: 13, title: 'Back up laptop',                 note: '',                                          c: C.blue,  p: 'low',  due: '2026-05-24', done: true },
    { id: 14, title: 'Pick up dry cleaning',           note: '',                                          c: C.amber, p: 'low',  due: '2026-05-23', done: true },
  ];

  let filter = 'active'; // all | active | completed
  let composing = false;

  /* ---- date helpers ---- */
  function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  const todayD = parse(TODAY);
  function diff(s) { return Math.round((parse(s) - todayD) / 864e5); }
  function fmtMD(s) { const d = parse(s); return `${MON[d.getMonth()]} ${d.getDate()}`; }
  function dueLabel(t) {
    if (!t.due) return { text: '—', cls: '' };
    const dd = diff(t.due);
    if (dd < 0)  return { text: fmtMD(t.due), cls: 'is-overdue' };
    if (dd === 0) return { text: 'Today', cls: 'is-today' };
    if (dd === 1) return { text: 'Tomorrow', cls: '' };
    if (dd <= 6) return { text: WD[parse(t.due).getDay()], cls: '' };
    return { text: fmtMD(t.due), cls: '' };
  }
  const PRI_LABEL = { high: 'High', med: 'Medium', low: 'Low' };

  /* ---- grouping ---- */
  function bucket(t) {
    if (!t.due) return 'nodate';
    const dd = diff(t.due);
    if (dd < 0) return 'overdue';
    if (dd === 0) return 'today';
    if (dd <= 6) return 'week';
    return 'later';
  }
  const GROUPS = [
    { key: 'overdue', label: 'Overdue',     overdue: true },
    { key: 'today',   label: 'Today' },
    { key: 'week',    label: 'This week' },
    { key: 'later',   label: 'Later' },
    { key: 'nodate',  label: 'No due date' },
  ];

  /* ---- markup ---- */
  function taskRow(t) {
    const d = dueLabel(t);
    const pri = `<span class="pri pri-${t.p === 'med' ? 'med' : t.p}">${PRI_LABEL[t.p]}</span>`;
    const note = t.note ? `<div class="task-note">${t.note}</div>` : '';
    return (
      `<div class="task${t.done ? ' is-done' : ''}" data-id="${t.id}" style="--c:${t.c}">` +
        `<button class="task-check" data-check aria-label="Toggle complete">${checkSvg}</button>` +
        `<div class="task-body"><div class="task-title">${t.title}</div>${note}</div>` +
        `<div class="task-meta">${pri}<span class="due ${d.cls}">${d.text}</span></div>` +
      `</div>`
    );
  }

  function group(g, items) {
    if (!items.length) return '';
    const rows = items.map(taskRow).join('');
    return (
      `<section class="tg${g.overdue ? ' is-overdue' : ''}">` +
        `<div class="tg-head"><span class="tg-title">${g.label}</span>` +
        `<span class="tg-count">${items.length}</span><span class="tg-rule"></span></div>` +
        rows +
      `</section>`
    );
  }

  function listHtml() {
    const active = TASKS.filter(t => !t.done);
    const done = TASKS.filter(t => t.done);

    let body = '';
    if (filter !== 'completed') {
      // sort: overdue oldest-first, everything else soonest-first
      const sorted = [...active].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
      GROUPS.forEach(g => {
        body += group(g, sorted.filter(t => bucket(t) === g.key));
      });
    }
    if (filter !== 'active') {
      const doneSorted = [...done].sort((a, b) => (b.due || '').localeCompare(a.due || ''));
      body += group({ key: 'done', label: 'Completed' }, doneSorted);
    }
    if (!body) {
      body = `<div class="tp-empty"><b>All clear</b>Nothing here right now.</div>`;
    }
    return body;
  }

  function pageHtml() {
    const active = TASKS.filter(t => !t.done).length;
    const done = TASKS.filter(t => t.done).length;
    const seg = ['All', 'Active', 'Completed'].map(s =>
      `<button class="tab${s.toLowerCase() === filter ? ' is-active' : ''}" data-filter="${s.toLowerCase()}">${s}</button>`
    ).join('');
    const compose = composing
      ? `<div class="tp-compose"><span class="task-check"></span>` +
        `<input type="text" placeholder="What needs doing?" data-compose autofocus></div>`
      : '';
    return (
      `<div class="tasks-page"><div class="tp-inner">` +
        `<div class="tp-bar">` +
          `<div class="tp-count"><b>${active}</b> active <span class="dim">·</span> ${done} completed</div>` +
          `<div class="tp-controls"><div class="tabs">${seg}</div>` +
          `<button class="add-task" data-add>${plusSvg} Add task</button></div>` +
        `</div>` +
        `<div class="tp-list">${compose}${listHtml()}</div>` +
      `</div></div>`
    );
  }

  function paint(host) {
    const main = host.querySelector('.cal-main');
    main.innerHTML = pageHtml();
    const inp = main.querySelector('[data-compose]');
    if (inp) inp.focus();
  }

  window.renderCalinoTasks = function (host) {
    // 1) reuse the real chrome rendered by renderCalino
    // 2) retitle: "Tasks" in place of "May 2026", drop the month navigator
    const titleLeft = host.querySelector('.title-left');
    if (titleLeft) titleLeft.innerHTML = `<h1 class="month-title">Tasks</h1>`;
    // 3) activate the Tasks tab
    host.querySelectorAll('.tabs .tab').forEach(b => {
      b.classList.toggle('is-active', b.textContent.trim() === 'Tasks');
    });

    paint(host);

    // 4) interactions (delegated)
    host.addEventListener('click', (e) => {
      const check = e.target.closest('[data-check]');
      if (check) {
        const id = +check.closest('.task').dataset.id;
        const t = TASKS.find(x => x.id === id);
        if (t) { t.done = !t.done; paint(host); }
        return;
      }
      const seg = e.target.closest('[data-filter]');
      if (seg) { filter = seg.dataset.filter; composing = false; paint(host); return; }
      const add = e.target.closest('[data-add]');
      if (add) { composing = true; if (filter === 'completed') filter = 'active'; paint(host); return; }
    });

    host.addEventListener('keydown', (e) => {
      const inp = e.target.closest('[data-compose]');
      if (!inp) return;
      if (e.key === 'Enter' && inp.value.trim()) {
        TASKS.unshift({ id: Date.now(), title: inp.value.trim(), note: '', c: C.plum, p: 'low', due: null });
        paint(host);
      } else if (e.key === 'Escape') {
        composing = false; paint(host);
      }
    });
  };
})();
