const mongoose = require('mongoose');

let isMongoConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('⚠️ MONGODB_URI chưa được thiết lập. Hệ thống sẽ sử dụng Local Resilience Database.');
    return false;
  }

  try {
    // Cấu hình Connection Pool chịu tải cao (High Concurrency & Stability)
    await mongoose.connect(uri, {
      maxPoolSize: 25,          // Duy trì tới 25 kết nối song song phục vụ nhiều luồng cùng lúc
      minPoolSize: 5,           // Luôn giữ tối thiểu 5 kết nối sẵn sàng
      socketTimeoutMS: 45000,   // Tránh ngắt kết nối giữa chừng khi xử lý tác vụ nặng
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
      family: 4                 // Ép IPv4 giúp tăng tốc độ phân giải DNS
    });

    isMongoConnected = true;
    console.log('✅ Đã kết nối thành công đến MongoDB Atlas (Database: ytb-multi - Connection Pool: 25)!');
    return true;
  } catch (err) {
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
