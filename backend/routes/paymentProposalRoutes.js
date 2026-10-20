const express = require('express');
const router = express.Router();
const paymentProposalController = require('../controllers/paymentProposalController');
const { protect, restrictTo } = require('../middlewares/auth');

// Yêu cầu xác thực đăng nhập cho toàn bộ các endpoint
router.use(protect);

// 1. Tạo đề xuất thanh toán (Dành riêng cho Kế toán tiếp nhận từ Thu mua)
router.post('/', restrictTo('ke_toan', 'admin'), paymentProposalController.create);

// 2. Lấy danh sách & Chi tiết đề xuất thanh toán
router.get('/', paymentProposalController.getAll);
router.get('/:id', paymentProposalController.getById);

// 3. Phê duyệt chi / Từ chối (Dành cho Giám đốc và Chủ tịch)
router.put('/:id/approve', restrictTo('giam_doc', 'chu_tich'), paymentProposalController.approve);
router.put('/:id/reject', restrictTo('giam_doc', 'chu_tich'), paymentProposalController.reject);

// 4. Kế toán xác nhận giải ngân chuyển tiền
router.put('/:id/disburse', restrictTo('ke_toan'), paymentProposalController.disburse);

module.exports = router;
