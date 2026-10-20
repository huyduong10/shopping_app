const express = require('express');
const router = express.Router();
const advanceProposalController = require('../controllers/advanceProposalController');
const { protect, restrictTo } = require('../middlewares/auth');

router.use(protect);

// Các API cơ bản (Tạo, Lấy danh sách, Lấy chi tiết)
router.post('/', advanceProposalController.create);
router.get('/', advanceProposalController.getAll);
router.get('/:id', advanceProposalController.getById);

// Quy trình phê duyệt
router.put('/:id/approve', restrictTo('giam_doc', 'chu_tich'), advanceProposalController.approve);
router.put('/:id/reject', restrictTo('giam_doc', 'chu_tich', 'ke_toan'), advanceProposalController.reject);
router.put('/:id/resubmit', advanceProposalController.resubmit);

// Kế toán phê duyệt và giải ngân
router.put('/:id/accounting-disburse', restrictTo('ke_toan'), advanceProposalController.accountingApproveAndDisburse);

// Hoàn ứng (Nộp, Từ chối và Xác nhận hoàn tạm ứng)
router.put('/:id/settlement', advanceProposalController.submitSettlement);
router.put('/:id/reject-settlement', restrictTo('ke_toan'), advanceProposalController.rejectSettlement);
router.put('/:id/confirm-settlement', restrictTo('ke_toan'), advanceProposalController.confirmSettlement);

module.exports = router;
