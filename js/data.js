// Seed data for the simulated week. Times are minutes from midnight.
// Nothing here talks to a real calendar service; see README "what is simulated".

export const ATTENDEES = [
  { id: 'a1', name: 'Ravi Mehta', initials: 'RM' },
  { id: 'a2', name: 'Mei Lin', initials: 'ML' },
  { id: 'a3', name: 'Tom Okafor', initials: 'TO' },
  { id: 'a4', name: 'Aisha Khan', initials: 'AK' },
  { id: 'a5', name: 'Jonas Weber', initials: 'JW' },
  { id: 'a6', name: 'Clara Rossi', initials: 'CR' },
];

export const DAYS = [
  { key: 1, short: 'Mon', label: 'Mon 16 Nov' },
  { key: 2, short: 'Tue', label: 'Tue 17 Nov' },
  { key: 3, short: 'Wed', label: 'Wed 18 Nov' },
  { key: 4, short: 'Thu', label: 'Thu 19 Nov' },
  { key: 5, short: 'Fri', label: 'Fri 20 Nov' },
];

export const DAY_NAMES = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };

export const EVENTS = [
  { id: 'ev-standup', title: 'Team standup', day: 1, start: 540, end: 585, shared: true, owner: 'you', people: 4 },
  { id: 'ev-lecture', title: 'IIS lecture', day: 2, start: 600, end: 660, shared: false, owner: 'you', people: 0 },
  { id: 'ev-1on1', title: '1:1 with Sam', day: 2, start: 840, end: 870, shared: false, owner: 'you', people: 1 },
  { id: 'ev-sprint', title: 'Sprint planning', day: 3, start: 660, end: 720, shared: true, owner: 'you', people: 5 },
  { id: 'ev-review', title: 'Project review', day: 4, start: 600, end: 660, shared: true, owner: 'you', people: 6 },
  { id: 'ev-focus', title: 'Focus block', day: 5, start: 780, end: 840, shared: false, owner: 'you', people: 0 },
];

// The undo-window timeline. Each entry fires once t reaches `at`.
// Attendance is what makes undo partial: a calendar entry can be restored,
// a message someone already read cannot.
export const NOTIFY_TIMELINE = [
  { at: 4000, opens: 1 },
  { at: 9000, opens: 2 },
];

export const UNDO_WINDOW_MS = 30000;

export const SAMPLE_REQUESTS = [
  'Move the project review to Friday morning',
  'Push the project review to Friday at 2pm',
  'Move the sprint planning to Wednesday afternoon',
  'Book me a flight to Berlin on Friday',
];
