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
const Brand = require('../models/Brand');
const ContentProject = require('../models/ContentProject');
const ContentPlan = require('../models/ContentPlan');
const ChannelGroup = require('../models/ChannelGroup');

function isConnectedToMongo() {
  return mongoose.connection.readyState === 1;
}

// Local fallback store (Tương thích cả Vercel Serverless /tmp và Local environment)
const os = require('os');
const DATA_DIR = process.env.VERCEL ? path.join(os.tmpdir(), 'ytb_data') : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  // Bỏ qua lỗi read-only trên môi trường serverless
}

function initLocalDB() {
  try {
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
  } catch (e) {}
}

function readLocalDB() {
  initLocalDB();
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {}
  return { users: [], channels: [], history: [], geminiDrafts: [], quotaUsage: { date: new Date().toISOString().split('T')[0], unitsUsed: 0, limit: 10000 } };
}

function writeLocalDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    // Local fallback silent on serverless
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

async function ensureMongoConnected() {
  if (process.env.MONGODB_URI && mongoose.connection.readyState !== 1) {
    try {
      const { connectDB } = require('../config/db');
      await connectDB();
    } catch (e) {}
  }
}

async function findUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();
  await ensureMongoConnected();
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

async function findUserById(id, emailFallback = '') {
  if (!id && !emailFallback) return null;
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    try {
      if (id && mongoose.isValidObjectId(id)) {
        const u = await User.findById(id).select('-password');
        if (u) return u;
      }
    } catch (e) {}

    // Fallback tìm theo Email nếu ID có sự thay đổi
    if (emailFallback) {
      return await User.findOne({ email: emailFallback.toLowerCase().trim() }).select('-password');
    }
    return null;
  } else {
    const db = readLocalDB();
    const user = (db.users || []).find(u => 
      (u._id && u._id.toString() === (id ? id.toString() : '')) || 
      u.id === id || 
      (emailFallback && u.email === emailFallback.toLowerCase().trim())
    );
    if (user) {
      const { password, ...safeUser } = user;
      return safeUser;
    }
    return null;
  }
}

// ==================== ADMIN & TEST USER OPERATIONS ====================

// Tự động khởi tạo tài khoản Quản trị viên (Admin) mặc định nếu chưa tồn tại
async function initDefaultAdmin() {
  try {
    const adminEmail = 'admin@admin.com';
    let admin = await findUserByEmail(adminEmail);
    if (!admin) {
      if (isConnectedToMongo()) {
        const user = new User({
          email: adminEmail,
          password: 'admin123',
          name: 'Administrator',
          role: 'admin',
          isTestAccount: false
        });
        await user.save();
        console.log('👑 [Admin] Đã khởi tạo tài khoản Admin mặc định (admin@admin.com / admin123)');
      } else {
        await createUser({
          email: adminEmail,
          password: 'admin123',
          name: 'Administrator',
          role: 'admin'
        });
        console.log('👑 [Admin] Đã khởi tạo tài khoản Admin Local (admin@admin.com / admin123)');
      }
    } else if (admin.role !== 'admin') {
      if (isConnectedToMongo()) {
        await User.findByIdAndUpdate(admin._id, { role: 'admin' });
      } else {
        const db = readLocalDB();
        const found = (db.users || []).find(u => u.email === adminEmail);
        if (found) {
          found.role = 'admin';
          writeLocalDB(db);
        }
      }
    }
  } catch (err) {
    console.error('Lỗi khởi tạo tài khoản Admin:', err.message);
  }
}

