import api from './api';
import { CreatePurchaseProposalDto, PurchaseProposal } from '../models';

export const purchaseProposalService = {
  getAll: async (): Promise<PurchaseProposal[]> => {
    const res = await api.get<{ success: boolean; data: PurchaseProposal[] }>('/purchase-proposals');
    return res.data.data;
  },

  getById: async (id: string): Promise<PurchaseProposal> => {
    const res = await api.get<{ success: boolean; data: PurchaseProposal }>(`/purchase-proposals/${id}`);
    return res.data.data;
  },

  create: async (data: CreatePurchaseProposalDto): Promise<PurchaseProposal> => {
    const res = await api.post<{ success: boolean; data: PurchaseProposal }>('/purchase-proposals', data);
    return res.data.data;
  },

  approve: async (id: string, comment?: string): Promise<PurchaseProposal> => {
    const res = await api.put<{ success: boolean; data: PurchaseProposal }>(`/purchase-proposals/${id}/approve`, {
      comment,
    });
    return res.data.data;
  },

  reject: async (id: string, reason: string): Promise<PurchaseProposal> => {
    const res = await api.put<{ success: boolean; data: PurchaseProposal }>(`/purchase-proposals/${id}/reject`, {
      reason,
    });
    return res.data.data;
  },

  getAIPricingSuggestions: async (id: string) => {
    const res = await api.get<{ success: boolean; data: any }>(
      `/purchase-proposals/${id}/ai-pricing`
    );
    return res.data.data;
  },

  submitProcurement: async (
    id: string,
    items: Array<{
      _id?: string;
      donGiaThucTe: number;
      nhaCungCap?: string;
      ghiChuNhaCungCap?: string;
      supplierQuotes?: any[];
    }>,
    pricingMethod?: 'ai' | 'manual',
    quotationAttachments?: any[],
    priceJustification?: string
  ): Promise<PurchaseProposal> => {
    // [LUỒNG MỚI] Gửi kèm supplierQuotes (3-4 báo giá) và priceJustification (văn bản giải trình)
    const res = await api.put<{ success: boolean; data: PurchaseProposal }>(
      `/purchase-proposals/${id}/procurement`,
      { items, pricingMethod, quotationAttachments, priceJustification }
    );
    return res.data.data;
  },

  // [LUỒNG MỚI] Bước 4: Thu mua nộp hồ sơ thực hiện mua sắm (ứng trước / hóa đơn / hợp đồng)
  submitProcurementExecution: async (
    id: string,
    executionData: {
      actionType: 'advance' | 'invoice' | 'contract' | 'multiple';
      invoiceInfo?: any;
      contractInfo?: any;
      advanceProposalId?: string | null;
      isAdvanced?: boolean;
      advanceAmount?: number;
      advanceNote?: string;
    }
  ): Promise<PurchaseProposal> => {
    const res = await api.put<{ success: boolean; data: PurchaseProposal }>(
      `/purchase-proposals/${id}/procurement-execution`,
      executionData
    );
    return res.data.data;
  },

  accountingConfirm: async (id: string, comment?: string): Promise<PurchaseProposal> => {
    const res = await api.put<{ success: boolean; data: PurchaseProposal }>(
      `/purchase-proposals/${id}/accounting-confirm`,
      { comment }
    );
    return res.data.data;
  },

  finalApprove: async (id: string, comment?: string): Promise<PurchaseProposal> => {
    const res = await api.put<{ success: boolean; data: PurchaseProposal }>(
      `/purchase-proposals/${id}/final-approve`,
      { comment }
    );
    return res.data.data;
  },

  // [LUỒNG MỚI] Người tạo đơn nộp lại yêu cầu sau khi bị từ chối
  resubmit: async (
    id: string,
    data: {
      items?: any[];
      necessityReason?: string;
      necessityAttachments?: any[];
    }
  ): Promise<PurchaseProposal> => {
    const res = await api.put<{ success: boolean; data: PurchaseProposal }>(
      `/purchase-proposals/${id}/resubmit`,
      data
    );
    return res.data.data;
  },
};
