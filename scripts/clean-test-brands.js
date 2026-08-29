require('dotenv').config();
const mongoose = require('mongoose');
const Brand = require('../models/Brand');

async function clean() {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      const res = await Brand.deleteMany({ name: { $regex: /Test Load Brand/i } });
      console.log('✅ Đã xóa thành công số lượng Brand test:', res.deletedCount);
      await mongoose.disconnect();
    }
  } catch (e) {
    console.error('Lỗi xóa test brands:', e.message);
  }
}

clean();
