const mongoose = require('mongoose');

const advanceItemSchema = new mongoose.Schema({
  stt: { type: Number, required: true },
  mucDich: { type: String, required: [true, 'Mục đích tạm ứng là bắt buộc'] },
  soTien: { type: Number, required: [true, 'Số tiền là bắt buộc'], min: 0 },
});

const approvalStepSchema = new mongoose.Schema({
  step: { type: String, required: true },
  role: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  comment: { type: String, default: '' },
  date: { type: Date, default: null },
});

const disbursementSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  note: { type: String, default: '' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const advanceProposalSchema = new mongoose.Schema({
  proposalCode: {
    type: String,
    unique: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  // [LUỒNG MỚI] Liên kết với Đề xuất Mua sắm (nếu tạm ứng để mua sắm vật tư)
  // [LUỒNG CŨ] Đề xuất tạm ứng không liên kết với đề xuất mua sắm
  purchaseProposal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseProposal',
    default: null,
  },
  // Bank info of the creator for receiving advance
  bankAccount: {
    accountNumber: { type: String, required: [true, 'Số tài khoản là bắt buộc'] },
    bankName: { type: String, required: [true, 'Tên ngân hàng là bắt buộc'] },
    accountHolder: { type: String, default: '' },
  },
  items: [advanceItemSchema],
  totalAmount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: [
      'draft',
      'pending_director',       // Chờ giám đốc duyệt
      'pending_chairman',       // Chờ chủ tịch duyệt
      'pending_accounting',     // Chờ kế toán duyệt
      'accounting_approved',    // Kế toán đã duyệt
      'disbursing',             // Đang giải ngân
      'disbursed',              // Đã giải ngân
      'pending_settlement',     // Chờ hoàn tạm ứng
      'settlement_submitted',   // Đã nộp hoàn tạm ứng
      'completed',              // Hoàn thành
      'rejected',               // Từ chối chung
      'rejected_by_director',   // Giám đốc từ chối -> trả về người tạo làm lại
      'rejected_by_chairman',   // Chủ tịch từ chối -> trả về người tạo làm lại
      'rejected_by_accounting', // Kế toán từ chối -> trả về người tạo làm lại
      'rejected_settlement',    // Kế toán từ chối hoàn tạm ứng -> trả về người tạo nộp lại
    ],
    default: 'draft',
  },
  currentApprovalRole: {
    type: String,
    default: null,
  },
  approvalFlow: [approvalStepSchema],
  disbursements: [disbursementSchema],
  totalDisbursed: {
    type: Number,
    default: 0,
  },
  // Settlement fields (hoàn tạm ứng)
  settlement: {
    type: {
      type: String,
      enum: ['surplus', 'deficit', 'exact'], // thừa, thiếu, đủ
      default: null,
    },
    amount: { type: Number, default: null }, // Số tiền thừa/thiếu
    attachments: [mongoose.Schema.Types.Mixed], // File đính kèm (Object {name, url, size, type} hoặc String)
    note: { type: String, default: '' },
    submittedAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  rejectionReason: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Tự động sinh mã đề xuất tạm ứng
advanceProposalSchema.pre('save', async function () {
  if (!this.proposalCode) {
    const count = await mongoose.model('AdvanceProposal').countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    this.proposalCode = `TU-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  }

  // Tính tổng số tiền tạm ứng
  this.totalAmount = this.items.reduce((sum, item) => sum + item.soTien, 0);
});

module.exports = mongoose.model('AdvanceProposal', advanceProposalSchema);
