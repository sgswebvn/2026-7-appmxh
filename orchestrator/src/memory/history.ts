import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function saveCycle(cycle: number, name: string, value: string) {
  const dir = path.resolve('.agent/cycles', `cycle-${String(cycle).padStart(3, '0')}`);
  await mkdir(dir, { recursive: true }); await writeFile(path.join(dir, name), value);
  return dir;
}
