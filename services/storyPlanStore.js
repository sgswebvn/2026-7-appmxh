const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), 'story-plans.json')
  : path.join(__dirname, '..', 'data', 'story-plans.json');

function read() {
  try {
    if (!fs.existsSync(STORE_FILE)) return [];
    const content = fs.readFileSync(STORE_FILE, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch (err) {
    console.warn('Error reading story-plans.json:', err.message);
    return [];
  }
}

function write(plans) {
  try {
    const dir = path.dirname(STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(plans, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing story-plans.json:', err.message);
  }
}

function save(plan) {
  if (!plan || !plan.storyId) throw new Error('Cannot save story plan without storyId.');
  const plans = read();
  const index = plans.findIndex(item => item.storyId === plan.storyId);
  if (index >= 0) {
    plans[index] = plan;
  } else {
    plans.unshift(plan);
  }
  write(plans);
  return plan;
}

function get(storyId) {
  if (!storyId) return null;
  const plans = read();
  return plans.find(plan => plan.storyId === storyId) || null;
}

function getAll() {
  return read();
}

function update(storyId, mutateFn) {
  const plan = get(storyId);
  if (!plan) return null;
  mutateFn(plan);
  return save(plan);
}

function remove(storyId) {
  const plans = read();
  const filtered = plans.filter(p => p.storyId !== storyId);
  write(filtered);
  return true;
}

module.exports = {
  save,
  get,
  getAll,
  update,
  remove
};
