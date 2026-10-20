const PurchaseProposal = require('../models/PurchaseProposal');
const AdvanceProposal = require('../models/AdvanceProposal');
const User = require('../models/User');
const { researchPrice } = require('./aiSearchService');

class PurchaseProposalService {

  /**
   * [LUỒNG MỚI] Xây dựng luồng phê duyệt cố định 5 bước, không phân biệt hạn mức tiền.
   *
   * Bước 1: Trưởng phòng duyệt tính thỏa đáng của yêu cầu vật tư
   * Bước 2: Thu mua lập 3-4 bản báo giá + giải trình, gửi thẳng lên Giám đốc
   * Bước 3: Giám đốc xem báo giá và phê duyệt mua (có thể từ chối)
   * Bước 4: Thu mua thực hiện mua sắm (chọn 1 trong 3: ứng trước, hóa đơn, hợp đồng)
   * Bước 5: Kế toán lập đề xuất thanh toán / tạm ứng và giải ngân
   *
   * ------ LUỒNG CŨ (ĐÃ COMMENT LẠI để tham chiếu) ------
   * Luồng cũ phân nhánh theo hạn mức tiền và vai trò người tạo:
   *   Nhân viên <= 1M  : truong_phong → thu_mua → ke_toan → pending_determination → ke_toan
   *   Nhân viên <= 10M : giam_doc     → thu_mua → ke_toan → pending_determination → ke_toan
   *   Nhân viên > 10M  : chu_tich     → thu_mua → ke_toan → chu_tich → ke_toan
   *   Trưởng phòng <= 1M : thu_mua   → ke_toan → pending_determination → ke_toan
   *   Giám đốc <= 10M    : thu_mua   → ke_toan → pending_determination → ke_toan
   * ------ KẾT THÚC LUỒNG CŨ ------
   */
  // [LUỒNG MỚI] Tham số estimatedAmount giữ lại để không phá vỡ nơi gọi hàm, nhưng không dùng để phân nhánh
  buildInitialApprovalFlow(creatorRole, estimatedAmount) { // eslint-disable-line no-unused-vars
    const flow = [];

    // Bước 1: Trưởng phòng duyệt (áp dụng cho MỌI vai trò người tạo, kể cả truong_phong tự tạo đơn)
    // [LUỒNG CŨ] Bỏ điều kiện if/else phân nhánh theo creatorRole + estimatedAmount
    flow.push({ step: 'Trưởng phòng duyệt yêu cầu', role: 'truong_phong', status: 'pending' });

    // Bước 2: Thu mua lập báo giá 3-4 NCC + văn bản giải trình
    // [LUỒNG CŨ] Bước này trước đây không yêu cầu giải trình, chỉ điền 1 đơn giá thực tế
    flow.push({ step: 'Thu mua lập báo giá & giải trình', role: 'thu_mua', status: 'pending' });

    // Bước 3: Giám đốc xem báo giá và phê duyệt mua
    // [LUỒNG CŨ] Trước đây GĐ duyệt CUỐI sau khi kế toán xác nhận, giờ GĐ duyệt TRƯỚC khi mua
    flow.push({ step: 'Giám đốc phê duyệt mua', role: 'giam_doc', status: 'pending' });

    // Bước 4: Thu mua thực hiện mua sắm (ứng trước / hóa đơn / hợp đồng)
    // [LUỒNG MỚI] Bước này hoàn toàn mới, không có trong luồng cũ
    flow.push({ step: 'Thu mua thực hiện mua sắm', role: 'thu_mua', status: 'pending' });

    // Bước 5: Kế toán thanh toán / tạm ứng dựa trên hồ sơ thu mua nộp
    // [LUỒNG CŨ] Trước đây kế toán xác nhận giá TRƯỚC GĐ duyệt, giờ chỉ xử lý sau cùng
    flow.push({ step: 'Kế toán thanh toán / tạm ứng', role: 'ke_toan', status: 'pending' });

    return flow;
  }



  getCurrentApprovalRole(approvalFlow) {
    const pendingStep = approvalFlow.find(step => step.status === 'pending');
    return pendingStep ? pendingStep.role : null;
  }

  async create(creatorId, data) {
    const creator = await User.findById(creatorId).populate('department');
    if (!creator) throw new Error('Người dùng không tồn tại');

    // [LUỒNG MỚI] Bỏ phần ước tính chi phí khi nhân viên gửi yêu cầu vật tư lên trưởng phòng (đơn giá sẽ do Thu mua khảo sát)
    // [LUỒNG CŨ] const estimatedTotal = data.items.reduce((sum, item) => sum + (item.soLuong * (item.donGiaDuKien || 0)), 0);
    const estimatedTotal = 0;

    const approvalFlow = this.buildInitialApprovalFlow(creator.role, estimatedTotal);
    const currentApprovalRole = this.getCurrentApprovalRole(approvalFlow);

    // [LUỒNG MỚI] Đơn mới tạo luôn bắt đầu bằng 'pending_tp_approval' (chờ Trưởng phòng duyệt tính thỏa đáng)
    // [LUỒNG CŨ]
    // let status = 'pending_approval';
    // if (currentApprovalRole === 'thu_mua') {
    //   status = 'procurement_review';
    // }
    const status = 'pending_tp_approval';

    // Đảm bảo các hạng mục vật tư không bắt buộc đơn giá dự kiến
    const sanitizedItems = data.items.map((item, idx) => ({
      stt: item.stt || idx + 1,
      tenVatTu: item.tenVatTu,
      yeuCauKiThuat: item.yeuCauKiThuat || '',
      phongBanSuDung: item.phongBanSuDung || '',
      soLuong: Number(item.soLuong) || 1,
      donGiaDuKien: Number(item.donGiaDuKien) || 0,
    }));

    const proposal = await PurchaseProposal.create({
      creator: creatorId,
      department: creator.department._id,
      items: sanitizedItems,
      approvalFlow,
      currentApprovalRole,
      status,
      // [LUỒNG MỚI] Giải trình tính cần thiết và ảnh minh chứng ban đầu (không cần nhập số tiền tạm ứng)
      necessityReason: data.necessityReason || '',
      necessityAttachments: data.necessityAttachments || [],
    });

    return await PurchaseProposal.findById(proposal._id)
      .populate('creator', 'fullName email role')
      .populate('department', 'name');
  }

