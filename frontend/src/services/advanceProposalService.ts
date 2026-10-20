import api from './api';
import {
  AdvanceProposal,
  CreateAdvanceProposalDto,
  SubmitSettlementDto,
} from '../models';

export const advanceProposalService = {
  getAll: async (): Promise<AdvanceProposal[]> => {
    const res = await api.get<{ success: boolean; data: AdvanceProposal[] }>('/advance-proposals');
    return res.data.data;
  },

  getById: async (id: string): Promise<AdvanceProposal> => {
    const res = await api.get<{ success: boolean; data: AdvanceProposal }>(`/advance-proposals/${id}`);
    return res.data.data;
  },

  create: async (data: CreateAdvanceProposalDto): Promise<AdvanceProposal> => {
    const res = await api.post<{ success: boolean; data: AdvanceProposal }>('/advance-proposals', data);
    return res.data.data;
  },

  approve: async (id: string, comment?: string): Promise<AdvanceProposal> => {
    const res = await api.put<{ success: boolean; data: AdvanceProposal }>(`/advance-proposals/${id}/approve`, {
      comment,
    });
    return res.data.data;
  },

  reject: async (id: string, reason: string): Promise<AdvanceProposal> => {
    const res = await api.put<{ success: boolean; data: AdvanceProposal }>(`/advance-proposals/${id}/reject`, {
      reason,
    });
    return res.data.data;
  },

  accountingDisburse: async (
    id: string,
    amount?: number,
    note?: string
  ): Promise<AdvanceProposal> => {
    const res = await api.put<{ success: boolean; data: AdvanceProposal }>(
      `/advance-proposals/${id}/accounting-disburse`,
      { amount, note }
    );
    return res.data.data;
  },

  submitSettlement: async (
    id: string,
    data: SubmitSettlementDto
  ): Promise<AdvanceProposal> => {
    const res = await api.put<{ success: boolean; data: AdvanceProposal }>(
      `/advance-proposals/${id}/settlement`,
      data
    );
    return res.data.data;
  },

  resubmit: async (
    id: string,
    data: {
      items?: Array<{ mucDich: string; soTien: number }>;
      bankAccount?: { bankName: string; accountNumber: string; accountHolder?: string };
      purchaseProposal?: string;
    }
  ): Promise<AdvanceProposal> => {
    const res = await api.put<{ success: boolean; data: AdvanceProposal }>(
      `/advance-proposals/${id}/resubmit`,
      data
    );
    return res.data.data;
  },

  rejectSettlement: async (id: string, reason: string): Promise<AdvanceProposal> => {
    const res = await api.put<{ success: boolean; data: AdvanceProposal }>(
      `/advance-proposals/${id}/reject-settlement`,
      { reason }
    );
    return res.data.data;
  },

  confirmSettlement: async (
    id: string,
    comment?: string
  ): Promise<AdvanceProposal> => {
    const res = await api.put<{ success: boolean; data: AdvanceProposal }>(
      `/advance-proposals/${id}/confirm-settlement`,
      { comment }
    );
    return res.data.data;
  },
};
