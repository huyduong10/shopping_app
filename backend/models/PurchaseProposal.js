const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  stt: { type: Number, required: true },
  tenVatTu: { type: String, required: [true, 'Tên vật tư là bắt buộc'] },
  // [LUỒNG MỚI] Bổ sung trường soLuong để Mongoose không bị strip khi lưu CSDL
  soLuong: { type: Number, required: true, default: 1, min: 1 },
  yeuCauKiThuat: { type: String, default: '' },
  phongBanSuDung: { type: String, default: '' },
  // [LUỒNG MỚI] Bỏ phần ước tính chi phí khi nhân viên tạo yêu cầu vật tư lên trưởng phòng (đơn giá sẽ do Thu mua khảo giá)
  // [CŨ] donGiaDuKien: { type: Number, required: [true, 'Đơn giá dự kiến là bắt buộc'], min: 0 },
  donGiaDuKien: { type: Number, default: 0, min: 0 },
  donGiaThucTe: { type: Number, default: null },
  nhaCungCap: { type: String, default: '' },       // Tên nhà cung cấp được lựa chọn tối ưu
  ghiChuNhaCungCap: { type: String, default: '' }, // Ghi chú thêm về nhà cung cấp / bảo hành

  // [LUỒNG MỚI] Mảng 3-4 bản báo giá thô từ AI hoặc nhập tay.
  // Thu mua nộp toàn bộ để Giám đốc đối chiếu khi duyệt mua.
  supplierQuotes: [{
    supplierName: { type: String, default: '' },    // Tên nhà cung cấp
    price:        { type: Number, default: 0 },     // Đơn giá báo
    url:          { type: String, default: '' },    // URL nguồn / link sản phẩm
    deliveryTime: { type: String, default: '' },    // Thời gian giao hàng dự kiến
    isBestChoice: { type: Boolean, default: false }, // Đánh dấu báo giá tối ưu được chọn
  }],
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

