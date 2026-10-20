const AdvanceProposal = require('../models/AdvanceProposal');
const User = require('../models/User');

class AdvanceProposalService {

  /**
   * [LUỒNG MỚI] Thiết lập luồng phê duyệt đơn tạm ứng dựa trên hạn mức số tiền:
   * - Đơn <= 10.000.000 VNĐ: Sếp (Giám đốc) duyệt -> Kế toán duyệt & giải ngân -> Hoàn tạm ứng -> Kế toán xác nhận
   * - Đơn > 10.000.000 VNĐ: Chủ tịch duyệt (bỏ qua Giám đốc) -> Kế toán duyệt & giải ngân -> Hoàn tạm ứng -> Kế toán xác nhận
   * - Giám đốc tự tạo: chuyển thẳng lên Chủ tịch duyệt
   * - Chủ tịch tự tạo: chuyển thẳng sang Kế toán giải ngân
   */
  buildApprovalFlow(creatorRole, totalAmount = 0) {
    const flow = [];
    const isOverTenMillion = Number(totalAmount) > 10000000;

    if (creatorRole === 'nhan_vien' || creatorRole === 'truong_phong' || creatorRole === 'thu_mua' || creatorRole === 'ke_toan') {
      if (isOverTenMillion) {
        // [LUỒNG MỚI] Đơn > 10 triệu: Chủ tịch trực tiếp duyệt tạm ứng, Giám đốc không duyệt
        flow.push({ step: 'Chủ tịch duyệt tạm ứng', role: 'chu_tich', status: 'pending' });
      } else {
        // [LUỒNG MỚI] Đơn <= 10 triệu: Sếp (Giám đốc) duyệt tạm ứng
        flow.push({ step: 'Giám đốc duyệt tạm ứng', role: 'giam_doc', status: 'pending' });
      }
    } else if (creatorRole === 'giam_doc') {
      // Giám đốc: bỏ qua duyệt cấp giám đốc, chuyển thẳng lên chủ tịch
      flow.push({ step: 'Chủ tịch duyệt tạm ứng', role: 'chu_tich', status: 'pending' });
    }
    // Chủ tịch: bỏ qua cả giám đốc và chủ tịch, chuyển thẳng sang kế toán

    flow.push({ step: 'Kế toán duyệt & giải ngân', role: 'ke_toan', status: 'pending' });
    flow.push({ step: 'Hoàn tạm ứng', role: 'creator', status: 'pending' });
    flow.push({ step: 'Kế toán xác nhận hoàn tạm ứng', role: 'ke_toan', status: 'pending' });

    return flow;
  }

  getCurrentApprovalRole(approvalFlow) {
    const pendingStep = approvalFlow.find(step => step.status === 'pending');
    return pendingStep ? pendingStep.role : null;
  }

  getStatusFromRole(role) {
    const roleStatusMap = {
      giam_doc: 'pending_director',
      chu_tich: 'pending_chairman',
      ke_toan: 'pending_accounting',
      creator: 'pending_settlement',
    };
    return roleStatusMap[role] || 'pending_accounting';
  }

  async create(creatorId, data) {
    const creator = await User.findById(creatorId).populate('department');
    if (!creator) throw new Error('Người dùng không tồn tại');

    // [LUỒNG MỚI] Tính tổng số tiền tạm ứng từ danh sách items để phân luồng thẩm quyền duyệt chi
    const totalAmount = Array.isArray(data.items)
      ? data.items.reduce((sum, item) => sum + (Number(item.soTien) || 0), 0)
      : (Number(data.totalAmount) || 0);

    const approvalFlow = this.buildApprovalFlow(creator.role, totalAmount);
    const currentApprovalRole = this.getCurrentApprovalRole(approvalFlow);
    const status = this.getStatusFromRole(currentApprovalRole);

    // Sử dụng thông tin tài khoản ngân hàng của người tạo hoặc tài khoản được chỉ định
    const bankAccount = data.bankAccount || creator.bankAccount;

    // [LUỒNG MỚI] Cho phép liên kết với đề xuất mua sắm (nếu có)
    const proposal = await AdvanceProposal.create({
      creator: creatorId,
      department: creator.department._id,
      bankAccount,
      items: data.items,
      totalAmount,
      approvalFlow,
      currentApprovalRole,
      status,
      purchaseProposal: data.purchaseProposal || null,
    });

    return await AdvanceProposal.findById(proposal._id)
      .populate('creator', 'fullName email role')
      .populate('department', 'name')
      .populate('purchaseProposal', 'proposalCode totalEstimatedAmount totalActualAmount');
  }