// Admin tạo tài khoản Test tự động khóa sau N phút (mặc định 10 phút)
async function createTestUser({ email, password, name, durationMinutes = 10, createdBy = 'admin' }) {
  const cleanEmail = email.toLowerCase().trim();
  const duration = Number(durationMinutes) || 10;
  const expiresAt = new Date(Date.now() + duration * 60 * 1000);

  if (isConnectedToMongo()) {
    const user = new User({
      email: cleanEmail,
      password: password,
      name: name || `Test User (${duration}m)`,
      role: 'user',
      isTestAccount: true,
      durationMinutes: duration,
      expiresAt: expiresAt,
      isLocked: false,
      plainPassword: password,
      createdBy: createdBy
    });
    return await user.save();
  } else {
    const db = readLocalDB();
    if (!db.users) db.users = [];

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      _id: uuidv4(),
      id: uuidv4(),
      email: cleanEmail,
      password: hashedPassword,
      name: name || `Test User (${duration}m)`,
      role: 'user',
      isTestAccount: true,
      durationMinutes: duration,
      expiresAt: expiresAt.toISOString(),
      isLocked: false,
      plainPassword: password,
      createdBy: createdBy,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeLocalDB(db);
    return newUser;
  }
}

// Lấy danh sách tất cả tài khoản Test cho Admin
async function getTestUsers() {
  await ensureMongoConnected();
  let users = [];
  if (isConnectedToMongo()) {
    users = await User.find({ isTestAccount: true }).sort({ createdAt: -1 }).lean();
  } else {
    const db = readLocalDB();
    users = (db.users || []).filter(u => u.isTestAccount);
  }

  const now = Date.now();
  return users.map(u => {
    const expTime = u.expiresAt ? new Date(u.expiresAt).getTime() : 0;
    const remainingSeconds = expTime > now ? Math.floor((expTime - now) / 1000) : 0;
    const isExpired = expTime ? now >= expTime : false;

    return {
      id: u._id ? u._id.toString() : u.id,
      email: u.email,
      name: u.name,
      plainPassword: u.plainPassword || '******',
      durationMinutes: u.durationMinutes || 10,
      expiresAt: u.expiresAt,
      isLocked: Boolean(u.isLocked),
      isExpired: isExpired,
      remainingSeconds: remainingSeconds,
      createdAt: u.createdAt,
      createdBy: u.createdBy || 'admin'
    };
  });
}

// Gia hạn thêm thời gian cho tài khoản Test (+10p, +30p,...) và mở khóa
async function extendTestUser(userId, additionalMinutes = 10) {
  await ensureMongoConnected();
  const addMs = Number(additionalMinutes) * 60 * 1000;
  const now = Date.now();

  if (isConnectedToMongo()) {
    if (!mongoose.isValidObjectId(userId)) return null;
    const user = await User.findById(userId);
    if (!user) return null;

    const currentExp = user.expiresAt ? new Date(user.expiresAt).getTime() : now;
    const baseTime = currentExp > now ? currentExp : now;
    const newExpiresAt = new Date(baseTime + addMs);

    user.expiresAt = newExpiresAt;
    user.isLocked = false;
    user.durationMinutes = (user.durationMinutes || 10) + Number(additionalMinutes);
    return await user.save();
  } else {
    const db = readLocalDB();
    const user = (db.users || []).find(u => (u._id && u._id.toString() === userId.toString()) || u.id === userId);
    if (!user) return null;

    const currentExp = user.expiresAt ? new Date(user.expiresAt).getTime() : now;
    const baseTime = currentExp > now ? currentExp : now;
    user.expiresAt = new Date(baseTime + addMs).toISOString();
    user.isLocked = false;
    user.durationMinutes = (user.durationMinutes || 10) + Number(additionalMinutes);
    writeLocalDB(db);
    return user;
  }
}

// Khóa hoặc Mở khóa thủ công tài khoản
async function toggleLockUser(userId) {
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    if (!mongoose.isValidObjectId(userId)) return null;
    const user = await User.findById(userId);
    if (!user) return null;
    user.isLocked = !user.isLocked;
    return await user.save();
  } else {
    const db = readLocalDB();
    const user = (db.users || []).find(u => (u._id && u._id.toString() === userId.toString()) || u.id === userId);
    if (!user) return null;
    user.isLocked = !user.isLocked;
    writeLocalDB(db);
    return user;
  }
}

