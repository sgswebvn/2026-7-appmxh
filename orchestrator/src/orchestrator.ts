import { improve, review, status, verify } from './cycle-manager.js';
export async function run(command: string) {
  if (command === 'review') return review();
  if (command === 'verify') return verify();
  if (command === 'status') return status();
  if (command === 'improve') return improve();
  throw new Error(`Unknown command: ${command}. Use review, improve, verify, or status.`);
}
