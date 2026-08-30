export const STATES = [
  'IDLE', 'START_CYCLE', 'ENSURE_SERVER', 'DISCOVER', 'PLAYWRIGHT_REVIEW', 'ANTIGRAVITY_REVIEW', 'ANALYZE',
  'CREATE_FINDINGS', 'PRIORITIZE', 'CREATE_TASK', 'CODEX_IMPLEMENT',
  'BUILD', 'TEST', 'BROWSER_VERIFY', 'ANTIGRAVITY_VERIFY', 'SCORE', 'PASS', 'FAIL'
] as const;

export type CycleState = (typeof STATES)[number];

export class StateMachine {
  private states: CycleState[] = ['IDLE'];
  transition(state: CycleState) { this.states.push(state); }
  history() { return [...this.states]; }
  current() { return this.states[this.states.length - 1]; }
}
