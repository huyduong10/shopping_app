const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const seedData = require('./utils/seed');
const User = require('./models/User');
const aiSearch = require('./routes/aiSearchRoutes');

// Đọc cấu hình biến môi trường
dotenv.config();

// Kết nối cơ sở dữ liệu và tự động tạo dữ liệu mẫu nếu database đang trống
connectDB().then(async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('⚡ Cơ sở dữ liệu đang trống, tự động nạp seed data...');
      await seedData(false);
    }
  } catch (err) {
    // Lỗi kết nối cơ sở dữ liệu đã được xử lý trong connectDB
  }
});

const app = express();

// Tin cậy reverse proxy (Render, Heroku...) để req.protocol trả về đúng 'https'
app.set('trust proxy', 1);

// Các Middleware cơ bản
// FRONTEND_URL có thể chứa nhiều domain, phân tách bằng dấu phẩy (bỏ dấu '/' ở cuối)
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || '')
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  'http://localhost:3000',
  'http://localhost:4000',
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const path = require('path');
const fs = require('fs');

// Khởi tạo thư mục uploads lưu trữ file vật lý trên ổ cứng nếu chưa có
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Phục vụ các file tĩnh được tải lên từ thư mục uploads trên ổ cứng
app.use('/uploads', express.static(uploadDir));

// Khai báo các Routes chính của ứng dụng
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/purchase-proposals', require('./routes/purchaseProposalRoutes'));
app.use('/api/advance-proposals', require('./routes/advanceProposalRoutes'));
app.use('/api/payment-proposals', require('./routes/paymentProposalRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// Enpoint phụ trách việc tra giá bằng AI
app.use('/api/ai-search', aiSearch);

// Kiểm tra sức khỏe máy chủ
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Hệ thống máy chủ đang hoạt động bình thường' });
});

// Endpoint nạp lại dữ liệu mẫu thủ công
app.post('/api/seed', async (req, res) => {
  try {
    await seedData(false);
    res.json({ success: true, message: 'Nạp dữ liệu mẫu thành công!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



// Middleware xử lý lỗi tập trung
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
