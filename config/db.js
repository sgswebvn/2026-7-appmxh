const mongoose = require('mongoose');

let cachedPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (mongoose.connection.readyState === 2 && cachedPromise) {
    try {
      await cachedPromise;
      return mongoose.connection.readyState === 1;
    } catch (e) {
      cachedPromise = null;
    }
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI chưa được thiết lập. Hệ thống sẽ sử dụng Local Resilience Database.');
    return false;
  }

  try {
    cachedPromise = mongoose.connect(uri, {
      maxPoolSize: 25,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      family: 4
    });

    await cachedPromise;
    cachedPromise = null;
    isMongoConnected = true;
    console.log('✅ Đã kết nối thành công đến MongoDB Atlas (Database: ytb-multi - Connection Pool: 25)!');
    return true;
  } catch (err) {
    cachedPromise = null;
    console.warn('⚠️ Kết nối MongoDB Atlas chưa thành công (Chi tiết:', err.message, '). Đang kích hoạt bộ đệm bảo vệ an toàn.');
    isMongoConnected = false;
    return false;
  }
}

function getMongoStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    host: mongoose.connection.host || 'Local Storage (Fallback)',
    databaseName: mongoose.connection.name || 'ytb-multi',
    poolSize: mongoose.connection.readyState === 1 ? 25 : 0
  };
}

module.exports = {
  connectDB,
  getMongoStatus,
  get isMongoConnected() {
    return mongoose.connection.readyState === 1;
  }
};
