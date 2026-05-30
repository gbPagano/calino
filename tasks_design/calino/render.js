/* Calino renderer — builds the full Month view into a host element.        */
/* The SAME markup powers all three directions; only the theme class on the  */
/* root changes how chips, the grid and chrome look.                         */

(function () {
  const WD = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function iso(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day + 3);
    const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const fday = (firstThu.getUTCDay() + 6) % 7;
    firstThu.setUTCDate(firstThu.getUTCDate() - fday + 3);
    return 1 + Math.round((d - firstThu) / (7 * 864e5));
  }

  const recurSvg =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M13 6a5 5 0 0 0-9-1.5M3 4v2.5h2.5"/><path d="M3 10a5 5 0 0 0 9 1.5M13 12v-2.5h-2.5"/></svg>';
  const checkSvg =
    '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5l2.5 2.5L11 4"/></svg>';

  function chip(ev) {
    const cls = ['evt'];
    if (ev.type === 'task') cls.push('is-task');
    if (ev.recur) cls.push('is-recur');
    if (ev.done) cls.push('is-done');
    if (ev.allday) cls.push('is-allday');

    let inner = '<span class="evt-rail"></span><span class="evt-dot"></span>';
    if (ev.type === 'task') {
      inner += `<span class="evt-check">${ev.done ? checkSvg : ''}</span>`;
    }
    inner += `<span class="evt-body"><span class="evt-title">${ev.title}</span>`;
    if (ev.time || ev.location) {
      const meta = [ev.time, ev.location].filter(Boolean).join(' · ');
      inner += `<span class="evt-meta">${meta}</span>`;
    }
    inner += '</span>';
    if (ev.recur) inner += `<span class="evt-recur">${recurSvg}</span>`;

    return `<div class="${cls.join(' ')}" style="--c:${ev.color}">${inner}</div>`;
  }

  function dayCell(date, inMonth, todayIso, events) {
    const di = iso(date.getFullYear(), date.getMonth(), date.getDate());
    const isToday = di === todayIso;
    const cls = ['cell'];
    if (!inMonth) cls.push('is-out');
    if (isToday) cls.push('is-today');
    if (date.getDay() === 0 || date.getDay() === 6) cls.push('is-weekend');

    const evs = (inMonth && events[di]) ? events[di] : [];
    const chips = evs.map(chip).join('');
    return (
      `<div class="${cls.join(' ')}">` +
        `<div class="cell-head"><span class="cell-num">${date.getDate()}</span></div>` +
        `<div class="cell-evts">${chips}</div>` +
      `</div>`
    );
  }

  function miniCal(data) {
    const { year, month, today } = data;
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    const head = ['M','T','W','T','F','S','S'].map(d => `<span class="mini-wd">${d}</span>`).join('');
    let cells = '';
    const cur = new Date(start);
    for (let i = 0; i < 42; i++) {
      const inM = cur.getMonth() === month;
      const di = iso(cur.getFullYear(), cur.getMonth(), cur.getDate());
      const c = ['mini-d'];
      if (!inM) c.push('is-out');
      if (di === today) c.push('is-today');
      cells += `<span class="${c.join(' ')}">${cur.getDate()}</span>`;
      cur.setDate(cur.getDate() + 1);
      if (cur.getMonth() !== month && cur > new Date(year, month + 1, 0) && i >= 34) break;
    }
    return (
      `<div class="mini">` +
        `<div class="mini-head"><button class="mini-nav">‹</button>` +
        `<span class="mini-title"><b>${MONTHS[month]}</b> ${year}</span>` +
        `<button class="mini-nav">›</button></div>` +
        `<div class="mini-wds">${head}</div>` +
        `<div class="mini-grid">${cells}</div>` +
        `<button class="today-btn">Today</button>` +
      `</div>`
    );
  }

  function sidebar(data) {
    const tasks = data.tasks.map(t =>
      `<li class="todo">` +
        `<span class="todo-box"></span>` +
        `<span class="todo-title">${t.title}</span>` +
        `<span class="todo-due${t.overdue ? ' is-overdue' : ''}">${t.due}</span>` +
      `</li>`
    ).join('');

    return (
      `<aside class="cal-side">` +
        miniCal(data) +
        `<section class="side-sec">` +
          `<div class="side-head"><span>Calendars</span><button class="side-add">+</button></div>` +
          `<label class="cal-row"><input type="checkbox" checked><span class="cal-dot" style="--c:${data.colors.blue}"></span>Offline calendar</label>` +
        `</section>` +
        `<section class="side-sec is-card">` +
          `<div class="side-head"><span>Tasks <em class="badge">${data.taskCount}</em></span><button class="side-collapse">⌄</button></div>` +
          `<ul class="todos">${tasks}</ul>` +
          `<button class="view-all">View all →</button>` +
        `</section>` +
        `<section class="side-sec">` +
          `<div class="side-head"><span>Categories</span><button class="side-collapse">⌄</button></div>` +
        `</section>` +
        `<footer class="side-foot"><a>Privacy</a><a>GitHub</a></footer>` +
      `</aside>`
    );
  }

  function toolbar(data) {
    const tabs = ['Month','Week','Day','Agenda','Tasks']
      .map(t => `<button class="tab${t === 'Month' ? ' is-active' : ''}">${t}</button>`).join('');
    const chev = (d) => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d === 'l' ? 'M10 3.5L5.5 8l4.5 4.5' : 'M6 3.5L10.5 8 6 12.5'}"/></svg>`;
    return (
      `<header class="cal-top">` +
        `<div class="brand-mark"><span class="brand-dot"></span>Calino</div>` +
        `<div class="cal-titlebar">` +
          `<div class="title-left">` +
            `<h1 class="month-title">${MONTHS[data.month]} <span class="year">${data.year}</span></h1>` +
            `<div class="monthnav">` +
              `<button class="monthnav-arrow" aria-label="Previous month">${chev('l')}</button>` +
              `<button class="monthnav-today">Today</button>` +
              `<button class="monthnav-arrow" aria-label="Next month">${chev('r')}</button>` +
            `</div>` +
          `</div>` +
          `<div class="top-right">` +
            `<button class="icon-btn" aria-label="Search">` +
              `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="5.5"/><path d="M16 16l-3.5-3.5"/></svg>` +
            `</button>` +
            `<div class="tabs">${tabs}</div>` +
            `<button class="icon-btn"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="14" height="10" rx="1.5"/><path d="M6.5 16h5" stroke-linecap="round"/></svg></button>` +
            `<button class="icon-btn"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="9" r="2.6"/><path d="M9 1.6v2M9 14.4v2M16.4 9h-2M3.6 9h-2M14.2 3.8l-1.4 1.4M5.2 12.8l-1.4 1.4M14.2 14.2l-1.4-1.4M5.2 5.2L3.8 3.8" stroke-linecap="round"/></svg></button>` +
          `</div>` +
        `</div>` +
      `</header>`
    );
  }

  function grid(data) {
    const { year, month, today, events } = data;
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));

    const wdHead = `<div class="g-wnum">W#</div>` + WD.map(d => `<div class="g-wd">${d}</div>`).join('');

    let rows = '';
    const cur = new Date(start);
    for (let w = 0; w < 5; w++) {
      const weekNo = isoWeek(cur);
      let cells = '';
      for (let i = 0; i < 7; i++) {
        cells += dayCell(new Date(cur), cur.getMonth() === month, today, events);
        cur.setDate(cur.getDate() + 1);
      }
      rows += `<div class="g-row"><div class="g-wnum">${weekNo}</div>${cells}</div>`;
    }

    return (
      `<div class="cal-grid">` +
        `<div class="g-headrow">${wdHead}</div>` +
        `<div class="g-body">${rows}</div>` +
      `</div>`
    );
  }

  window.renderCalino = function (host, theme) {
    const data = window.CALINO;
    host.className = 'calino ' + (theme || 'theme-rail');
    host.innerHTML =
      toolbar(data) +
      `<div class="cal-body">` +
        sidebar(data) +
        `<main class="cal-main">${grid(data)}</main>` +
      `</div>`;
  };
})();