  async getAll(userId, userRole, userDepartment) {
    let query = {};

    // Lọc danh sách đề xuất theo vai trò của người dùng
    if (userRole === 'nhan_vien') {
      // Nhân viên: chỉ xem đề xuất do chính mình tạo (kể cả đơn bị từ chối gửi về)
      query.creator = userId;
    } else if (userRole === 'truong_phong') {
      // Trưởng phòng: xem đề xuất của phòng ban mình phụ trách
      query.department = userDepartment;
    } else if (userRole === 'thu_mua') {
      // [LUỒNG MỚI] Thu mua: xem các đề xuất cần khảo giá (procurement_pricing), cần mua sắm (procurement_execution), hoặc từng xử lý
      // [LUỒNG CŨ] query.$or = [{ currentApprovalRole: 'thu_mua' }, { 'approvalFlow.role': 'thu_mua', 'approvalFlow.status': { $in: ['approved', 'pending'] } }];
      query.$or = [
        { currentApprovalRole: 'thu_mua' },
        { status: { $in: ['procurement_pricing', 'procurement_execution', 'procurement_review', 'rejected_by_director', 'rejected_by_accounting'] } },
        { 'approvalFlow.role': 'thu_mua', 'approvalFlow.status': { $in: ['approved', 'pending'] } },
      ];
    } else if (userRole === 'ke_toan') {
      // [LUỒNG MỚI] Kế toán: nhận bản sao theo dõi khi Thu mua nộp báo giá cho GĐ/Chủ tịch (pending_director_approval / pending_chairman_approval), xử lý chứng từ khi Thu mua nộp hồ sơ (pending_accounting), hoặc giải ngân
      // [LUỒNG CŨ] query.$or = [{ currentApprovalRole: 'ke_toan' }, { status: { $in: ['pending_payment', 'pending_payment_approval', 'disbursing', 'completed'] } }, { 'approvalFlow.role': 'ke_toan', 'approvalFlow.status': { $in: ['approved', 'pending'] } }];
      query.$or = [
        { currentApprovalRole: 'ke_toan' },
        { status: { $in: ['pending_director_approval', 'pending_chairman_approval', 'pending_accounting', 'accounting_review', 'pending_payment', 'pending_payment_approval', 'disbursing', 'completed', 'rejected_by_accounting'] } },
        { 'approvalFlow.role': 'ke_toan', 'approvalFlow.status': { $in: ['approved', 'pending'] } },
      ];
    } else if (userRole === 'giam_doc') {
      // [LUỒNG MỚI] Giám đốc xem các đề xuất thuộc thẩm quyền (ẩn các đơn > 10tr thuộc thẩm quyền Chủ tịch đang chờ duyệt)
      query.status = {
        $nin: ['pending_tp_approval', 'draft', 'rejected_by_tp', 'pending_chairman_approval'],
      };
    }
    // Chủ tịch có thể xem toàn bộ các đề xuất

    return await PurchaseProposal.find(query)
      .populate('creator', 'fullName email role department bankAccount')
      .populate('department', 'name')
      .populate('approvalFlow.approver', 'fullName role')
      .populate('disbursements.processedBy', 'fullName')
      .populate('procurementExecution.submittedBy', 'fullName email role department bankAccount')
      .sort({ createdAt: -1 });
  }

  async getById(id) {
    const proposal = await PurchaseProposal.findById(id)
      .populate('creator', 'fullName email role department bankAccount')
      .populate('department', 'name')
      .populate('approvalFlow.approver', 'fullName role')
      .populate('disbursements.processedBy', 'fullName')
      .populate('procurementExecution.submittedBy', 'fullName email role department bankAccount')
      .populate({
        path: 'procurementExecution.advanceProposalId',
        select: 'proposalCode status totalAmount currentApprovalRole approvalFlow',
      });

    if (!proposal) throw new Error('Đề xuất không tồn tại');
    return proposal;
  }

