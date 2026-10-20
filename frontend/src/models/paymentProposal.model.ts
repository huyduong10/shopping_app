import { Role, User } from './auth.model';
import { Department } from './department.model';
import { PurchaseProposal } from './purchaseProposal.model';

export type PaymentProposalStatus =
  | 'pending_director'     // Chờ Giám đốc duyệt (<= 10tr)
  | 'pending_chairman'     // Chờ Chủ tịch duyệt (> 10tr)
  | 'pending_disbursement' // Đã duyệt, chờ Kế toán giải ngân
  | 'completed'            // Kế toán đã giải ngân chuyển tiền xong
  | 'rejected';            // Bị từ chối

export interface PaymentBeneficiary {
  name: string;
  accountNumber: string;
  bankName: string;
  branch?: string;
}

export interface PaymentApprovalStep {
  _id?: string;
  step: 'duyet_chi' | 'giai_ngan' | string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  approver?: User | { _id: string; fullName: string; role: Role } | null;
  comment?: string;
  date?: string | null;
}

export interface PaymentProposal {
  _id: string;
  proposalCode: string;
  purchaseProposal: PurchaseProposal | { _id: string; proposalCode: string; totalEstimatedAmount: number; totalActualAmount?: number; totalDisbursed: number; status: string };
  creator: User;
  department: Department;
  beneficiary: PaymentBeneficiary;
  paymentReason: string;
  paymentMethod: 'bank_transfer' | 'cash';
  amount: number;
  amountInWords?: string;
  installmentNote?: string;
  attachments?: Array<{ name: string; url: string; size?: number; type?: string }>;
  // [LUỒNG MỚI] Hồ sơ đề xuất thanh toán bao gồm:
  // 1. Danh mục yêu cầu vật tư
  items?: Array<{
    stt?: number;
    tenVatTu: string;
    soLuong: number;
    donGiaThucTe: number;
    nhaCungCap?: string;
    yeuCauKiThuat?: string;
    phongBanSuDung?: string;
    thanhTien?: number;
  }>;
  // 2. Bảng báo giá đối tác
  quotationAttachments?: Array<{ name: string; url: string; size?: number; type?: string }>;
  // 3. Hợp đồng kinh tế
  contractInfo?: {
    contractNumber?: string;
    partnerName?: string;
    files?: Array<{ name: string; url: string; size?: number; type?: string }>;
  };
  contractAttachments?: Array<{ name: string; url: string; size?: number; type?: string }>;
  // 4. Hóa đơn VAT do Thu mua cung cấp
  invoiceInfo?: {
    invoiceNumber?: string;
    invoiceDate?: string | null;
    files?: Array<{ name: string; url: string; size?: number; type?: string }>;
  };
  status: PaymentProposalStatus;
  currentApprovalRole?: string | null;
  approvalFlow: PaymentApprovalStep[];
  disbursementInfo?: {
    disbursedAt?: string | null;
    disbursedBy?: User | { _id: string; fullName: string } | null;
    transactionCode?: string;
    note?: string;
    receiptAttachment?: any;
  };
  transactionCode?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentProposalDto {
  purchaseProposalId: string;
  beneficiary: PaymentBeneficiary;
  paymentReason: string;
  paymentMethod?: 'bank_transfer' | 'cash';
  amount: number;
  amountInWords?: string;
  installmentNote?: string;
  attachments?: Array<{ name: string; url: string; size?: number; type?: string }>;
  items?: Array<{
    stt?: number;
    tenVatTu: string;
    soLuong: number;
    donGiaThucTe: number;
    nhaCungCap?: string;
    yeuCauKiThuat?: string;
    phongBanSuDung?: string;
    thanhTien?: number;
  }>;
  quotationAttachments?: Array<{ name: string; url: string; size?: number; type?: string }>;
  contractInfo?: {
    contractNumber?: string;
    partnerName?: string;
    files?: Array<{ name: string; url: string; size?: number; type?: string }>;
  };
  contractAttachments?: Array<{ name: string; url: string; size?: number; type?: string }>;
  invoiceInfo?: {
    invoiceNumber?: string;
    invoiceDate?: string | null;
    files?: Array<{ name: string; url: string; size?: number; type?: string }>;
  };
}
