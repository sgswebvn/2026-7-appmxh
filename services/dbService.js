const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Mongoose Models
const User = require('../models/User');
const Channel = require('../models/Channel');
const History = require('../models/History');
const GeminiDraft = require('../models/GeminiDraft');

function isConnectedToMongo() {
  return mongoose.connection.readyState === 1;
}

// Local fallback store
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function initLocalDB() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      users: [],
      channels: [],
      history: [],
      geminiDrafts: [],
      quotaUsage: {
        date: new Date().toISOString().split('T')[0],
        unitsUsed: 0,
        limit: 10000
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

function readLocalDB() {
  initLocalDB();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return { users: [], channels: [], history: [], geminiDrafts: [], quotaUsage: { date: new Date().toISOString().split('T')[0], unitsUsed: 0, limit: 10000 } };
  }
}

function writeLocalDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi ghi local db:', err);
  }
}

// ==================== USER OPERATIONS ====================
async function createUser(userData) {
  if (isConnectedToMongo()) {
    const user = new User({
      email: userData.email.toLowerCase().trim(),
      password: userData.password,
      name: userData.name || 'Creator',
      geminiApiKey: userData.geminiApiKey || '',
      role: userData.role || 'user'
    });
    return await user.save();
  } else {
    const db = readLocalDB();
    if (!db.users) db.users = [];
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);
    
    const newUser = {
      _id: uuidv4(),
      id: uuidv4(),
      email: userData.email.toLowerCase().trim(),
      password: hashedPassword,
      name: userData.name || 'Creator',
      geminiApiKey: userData.geminiApiKey || '',
      role: userData.role || 'user',
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeLocalDB(db);
    return newUser;
  }
}

async function findUserByEmail(email) {
  const cleanEmail = email.toLowerCase().trim();
  if (isConnectedToMongo()) {
    return await User.findOne({ email: cleanEmail });
  } else {
    const db = readLocalDB();
    const user = (db.users || []).find(u => u.email === cleanEmail);
    if (user) {
      user.comparePassword = async function(candidate) {
        return bcrypt.compare(candidate, user.password);
      };
      return user;
    }
    return null;
  }
}

async function findUserById(id) {
  if (isConnectedToMongo()) {
    return await User.findById(id).select('-password');
  } else {
    const db = readLocalDB();
    const user = (db.users || []).find(u => (u._id && u._id.toString() === id.toString()) || u.id === id);
    if (user) {
      const { password, ...safeUser } = user;
      return safeUser;
    }
    return null;
  }
}

async function updateUserGeminiKey(userId, apiKey) {
  if (isConnectedToMongo()) {
    return await User.findByIdAndUpdate(userId, { geminiApiKey: apiKey }, { returnDocument: 'after' });
  } else {
    const db = readLocalDB();
    const user = (db.users || []).find(u => (u._id && u._id.toString() === userId.toString()) || u.id === userId);
    if (user) {
      user.geminiApiKey = apiKey;
      writeLocalDB(db);
    }
    return user;
  }
}

// ==================== CHANNELS OPERATIONS ====================
async function getChannels(userId) {
  if (isConnectedToMongo()) {
    return await Channel.find({ userId: userId.toString() }).sort({ createdAt: -1 });
  } else {
    const db = readLocalDB();
    return (db.channels || []).filter(c => c.userId === userId.toString());
  }
}

async function getChannelById(userId, channelId) {
  if (isConnectedToMongo()) {
    return await Channel.findOne({ userId: userId.toString(), channelId: channelId.toString() });
  } else {
    const db = readLocalDB();
    return (db.channels || []).find(c => c.userId === userId.toString() && (c.channelId === channelId.toString() || c.id === channelId.toString()));
  }
}

async function saveChannel(userId, channelData) {
  const cleanUserId = userId.toString();
  const cleanChannelId = (channelData.id || channelData.channelId).toString();

  if (isConnectedToMongo()) {
    return await Channel.findOneAndUpdate(
      { userId: cleanUserId, channelId: cleanChannelId },
      {
        userId: cleanUserId,
        channelId: cleanChannelId,
        title: channelData.title,
        customUrl: channelData.customUrl || '',
        description: channelData.description || '',
        thumbnailUrl: channelData.thumbnailUrl || '',
        subscriberCount: Number(channelData.subscriberCount) || 0,
        videoCount: Number(channelData.videoCount) || 0,
        viewCount: Number(channelData.viewCount) || 0,
        email: channelData.email || '',
        tokens: channelData.tokens,
        updatedAt: new Date()
      },
      { upsert: true, returnDocument: 'after' }
    );
  } else {
    const db = readLocalDB();
    if (!db.channels) db.channels = [];
    const index = db.channels.findIndex(c => c.userId === cleanUserId && (c.channelId === cleanChannelId || c.id === cleanChannelId));
    
    const record = {
      userId: cleanUserId,
      channelId: cleanChannelId,
      id: cleanChannelId,
      ...channelData,
      updatedAt: new Date().toISOString()
    };

    if (index >= 0) {
      db.channels[index] = { ...db.channels[index], ...record };
    } else {
      record.createdAt = new Date().toISOString();
      db.channels.push(record);
    }
    writeLocalDB(db);
    return record;
  }
}

// Tự động tăng số lượng video đã đăng của kênh khi upload thành công
async function incrementChannelVideoCount(userId, channelId) {
  const cleanUserId = userId.toString();
  const cleanChannelId = channelId.toString();

  if (isConnectedToMongo()) {
    return await Channel.findOneAndUpdate(
      { userId: cleanUserId, channelId: cleanChannelId },
      { $inc: { videoCount: 1 }, updatedAt: new Date() },
      { returnDocument: 'after' }
    );
  } else {
    const db = readLocalDB();
    const channel = (db.channels || []).find(c => c.userId === cleanUserId && (c.channelId === cleanChannelId || c.id === cleanChannelId));
    if (channel) {
      channel.videoCount = (Number(channel.videoCount) || 0) + 1;
      channel.updatedAt = new Date().toISOString();
      writeLocalDB(db);
    }
  }
}