  async approve(proposalId, approverId, comment) {
    const proposal = await PurchaseProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    const approver = await User.findById(approverId);
    if (!approver) throw new Error('Người duyệt không tồn tại');

    // Tìm bước duyệt đang chờ xử lý hiện tại
    const currentStepIndex = proposal.approvalFlow.findIndex(
      step => step.status === 'pending'
    );

    if (currentStepIndex === -1) {
      throw new Error('Không có bước duyệt nào đang chờ');
    }

    const currentStep = proposal.approvalFlow[currentStepIndex];

    // Xác thực người duyệt có đúng vai trò được cấp quyền hay không
    if (currentStep.role !== 'pending_determination' && currentStep.role !== approver.role) {
      throw new Error('Bạn không có quyền duyệt bước này');
    }

    // Cập nhật trạng thái bước hiện tại
    currentStep.status = 'approved';
    currentStep.approver = approverId;
    currentStep.comment = comment || '';
    currentStep.date = new Date();

    // Xác định trạng thái tiếp theo
    const nextPendingStep = proposal.approvalFlow.find(
      (step, idx) => idx > currentStepIndex && step.status === 'pending'
    );

    /*
     * [LUỒNG CŨ - ĐÃ COMMENT LẠI]:
     * if (nextPendingStep) {
     *   proposal.currentApprovalRole = nextPendingStep.role;
     *   if (nextPendingStep.role === 'thu_mua') {
     *     proposal.status = 'procurement_review';
     *   } else if (nextPendingStep.role === 'ke_toan' && currentStep.role !== 'pending_determination') {
     *     proposal.status = 'accounting_review';
     *   } else if (nextPendingStep.role === 'pending_determination') {
     *     proposal.status = 'pending_final_approval';
     *   } else if (nextPendingStep.role === 'ke_toan' && proposal.status === 'final_approved') {
     *     proposal.status = 'pending_payment';
     *   } else {
     *     proposal.status = 'pending_approval';
     *   }
     * } else {
     *   proposal.status = 'pending_payment';
     *   proposal.currentApprovalRole = 'ke_toan';
     * }
     */

    // [LUỒNG MỚI] Cập nhật trạng thái đề xuất theo bước tiếp theo của quy trình:
    if (nextPendingStep) {
      proposal.currentApprovalRole = nextPendingStep.role;

      if (currentStep.role === 'truong_phong' && nextPendingStep.role === 'thu_mua') {
        // Sau khi Trưởng phòng duyệt thỏa đáng -> Thu mua nhận yêu cầu lập báo giá
        proposal.status = 'procurement_pricing';
      } else if ((currentStep.role === 'giam_doc' || currentStep.role === 'chu_tich') && nextPendingStep.role === 'thu_mua') {
        // Sau khi Giám đốc / Chủ tịch phê duyệt mua -> Thu mua chuyển sang thực hiện mua sắm
        proposal.status = 'procurement_execution';
      } else if (nextPendingStep.role === 'giam_doc' || nextPendingStep.role === 'chu_tich') {
        proposal.status = nextPendingStep.role === 'chu_tich' ? 'pending_chairman_approval' : 'pending_director_approval';
      } else if (nextPendingStep.role === 'ke_toan') {
        proposal.status = 'pending_accounting';
      } else {
        proposal.status = 'pending_tp_approval';
      }
    } else {
      // Tất cả các bước duyệt đều đã hoàn thành
      proposal.status = 'completed';
      proposal.currentApprovalRole = null;
    }

    await proposal.save();
    return await this.getById(proposalId);
  }