  async getAll(userId, userRole, userDepartment) {
    let query = {};

    if (userRole === 'nhan_vien') {
      query.creator = userId;
    } else if (userRole === 'truong_phong') {
      query.department = userDepartment;
    } else if (userRole === 'thu_mua') {
      query.creator = userId;
    } else if (userRole === 'ke_toan') {
      query.$or = [
        { currentApprovalRole: 'ke_toan' },
        { status: { $in: ['disbursing', 'disbursed', 'settlement_submitted', 'completed', 'rejected_by_accounting', 'rejected_settlement'] } },
        { 'approvalFlow.role': 'ke_toan' },
        { creator: userId },
      ];
    }
    // Giám đốc và Chủ tịch có thể xem toàn bộ đề xuất

    return await AdvanceProposal.find(query)
      .populate('creator', 'fullName email role')
      .populate('department', 'name')
      .populate('approvalFlow.approver', 'fullName role')
      .populate('disbursements.processedBy', 'fullName')
      .populate('purchaseProposal', 'proposalCode totalEstimatedAmount totalActualAmount')
      .sort({ createdAt: -1 });
  }

  async getById(id) {
    const proposal = await AdvanceProposal.findById(id)
      .populate('creator', 'fullName email role department bankAccount')
      .populate('department', 'name')
      .populate('approvalFlow.approver', 'fullName role')
      .populate('disbursements.processedBy', 'fullName')
      .populate('settlement.confirmedBy', 'fullName')
      .populate('purchaseProposal', 'proposalCode totalEstimatedAmount totalActualAmount items');

    if (!proposal) throw new Error('Đề xuất không tồn tại');
    return proposal;
  }

  async approve(proposalId, approverId, comment) {
    const proposal = await AdvanceProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    const approver = await User.findById(approverId);
    if (!approver) throw new Error('Người duyệt không tồn tại');

    const currentStepIndex = proposal.approvalFlow.findIndex(step => step.status === 'pending');
    if (currentStepIndex === -1) throw new Error('Không có bước duyệt nào đang chờ');

    const currentStep = proposal.approvalFlow[currentStepIndex];

    const isStepChairman = currentStep.role === 'chu_tich';
    const isStepDirector = currentStep.role === 'giam_doc';

    if (isStepChairman && approver.role !== 'chu_tich') {
      throw new Error('Đơn tạm ứng trên 10.000.000 VNĐ thuộc thẩm quyền Chủ tịch phê duyệt');
    }

    if (isStepDirector && approver.role !== 'giam_doc' && approver.role !== 'chu_tich') {
      throw new Error('Bạn không có quyền duyệt bước này');
    }

    if (!isStepChairman && !isStepDirector && currentStep.role !== approver.role) {
      throw new Error('Bạn không có quyền duyệt bước này');
    }

    currentStep.status = 'approved';
    currentStep.approver = approverId;
    currentStep.comment = comment || '';
    currentStep.date = new Date();

    // Tìm bước duyệt tiếp theo đang chờ xử lý
    const nextPendingStep = proposal.approvalFlow.find(
      (step, idx) => idx > currentStepIndex && step.status === 'pending'
    );

    if (nextPendingStep) {
      proposal.currentApprovalRole = nextPendingStep.role;
      proposal.status = this.getStatusFromRole(nextPendingStep.role);
    } else {
      proposal.currentApprovalRole = null;
    }

    await proposal.save();
    return await this.getById(proposalId);
  }