// Xóa tài khoản Test
async function deleteTestUser(userId) {
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    if (mongoose.isValidObjectId(userId)) {
      await Channel.deleteMany({ userId: userId.toString() });
      await History.deleteMany({ userId: userId.toString() });
      await GeminiDraft.deleteMany({ userId: userId.toString() });
      return await User.findByIdAndDelete(userId);
    }
    return true;
  } else {
    const db = readLocalDB();
    db.users = (db.users || []).filter(u => !( (u._id && u._id.toString() === userId.toString()) || u.id === userId ));
    db.channels = (db.channels || []).filter(c => c.userId !== userId.toString());
    db.history = (db.history || []).filter(h => h.userId !== userId.toString());
    db.geminiDrafts = (db.geminiDrafts || []).filter(g => g.userId !== userId.toString());
    writeLocalDB(db);
    return true;
  }
}

// Kiểm tra trạng thái hết hạn và tự động khóa nếu quá thời gian
function checkUserLockAndExpiry(user) {
  if (!user) return { isExpired: false, isLocked: false, remainingSeconds: 0 };

  const isLocked = Boolean(user.isLocked);
  let isExpired = false;
  let remainingSeconds = 0;

  if (user.isTestAccount && user.expiresAt) {
    const now = Date.now();
    const expTime = new Date(user.expiresAt).getTime();
    if (now >= expTime) {
      isExpired = true;
      remainingSeconds = 0;
    } else {
      remainingSeconds = Math.floor((expTime - now) / 1000);
    }
  }

  return {
    isExpired,
    isLocked,
    remainingSeconds,
    canAccess: !isLocked && !isExpired
  };
}

async function updateUserGeminiKey(userId, apiKey) {
  await ensureMongoConnected();
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
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    return await Channel.find({ userId: userId.toString() }).sort({ createdAt: -1 });
  } else {
    const db = readLocalDB();
    return (db.channels || []).filter(c => c.userId === userId.toString());
  }
}

async function getChannelById(userId, channelId) {
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    return await Channel.findOne({ userId: userId.toString(), channelId: channelId.toString() });
  } else {
    const db = readLocalDB();
    return (db.channels || []).find(c => c.userId === userId.toString() && (c.channelId === channelId.toString() || c.id === channelId.toString()));
  }
}