  /**
   * [LUỒNG MỚI] Từ chối đơn và trả về người chịu trách nhiệm ở khâu trước đó:
   * - Khâu 1 (pending_tp_approval): Trưởng phòng từ chối -> Trả về Người tạo đơn (nhân viên) -> status: 'rejected_by_tp', currentApprovalRole: 'nhan_vien'
   * - Khâu 3 (pending_director_approval): Giám đốc từ chối báo giá -> Trả về Thu mua lập báo giá lại -> status: 'procurement_pricing', currentApprovalRole: 'thu_mua'
   * - Khâu 5 (pending_accounting): Kế toán từ chối chứng từ -> Trả về Thu mua thực hiện mua sắm lại -> status: 'procurement_execution', currentApprovalRole: 'thu_mua'
   * - Khâu khác: Đơn chuyển status: 'rejected'
   *
   * Đơn sau khi được người ở khâu trước sửa đổi/nộp lại sẽ tiếp tục quy trình như mới, giữ nguyên mã đơn proposalCode.
   *
   * [LUỒNG CŨ]:
   * proposal.status = 'rejected';
   * proposal.rejectionReason = reason || '';
   * proposal.currentApprovalRole = null;
   */
  async reject(proposalId, approverId, reason) {
    const proposal = await PurchaseProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    const approver = await User.findById(approverId);
    if (!approver) throw new Error('Người duyệt không tồn tại');

    // Xác định khâu hiện tại và trả về khâu trước đó
    if (proposal.status === 'pending_tp_approval' || proposal.status === 'pending_approval') {
      // 1. Trưởng phòng từ chối -> Gửi về cho Nhân viên (người tạo đơn)
      const tpStep = proposal.approvalFlow.find(s => s.role === 'truong_phong');
      if (tpStep) {
        tpStep.status = 'rejected';
        tpStep.approver = approverId;
        tpStep.comment = reason || 'Trưởng phòng từ chối yêu cầu vật tư';
        tpStep.date = new Date();
      }

      proposal.status = 'rejected_by_tp';
      proposal.currentApprovalRole = 'nhan_vien';
      proposal.rejectionReason = reason || 'Yêu cầu vật tư chưa thỏa đáng, vui lòng kiểm tra và chỉnh sửa lại.';
    } else if (proposal.status === 'pending_director_approval' || proposal.status === 'pending_chairman_approval' || proposal.status === 'pending_final_approval') {
      // 2. Giám đốc / Chủ tịch từ chối báo giá -> Gửi về cho Thu mua lập lại báo giá
      const isOverTenMillion = (proposal.totalActualAmount || 0) > 10000000;
      if (isOverTenMillion && approver.role !== 'chu_tich') {
        throw new Error('Đơn mua sắm có tổng giá trị hàng hóa trên 10 triệu đồng thuộc thẩm quyền của Chủ tịch. Giám đốc không có quyền từ chối hoặc phê duyệt đơn này.');
      }

      const directorStep = proposal.approvalFlow.find(s => s.role === 'giam_doc' || s.role === 'chu_tich');
      if (directorStep) {
        directorStep.status = 'rejected';
        directorStep.approver = approverId;
        directorStep.comment = reason || (isOverTenMillion ? 'Chủ tịch không duyệt báo giá, yêu cầu khảo giá lại' : 'Giám đốc không duyệt báo giá, yêu cầu khảo giá lại');
        directorStep.date = new Date();
      }

      // Reset bước Thu mua lập báo giá về pending để Thu mua thao tác lại
      const procurementStep = proposal.approvalFlow.find(s => s.role === 'thu_mua' && s.step.includes('báo giá'));
      if (procurementStep) {
        procurementStep.status = 'pending';
        procurementStep.approver = null;
      }

      proposal.status = 'rejected_by_director';
      proposal.currentApprovalRole = 'thu_mua';
      proposal.rejectionReason = reason || (isOverTenMillion ? 'Chủ tịch yêu cầu khảo sát lại nhà cung cấp hoặc đàm phán mức giá tốt hơn.' : 'Giám đốc yêu cầu khảo sát lại nhà cung cấp hoặc đàm phán mức giá tốt hơn.');
    } else if (proposal.status === 'pending_accounting' || proposal.status === 'accounting_review') {
      // 3. Kế toán từ chối chứng từ -> Gửi về cho Thu mua thực hiện lại mua sắm / nộp lại chứng từ
      const accountingStep = proposal.approvalFlow.find(s => s.role === 'ke_toan');
      if (accountingStep) {
        accountingStep.status = 'rejected';
        accountingStep.approver = approverId;
        accountingStep.comment = reason || 'Kế toán từ chối chứng từ mua sắm';
        accountingStep.date = new Date();
      }

      // Reset bước Thu mua thực hiện mua sắm về pending để Thu mua nộp lại chứng từ
      const executionStep = proposal.approvalFlow.find(s => s.role === 'thu_mua' && s.step.includes('thực hiện'));
      if (executionStep) {
        executionStep.status = 'pending';
        executionStep.approver = null;
      }

      proposal.status = 'rejected_by_accounting';
      proposal.currentApprovalRole = 'thu_mua';
      proposal.rejectionReason = reason || 'Kế toán yêu cầu kiểm tra lại chứng từ hóa đơn/hợp đồng.';
    } else if (proposal.status === 'procurement_pricing') {
      // 4. Thu mua từ chối -> Gửi về cho Trưởng phòng hoặc Người tạo
      const procurementStep = proposal.approvalFlow.find(s => s.role === 'thu_mua');
      if (procurementStep) {
        procurementStep.status = 'rejected';
        procurementStep.approver = approverId;
        procurementStep.comment = reason || 'Thu mua từ chối xử lý';
        procurementStep.date = new Date();
      }

      proposal.status = 'rejected_by_tp';
      proposal.currentApprovalRole = 'nhan_vien';
      proposal.rejectionReason = reason || 'Thu mua không thể tìm thấy nguồn cung cấp phù hợp.';
    } else {
      // Trường hợp chung: từ chối hoàn toàn
      const currentStep = proposal.approvalFlow.find(step => step.status === 'pending');
      if (currentStep) {
        currentStep.status = 'rejected';
        currentStep.approver = approverId;
        currentStep.comment = reason || '';
        currentStep.date = new Date();
      }
      proposal.status = 'rejected';
      proposal.rejectionReason = reason || '';
      proposal.currentApprovalRole = null;
    }

    await proposal.save();
    return await this.getById(proposalId);
  }

  /**
   * [LUỒNG MỚI] Người tạo đơn chỉnh sửa và nộp lại yêu cầu vật tư sau khi bị Trưởng phòng từ chối (rejected_by_tp).
   * Đơn được gửi lại cho Trưởng phòng duyệt, mã đơn proposalCode vẫn GIỮ NGUYÊN.
   */
  async resubmit(proposalId, creatorId, updateData) {
    const proposal = await PurchaseProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    if (proposal.creator.toString() !== creatorId.toString()) {
      throw new Error('Chỉ người tạo đơn mới có quyền nộp lại đề xuất');
    }

    if (proposal.status !== 'rejected_by_tp' && proposal.status !== 'rejected') {
      throw new Error('Đề xuất không ở trạng thái bị từ chối cần nộp lại');
    }

    // Cập nhật danh sách vật tư nếu có
    if (updateData.items && Array.isArray(updateData.items)) {
      proposal.items = updateData.items.map((item, idx) => ({
        stt: item.stt || idx + 1,
        tenVatTu: item.tenVatTu,
        yeuCauKiThuat: item.yeuCauKiThuat || '',
        phongBanSuDung: item.phongBanSuDung || '',
        soLuong: Number(item.soLuong) || 1,
        donGiaDuKien: Number(item.donGiaDuKien) || 0,
      }));
    }

    // Cập nhật giải trình và ảnh minh chứng nếu có
    if (updateData.necessityReason !== undefined) {
      proposal.necessityReason = updateData.necessityReason;
    }
    if (updateData.necessityAttachments !== undefined) {
      proposal.necessityAttachments = updateData.necessityAttachments;
    }

    // Reset lại trạng thái về Bước 1: Trưởng phòng duyệt
    proposal.status = 'pending_tp_approval';
    proposal.currentApprovalRole = 'truong_phong';
    proposal.rejectionReason = '';

    // Reset lại bước Trưởng phòng trong approvalFlow thành pending
    const tpStep = proposal.approvalFlow.find(s => s.role === 'truong_phong');
    if (tpStep) {
      tpStep.status = 'pending';
      tpStep.approver = null;
      tpStep.comment = '';
      tpStep.date = null;
    }

    await proposal.save();
    return await this.getById(proposalId);
  }