  async reject(proposalId, approverId, reason) {
    const proposal = await AdvanceProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    const approver = await User.findById(approverId);
    if (!approver) throw new Error('Người duyệt không tồn tại');

    const currentStepIndex = proposal.approvalFlow.findIndex(step => step.status === 'pending');
    if (currentStepIndex === -1) throw new Error('Không có bước duyệt nào đang chờ');

    const currentStep = proposal.approvalFlow[currentStepIndex];

    const isStepChairman = currentStep.role === 'chu_tich';
    const isStepDirector = currentStep.role === 'giam_doc';

    if (isStepChairman && approver.role !== 'chu_tich') {
      throw new Error('Đơn tạm ứng trên 10.000.000 VNĐ thuộc thẩm quyền Chủ tịch xem xét');
    }

    if (isStepDirector && approver.role !== 'giam_doc' && approver.role !== 'chu_tich') {
      throw new Error('Bạn không có quyền từ chối bước này');
    }

    if (!isStepChairman && !isStepDirector && currentStep.role !== approver.role) {
      throw new Error('Bạn không có quyền từ chối bước này');
    }

    currentStep.status = 'rejected';
    currentStep.approver = approverId;
    currentStep.comment = reason || '';
    currentStep.date = new Date();

    // [QUY TRÌNH MỚI] Nếu đơn tạm ứng bị từ chối, trả về bước trước đó (Người tạo) để làm lại
    if (isStepChairman || approver.role === 'chu_tich') {
      proposal.status = 'rejected_by_chairman';
    } else if (isStepDirector || approver.role === 'giam_doc') {
      proposal.status = 'rejected_by_director';
    } else if (currentStep.role === 'ke_toan' || approver.role === 'ke_toan') {
      proposal.status = 'rejected_by_accounting';
    } else {
      proposal.status = 'rejected';
    }

    proposal.rejectionReason = reason || '';
    proposal.currentApprovalRole = 'creator'; // Trả về bước trước đó: người tạo để làm lại

    await proposal.save();
    return await this.getById(proposalId);
  }

  /**
   * [QUY TRÌNH MỚI] Người tạo chỉnh sửa và gửi lại đề xuất tạm ứng sau khi bị từ chối
   */
  async resubmit(proposalId, creatorId, updateData) {
    const proposal = await AdvanceProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    if (proposal.creator.toString() !== creatorId.toString()) {
      throw new Error('Chỉ người tạo mới có quyền chỉnh sửa và gửi lại đề xuất');
    }

    const allowedStatuses = ['rejected', 'rejected_by_director', 'rejected_by_chairman', 'rejected_by_accounting'];
    if (!allowedStatuses.includes(proposal.status)) {
      throw new Error('Chỉ có thể chỉnh sửa và gửi lại khi đề xuất bị từ chối');
    }

    const creator = await User.findById(creatorId);
    if (!creator) throw new Error('Người dùng không tồn tại');

    if (Array.isArray(updateData.items) && updateData.items.length > 0) {
      proposal.items = updateData.items.map((item, idx) => ({
        stt: idx + 1,
        mucDich: item.mucDich,
        soTien: Number(item.soTien) || 0,
      }));
    }

    if (updateData.bankAccount) {
      proposal.bankAccount = updateData.bankAccount;
    }

    if (updateData.purchaseProposal !== undefined) {
      proposal.purchaseProposal = updateData.purchaseProposal || null;
    }

    // Tính lại tổng số tiền tạm ứng
    const totalAmount = proposal.items.reduce((sum, item) => sum + (Number(item.soTien) || 0), 0);
    proposal.totalAmount = totalAmount;

    // Xây dựng lại luồng phê duyệt từ đầu theo số tiền mới
    const approvalFlow = this.buildApprovalFlow(creator.role, totalAmount);
    const currentApprovalRole = this.getCurrentApprovalRole(approvalFlow);
    const status = this.getStatusFromRole(currentApprovalRole);

    proposal.approvalFlow = approvalFlow;
    proposal.currentApprovalRole = currentApprovalRole;
    proposal.status = status;
    proposal.rejectionReason = ''; // Xóa lý do từ chối sau khi làm lại

    await proposal.save();
    return await this.getById(proposalId);
  }

  async accountingApproveAndDisburse(proposalId, accountantId, amount, note) {
    const proposal = await AdvanceProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    if (proposal.status !== 'pending_accounting' && proposal.status !== 'accounting_approved') {
      throw new Error('Đề xuất không ở trạng thái kế toán duyệt');
    }

    const accountingStep = proposal.approvalFlow.find(
      step => step.role === 'ke_toan' && step.step === 'Kế toán duyệt & giải ngân' && step.status === 'pending'
    );

    if (accountingStep) {
      accountingStep.status = 'approved';
      accountingStep.approver = accountantId;
      accountingStep.date = new Date();
    }

    // Ghi nhận lần giải ngân chi tiền
    const disbursementAmount = amount || proposal.totalAmount;
    proposal.disbursements.push({
      amount: disbursementAmount,
      note: note || 'Giải ngân tạm ứng',
      processedBy: accountantId,
      date: new Date(),
    });
    proposal.totalDisbursed += disbursementAmount;

    proposal.status = 'pending_settlement';
    proposal.currentApprovalRole = 'creator';

    await proposal.save();
    return await this.getById(proposalId);
  }

