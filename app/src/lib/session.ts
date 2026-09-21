/** Une session = six pas, toujours dans le même ordre. Reprise au pas exact. Rattrapage après absence. */
export type Step = { t: string; d: string; m: string; go: string | null };
export type SessionState = { done: boolean[]; catchup: boolean };

export const STEPS: Step[] = [
  { t: 'Ouvrir', d: "L'anecdote du jour", m: '20 s', go: 'anec' },
  { t: 'Échauffer', d: 'Les révisions dues', m: '3 min', go: 'rev' },
  { t: 'Apprendre', d: 'Une brique, puis ses composés', m: '3 min', go: 'learn' },
  { t: 'Utiliser', d: 'Deux mots, une phrase, trois lignes', m: '2 min', go: 'use' },
  { t: 'Fixer', d: 'Une vérification', m: '1 min', go: 'check' },
  { t: 'Clore', d: 'Le constat et la graine', m: '20 s', go: 'close' }
];
export const CATCHUP: Step[] = [
  { t: 'Réviser', d: 'Les plus urgentes', m: '5 min', go: 'rev' },
  { t: 'Réviser', d: '', m: '5 min', go: 'rev' },
  { t: 'Réviser', d: '', m: '5 min', go: 'rev' },
  { t: 'Nouveaux caractères', d: 'Reviennent quand la pile est redescendue', m: '', go: null }
];
export const steps = (s: SessionState) => (s.catchup ? CATCHUP : STEPS);
export const nextIndex = (s: SessionState) => steps(s).findIndex((x, i) => !s.done[i] && x.go);
export const budgetNewBricks = (minutes: 5 | 10 | 20) => ({ 5: 0, 10: 1, 20: 2 })[minutes];