  /**
   * AI tự động tra cứu nhà cung cấp và khảo sát đơn giá thị trường cho từng vật tư
   * Trả về ít nhất 3 nhà cung cấp uy tín cho mỗi hạng mục vật tư trong đơn
   */
  async aiSuggestPricing(proposalId) {
    const proposal = await PurchaseProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    const results = [];
    for (const item of proposal.items) {
      try {
        const suppliers = await researchPrice({
          stt: item.stt,
          tenVatTu: item.tenVatTu,
          yeuCauKiThuat: item.yeuCauKiThuat,
          soLuong: item.soLuong,
          donGiaDuKien: item.donGiaDuKien,
          phongBanSuDung: item.phongBanSuDung,
        });

        // Tìm nhà cung cấp có đơn giá tốt nhất để gắn cờ isBestChoice
        let lowestPrice = Infinity;
        let bestIdx = 0;
        suppliers.forEach((s, idx) => {
          if (s.price > 0 && s.price < lowestPrice) {
            lowestPrice = s.price;
            bestIdx = idx;
          }
        });

        const formattedSuppliers = suppliers.map((s, idx) => ({
          id: `ncc_${item._id}_${idx}`,
          name: s.name,
          price: s.price || item.donGiaDuKien || 0,
          url: s.url || '',
          rating: 4.8,
          deliveryDays: '1 - 2 ngày',
          note: s.url ? `Nguồn khảo giá: ${s.url}` : 'Đã xác minh thị trường',
          isBestChoice: idx === bestIdx,
        }));

        results.push({
          itemId: item._id,
          stt: item.stt,
          tenVatTu: item.tenVatTu,
          yeuCauKiThuat: item.yeuCauKiThuat,
          phongBanSuDung: item.phongBanSuDung,
          soLuong: item.soLuong,
          donGiaDuKien: item.donGiaDuKien,
          suppliers: formattedSuppliers,
        });
      } catch (itemErr) {
        console.error(`Lỗi khảo giá AI cho vật tư ${item.tenVatTu}:`, itemErr.message || itemErr);
        const errMsg = String(itemErr.message || '').toLowerCase();
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('resource_exhausted') || errMsg.includes('rate limit') || errMsg.includes('token')) {
          throw new Error('Hạn mức API AI (Quota/Token) tạm thời không khả dụng. Vui lòng chuyển sang nhập giá thủ công.');
        }
        results.push({
          itemId: item._id,
          stt: item.stt,
          tenVatTu: item.tenVatTu,
          yeuCauKiThuat: item.yeuCauKiThuat,
          phongBanSuDung: item.phongBanSuDung,
          soLuong: item.soLuong,
          donGiaDuKien: item.donGiaDuKien,
          suppliers: [],
        });
      }
    }