const purchaseProposalSchema = new mongoose.Schema({
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
  // [LUỒNG MỚI] Giải trình tính cần thiết khi lập đơn mua sắm ban đầu (tại sao cần mua, mục đích sử dụng)
  // [LUỒNG CŨ] Không có mục giải trình tính cần thiết ban đầu
  necessityReason: {
    type: String,
    default: '',
  },
  // [LUỒNG MỚI] Danh sách ảnh / tài liệu đính kèm minh chứng tính cần thiết (ảnh hiện trạng hư hỏng, ảnh mẫu vật tư...)
  necessityAttachments: [mongoose.Schema.Types.Mixed],

  items: [purchaseItemSchema],
  totalEstimatedAmount: {
    type: Number,
    default: 0,
  },
  totalActualAmount: {
    type: Number,
    default: null,
  },
  // Phương thức khảo giá: 'ai' (dùng AI tra cứu NCC) hoặc 'manual' (nhập tay)
  pricingMethod: {
    type: String,
    enum: ['ai', 'manual'],
    default: 'manual',
  },
  // Danh sách tài liệu / hóa đơn báo giá đính kèm
  quotationAttachments: [mongoose.Schema.Types.Mixed],

  // [LUỒNG MỚI] Văn bản giải trình của Thu mua: lý do chọn nhà cung cấp / mức giá tối ưu.
  // Thu mua bắt buộc điền trước khi gửi lên Giám đốc duyệt.
  priceJustification: { type: String, default: '' },

  // [LUỒNG MỚI] Hành động mua sắm thực tế của Thu mua sau khi Giám đốc phê duyệt.
  // Thu mua chọn 1 trong 3 hình thức: ứng trước tiền, mua lấy hóa đơn, làm hợp đồng.
  procurementExecution: {
    // Hình thức thực hiện mua sắm (null = chưa thực hiện)
    actionType: {
      type: String,
      enum: ['advance', 'invoice', 'contract', 'multiple', null],
      default: null,
    },
    // Thông tin hóa đơn VAT (khi actionType = 'invoice')
    invoiceInfo: {
      invoiceNumber: { type: String, default: '' },
      invoiceDate:   { type: Date, default: null },
      files: [mongoose.Schema.Types.Mixed],
    },
    // Thông tin hợp đồng kinh tế
    contractInfo: {
      contractNumber: { type: String, default: '' },
      partnerName:    { type: String, default: '' },
      files: [mongoose.Schema.Types.Mixed],
    },
    // [QUY TRÌNH MỚI] Xác nhận Thu mua đã được nhận tiền tạm ứng trước đó độc lập
    isAdvanced: {
      type: Boolean,
      default: false,
    },
    advanceAmount: {
      type: Number,
      default: 0,
    },
    advanceNote: {
      type: String,
      default: '',
    },
    // Liên kết mã đơn tạm ứng (nếu có)
    advanceProposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdvanceProposal',
      default: null,
    },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, default: null },
  },
  // [QUY TRÌNH MỚI] Lưu trữ các hóa đơn / hợp đồng đã được Giám đốc duyệt và Kế toán thanh toán hoàn tất
  isInvoiceCompleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  invoiceCompletedAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: [
      'draft',                    // Bản nháp

      // [LUỒNG CŨ] 'pending_approval' = Chờ duyệt sơ bộ theo hạn mức tiền
      // [LUỒNG MỚI] Thay bằng 'pending_tp_approval' - luôn luôn qua Trưởng phòng trước
      'pending_approval',         // [GIỮ LẠI - tương thích dữ liệu cũ]
      'pending_tp_approval',      // [LUỒNG MỚI] Chờ Trưởng phòng xác nhận tính thỏa đáng của yêu cầu

      'approved_initial',         // [GIỮ LẠI - tương thích dữ liệu cũ]

      // [LUỒNG CŨ] 'procurement_review' = Thu mua khảo giá rồi gửi kế toán
      // [LUỒNG MỚI] Thay bằng 'procurement_pricing' - Thu mua lập 3-4 báo giá + giải trình, gửi thẳng GĐ
      'procurement_review',       // [GIỮ LẠI - tương thích dữ liệu cũ]
      'procurement_pricing',      // [LUỒNG MỚI] Thu mua đang lập báo giá chi tiết (3-4 NCC)

      'procurement_completed',    // [GIỮ LẠI - tương thích dữ liệu cũ]

      // [LUỒNG CŨ] 'accounting_review' = Kế toán xác nhận giá TRƯỚC khi GĐ duyệt
      // [LUỒNG MỚI] Kế toán nhận bản tham chiếu SONG SONG khi Thu mua nộp báo giá, không còn là bước chặn
      'accounting_review',        // [GIỮ LẠI - tương thích dữ liệu cũ]

      // [LUỒNG CŨ] 'pending_final_approval' = GĐ/CT duyệt giá chốt (sau khi kế toán xác nhận)
      // [LUỒNG MỚI] 'pending_director_approval' = GĐ duyệt mua (nhận trực tiếp từ Thu mua, kèm báo giá + giải trình)
      'pending_director_approval',     // [LUỒNG MỚI] Chờ Giám đốc xem báo giá và phê duyệt mua (đơn <= 10tr)
      'pending_chairman_approval',     // [LUỒNG MỚI] Chờ Chủ tịch xem báo giá và phê duyệt mua để làm hợp đồng (đơn > 10tr)

      // [LUỒNG MỚI] Sau khi GĐ duyệt → Thu mua chọn hình thức (ứng trước / hóa đơn / hợp đồng)
      'procurement_execution',    // [LUỒNG MỚI] Thu mua đang thực hiện mua sắm thực tế

      // [LUỒNG MỚI] Thu mua nộp hồ sơ (HĐ / hợp đồng / đơn ứng trước) → Kế toán xử lý
      'pending_accounting',       // [LUỒNG MỚI] Hồ sơ đã nộp, chờ kế toán lập đề xuất thanh toán/tạm ứng

      'pending_payment',          // Chờ kế toán lập thanh toán
      'pending_payment_approval', // Chờ duyệt đề xuất thanh toán
      'final_approved',           // Duyệt cuối cùng
      'disbursing',               // Đang giải ngân
      'completed',                // Hoàn thành
      'rejected',                 // Từ chối hoàn toàn
      'rejected_by_tp',           // Bị Trưởng phòng từ chối (trả về nhân viên sửa)
      'rejected_by_director',     // Bị Giám đốc / Chủ tịch từ chối báo giá (trả về thu mua khảo giá lại)
      'rejected_by_accounting',   // Bị Kế toán từ chối hóa đơn/chứng từ (trả về thu mua sửa lại)
    ],
    // [LUỒNG MỚI] Trạng thái ban đầu luôn là chờ Trưởng phòng duyệt yêu cầu
    // [LUỒNG CŨ] default: 'draft'
    default: 'pending_tp_approval',
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
  rejectionReason: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Tự động sinh mã đề xuất
purchaseProposalSchema.pre('save', async function () {
  if (!this.proposalCode) {
    const count = await mongoose.model('PurchaseProposal').countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    this.proposalCode = `MS-${year}${month}-${String(count + 1).padStart(4, '0')}`;
  }

  // [LUỒNG MỚI] Tính tổng tiền thực tế từ các vật tư đã có giá khảo sát
  const calcActualTotal = this.items.reduce((sum, item) => {
    const price = Number(item.donGiaThucTe) || 0;
    const qty = Number(item.soLuong) || 1;
    return sum + (qty * price);
  }, 0);
  if (calcActualTotal > 0) {
    this.totalActualAmount = isNaN(calcActualTotal) ? 0 : calcActualTotal;
  }

  // [LUỒNG MỚI] Tính tổng số tiền dự toán:
  // Nếu nhân viên ban đầu không nhập giá dự kiến (0đ), sau khi khảo giá có giá mới (donGiaThucTe)
  // thì dự toán sẽ tự động lấy theo giá khảo sát mới thay vì để 0đ
  this.totalEstimatedAmount = this.items.reduce((sum, item) => {
    const qty = Number(item.soLuong) || 1;
    const estPrice = (Number(item.donGiaDuKien) > 0) ? Number(item.donGiaDuKien) : (Number(item.donGiaThucTe) || 0);
    return sum + (qty * estPrice);
  }, 0);
  if (this.totalEstimatedAmount === 0 && this.totalActualAmount > 0) {
    this.totalEstimatedAmount = this.totalActualAmount;
  }
});

module.exports = mongoose.model('PurchaseProposal', purchaseProposalSchema);
