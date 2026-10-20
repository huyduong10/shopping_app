import { BankAccount, User } from './auth.model';
import { Department } from './department.model';
import { ApprovalStep, Disbursement } from './purchaseProposal.model';

export interface AdvanceItem {
  _id?: string;
  stt: number;
  mucDich: string;
  soTien: number;
}

export type SettlementType = 'surplus' | 'deficit' | 'exact';

export interface SettlementAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface SettlementData {
  type: SettlementType;
  amount?: number | null;
  attachments?: SettlementAttachment[];
  note?: string;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  confirmedBy?: User | { _id: string; fullName: string } | null;
}

export type AdvanceProposalStatus =
  | 'draft'
  | 'pending_director'
  | 'pending_chairman'
  | 'pending_accounting'
  | 'accounting_approved'
  | 'disbursing'
  | 'disbursed'
  | 'pending_settlement'
  | 'settlement_submitted'
  | 'completed'
  | 'rejected'
  | 'rejected_by_director'
  | 'rejected_by_chairman'
  | 'rejected_by_accounting'
  | 'rejected_settlement';

export interface AdvanceProposal {
  _id: string;
  proposalCode: string;
  creator: User;
  department: Department;
  bankAccount: BankAccount;
  items: AdvanceItem[];
  totalAmount: number;
  status: AdvanceProposalStatus;
  currentApprovalRole?: string | null;
  approvalFlow: ApprovalStep[];
  disbursements: Disbursement[];
  totalDisbursed: number;
  settlement?: SettlementData;
  rejectionReason?: string;
  // [LUỒNG MỚI] Liên kết với đề xuất mua sắm
  purchaseProposal?: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdvanceProposalDto {
  bankAccount?: BankAccount;
  items: Array<{
    stt: number;
    mucDich: string;
    soTien: number;
  }>;
  // [LUỒNG MỚI] Liên kết với đề xuất mua sắm
  purchaseProposal?: string;
}

export interface SubmitSettlementDto {
  type: SettlementType;
  amount?: number;
  attachments?: SettlementAttachment[];
  note?: string;
}