async function saveChannel(userId, channelData) {
  await ensureMongoConnected();
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
  await ensureMongoConnected();
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
  await ensureMongoConnected();
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
  await ensureMongoConnected();
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
  await ensureMongoConnected();
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

async function clearHistory(userId) {
  await ensureMongoConnected();
  const cleanUserId = userId.toString();
  if (isConnectedToMongo()) {
    return await History.deleteMany({ userId: cleanUserId });
  } else {
    const db = readLocalDB();
    if (db.history) {
      db.history = db.history.filter(h => h.userId !== cleanUserId);
      writeLocalDB(db);
    }
    return { acknowledged: true };
  }
}

// ==================== GEMINI DRAFTS OPERATIONS ====================
async function saveGeminiDraft(userId, draftData) {
  await ensureMongoConnected();
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
  await ensureMongoConnected();
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

// ==================== MULTI-BRAND OPERATIONS ====================
async function getBrands(userId) {
  if (isConnectedToMongo()) {
    return Brand.find({ userId }).sort({ createdAt: -1 });
  }
  const db = readLocalDB();
  return (db.brands || []).filter(b => b.userId === userId);
}

async function getBrandById(userId, brandId) {
  if (isConnectedToMongo()) {
    return Brand.findOne({ userId, _id: brandId });
  }
  const db = readLocalDB();
  return (db.brands || []).find(b => b.userId === userId && (b._id === brandId || b.id === brandId));
}

async function createBrand(userId, brandData) {
  if (isConnectedToMongo()) {
    return Brand.create({
      userId,
      name: brandData.name,
      description: brandData.description || '',
      targetAudience: brandData.targetAudience || 'Khán giả đại chúng',
      toneOfVoice: brandData.toneOfVoice || 'Hấp dẫn, kích thích tò mò',
      primaryColor: brandData.primaryColor || '#e11d48',
      socialChannels: brandData.socialChannels || []
    });
  }
  const db = readLocalDB();
  if (!db.brands) db.brands = [];
  const newBrand = {
    id: uuidv4(),
    _id: uuidv4(),
    userId,
    name: brandData.name,
    description: brandData.description || '',
    targetAudience: brandData.targetAudience || 'Khán giả đại chúng',
    toneOfVoice: brandData.toneOfVoice || 'Hấp dẫn, kích thích tò mò',
    primaryColor: brandData.primaryColor || '#e11d48',
    socialChannels: brandData.socialChannels || [],
    createdAt: new Date()
  };
  db.brands.unshift(newBrand);
  writeLocalDB(db);
  return newBrand;
}

async function updateBrand(userId, brandId, brandData) {
  if (isConnectedToMongo()) {
    return Brand.findOneAndUpdate(
      { userId, _id: brandId },
      { $set: { ...brandData, updatedAt: new Date() } },
      { new: true }
    );
  }
  const db = readLocalDB();
  if (!db.brands) db.brands = [];
  const idx = db.brands.findIndex(b => b.userId === userId && (b._id === brandId || b.id === brandId));
  if (idx !== -1) {
    db.brands[idx] = { ...db.brands[idx], ...brandData, updatedAt: new Date() };
    writeLocalDB(db);
    return db.brands[idx];
  }
  return null;
}

async function deleteBrand(userId, brandId) {
  if (isConnectedToMongo()) {
    return Brand.deleteOne({ userId, _id: brandId });
  }
  const db = readLocalDB();
  if (!db.brands) db.brands = [];
  db.brands = db.brands.filter(b => !(b.userId === userId && (b._id === brandId || b.id === brandId)));
  writeLocalDB(db);
  return true;
}

// ==================== CONTENT PROJECTS (CONTENT LIBRARY) ====================
async function getContentProjects(userId, brandId = null) {
  const query = { userId };
  if (brandId) query.brandId = brandId;

  if (isConnectedToMongo()) {
    return ContentProject.find(query).sort({ updatedAt: -1 });
  }
  const db = readLocalDB();
  return (db.contentProjects || []).filter(p => p.userId === userId && (!brandId || p.brandId === brandId));
}

async function createContentProject(userId, projectData) {
  if (isConnectedToMongo()) {
    return ContentProject.create({
      userId,
      brandId: projectData.brandId || '',
      title: projectData.title,
      topic: projectData.topic || '',
      contentType: projectData.contentType || 'SHORT',
      status: projectData.status || 'IDEA',
      scriptData: projectData.scriptData || null,
      seoMetadata: projectData.seoMetadata || null,
      mediaFiles: projectData.mediaFiles || [],
      scheduledAt: projectData.scheduledAt || null
    });
  }
  const db = readLocalDB();
  if (!db.contentProjects) db.contentProjects = [];
  const newProj = {
    id: uuidv4(),
    _id: uuidv4(),
    userId,
    ...projectData,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  db.contentProjects.unshift(newProj);
  writeLocalDB(db);
  return newProj;
}

async function updateContentProject(userId, projectId, projectData) {
  if (isConnectedToMongo()) {
    return ContentProject.findOneAndUpdate(
      { userId, _id: projectId },
      { $set: { ...projectData, updatedAt: new Date() } },
      { new: true }
    );
  }
  const db = readLocalDB();
  if (!db.contentProjects) db.contentProjects = [];
  const idx = db.contentProjects.findIndex(p => p.userId === userId && (p._id === projectId || p.id === projectId));
  if (idx !== -1) {
    db.contentProjects[idx] = { ...db.contentProjects[idx], ...projectData, updatedAt: new Date() };
    writeLocalDB(db);
    return db.contentProjects[idx];
  }
  return null;
}

async function deleteContentProject(userId, projectId) {
  if (isConnectedToMongo()) {
    return ContentProject.deleteOne({ userId, _id: projectId });
  }
  const db = readLocalDB();
  if (!db.contentProjects) db.contentProjects = [];
  db.contentProjects = db.contentProjects.filter(p => !(p.userId === userId && (p._id === projectId || p.id === projectId)));
  writeLocalDB(db);
  return true;
}

// ==================== CONTENT MATRIX PLANNER ====================
async function getContentPlans(userId, brandId = null) {
  const query = { userId };
  if (brandId) query.brandId = brandId;

  if (isConnectedToMongo()) {
    return ContentPlan.find(query).sort({ timeSlot: 1 });
  }
  const db = readLocalDB();
  return (db.contentPlans || []).filter(p => p.userId === userId && (!brandId || p.brandId === brandId));
}

async function saveContentPlan(userId, planData) {
  if (isConnectedToMongo()) {
    return ContentPlan.create({
      userId,
      brandId: planData.brandId || '',
      dayOfWeek: planData.dayOfWeek,
      timeSlot: planData.timeSlot,
      topicTheme: planData.topicTheme,
      targetPlatforms: planData.targetPlatforms || ['YOUTUBE', 'FACEBOOK', 'TIKTOK']
    });
  }
  const db = readLocalDB();
  if (!db.contentPlans) db.contentPlans = [];
  const newPlan = {
    id: uuidv4(),
    _id: uuidv4(),
    userId,
    ...planData,
    createdAt: new Date()
  };
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

// ==================== MULTI-BRAND OPERATIONS ====================
async function getBrands(userId) {
  if (isConnectedToMongo()) {
    return Brand.find({ userId }).sort({ createdAt: -1 });
  }
  const db = readLocalDB();
  return (db.brands || []).filter(b => b.userId === userId);
}

async function getBrandById(userId, brandId) {
  if (isConnectedToMongo()) {
    return Brand.findOne({ userId, _id: brandId });
  }
  const db = readLocalDB();
  return (db.brands || []).find(b => b.userId === userId && (b._id === brandId || b.id === brandId));
}

async function createBrand(userId, brandData) {
  if (isConnectedToMongo()) {
    return Brand.create({
      userId,
      name: brandData.name,
      description: brandData.description || '',
      targetAudience: brandData.targetAudience || 'Khán giả đại chúng',
      toneOfVoice: brandData.toneOfVoice || 'Hấp dẫn, kích thích tò mò',
      primaryColor: brandData.primaryColor || '#e11d48',
      socialChannels: brandData.socialChannels || []
    });
  }
  const db = readLocalDB();
  if (!db.brands) db.brands = [];
  const newBrand = {
    id: uuidv4(),
    _id: uuidv4(),
    userId,
    name: brandData.name,
    description: brandData.description || '',
    targetAudience: brandData.targetAudience || 'Khán giả đại chúng',
    toneOfVoice: brandData.toneOfVoice || 'Hấp dẫn, kích thích tò mò',
    primaryColor: brandData.primaryColor || '#e11d48',
    socialChannels: brandData.socialChannels || [],
    createdAt: new Date()
  };
  db.brands.unshift(newBrand);
  writeLocalDB(db);
  return newBrand;
}

async function updateBrand(userId, brandId, brandData) {
  if (isConnectedToMongo()) {
    return Brand.findOneAndUpdate(
      { userId, _id: brandId },
      { $set: { ...brandData, updatedAt: new Date() } },
      { new: true }
    );
  }
  const db = readLocalDB();
  if (!db.brands) db.brands = [];
  const idx = db.brands.findIndex(b => b.userId === userId && (b._id === brandId || b.id === brandId));
  if (idx !== -1) {
    db.brands[idx] = { ...db.brands[idx], ...brandData, updatedAt: new Date() };
    writeLocalDB(db);
    return db.brands[idx];
  }
  return null;
}

async function deleteBrand(userId, brandId) {
  if (isConnectedToMongo()) {
    return Brand.deleteOne({ userId, _id: brandId });
  }
  const db = readLocalDB();
  if (!db.brands) db.brands = [];
  db.brands = db.brands.filter(b => !(b.userId === userId && (b._id === brandId || b.id === brandId)));
  writeLocalDB(db);
  return true;
}

// ==================== CONTENT PROJECTS (CONTENT LIBRARY) ====================
async function getContentProjects(userId, brandId = null) {
  const query = { userId };
  if (brandId) query.brandId = brandId;

  if (isConnectedToMongo()) {
    return ContentProject.find(query).sort({ updatedAt: -1 });
  }
  const db = readLocalDB();
  return (db.contentProjects || []).filter(p => p.userId === userId && (!brandId || p.brandId === brandId));
}

async function createContentProject(userId, projectData) {
  if (isConnectedToMongo()) {
    return ContentProject.create({
      userId,
      brandId: projectData.brandId || '',
      title: projectData.title,
      topic: projectData.topic || '',
      contentType: projectData.contentType || 'SHORT',
      status: projectData.status || 'IDEA',
      scriptData: projectData.scriptData || null,
      seoMetadata: projectData.seoMetadata || null,
      mediaFiles: projectData.mediaFiles || [],
      scheduledAt: projectData.scheduledAt || null
    });
  }
  const db = readLocalDB();
  if (!db.contentProjects) db.contentProjects = [];
  const newProj = {
    id: uuidv4(),
    _id: uuidv4(),
    userId,
    ...projectData,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  db.contentProjects.unshift(newProj);
  writeLocalDB(db);
  return newProj;
}

async function updateContentProject(userId, projectId, projectData) {
  if (isConnectedToMongo()) {
    return ContentProject.findOneAndUpdate(
      { userId, _id: projectId },
      { $set: { ...projectData, updatedAt: new Date() } },
      { new: true }
    );
  }
  const db = readLocalDB();
  if (!db.contentProjects) db.contentProjects = [];
  const idx = db.contentProjects.findIndex(p => p.userId === userId && (p._id === projectId || p.id === projectId));
  if (idx !== -1) {
    db.contentProjects[idx] = { ...db.contentProjects[idx], ...projectData, updatedAt: new Date() };
    writeLocalDB(db);
    return db.contentProjects[idx];
  }
  return null;
}

async function deleteContentProject(userId, projectId) {
  if (isConnectedToMongo()) {
    return ContentProject.deleteOne({ userId, _id: projectId });
  }
  const db = readLocalDB();
  if (!db.contentProjects) db.contentProjects = [];
  db.contentProjects = db.contentProjects.filter(p => !(p.userId === userId && (p._id === projectId || p.id === projectId)));
  writeLocalDB(db);
  return true;
}

// ==================== CONTENT MATRIX PLANNER ====================
async function getContentPlans(userId, brandId = null) {
  const query = { userId };
  if (brandId) query.brandId = brandId;

  if (isConnectedToMongo()) {
    return ContentPlan.find(query).sort({ timeSlot: 1 });
  }
  const db = readLocalDB();
  return (db.contentPlans || []).filter(p => p.userId === userId && (!brandId || p.brandId === brandId));
}

async function saveContentPlan(userId, planData) {
  if (isConnectedToMongo()) {
    return ContentPlan.create({
      userId,
      brandId: planData.brandId || '',
      dayOfWeek: planData.dayOfWeek,
      timeSlot: planData.timeSlot,
      topicTheme: planData.topicTheme,
      targetPlatforms: planData.targetPlatforms || ['YOUTUBE', 'FACEBOOK', 'TIKTOK']
    });
  }
  const db = readLocalDB();
  if (!db.contentPlans) db.contentPlans = [];
  const newPlan = {
    id: uuidv4(),
    _id: uuidv4(),
    userId,
    ...planData,
    createdAt: new Date()
  };
  db.contentPlans.push(newPlan);
  writeLocalDB(db);
  return newPlan;
}

async function deleteContentPlan(userId, planId) {
  if (isConnectedToMongo()) {
    return ContentPlan.deleteOne({ userId, _id: planId });
  }
  const db = readLocalDB();
  if (!db.contentPlans) db.contentPlans = [];
  db.contentPlans = db.contentPlans.filter(p => !(p.userId === userId && (p._id === planId || p.id === planId)));
  writeLocalDB(db);
  return true;
}

// ==================== CHANNEL GROUPS (PHÂN NHÓM KÊNH & FANPAGE THEO CHỦ ĐỀ) ====================
async function getChannelGroups(userId) {
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    return ChannelGroup.find({ userId }).sort({ createdAt: -1 });
  }
  const db = readLocalDB();
  return (db.channelGroups || []).filter(g => g.userId === userId);
}

async function createChannelGroup(userId, groupData) {
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    const group = new ChannelGroup({
      userId,
      name: groupData.name,
      topic: groupData.topic || 'Chung',
      color: groupData.color || '#38bdf8',
      description: groupData.description || '',
      channelIds: groupData.channelIds || []
    });
    return group.save();
  }
  const db = readLocalDB();
  if (!db.channelGroups) db.channelGroups = [];
  const newGroup = {
    _id: uuidv4(),
    id: uuidv4(),
    userId,
    name: groupData.name,
    topic: groupData.topic || 'Chung',
    color: groupData.color || '#38bdf8',
    description: groupData.description || '',
    channelIds: groupData.channelIds || [],
    createdAt: new Date().toISOString()
  };
  db.channelGroups.push(newGroup);
  writeLocalDB(db);
  return newGroup;
}

async function updateChannelGroup(userId, groupId, updateData) {
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return null;
    }
    return ChannelGroup.findOneAndUpdate({ userId, _id: groupId }, { $set: updateData }, { returnDocument: 'after' });
  }
  const db = readLocalDB();
  if (!db.channelGroups) db.channelGroups = [];
  const idx = db.channelGroups.findIndex(g => g.userId === userId && (g._id === groupId || g.id === groupId));
  if (idx !== -1) {
    db.channelGroups[idx] = { ...db.channelGroups[idx], ...updateData, updatedAt: new Date().toISOString() };
    writeLocalDB(db);
    return db.channelGroups[idx];
  }
  return null;
}

async function deleteChannelGroup(userId, groupId) {
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return { deletedCount: 0 };
    }
    return ChannelGroup.deleteOne({ userId, _id: groupId });
  }
  const db = readLocalDB();
  if (!db.channelGroups) db.channelGroups = [];
  db.channelGroups = db.channelGroups.filter(g => !(g.userId === userId && (g._id === groupId || g.id === groupId)));
  writeLocalDB(db);
  return true;
}

