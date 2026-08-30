const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');
const { validateStoryPlan } = require('./storyPlanValidator');
const store = require('./storyPlanStore');

const schema = `Return ONLY JSON. StoryPlan: {storyId,topic,title,genre,style,durationTarget,characters:[{id,name,age,gender,role,personality:string[],appearance:{face,hair,clothing,body,style},visualPrompt,voice:{voiceId,language,gender,tone}}],relationships:[{id,fromCharacterId,toCharacterId,relationship,dynamic}],scenes:[{id,location,time,environment,characters:string[],action,emotion,dialogueIds:string[],visualPrompt}],dialogues:[{id,speakerId,text,emotion,action,voiceId,sceneId}],shots:[{id,sceneId,shotType,camera,duration,characters:string[],action,dialogueIds:string[],visualPrompt,transition}]}. Make a coherent multi-character conversational story. Use stable IDs consistently.`;
function extractJson(text) { const match = text.match(/\{[\s\S]*\}/); if (!match) throw new Error('LLM did not return a JSON object.'); return JSON.parse(match[0]); }
function referenceProfiles(plan) { return plan.characters.map(character => ({ characterId: character.id, canonicalAppearance: character.appearance, visualPrompt: character.visualPrompt, clothing: character.appearance.clothing, hairstyle: character.appearance.hair, facialFeatures: character.appearance.face, style: character.appearance.style, negativePrompt: 'inconsistent face, changing clothing, duplicate person, extra limbs, text, watermark' })); }
async function generateStoryPlan({ topic, style = 'conversational cinematic short', durationTarget = 30, apiKey, generate }) {
  if (!topic || !topic.trim()) { const error = new Error('A topic is required.'); error.code = 'INVALID_TOPIC'; throw error; }
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!generate && (!key || key.trim().length < 10)) { const error = new Error('Story generation requires a configured LLM API key. No static fallback is used.'); error.code = 'GENERATION_UNAVAILABLE'; throw error; }
  let plan;
  try {
    if (generate) plan = await generate({ topic: topic.trim(), style, durationTarget, schema });
    else { const model = new GoogleGenerativeAI(key.trim()).getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json' } }); const result = await model.generateContent(`You are a story planner. Topic: ${topic}\nStyle: ${style}\nDuration: ${durationTarget}s\n${schema}`); plan = extractJson(result.response.text()); }
  } catch (cause) { const error = new Error(`Story generation failed: ${cause.message}`); error.code = 'GENERATION_FAILED'; throw error; }
  plan = { ...plan, storyId: plan.storyId || `story_${uuidv4()}`, topic: topic.trim(), style, durationTarget: Number(durationTarget) || 30 };
  plan.characterReferences = referenceProfiles(plan);
  const validation = validateStoryPlan(plan); if (!validation.valid) { const error = new Error(`Generated StoryPlan is invalid: ${validation.issues.join(' ')}`); error.code = 'GENERATION_FAILED'; error.validation = validation; throw error; }
  return store.save(plan);
}
function validate(plan) { return validateStoryPlan(plan); }
function getStory(storyId) { return store.get(storyId); }
function createCharacter(storyId, character) { return store.update(storyId, plan => { plan.characters.push(character); plan.characterReferences = referenceProfiles(plan); }); }
function updateCharacter(storyId, id, patch) { return store.update(storyId, plan => { const character = plan.characters.find(item => item.id === id); if (!character) throw new Error('Character not found.'); Object.assign(character, patch, { id }); plan.characterReferences = referenceProfiles(plan); }); }
function createRelationship(storyId, relationship) { return store.update(storyId, plan => plan.relationships.push(relationship)); }
module.exports = { generateStoryPlan, validate, getStory, createCharacter, updateCharacter, createRelationship, referenceProfiles };
