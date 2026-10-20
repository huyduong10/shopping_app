import { Role, User } from './auth.model';
import { Department } from './department.model';

export interface SupplierQuote {
  _id?: string;
  nccName: string;
  donGia: number;
  url?: string;
  ghiChu?: string;
  isChosen?: boolean;
}

export interface PurchaseItem {
  _id?: string;
  stt: number;
  tenVatTu: string;
  yeuCauKiThuat?: string;
  phongBanSuDung: string;
  soLuong: number;
  // [LUỒNG MỚI] Đơn giá dự kiến không bắt buộc khi nhân viên gửi yêu cầu ban đầu
  // [CŨ] donGiaDuKien: number;
  donGiaDuKien?: number;
  donGiaThucTe?: number | null;
  nhaCungCap?: string;
  ghiChuNhaCungCap?: string;
  // [LUỒNG MỚI] 3-4 báo giá cho từng vật tư
  supplierQuotes?: SupplierQuote[];
}

export interface SupplierSuggestion {
  id: string;
  name: string;
  price: number;
  url?: string;
  rating?: number;
  deliveryDays?: string;
  note?: string;
  isBestChoice?: boolean;
}

export interface ItemAISuggestion {
  itemId: string;
  stt: number;
  tenVatTu: string;
  yeuCauKiThuat?: string;
  phongBanSuDung?: string;
  soLuong: number;
  donGiaDuKien: number;
  suppliers: SupplierSuggestion[];
}

export interface ApprovalStep {
  _id?: string;
  step: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  approver?: User | { _id: string; fullName: string; role: Role } | null;
  comment?: string;
  date?: string | null;
}

export interface Disbursement {
  _id?: string;
  amount: number;
  date: string;
  note?: string;
  processedBy?: User | { _id: string; fullName: string } | null;
}

export interface ProcurementExecution {
  actionType: 'advance' | 'invoice' | 'contract' | 'multiple' | null;
  invoiceInfo?: {
    invoiceNumber?: string;
    invoiceDate?: string | null;
    files?: any[];
  };
  contractInfo?: {
    contractNumber?: string;
    partnerName?: string;
    files?: any[];
  };
  // [QUY TRÌNH MỚI] Cờ xác nhận đã nhận tạm ứng kinh phí trước đó
  isAdvanced?: boolean;
  advanceAmount?: number;
  advanceNote?: string;
  // Liên kết đơn tạm ứng nếu có
  advanceProposalId?: string | {
    _id: string;
    proposalCode: string;
    status: string;
    totalAmount: number;
    currentApprovalRole?: string;
  } | null;
  submittedBy?: User | { _id: string; fullName: string } | null;
  submittedAt?: string | null;
}

export type PurchaseProposalStatus =
  | 'draft'
  // [LUỒNG MỚI]
  | 'pending_tp_approval'       // Trưởng phòng duyệt tính thỏa đáng
  | 'procurement_pricing'      // Thu mua lập 3-4 báo giá + giải trình
  | 'pending_director_approval' // Giám đốc duyệt báo giá (đơn <= 10tr)
  | 'pending_chairman_approval' // Chủ tịch duyệt báo giá để làm hợp đồng (đơn > 10tr)
  | 'procurement_execution'    // Thu mua thực hiện mua sắm (ứng trước/hóa đơn/hợp đồng)
  | 'pending_accounting'       // Chờ kế toán xử lý chứng từ và thanh toán/tất toán
  | 'rejected_by_tp'           // Trưởng phòng từ chối, trả về cho nhân viên chỉnh sửa
  | 'rejected_by_director'     // Giám đốc/Chủ tịch từ chối báo giá, trả về thu mua khảo giá lại
  | 'rejected_by_accounting'   // Kế toán từ chối chứng từ/hóa đơn, trả về thu mua sửa lại
  // [LUỒNG CŨ - giữ tương thích dữ liệu cũ]
  | 'pending_approval'
  | 'approved_initial'
  | 'procurement_review'
  | 'procurement_completed'
  | 'accounting_review'
  | 'pending_final_approval'
  | 'pending_payment'
  | 'pending_payment_approval'
  | 'final_approved'
  | 'disbursing'
  | 'completed'
  | 'rejected';

export interface PurchaseProposal {
  _id: string;
  proposalCode: string;
  creator: User;
  department: Department;
  items: PurchaseItem[];
  totalEstimatedAmount: number;
  totalActualAmount?: number | null;
  pricingMethod?: 'ai' | 'manual';
  quotationAttachments?: Array<{
    name: string;
    url: string;
    size?: number;
    type?: string;
  }>;
  // [LUỒNG MỚI] Giải trình tính cần thiết và ảnh minh chứng ban đầu của người đề xuất
  necessityReason?: string;
  necessityAttachments?: Array<{
    name: string;
    url: string;
    size?: number;
    type?: string;
  }>;

  // [LUỒNG MỚI] Giải trình của thu mua và hồ sơ thực hiện
  priceJustification?: string;
  procurementExecution?: ProcurementExecution;

  status: PurchaseProposalStatus;
  currentApprovalRole?: string | null;
  approvalFlow: ApprovalStep[];
  disbursements: Disbursement[];
  totalDisbursed: number;
  // [QUY TRÌNH MỚI] Lưu trữ các hóa đơn / hợp đồng đã được Giám đốc duyệt và Kế toán thanh toán hoàn tất
  isInvoiceCompleted?: boolean;
  invoiceCompletedAt?: string | null;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseProposalDto {
  items: Array<{
    stt: number;
    tenVatTu: string;
    yeuCauKiThuat?: string;
    phongBanSuDung: string;
    soLuong: number;
    // [LUỒNG MỚI] Không bắt buộc nhập đơn giá dự kiến
    donGiaDuKien?: number;
  }>;
  // [LUỒNG MỚI] Giải trình tính cần thiết và ảnh minh chứng (không cần nhập số tiền tạm ứng)
  necessityReason?: string;
  necessityAttachments?: Array<{
    name: string;
    url: string;
    size?: number;
    type?: string;
  }>;
}