// ==================== TELEGRAM CONFIG MONGO PERSISTENCE ====================
async function updateUserTelegramConfig(userId, { botToken, chatId }) {
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    if (mongoose.Types.ObjectId.isValid(userId)) {
      return await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            'telegramConfig.botToken': botToken || '',
            'telegramConfig.chatId': chatId || ''
          }
        },
        { returnDocument: 'after' }
      );
    }
  } else {
    const db = readLocalDB();
    const user = (db.users || []).find(u => (u._id || u.id) === userId);
    if (user) {
      user.telegramConfig = { botToken: botToken || '', chatId: chatId || '' };
      writeLocalDB(db);
      return user;
    }
  }
  return null;
}

async function getUserTelegramConfig(userId) {
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    if (mongoose.Types.ObjectId.isValid(userId)) {
      const user = await User.findById(userId).select('telegramConfig');
      return user?.telegramConfig || { botToken: '', chatId: '' };
    }
  } else {
    const db = readLocalDB();
    const user = (db.users || []).find(u => (u._id || u.id) === userId);
    return user?.telegramConfig || { botToken: '', chatId: '' };
  }
  return { botToken: '', chatId: '' };
}

async function getAllUsers() {
  await ensureMongoConnected();
  if (isConnectedToMongo()) {
    return await User.find({}).sort({ createdAt: -1 });
  }
  const db = readLocalDB();
  return db.users || [];
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  getUserById: findUserById,
  getAllUsers,
  updateUserGeminiKey,
  initDefaultAdmin,
  createTestUser,
  getTestUsers,
  extendTestUser,
  toggleLockUser,
  deleteTestUser,
  checkUserLockAndExpiry,
  getChannels,
  getChannelById,
  saveChannel,
  incrementChannelVideoCount,
  updateChannelStats,
  deleteChannel,
  updateChannelTokens,
  getHistory,
  addHistory,
  clearHistory,
  saveGeminiDraft,
  getGeminiDrafts,
  getQuotaUsage,
  addQuotaUsage,
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  getContentProjects,
  createContentProject,
  updateContentProject,
  deleteContentProject,
  getContentPlans,
  saveContentPlan,
  deleteContentPlan,
  getChannelGroups,
  createChannelGroup,
  updateChannelGroup,
  deleteChannelGroup,
  updateUserTelegramConfig,
  getUserTelegramConfig
};
