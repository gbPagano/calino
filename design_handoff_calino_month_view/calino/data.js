/* Calino — May 2026 sample data. One source of truth for all directions. */
/* Event colors are USER-CHOSEN (per the brief), stored as a base hue hex.   */
/* Each theme derives its own tint/treatment from --c so ANY color reads     */
/* calm and intentional, never like an alert.                                */

window.CALINO = (function () {
  // A calm, user-pickable palette (the kind of colors people actually choose)
  const C = {
    rose:  '#c2697f',
    blue:  '#5b7fb5',
    green: '#5d9a78',
    amber: '#bf944e',
    plum:  '#8a6aa8',
  };

  // type: 'event' | 'task'  ·  allday: spans the day (holidays/trips)
  // recur: recurring  ·  done: task checked
  const E = (title, color, opts = {}) => Object.assign({ title, color, type: 'event' }, opts);
  const T = (title, color, opts = {}) => Object.assign({ title, color, type: 'task' }, opts);

  // Keyed by ISO date (2026-05-DD)
  const events = {
    '2026-05-01': [E('March Kickoff Meeting', C.rose)],
    '2026-05-05': [
      E('Dentist Appointment', C.rose),
      E('Gym Session', C.blue, { recur: true }),
      T('Submit expense report', C.rose),
    ],
    '2026-05-07': [
      E('Client Call · Acme Corp', C.rose, { recur: true }),
      E('Gym Session', C.blue, { recur: true }),
    ],
    '2026-05-08': [E('Daylight Saving Time', C.amber, { allday: true })],
    '2026-05-09': [T('Buy birthday gift for Sarah', C.rose)],
    '2026-05-10': [
      E('Dinner with Sarah', C.rose),
      T('Book flight for conference', C.green, { done: true }),
    ],
    '2026-05-12': [
      E("Tom's Birthday", C.rose, { allday: true }),
      E('Gym Session', C.blue, { recur: true }),
    ],
    '2026-05-14': [
      E('Work Retreat', C.rose),
      E('Client Call · Acme Corp', C.rose, { recur: true }),
      E('Gym Session', C.blue, { recur: true }),
    ],
    '2026-05-15': [
      E('Lunch with Mom', C.rose),
      T('Review Q1 goals', C.plum),
    ],
    '2026-05-16': [E('Design Sprint', C.plum, { allday: true })],
    '2026-05-17': [
      E('Design Sprint', C.plum, { allday: true }),
      E("St. Patrick's Lunch", C.amber),
    ],
    '2026-05-18': [
      E('Code Review Session', C.rose),
      T('Plan weekend trip', C.green, { done: true }),
    ],
    '2026-05-19': [E('Gym Session', C.blue, { recur: true })],
    '2026-05-20': [
      E('National Day · No Work', C.amber, { allday: true }),
      T('Update documentation', C.green, { done: true }),
    ],
    '2026-05-21': [
      E('Project Review', C.rose),
      E('Client Call · Acme Corp', C.rose, { recur: true }),
      E('Gym Session', C.blue, { recur: true }),
    ],
    '2026-05-22': [E('Product Planning Workshop', C.plum)],
    '2026-05-24': [
      E('Family Vacation', C.amber, { allday: true }),
      E('Doctor Checkup', C.rose),
    ],
    '2026-05-25': [
      E('Family Vacation', C.amber, { allday: true }),
      T('Schedule dentist appointment', C.blue),
    ],
    '2026-05-26': [
      E('Family Vacation', C.amber, { allday: true }),
      E('Gym Session', C.blue, { recur: true }),
    ],
    '2026-05-27': [
      E('Brunch with Friends', C.blue, { time: '12:00 – 14:00', location: 'Cafe Rouge' }),
      E('Yoga Class', C.blue, { recur: true }),
    ],
    '2026-05-28': [
      E('Client Call · Acme Corp', C.rose, { recur: true }),
      E('Gym Session', C.blue, { recur: true }),
      T('Renew car insurance', C.rose),
    ],
    '2026-05-29': [E('One-on-One with Manager', C.rose, { recur: true })],
    '2026-05-30': [E('Q1 Retrospective', C.rose, { time: '15:00 – 16:30', location: 'Conference Room C' })],
    '2026-05-31': [E('Monthly Report Deadline', C.rose, { time: '11:00 – 12:00' })],
  };

  // Sidebar to-do list
  const tasks = [
    { title: 'Renew car insurance', due: 'May 28', overdue: false },
    { title: 'Schedule dentist appointment', due: 'May 25', overdue: false },
    { title: 'Update documentation', due: 'May 20', overdue: true },
    { title: 'Plan weekend trip', due: 'May 18', overdue: true },
    { title: 'Review Q1 goals', due: 'May 15', overdue: true },
  ];

  return {
    colors: C,
    events,
    tasks,
    today: '2026-05-30',
    month: 4,   // May (0-indexed)
    year: 2026,
    taskCount: 8,
  };
})();
