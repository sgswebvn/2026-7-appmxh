import { run } from './orchestrator.js';
const command = process.argv[2] || 'status';
run(command).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(`Agent failed: ${error.message}`); process.exitCode = 1; });