// Cập nhật số liệu mới nhất từ YouTube (Subscribers, Videos, Views)
async function updateChannelStats(userId, channelId, stats) {
  const cleanUserId = userId.toString();
  const cleanChannelId = channelId.toString();

  if (isConnectedToMongo()) {
    return await Channel.findOneAndUpdate(
      { userId: cleanUserId, channelId: cleanChannelId },
      {
        subscriberCount: Number(stats.subscriberCount) || 0,
        videoCount: Number(stats.videoCount) || 0,
        viewCount: Number(stats.viewCount) || 0,
        updatedAt: new Date()
      },
      { returnDocument: 'after' }
    );
  } else {
    const db = readLocalDB();
    const channel = (db.channels || []).find(c => c.userId === cleanUserId && (c.channelId === cleanChannelId || c.id === cleanChannelId));
    if (channel) {
      channel.subscriberCount = Number(stats.subscriberCount) || channel.subscriberCount;
      channel.videoCount = Number(stats.videoCount) || channel.videoCount;
      channel.viewCount = Number(stats.viewCount) || channel.viewCount;
      channel.updatedAt = new Date().toISOString();
      writeLocalDB(db);
    }
  }
}

async function deleteChannel(userId, channelId) {
  const cleanUserId = userId.toString();
  const cleanChannelId = channelId.toString();

  if (isConnectedToMongo()) {
    return await Channel.deleteOne({ userId: cleanUserId, channelId: cleanChannelId });
  } else {
    const db = readLocalDB();
    db.channels = (db.channels || []).filter(c => !(c.userId === cleanUserId && (c.channelId === cleanChannelId || c.id === cleanChannelId)));
    writeLocalDB(db);
    return true;
  }
}

async function updateChannelTokens(userId, channelId, tokens) {
  const cleanUserId = userId.toString();
  const cleanChannelId = channelId.toString();

  if (isConnectedToMongo()) {
    return await Channel.findOneAndUpdate(
      { userId: cleanUserId, channelId: cleanChannelId },
      { tokens, updatedAt: new Date() }
    );
  } else {
    const db = readLocalDB();
    const channel = (db.channels || []).find(c => c.userId === cleanUserId && (c.channelId === cleanChannelId || c.id === cleanChannelId));
    if (channel) {
      channel.tokens = { ...channel.tokens, ...tokens };
      channel.updatedAt = new Date().toISOString();
      writeLocalDB(db);
    }
  }
}

// ==================== HISTORY OPERATIONS ====================
async function getHistory(userId) {
  const cleanUserId = userId.toString();
  if (isConnectedToMongo()) {
    return await History.find({ userId: cleanUserId }).sort({ createdAt: -1 });
  } else {
    const db = readLocalDB();
    return (db.history || [])
      .filter(h => h.userId === cleanUserId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

async function addHistory(userId, record) {
  const cleanUserId = userId.toString();
  if (isConnectedToMongo()) {
    const hist = new History({ ...record, userId: cleanUserId });
    return await hist.save();
  } else {
    const db = readLocalDB();
    if (!db.history) db.history = [];
    const item = { ...record, userId: cleanUserId, _id: uuidv4(), createdAt: new Date().toISOString() };
    db.history.unshift(item);
    writeLocalDB(db);
    return item;
  }
}

// ==================== GEMINI DRAFTS OPERATIONS ====================
async function saveGeminiDraft(userId, draftData) {
  const cleanUserId = userId.toString();
  if (isConnectedToMongo()) {
    const draft = new GeminiDraft({ ...draftData, userId: cleanUserId });
    return await draft.save();
  } else {
    const db = readLocalDB();
    if (!db.geminiDrafts) db.geminiDrafts = [];
    const item = { ...draftData, userId: cleanUserId, _id: uuidv4(), createdAt: new Date().toISOString() };
    db.geminiDrafts.unshift(item);
    writeLocalDB(db);
    return item;
  }
}

async function getGeminiDrafts(userId) {
  const cleanUserId = userId.toString();
  if (isConnectedToMongo()) {
    return await GeminiDraft.find({ userId: cleanUserId }).sort({ createdAt: -1 }).limit(10);
  } else {
    const db = readLocalDB();
    return (db.geminiDrafts || [])
      .filter(d => d.userId === cleanUserId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);
  }
}

// ==================== QUOTA USAGE ====================
function getQuotaUsage() {
  const db = readLocalDB();
  const today = new Date().toISOString().split('T')[0];
  if (!db.quotaUsage || db.quotaUsage.date !== today) {
    db.quotaUsage = { date: today, unitsUsed: 0, limit: 10000 };
    writeLocalDB(db);
  }
  return db.quotaUsage;
}

function addQuotaUsage(units) {
  const db = readLocalDB();
  const today = new Date().toISOString().split('T')[0];
  if (!db.quotaUsage || db.quotaUsage.date !== today) {
    db.quotaUsage = { date: today, unitsUsed: 0, limit: 10000 };
  }
  db.quotaUsage.unitsUsed += units;
  writeLocalDB(db);
  return db.quotaUsage;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserGeminiKey,
  getChannels,
  getChannelById,
  saveChannel,
  incrementChannelVideoCount,
  updateChannelStats,
  deleteChannel,
  updateChannelTokens,
  getHistory,
  addHistory,
  saveGeminiDraft,
  getGeminiDrafts,
  getQuotaUsage,
  addQuotaUsage
};