    return results;
  }

  /**
   * [LUỒNG MỚI] Bước 2: Thu mua lập 3-4 bản báo giá cho từng vật tư, chọn mức giá tối ưu và gửi kèm văn bản giải trình.
   * Gửi thẳng lên Giám đốc duyệt (status: pending_director_approval), đồng thời Kế toán nhận bản sao theo dõi.
   *
   * [LUỒNG CŨ] Chỉ nhập 1 đơn giá thực tế + 1 nhà cung cấp, sau đó chuyển sang cho Kế toán xác nhận (status: accounting_review).
   */
  async submitProcurement(proposalId, procurerId, items, pricingMethod = 'manual', quotationAttachments = [], priceJustification = '') {
    const proposal = await PurchaseProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    // [LUỒNG MỚI] Chấp nhận khi ở procurement_pricing (hoặc procurement_review của luồng cũ) hoặc bị từ chối báo giá nộp lại
    if (proposal.status !== 'procurement_pricing' && proposal.status !== 'procurement_review' && proposal.status !== 'rejected_by_director') {
      throw new Error('Đề xuất không ở trạng thái thu mua lập báo giá');
    }

    // 1. Cập nhật đơn giá thực tế, nhà cung cấp và danh sách báo giá (supplierQuotes) cho từng vật tư
    for (let idx = 0; idx < items.length; idx++) {
      const itemUpdate = items[idx];
      let item = null;
      if (itemUpdate._id) {
        item = proposal.items.id(itemUpdate._id) || proposal.items.find(i => String(i._id) === String(itemUpdate._id));
      }
      if (!item && itemUpdate.stt) {
        item = proposal.items.find(i => i.stt === itemUpdate.stt);
      }
      if (!item && proposal.items[idx]) {
        item = proposal.items[idx];
      }

      if (item) {
        /*
         * [LUỒNG CŨ - ĐÃ COMMENT LẠI]:
         * item.donGiaThucTe = Number(itemUpdate.donGiaThucTe);
         */
        // [LUỒNG MỚI] Làm sạch giá trị đơn giá thực tế, tránh lỗi NaN làm sập Mongoose
        const rawPrice = Number(itemUpdate.donGiaThucTe);
        item.donGiaThucTe = (!isNaN(rawPrice) && rawPrice >= 0) ? rawPrice : 0;

        // [LUỒNG MỚI] Nếu đơn giá dự kiến ban đầu là 0đ (do nhân viên không ước tính),
        // cập nhật giá mới tìm được từ khảo giá vào donGiaDuKien để không còn bị ghi 0đ
        if (!item.donGiaDuKien || item.donGiaDuKien === 0) {
          item.donGiaDuKien = item.donGiaThucTe;
        }

        if (itemUpdate.nhaCungCap) {
          item.nhaCungCap = itemUpdate.nhaCungCap;
        }
        if (itemUpdate.ghiChuNhaCungCap) {
          item.ghiChuNhaCungCap = itemUpdate.ghiChuNhaCungCap;
        }
        // [LUỒNG MỚI] Lưu danh sách 3-4 báo giá của các NCC cho từng vật tư
        if (itemUpdate.supplierQuotes && Array.isArray(itemUpdate.supplierQuotes)) {
          item.supplierQuotes = itemUpdate.supplierQuotes;
        }

        // [LUỒNG MỚI] Đảm bảo cập nhật trường soLuong nếu trước đó đơn bị thiếu
        if (itemUpdate.soLuong !== undefined || item.soLuong === undefined || item.soLuong === null) {
          item.soLuong = Number(itemUpdate.soLuong) || Number(item.soLuong) || 1;
        }
      }
    }

    // 2. Cập nhật phương thức khảo giá, file đính kèm và văn bản giải trình
    proposal.pricingMethod = pricingMethod || 'manual';
    if (quotationAttachments && quotationAttachments.length > 0) {
      proposal.quotationAttachments = quotationAttachments;
    }
    // [LUỒNG MỚI] Lưu văn bản giải trình lý do chọn mức giá/NCC
    if (priceJustification) {
      proposal.priceJustification = priceJustification;
    }

    /*
     * [LUỒNG CŨ - ĐÃ COMMENT LẠI]:
     * const actualTotal = proposal.items.reduce((sum, item) => {
     *   const estPrice = item.donGiaDuKien || 0;
     *   return sum + (item.soLuong * (item.donGiaThucTe !== null && item.donGiaThucTe !== undefined ? item.donGiaThucTe : estPrice));
     * }, 0);
     * proposal.totalActualAmount = actualTotal;
     */
    // [LUỒNG MỚI] Tự động tổng hợp chi phí thực tế từ tất cả các vật tư (kết hợp linh hoạt từ AI và thủ công)
    const actualTotal = proposal.items.reduce((sum, item) => {
      const price = Number(item.donGiaThucTe) || 0;
      const qty = Number(item.soLuong) || 1;
      return sum + (qty * price);
    }, 0);
    proposal.totalActualAmount = isNaN(actualTotal) ? 0 : actualTotal;

    // [LUỒNG MỚI] Cập nhật totalEstimatedAmount bằng giá khảo sát mới nếu trước đó là 0đ
    if (!proposal.totalEstimatedAmount || proposal.totalEstimatedAmount === 0) {
      proposal.totalEstimatedAmount = proposal.totalActualAmount;
    }

    // Đánh dấu các trường subdocument đã thay đổi để Mongoose lưu chính xác xuống MongoDB
    proposal.markModified('items');
    proposal.markModified('totalActualAmount');
    proposal.markModified('totalEstimatedAmount');

    // 4. Đánh dấu bước thu mua lập báo giá là đã hoàn thành
    const procurementStep = proposal.approvalFlow.find(
      step => step.role === 'thu_mua' && step.status === 'pending'
    );
    if (procurementStep) {
      procurementStep.status = 'approved';
      procurementStep.approver = procurerId;
      procurementStep.date = new Date();
      procurementStep.comment = priceJustification || (pricingMethod === 'ai'
        ? 'Đã sử dụng AI khảo sát 3-4 báo giá và chọn nhà cung cấp tối ưu'
        : 'Đã hoàn tất khảo sát 3-4 báo giá thực tế và lập giải trình');
    }

    /*
     * [LUỒNG CŨ - ĐÃ COMMENT LẠI]:
     * proposal.status = 'accounting_review';
     * proposal.currentApprovalRole = 'ke_toan';
     */

    // 5. [LUỒNG MỚI] Phân quyền phê duyệt mua theo hạn mức 10 triệu đồng:
    // - Nếu tổng giá trị hàng hóa thực tế > 10.000.000 VNĐ: Chủ tịch duyệt mua để làm hợp đồng, Giám đốc KHÔNG duyệt.
    // - Nếu tổng giá trị hàng hóa thực tế <= 10.000.000 VNĐ: Giám đốc duyệt mua.
    const isOverTenMillion = (proposal.totalActualAmount || 0) > 10000000;
    const targetApprovalRole = isOverTenMillion ? 'chu_tich' : 'giam_doc';
    const targetStatus = isOverTenMillion ? 'pending_chairman_approval' : 'pending_director_approval';
    const targetStepName = isOverTenMillion ? 'Chủ tịch phê duyệt mua' : 'Giám đốc phê duyệt mua';

    proposal.rejectionReason = '';
    const leaderStep = proposal.approvalFlow.find(
      s => s.role === 'giam_doc' || s.role === 'chu_tich' || (s.step && (s.step.includes('phê duyệt mua') || s.step.includes('Giám đốc') || s.step.includes('Chủ tịch')))
    );
    if (leaderStep) {
      leaderStep.step = targetStepName;
      leaderStep.role = targetApprovalRole;
      leaderStep.status = 'pending';
      leaderStep.approver = null;
      leaderStep.comment = '';
      leaderStep.date = null;
    }

    proposal.status = targetStatus;
    proposal.currentApprovalRole = targetApprovalRole;
    proposal.markModified('approvalFlow');

    await proposal.save();
    return await this.getById(proposalId);
  }

  /**
   * [LUỒNG MỚI] Bước 3: Phê duyệt báo giá để làm hợp đồng mua sắm.
   * - Đơn > 10.000.000 VNĐ: Chủ tịch phê duyệt, Giám đốc KHÔNG được duyệt.
   * - Đơn <= 10.000.000 VNĐ: Giám đốc phê duyệt.
   * Sau khi duyệt, đơn chuyển sang Thu mua thực hiện mua sắm (status: procurement_execution).
   */
  async finalApprove(proposalId, approverId, comment) {
    const proposal = await PurchaseProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    // [LUỒNG MỚI] Cho phép duyệt khi ở pending_director_approval, pending_chairman_approval (hoặc pending_final_approval luồng cũ)
    const isPendingApproval = [
      'pending_director_approval',
      'pending_chairman_approval',
      'pending_final_approval',
    ].includes(proposal.status);

    if (!isPendingApproval) {
      throw new Error('Đề xuất không ở trạng thái chờ lãnh đạo phê duyệt mua sắm');
    }

    const approver = await User.findById(approverId);
    if (!approver) throw new Error('Người duyệt không tồn tại');

    const isOverTenMillion = (proposal.totalActualAmount || 0) > 10000000;

    // QUY TẮC BẮT BUỘC:
    // Đơn có tổng tiền > 10.000.000 VNĐ: CHỈ Chủ tịch có quyền duyệt mua để làm hợp đồng, Giám đốc KHÔNG duyệt!
    if (isOverTenMillion) {
      if (approver.role !== 'chu_tich') {
        throw new Error('Đơn mua sắm có tổng giá trị hàng hóa trên 10 triệu đồng (> 10.000.000 VNĐ). Theo quy định, quyền duyệt mua để làm hợp đồng do Chủ tịch thực hiện, Giám đốc không có quyền phê duyệt đơn này.');
      }
    } else {
      if (approver.role !== 'giam_doc' && approver.role !== 'chu_tich') {
        throw new Error('Bạn không có quyền duyệt bước này (chỉ Giám đốc được duyệt đơn từ 10 triệu trở xuống)');
      }
    }

    const finalStep = proposal.approvalFlow.find(
      step => (step.status === 'pending' || !step.status || step.status === 'approved') &&
              (step.role === 'giam_doc' || step.role === 'chu_tich' || (step.step && step.step.includes('phê duyệt mua')))
    );

    if (finalStep) {
      finalStep.step = isOverTenMillion ? 'Chủ tịch phê duyệt mua' : 'Giám đốc phê duyệt mua';
      finalStep.role = isOverTenMillion ? 'chu_tich' : 'giam_doc';
      finalStep.status = 'approved';
      finalStep.approver = approverId;
      finalStep.comment = comment || '';
      finalStep.date = new Date();
    }

    // Sau khi duyệt mua -> Chuyển sang Thu mua thực hiện mua sắm (hợp đồng / hóa đơn / tạm ứng)
    proposal.status = 'procurement_execution';
    proposal.currentApprovalRole = 'thu_mua';
    proposal.markModified('approvalFlow');

    await proposal.save();
    return await this.getById(proposalId);
  }

  /**
   * [LUỒNG MỚI] Bước 4: Thu mua thực hiện mua sắm sau khi Giám đốc đã phê duyệt báo giá.
   * Thu mua chọn 1 trong 3 phương án:
   *   1. 'advance': Tạm ứng tiền công ty (tự động tạo hoặc liên kết đơn Tạm ứng AdvanceProposal)
   *   2. 'invoice': Tự chi tiền mua rồi lấy hóa đơn VAT gửi Kế toán hoàn ứng/thanh toán
   *   3. 'contract': Ký hợp đồng kinh tế với nhà cung cấp
   *
   * Sau khi nộp hồ sơ, đơn chuyển sang trạng thái: pending_accounting (chờ kế toán thanh toán/tạm ứng).
   */
  async submitProcurementExecution(proposalId, procurerId, executionData) {
    const proposal = await PurchaseProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    if (proposal.status !== 'procurement_execution' && proposal.status !== 'rejected_by_accounting') {
      throw new Error('Đề xuất không ở trạng thái Thu mua thực hiện mua sắm');
    }

    const { actionType, invoiceInfo, contractInfo, isAdvanced, advanceAmount, advanceNote, advanceProposalId } = executionData;
    const hasInvoice = Boolean(invoiceInfo && (invoiceInfo.invoiceNumber || (invoiceInfo.files && invoiceInfo.files.length > 0)));
    const hasContract = Boolean(contractInfo && (contractInfo.contractNumber || (contractInfo.files && contractInfo.files.length > 0)));

    let effectiveActionType = actionType || 'invoice';
    if (hasContract && hasInvoice) {
      effectiveActionType = 'multiple';
    } else if (hasContract) {
      effectiveActionType = 'contract';
    } else if (hasInvoice) {
      effectiveActionType = 'invoice';
    }

    // [QUY TRÌNH MỚI] Quá trình tạm ứng do Thu mua tự thực hiện độc lập như nhân viên bên phân hệ Tạm Ứng.
    // Tại đây, Thu mua chỉ nộp hợp đồng/hóa đơn VAT kèm ảnh minh chứng và nút xác nhận đã được tạm ứng hay chưa.
    proposal.procurementExecution = {
      actionType: effectiveActionType,
      invoiceInfo: invoiceInfo || {},
      contractInfo: contractInfo || {},
      isAdvanced: Boolean(isAdvanced),
      advanceAmount: Number(advanceAmount) || 0,
      advanceNote: advanceNote || '',
      advanceProposalId: advanceProposalId || null,
      submittedBy: procurerId,
      submittedAt: new Date(),
    };

    // Đánh dấu bước Thu mua thực hiện mua sắm trong approvalFlow là đã hoàn thành
    const executionStep = proposal.approvalFlow.find(
      step => step.role === 'thu_mua' && step.step.includes('thực hiện') && step.status === 'pending'
    );
    if (executionStep) {
      executionStep.status = 'approved';
      executionStep.approver = procurerId;
      executionStep.date = new Date();
      let commentMsg = 'Đã cung cấp hồ sơ chứng từ hợp đồng/hóa đơn cho Kế toán';
      if (isAdvanced) {
        commentMsg += ` (Xác nhận đã nhận tạm ứng trước: ${Number(advanceAmount || 0).toLocaleString('vi-VN')} VNĐ)`;
      }
      executionStep.comment = commentMsg;
    }

    // Chuyển sang Bước 5: Kế toán thanh toán / tạm ứng
    // [LUỒNG MỚI] Xóa lý do từ chối cũ và reset bước Kế toán về pending khi nộp lại
    proposal.rejectionReason = '';
    const accountingStep = proposal.approvalFlow.find(s => s.role === 'ke_toan');
    if (accountingStep) {
      accountingStep.status = 'pending';
      accountingStep.approver = null;
      accountingStep.comment = '';
      accountingStep.date = null;
    }

    proposal.status = 'pending_accounting';
    proposal.currentApprovalRole = 'ke_toan';

    await proposal.save();
    return await this.getById(proposalId);
  }

  /**
   * [LUỒNG MỚI] Bước 5: Kế toán kiểm tra chứng từ (HĐ, hợp đồng hoặc tạm ứng) và xác nhận giải ngân/hoàn tất.
   *
   * [LUỒNG CŨ] Kế toán xác nhận giá thị trường trước khi GĐ duyệt (chuyển sang pending_final_approval).
   */
  async accountingConfirm(proposalId, accountantId, comment) {
    const proposal = await PurchaseProposal.findById(proposalId);
    if (!proposal) throw new Error('Đề xuất không tồn tại');

    // [LUỒNG MỚI] Cho phép xác nhận khi ở pending_accounting (hoặc accounting_review của luồng cũ)
    if (proposal.status !== 'pending_accounting' && proposal.status !== 'accounting_review') {
      throw new Error('Đề xuất không ở trạng thái chờ kế toán xử lý chứng từ/thanh toán');
    }

    // Đánh dấu bước kế toán là đã hoàn thành
    const accountingStep = proposal.approvalFlow.find(
      step => step.role === 'ke_toan' && step.status === 'pending'
    );
    if (accountingStep) {
      accountingStep.status = 'approved';
      accountingStep.approver = accountantId;
      accountingStep.comment = comment || 'Kế toán đã tiếp nhận chứng từ và hoàn tất thanh toán / tạm ứng';
      accountingStep.date = new Date();
    }

    /*
     * [LUỒNG CŨ - ĐÃ COMMENT LẠI]:
     * const actualAmount = proposal.totalActualAmount || proposal.totalEstimatedAmount;
     * const finalApprovalStep = proposal.approvalFlow.find(step => step.role === 'pending_determination');
     * if (finalApprovalStep) {
     *   if (actualAmount <= 10000000) {
     *     finalApprovalStep.role = 'giam_doc';
     *     finalApprovalStep.step = 'Giám đốc duyệt cuối';
     *   } else {
     *     finalApprovalStep.role = 'chu_tich';
     *     finalApprovalStep.step = 'Chủ tịch duyệt cuối';
     *   }
     * }
     * proposal.status = 'pending_final_approval';
     * proposal.currentApprovalRole = finalApprovalStep ? finalApprovalStep.role : 'giam_doc';
     */

    // [LUỒNG MỚI] Sau khi Kế toán xử lý hồ sơ thanh toán/tạm ứng, đề xuất hoàn tất và lưu hóa đơn
    proposal.status = 'completed';
    proposal.currentApprovalRole = null;
    proposal.isInvoiceCompleted = true;
    proposal.invoiceCompletedAt = new Date();

    await proposal.save();
    return await this.getById(proposalId);
  }
}

module.exports = new PurchaseProposalService();