  async submitSettlement(proposalId, creatorId, settlementData) {
    const proposal = await AdvanceProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    if (proposal.status !== 'pending_settlement' && proposal.status !== 'rejected_settlement') {
      throw new Error('Đề xuất không ở trạng thái hoàn tạm ứng');
    }

    if (proposal.creator.toString() !== creatorId.toString()) {
      throw new Error('Chỉ người tạo đề xuất mới có thể hoàn tạm ứng');
    }

    // Cập nhật thông tin quyết toán hoàn ứng
    proposal.settlement = {
      type: settlementData.type, // 'surplus', 'deficit', 'exact'
      amount: settlementData.amount || 0,
      attachments: settlementData.attachments || [],
      note: settlementData.note || '',
      submittedAt: new Date(),
    };

    // Đánh dấu bước nộp hoàn ứng của người tạo là đã hoàn tất
    const creatorStep = proposal.approvalFlow.find(
      step => step.role === 'creator'
    );
    if (creatorStep) {
      creatorStep.status = 'approved';
      creatorStep.approver = creatorId;
      creatorStep.date = new Date();
    }

    // Đặt lại bước kế toán xác nhận là pending
    const accountingFinalStep = proposal.approvalFlow.find(
      step => step.step === 'Kế toán xác nhận hoàn tạm ứng'
    );
    if (accountingFinalStep) {
      accountingFinalStep.status = 'pending';
      accountingFinalStep.approver = null;
      accountingFinalStep.comment = '';
    }

    proposal.status = 'settlement_submitted';
    proposal.currentApprovalRole = 'ke_toan';
    proposal.rejectionReason = ''; // Xóa lý do từ chối hoàn ứng nếu có

    await proposal.save();
    return await this.getById(proposalId);
  }

  /**
   * [QUY TRÌNH MỚI] Kế toán từ chối chứng từ hoàn tạm ứng và yêu cầu người tạo làm lại
   */
  async rejectSettlement(proposalId, accountantId, reason) {
    const proposal = await AdvanceProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    if (proposal.status !== 'settlement_submitted') {
      throw new Error('Đề xuất không ở trạng thái chờ xác nhận hoàn tạm ứng');
    }

    const accountant = await User.findById(accountantId);
    if (!accountant) throw new Error('Người duyệt không tồn tại');

    // Reset bước hoàn ứng của người tạo về pending để nộp lại
    const creatorStep = proposal.approvalFlow.find(
      step => step.role === 'creator'
    );
    if (creatorStep) {
      creatorStep.status = 'pending';
      creatorStep.approver = null;
      creatorStep.comment = '';
    }

    proposal.status = 'rejected_settlement';
    proposal.currentApprovalRole = 'creator'; // Trả về cho người tạo nộp lại chứng từ hoàn ứng
    proposal.rejectionReason = reason || 'Kế toán từ chối chứng từ hoàn tạm ứng, yêu cầu làm lại';

    await proposal.save();
    return await this.getById(proposalId);
  }

  async confirmSettlement(proposalId, accountantId, comment) {
    const proposal = await AdvanceProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    if (proposal.status !== 'settlement_submitted') {
      throw new Error('Đề xuất không ở trạng thái chờ xác nhận hoàn tạm ứng');
    }

    // Đánh dấu bước kế toán xác nhận hoàn ứng là đã duyệt
    const finalAccountingStep = proposal.approvalFlow.find(
      step => step.step === 'Kế toán xác nhận hoàn tạm ứng' && step.status === 'pending'
    );
    if (finalAccountingStep) {
      finalAccountingStep.status = 'approved';
      finalAccountingStep.approver = accountantId;
      finalAccountingStep.comment = comment || '';
      finalAccountingStep.date = new Date();
    }

    proposal.settlement.confirmedAt = new Date();
    proposal.settlement.confirmedBy = accountantId;

    proposal.status = 'completed';
    proposal.currentApprovalRole = null;

    await proposal.save();
    return await this.getById(proposalId);
  }
}

module.exports = new AdvanceProposalService();
