const fs = require('fs'); const path = require('path'); const os = require('os');
const file = process.env.VERCEL ? path.join(os.tmpdir(), 'story-plans.json') : path.join(__dirname, '..', 'data', 'story-plans.json');
function read() { try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []; } catch { return []; } }
function write(plans) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(plans, null, 2)); }
function save(plan) { const plans = read(); const index = plans.findIndex(item => item.storyId === plan.storyId); if (index >= 0) plans[index] = plan; else plans.push(plan); write(plans); return plan; }
function get(storyId) { return read().find(plan => plan.storyId === storyId) || null; }
function update(storyId, mutate) { const plan = get(storyId); if (!plan) return null; mutate(plan); return save(plan); }
module.exports = { save, get, update };
