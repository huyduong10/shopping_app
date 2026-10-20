import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { advanceProposalService, uploadService } from '../../services';
import { AdvanceProposal, SettlementType, SettlementAttachment } from '../../models';
import { StatusBadge, ApprovalFlowTracker, Modal, AdvancePrintModal, FilePreviewModal, PreviewFileItem } from '../../component';
import { formatCurrency, formatDate, getRoleLabel, formatFileSize } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  XCircle,
  CreditCard,
  User as UserIcon,
  Loader2,
  AlertCircle,
  FileCheck,
  Receipt,
  Paperclip,
  UploadCloud,
  Download,
  Eye,
  ExternalLink,
  FileSpreadsheet,
  Image as ImageIcon,
  FileText,
  X,
  Printer,
  Crown,
  Plus,
  Trash2,
} from 'lucide-react';

const getFileIcon = (fileName: string, type?: string) => {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (ext === 'pdf' || type?.includes('pdf')) {
    return <FileText size={20} color="#f87171" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext || '') || type?.includes('sheet') || type?.includes('excel')) {
    return <FileSpreadsheet size={20} color="#34d399" />;
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext || '') || type?.includes('image')) {
    return <ImageIcon size={20} color="#38bdf8" />;
  }
  return <FileText size={20} color="var(--primary)" />;
};


export const AdvanceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [proposal, setProposal] = useState<AdvanceProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quản lý trạng thái mở/đóng các Modal
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isConfirmSettlementOpen, setIsConfirmSettlementOpen] = useState(false);
  const [isDisburseSuccessOpen, setIsDisburseSuccessOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // [QUY TRÌNH MỚI] Modal chỉnh sửa và nộp lại đơn tạm ứng khi bị từ chối
  const [isResubmitOpen, setIsResubmitOpen] = useState(false);
  const [resubmitItems, setResubmitItems] = useState<Array<{ id: string; mucDich: string; soTien: number }>>([]);
  const [resubmitBankAccount, setResubmitBankAccount] = useState({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  });

  // [QUY TRÌNH MỚI] Modal Kế toán từ chối hoàn tạm ứng
  const [isRejectSettlementOpen, setIsRejectSettlementOpen] = useState(false);
  const [rejectSettlementReason, setRejectSettlementReason] = useState('');

  const [disburseSuccessInfo, setDisburseSuccessInfo] = useState<{
    code: string;
    amount: number;
    beneficiaryName: string;
    accountNumber: string;
    bankName: string;
    note: string;
  } | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<PreviewFileItem | null>(null);
  const [previewFileList, setPreviewFileList] = useState<PreviewFileItem[]>([]);
  const [previewFileIndex, setPreviewFileIndex] = useState(0);

  const handleOpenPreview = (name: string, url: string, type?: string, list?: PreviewFileItem[], index?: number) => {
    const item: PreviewFileItem = { name, url, type };
    setPreviewAttachment(item);
    if (list && list.length > 0) {
      setPreviewFileList(list);
      setPreviewFileIndex(index !== undefined ? index : list.findIndex((f) => f.url === url));
    } else {
      setPreviewFileList([item]);
      setPreviewFileIndex(0);
    }
  };

  // Dữ liệu biểu mẫu trong các Modal
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [disburseNote, setDisburseNote] = useState('');
  const [disburseAmount, setDisburseAmount] = useState<number>(0);

  // Dữ liệu biểu mẫu hoàn ứng
  const [settlementType, setSettlementType] = useState<SettlementType>('exact');
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementNote, setSettlementNote] = useState('');
  const [settlementAttachments, setSettlementAttachments] = useState<SettlementAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [fileUploading, setFileUploading] = useState(false);

  // Xử lý upload danh sách tệp đính kèm hoàn ứng lưu thẳng vào ổ cứng máy chủ
  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files || files.length === 0) return;

    // Kiểm tra dung lượng từng tệp không vượt quá 15MB
    const oversizedFiles = files.filter((f) => f.size > 15 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert(`Một số tệp vượt quá dung lượng tối đa 15MB: ${oversizedFiles.map((f) => f.name).join(', ')}`);
      return;
    }

    setFileUploading(true);
    try {
      const uploadedResults = await uploadService.uploadFiles(files);
      setSettlementAttachments((prev) => [
        ...prev,
        ...uploadedResults.map((item) => ({
          name: item.name,
          url: item.url,
          size: item.size,
          type: item.type,
        })),
      ]);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tải tệp lên ổ cứng máy chủ');
    } finally {
      setFileUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setSettlementAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const [actionLoading, setActionLoading] = useState(false);


  const fetchProposal = useCallback(async (propId: string) => {
    setLoading(true);
    try {
      const data = await advanceProposalService.getById(propId);
      setProposal(data);
      setDisburseAmount(data.totalAmount);
    } catch (err: any) {
      setError(err.message || 'Không thể tải chi tiết đề xuất tạm ứng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) fetchProposal(id);
  }, [id, fetchProposal]);

  // Các hàm xử lý hành động người dùng
  const handleApprove = async () => {
    if (!proposal) return;
    setActionLoading(true);
    try {
      await advanceProposalService.approve(proposal._id, comment);
      setIsApproveOpen(false);
      setComment('');
      fetchProposal(proposal._id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!proposal || !rejectReason.trim()) {
      alert('Vui lòng nhập lý do từ chối');
      return;
    }
    setActionLoading(true);
    try {
      await advanceProposalService.reject(proposal._id, rejectReason);
      setIsRejectOpen(false);
      setRejectReason('');
      fetchProposal(proposal._id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccountingDisburse = async () => {
    if (!proposal) return;
    setActionLoading(true);
    try {
      const savedAmount = disburseAmount;
      const savedNote = disburseNote || `Giải ngân tạm ứng chuyển vào STK ${proposal.bankAccount?.accountNumber}`;
      await advanceProposalService.accountingDisburse(
        proposal._id,
        savedAmount,
        savedNote
      );
      setDisburseSuccessInfo({
        code: proposal.proposalCode,
        amount: savedAmount,
        beneficiaryName: proposal.creator?.fullName || '',
        accountNumber: proposal.bankAccount?.accountNumber || '',
        bankName: proposal.bankAccount?.bankName || '',
        note: savedNote,
      });
      setIsDisburseOpen(false);
      setDisburseNote('');
      setIsDisburseSuccessOpen(true);
      fetchProposal(proposal._id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitSettlement = async () => {
    if (!proposal) return;
    setActionLoading(true);
    try {
      const payload = {
        type: settlementType,
        amount: settlementType === 'exact' ? 0 : settlementAmount,
        note: settlementNote,
        attachments: settlementAttachments,
      };
      await advanceProposalService.submitSettlement(proposal._id, payload);
      setIsSettlementOpen(false);
      setSettlementAttachments([]);
      setSettlementNote('');
      fetchProposal(proposal._id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmSettlement = async () => {
    if (!proposal) return;
    setActionLoading(true);
    try {
      await advanceProposalService.confirmSettlement(proposal._id, comment);
      setIsConfirmSettlementOpen(false);
      setComment('');
      fetchProposal(proposal._id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // [QUY TRÌNH MỚI] Mở modal chỉnh sửa và làm lại đơn tạm ứng khi bị từ chối
  const handleOpenResubmitModal = () => {
    if (!proposal) return;
    setResubmitItems(
      proposal.items && proposal.items.length > 0
        ? proposal.items.map((item, idx) => ({
            id: String(item._id || idx + 1),
            mucDich: item.mucDich,
            soTien: item.soTien,
          }))
        : [{ id: '1', mucDich: '', soTien: 0 }]
    );
    setResubmitBankAccount({
      bankName: proposal.bankAccount?.bankName || '',
      accountNumber: proposal.bankAccount?.accountNumber || '',
      accountHolder: proposal.bankAccount?.accountHolder || proposal.creator?.fullName || '',
    });
    setIsResubmitOpen(true);
  };

  const handleAddResubmitItem = () => {
    setResubmitItems((prev) => [
      ...prev,
      { id: Date.now().toString(), mucDich: '', soTien: 0 },
    ]);
  };

  const handleRemoveResubmitItem = (index: number) => {
    if (resubmitItems.length === 1) return;
    setResubmitItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateResubmitItem = (index: number, field: 'mucDich' | 'soTien', value: any) => {
    setResubmitItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleResubmit = async () => {
    if (!proposal) return;
    if (!resubmitBankAccount.bankName.trim() || !resubmitBankAccount.accountNumber.trim()) {
      alert('Vui lòng điền đầy đủ Tên ngân hàng và Số tài khoản nhận tiền');
      return;
    }
    for (let i = 0; i < resubmitItems.length; i++) {
      if (!resubmitItems[i].mucDich.trim()) {
        alert(`Vui lòng nhập mục đích tạm ứng cho dòng số ${i + 1}`);
        return;
      }
      if (Number(resubmitItems[i].soTien) <= 0) {
        alert(`Số tiền dòng số ${i + 1} phải lớn hơn 0`);
        return;
      }
    }
    setActionLoading(true);
    try {
      await advanceProposalService.resubmit(proposal._id, {
        items: resubmitItems.map((item, idx) => ({
          mucDich: item.mucDich.trim(),
          soTien: Number(item.soTien),
        })),
        bankAccount: resubmitBankAccount,
      });
      setIsResubmitOpen(false);
      fetchProposal(proposal._id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // [QUY TRÌNH MỚI] Mở modal hoàn tạm ứng (prefill dữ liệu cũ nếu có)
  const handleOpenSettlementModal = () => {
    if (proposal?.settlement) {
      setSettlementType(proposal.settlement.type || 'exact');
      setSettlementAmount(proposal.settlement.amount || 0);
      setSettlementNote(proposal.settlement.note || '');
      setSettlementAttachments(proposal.settlement.attachments || []);
    }
    setIsSettlementOpen(true);
  };

  // [QUY TRÌNH MỚI] Kế toán từ chối hoàn tạm ứng
  const handleRejectSettlement = async () => {
    if (!proposal || !rejectSettlementReason.trim()) {
      alert('Vui lòng nhập lý do từ chối báo cáo hoàn tạm ứng');
      return;
    }
    setActionLoading(true);
    try {
      await advanceProposalService.rejectSettlement(proposal._id, rejectSettlementReason);
      setIsRejectSettlementOpen(false);
      setRejectSettlementReason('');
      fetchProposal(proposal._id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
        <Loader2 size={36} className="animate-spin" color="var(--primary)" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertCircle size={36} color="var(--danger)" style={{ margin: '0 auto 1rem auto' }} />
        <h3 style={{ color: '#ffffff' }}>{error || 'Không tìm thấy đề xuất'}</h3>
        <Link to="/advance" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  // [LUỒNG MỚI] Phân quyền duyệt đơn tạm ứng theo hạn mức 10 triệu VNĐ
  const isOverTenMillion = (proposal.totalAmount || 0) > 10000000;

  // Cảnh báo khi Giám đốc đang xem đơn > 10 triệu (thuộc thẩm quyền Chủ tịch phê duyệt)
  const isDirectorWatchingOverLimit =
    (proposal.status === 'pending_chairman' || proposal.status === 'pending_director') &&
    isOverTenMillion &&
    user?.role === 'giam_doc';

  // Điều kiện lãnh đạo được bấm nút duyệt/từ chối theo phân quyền 10 triệu
  const canUserApproveAdvance = () => {
    if (proposal.status !== 'pending_director' && proposal.status !== 'pending_chairman') {
      return false;
    }
    if (isOverTenMillion) {
      // Đơn > 10 triệu: Chỉ Chủ tịch được duyệt
      return user?.role === 'chu_tich';
    }
    // Đơn <= 10 triệu: Sếp (Giám đốc) duyệt, Chủ tịch cũng có thể duyệt
    return user?.role === 'giam_doc' || user?.role === 'chu_tich';
  };

  // [QUY TRÌNH MỚI] Kiểm tra trạng thái bị từ chối
  const isProposalRejected = [
    'rejected',
    'rejected_by_director',
    'rejected_by_chairman',
    'rejected_by_accounting',
  ].includes(proposal.status);

  const isSettlementRejected = proposal.status === 'rejected_settlement';

  // Người tạo (hoặc lãnh đạo) có quyền chỉnh sửa & nộp lại đơn khi bị từ chối
  const isCreatorTurnToResubmit =
    isProposalRejected &&
    (proposal.creator?._id === user?._id || user?.role === 'truong_phong' || user?.role === 'chu_tich');

  const isAccountingDisburseTurn =
    user?.role === 'ke_toan' &&
    proposal.status === 'pending_accounting';

  const isCreatorSettlementTurn =
    (proposal.status === 'pending_settlement' || proposal.status === 'rejected_settlement') &&
    proposal.creator?._id === user?._id;

  const isAccountingSettlementConfirmTurn =
    user?.role === 'ke_toan' &&
    proposal.status === 'settlement_submitted';

  const resubmitTotalAmount = resubmitItems.reduce(
    (sum, item) => sum + (Number(item.soTien) || 0),
    0
  );
  const isResubmitOverTenMillion = resubmitTotalAmount > 10000000;

  return (
    <div>
      {/* Thanh tiêu đề và nút quay lại */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/advance" className="btn btn-ghost btn-sm" style={{ padding: '0.4rem' }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1 style={{ fontSize: '1.5rem', color: '#ffffff' }} className="font-mono">
                {proposal.proposalCode}
              </h1>
              <StatusBadge status={proposal.status} type="advance" />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
              <span>Ngày tạo: {formatDate(proposal.createdAt)}</span>
              <span>•</span>
              <span>Phòng ban: {proposal.department?.name}</span>
            </div>
          </div>
        </div>

        {/* Thanh công cụ nút thao tác */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isCreatorTurnToResubmit && (
            <button
              onClick={handleOpenResubmitModal}
              className="btn btn-warning"
              style={{
                gap: '0.4rem',
                backgroundColor: '#f59e0b',
                borderColor: '#d97706',
                color: '#000000',
                fontWeight: 700,
              }}
            >
              <FileCheck size={16} />
              <span>Chỉnh Sửa & Gửi Lại Đơn Tạm Ứng</span>
            </button>
          )}

          {canUserApproveAdvance() && (
            <>
              <button onClick={() => setIsApproveOpen(true)} className="btn btn-success" style={{ gap: '0.4rem' }}>
                {isOverTenMillion ? <Crown size={16} /> : <CheckCircle2 size={16} />}
                <span>{isOverTenMillion ? 'Chủ Tịch Duyệt Tạm Ứng' : 'Sếp Duyệt Tạm Ứng'}</span>
              </button>
              <button onClick={() => setIsRejectOpen(true)} className="btn btn-danger" style={{ gap: '0.4rem' }}>
                <XCircle size={16} />
                <span>Từ Chối</span>
              </button>
            </>
          )}

          {isAccountingDisburseTurn && (
            <>
              <button onClick={() => setIsDisburseOpen(true)} className="btn btn-success">
                <CheckCircle2 size={16} />
                <span>Duyệt & Giải Ngân Vào STK ({formatCurrency(proposal.totalAmount)})</span>
              </button>
              <button onClick={() => setIsRejectOpen(true)} className="btn btn-danger">
                <XCircle size={16} />
                <span>Từ Chối</span>
              </button>
            </>
          )}

          {isCreatorSettlementTurn && (
            <button onClick={handleOpenSettlementModal} className="btn btn-warning" style={{ gap: '0.4rem' }}>
              <Receipt size={16} />
              <span>{proposal.status === 'rejected_settlement' ? 'Làm Lại & Nộp Lại Báo Cáo Hoàn Ứng' : 'Nộp Báo Cáo Hoàn Tạm Ứng'}</span>
            </button>
          )}

          {isAccountingSettlementConfirmTurn && (
            <>
              <button onClick={() => setIsConfirmSettlementOpen(true)} className="btn btn-primary" style={{ gap: '0.4rem' }}>
                <FileCheck size={16} />
                <span>Xác Nhận Quyết Toán Hoàn Ứng</span>
              </button>
              <button onClick={() => setIsRejectSettlementOpen(true)} className="btn btn-danger" style={{ gap: '0.4rem' }}>
                <XCircle size={16} />
                <span>Từ Chối Hoàn Ứng</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsPrintOpen(true)}
            className="btn btn-secondary"
            style={{ gap: '0.4rem' }}
            title="Xem trước và in biểu mẫu giấy đề nghị tạm ứng PDF"
          >
            <Printer size={16} />
            <span>In / Xuất PDF</span>
          </button>
        </div>
      </div>

      {/* [QUY TRÌNH MỚI] Banner cảnh báo Đơn tạm ứng bị từ chối và hướng dẫn làm lại */}
      {isProposalRejected && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: 1, minWidth: '280px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0,
              }}
            >
              <AlertCircle size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f87171', marginBottom: '0.35rem' }}>
                Đề Xuất Tạm Ứng Đã Bị Từ Chối (Được Chuyển Trả Về Bước Làm Lại)
              </div>
              <div style={{ fontSize: '0.875rem', color: '#ffffff', marginBottom: '0.5rem' }}>
                <strong>Lý do từ chối:</strong> {proposal.rejectionReason || 'Chưa cung cấp lý do chi tiết'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Quy trình đã chuyển quyền xử lý về cho Người tạo đơn. Vui lòng rà soát lại thông tin (mục đích, số tiền, tài khoản nhận), bấm nút bên dưới để chỉnh sửa và nộp lại đề xuất.
              </div>
            </div>
          </div>

          {isCreatorTurnToResubmit && (
            <button
              onClick={handleOpenResubmitModal}
              className="btn btn-warning"
              style={{
                gap: '0.5rem',
                backgroundColor: '#f59e0b',
                borderColor: '#d97706',
                color: '#000000',
                fontWeight: 700,
                padding: '0.65rem 1.25rem',
              }}
            >
              <FileCheck size={18} />
              <span>Chỉnh Sửa & Gửi Lại Đơn Tạm Ứng</span>
            </button>
          )}
        </div>
      )}

      {/* [QUY TRÌNH MỚI] Banner cảnh báo Hoàn ứng bị từ chối */}
      {isSettlementRejected && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: 1, minWidth: '280px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0,
              }}
            >
              <AlertCircle size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f87171', marginBottom: '0.35rem' }}>
                Chứng Từ Hoàn Tạm Ứng Bị Kế Toán Từ Chối (Yêu Cầu Làm Lại)
              </div>
              <div style={{ fontSize: '0.875rem', color: '#ffffff', marginBottom: '0.5rem' }}>
                <strong>Lý do từ chối:</strong> {proposal.rejectionReason || 'Kế toán yêu cầu nộp lại chứng từ hoàn ứng'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Vui lòng kiểm tra lại số tiền chênh lệch thừa/thiếu và cập nhật các hóa đơn, chứng từ hợp lệ để gửi lại cho Kế toán xác nhận.
              </div>
            </div>
          </div>

          {isCreatorSettlementTurn && (
            <button
              onClick={handleOpenSettlementModal}
              className="btn btn-warning"
              style={{
                gap: '0.5rem',
                backgroundColor: '#f59e0b',
                borderColor: '#d97706',
                color: '#000000',
                fontWeight: 700,
                padding: '0.65rem 1.25rem',
              }}
            >
              <Receipt size={18} />
              <span>Chỉnh Sửa & Nộp Lại Báo Cáo Hoàn Ứng</span>
            </button>
          )}
        </div>
      )}

      {/* [LUỒNG MỚI] Thông báo cho Giám đốc khi xem đơn tạm ứng > 10 triệu */}
      {isDirectorWatchingOverLimit && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#fef08a',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <Crown size={20} color="#eab308" />
          <span style={{ fontSize: '0.875rem' }}>
            <strong>Thông báo thẩm quyền phê duyệt:</strong> Đơn tạm ứng có tổng số tiền là{' '}
            <strong style={{ color: '#ffffff' }}>{formatCurrency(proposal.totalAmount)}</strong> (&gt; 10.000.000 VNĐ).
            Theo quy định, quyền duyệt chi tạm ứng do <strong>Chủ tịch</strong> trực tiếp phê duyệt (Giám đốc không phê duyệt đơn này).
          </span>
        </div>
      )}

      {/* Bố cục nội dung chính */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.75rem' }}>
        {/* Cột bên trái: Chi tiết tạm ứng & Báo cáo hoàn ứng */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* [LUỒNG MỚI] Thông báo liên kết với đơn mua sắm vật tư gốc */}
          {proposal.purchaseProposal && (
            <div
              style={{
                padding: '0.9rem 1.25rem',
                backgroundColor: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đơn tạm ứng khởi tạo từ Đề Xuất Mua Sắm:</span>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff', marginTop: '0.2rem' }}>
                  {proposal.purchaseProposal.proposalCode || 'Đơn mua sắm'}
                </div>
              </div>
              <Link
                to={`/purchase/${proposal.purchaseProposal._id || proposal.purchaseProposal}`}
                className="btn btn-secondary btn-sm"
                style={{ gap: '0.35rem' }}
              >
                <ExternalLink size={14} />
                <span>Xem Đề Xuất Mua Sắm Gốc</span>
              </Link>
            </div>
          )}

          {/* Thẻ thông tin người tạo & Tài khoản ngân hàng thụ hưởng */}
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                  }}
                >
                  <UserIcon size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Người Nhận Tạm Ứng</div>
                  <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>{proposal.creator?.fullName}</div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                    {getRoleLabel(proposal.creator?.role)} • {proposal.department?.name}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(6, 182, 212, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  <CreditCard size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tài Khoản Thụ Hưởng</div>
                  <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>
                    {proposal.bankAccount?.bankName}: <span className="font-mono">{proposal.bankAccount?.accountNumber}</span>
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                    Chủ TK: {proposal.bankAccount?.accountHolder || proposal.creator?.fullName}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items breakdown card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Banknote size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Mục Đích Chi Tiết Tạm Ứng</h3>
              </div>
              <span className="badge badge-secondary">{proposal.items.length} mục</span>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                    <th>Nội Dung / Mục Đích Tạm Ứng</th>
                    <th style={{ textAlign: 'right', width: '200px' }}>Số Tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.items.map((item) => (
                    <tr key={item._id || item.stt}>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.stt}</td>
                      <td style={{ fontWeight: 600 }}>{item.mucDich}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-cyan)' }} className="font-mono">
                        {formatCurrency(item.soTien)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tổng số tiền */}
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1.25rem',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tổng Tiền Tạm Ứng</span>
                  <span className={`badge ${isOverTenMillion ? 'badge-purple' : 'badge-info'}`} style={{ fontSize: '0.675rem' }}>
                    {isOverTenMillion ? '👑 Cấp duyệt: Chủ tịch' : '👔 Cấp duyệt: Sếp (Giám đốc)'}
                  </span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }} className="font-mono">
                  {formatCurrency(proposal.totalAmount)}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Thực Tế Đã Giải Ngân</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }} className="font-mono">
                  {formatCurrency(proposal.totalDisbursed)}
                </div>
              </div>
            </div>
          </div>

          {/* Thẻ chi tiết báo cáo hoàn tạm ứng nếu đã nộp */}
          {proposal.settlement && proposal.settlement.submittedAt && (
            <div
              className="card"
              style={{
                border: '1px solid rgba(168, 85, 247, 0.3)',
                background: 'rgba(168, 85, 247, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Receipt size={18} color="var(--purple)" />
                  <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Báo Cáo Hoàn Tạm Ứng</h3>
                </div>

                <span
                  className={`badge ${
                    proposal.settlement.type === 'surplus'
                      ? 'badge-warning'
                      : proposal.settlement.type === 'deficit'
                      ? 'badge-primary'
                      : 'badge-success'
                  }`}
                >
                  {proposal.settlement.type === 'surplus' && 'Thừa tiền (Nộp lại quỹ)'}
                  {proposal.settlement.type === 'deficit' && 'Thiếu tiền (Công ty bù)'}
                  {proposal.settlement.type === 'exact' && 'Quyết toán đủ'}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Số tiền chênh lệch: </span>
                  <strong className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
                    {formatCurrency(proposal.settlement.amount || 0)}
                  </strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Thời gian nộp: </span>
                  <span>{formatDate(proposal.settlement.submittedAt)}</span>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Trạng thái xác nhận: </span>
                  {proposal.settlement.confirmedAt ? (
                    <strong style={{ color: 'var(--success)' }}>
                      Đã xác nhận ({formatDate(proposal.settlement.confirmedAt)})
                    </strong>
                  ) : (
                    <strong style={{ color: 'var(--warning)' }}>Chờ Kế toán xác nhận</strong>
                  )}
                </div>
              </div>

              {proposal.settlement.note && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  <strong>Ghi chú:</strong> {proposal.settlement.note}
                </div>
              )}

              {proposal.settlement.attachments && proposal.settlement.attachments.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                  <div
                    style={{
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Paperclip size={15} color="var(--purple)" />
                    <span>Chứng Từ / Tài Liệu Đính Kèm ({proposal.settlement.attachments.length}):</span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                      gap: '0.75rem',
                    }}
                  >
                    {proposal.settlement.attachments.map((att: any, idx: number) => {
                      const isObj = typeof att === 'object' && att !== null;
                      const fileName = isObj ? att.name : String(att);
                      const fileUrl = isObj ? att.url : '';
                      const fileSize = isObj ? att.size : 0;
                      const fileType = isObj ? att.type : '';
                      const isImage = fileType?.includes('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);

                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '0.75rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                            {getFileIcon(fileName, fileType)}
                            <div style={{ overflow: 'hidden', flex: 1 }}>
                              <div
                                style={{
                                  fontSize: '0.825rem',
                                  fontWeight: 600,
                                  color: '#ffffff',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={fileName}
                              >
                                {fileName}
                              </div>
                              {fileSize > 0 && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {formatFileSize(fileSize)}
                                </div>
                              )}
                            </div>
                          </div>

                          {isImage && fileUrl && (
                            <div
                              style={{
                                width: '100%',
                                height: '90px',
                                borderRadius: 'var(--radius-sm)',
                                overflow: 'hidden',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                cursor: 'pointer',
                                position: 'relative',
                              }}
                              onClick={() => handleOpenPreview(fileName, fileUrl, fileType, proposal.settlement?.attachments, idx)}
                              title="Bấm để xem ảnh lớn"
                            >
                              <img
                                src={fileUrl}
                                alt={fileName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  backgroundColor: 'rgba(0,0,0,0.35)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  opacity: 0,
                                  transition: 'opacity 0.2s',
                                  color: '#ffffff',
                                  fontSize: '0.75rem',
                                  gap: '0.3rem',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                              >
                                <Eye size={15} />
                                <span>Phóng to</span>
                              </div>
                            </div>
                          )}

                          {fileUrl ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '0.4rem',
                                borderTop: '1px solid var(--border-subtle)',
                                paddingTop: '0.4rem',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleOpenPreview(fileName, fileUrl, fileType, proposal.settlement?.attachments, idx)}
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: '0.725rem', padding: '0.25rem 0.6rem', gap: '0.3rem' }}
                                title="Xem trực tiếp không cần tải về"
                              >
                                <Eye size={13} />
                                <span>Xem</span>
                              </button>
                              <a
                                href={fileUrl}
                                download={fileName}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.725rem', padding: '0.25rem 0.5rem', gap: '0.25rem' }}
                                title="Tải về máy nếu cần"
                              >
                                <Download size={13} />
                                <span>Tải</span>
                              </a>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                              (Tập tin không có dữ liệu xem trước)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Approval Flow Tracker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#ffffff', marginBottom: '1.25rem' }}>
              Tiến Trình Phê Duyệt
            </h3>
            <ApprovalFlowTracker steps={proposal.approvalFlow} currentRole={proposal.currentApprovalRole} />
          </div>

          {proposal.rejectionReason && (
            <div
              style={{
                padding: '1.25rem',
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={16} />
                <span>Lý Do Từ Chối:</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#fca5a5', lineHeight: 1.5, marginBottom: isCreatorTurnToResubmit || (isCreatorSettlementTurn && isSettlementRejected) ? '0.75rem' : 0 }}>
                {proposal.rejectionReason}
              </div>

              {isCreatorTurnToResubmit && (
                <button
                  type="button"
                  onClick={handleOpenResubmitModal}
                  className="btn btn-warning btn-sm"
                  style={{ width: '100%', fontSize: '0.775rem', fontWeight: 700, gap: '0.35rem' }}
                >
                  <FileCheck size={14} />
                  <span>Sửa & Gửi Lại Đơn</span>
                </button>
              )}

              {isCreatorSettlementTurn && isSettlementRejected && (
                <button
                  type="button"
                  onClick={handleOpenSettlementModal}
                  className="btn btn-warning btn-sm"
                  style={{ width: '100%', fontSize: '0.775rem', fontWeight: 700, gap: '0.35rem' }}
                >
                  <Receipt size={14} />
                  <span>Làm Lại Hoàn Ứng</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 1. MODAL DUYỆT ĐỀ XUẤT TẠM ỨNG */}
      <Modal isOpen={isApproveOpen} onClose={() => setIsApproveOpen(false)} title="Duyệt Đơn Tạm Ứng">
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Bạn đồng ý duyệt đơn tạm ứng <strong>{proposal.proposalCode}</strong> số tiền{' '}
            <strong style={{ color: 'var(--accent-cyan)' }}>{formatCurrency(proposal.totalAmount)}</strong>.
          </p>
        </div>
        <div className="form-group">
          <label className="form-label">Ý kiến duyệt:</label>
          <textarea
            className="form-textarea"
            placeholder="Nhập ý kiến nếu có..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <div className="modal-footer" style={{ margin: '1.5rem -1.65rem -1.65rem -1.65rem' }}>
          <button onClick={() => setIsApproveOpen(false)} className="btn btn-secondary">Hủy</button>
          <button onClick={handleApprove} disabled={actionLoading} className="btn btn-success">
            {actionLoading ? 'Đang duyệt...' : 'Đồng Ý Phê Duyệt'}
          </button>
        </div>
      </Modal>

      {/* 2. MODAL TỪ CHỐI ĐỀ XUẤT TẠM ỨNG */}
      <Modal isOpen={isRejectOpen} onClose={() => setIsRejectOpen(false)} title="Từ Chối Đề Xuất Tạm Ứng">
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Vui lòng nhập lý do từ chối:
          </p>
        </div>
        <div className="form-group">
          <label className="form-label">Lý do từ chối <span className="required">*</span></label>
          <textarea
            className="form-textarea"
            required
            placeholder="Lý do..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
        <div className="modal-footer" style={{ margin: '1.5rem -1.65rem -1.65rem -1.65rem' }}>
          <button onClick={() => setIsRejectOpen(false)} className="btn btn-secondary">Hủy</button>
          <button onClick={handleReject} disabled={actionLoading || !rejectReason.trim()} className="btn btn-danger">
            {actionLoading ? 'Đang xử lý...' : 'Xác Nhận Từ Chối'}
          </button>
        </div>
      </Modal>

      {/* 3. MODAL KẾ TOÁN GIẢI NGÂN TẠM ỨNG */}
      <Modal isOpen={isDisburseOpen} onClose={() => setIsDisburseOpen(false)} title="Kế Toán Giải Ngân Tạm Ứng">
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Kế toán xác nhận chuyển tiền tạm ứng vào tài khoản ngân hàng của người đề xuất:
          </p>
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.85rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.825rem',
            }}
          >
            <div>Ngân hàng: <strong>{proposal.bankAccount?.bankName}</strong></div>
            <div>Số tài khoản: <strong className="font-mono">{proposal.bankAccount?.accountNumber}</strong></div>
            <div>Chủ tài khoản: <strong>{proposal.bankAccount?.accountHolder || proposal.creator?.fullName}</strong></div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Số tiền giải ngân (VNĐ) <span className="required">*</span></label>
          <input
            type="number"
            min="1000"
            required
            className="form-input font-mono"
            value={disburseAmount}
            onChange={(e) => setDisburseAmount(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Ghi chú / Số UNC:</label>
          <input
            type="text"
            className="form-input"
            placeholder="Ủy nhiệm chi số..."
            value={disburseNote}
            onChange={(e) => setDisburseNote(e.target.value)}
          />
        </div>

        <div className="modal-footer" style={{ margin: '1.5rem -1.65rem -1.65rem -1.65rem' }}>
          <button onClick={() => setIsDisburseOpen(false)} className="btn btn-secondary">Hủy</button>
          <button onClick={handleAccountingDisburse} disabled={actionLoading} className="btn btn-success">
            {actionLoading ? 'Đang giải ngân...' : 'Xác Nhận Chuyển Khoản & Mở Hoàn Ứng'}
          </button>
        </div>
      </Modal>

      {/* 4. MODAL NỘP BÁO CÁO QUYẾT TOÁN HOÀN ỨNG */}
      <Modal isOpen={isSettlementOpen} onClose={() => setIsSettlementOpen(false)} title="Nộp Báo Cáo Quyết Toán Hoàn Ứng">
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Sau khi sử dụng khoản tiền tạm ứng <strong>{formatCurrency(proposal.totalDisbursed)}</strong>, vui lòng chọn kết quả chi tiêu:
          </p>
        </div>

        {/* 3 tùy chọn phân loại chi tiêu hoàn ứng */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={`btn ${settlementType === 'exact' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSettlementType('exact')}
            style={{ fontSize: '0.8rem', padding: '0.65rem' }}
          >
            Đủ (Đúng số tiền)
          </button>
          <button
            type="button"
            className={`btn ${settlementType === 'surplus' ? 'btn-warning' : 'btn-secondary'}`}
            onClick={() => setSettlementType('surplus')}
            style={{ fontSize: '0.8rem', padding: '0.65rem' }}
          >
            Thừa (Nộp lại quỹ)
          </button>
          <button
            type="button"
            className={`btn ${settlementType === 'deficit' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSettlementType('deficit')}
            style={{ fontSize: '0.8rem', padding: '0.65rem' }}
          >
            Thiếu (Cần bù thêm)
          </button>
        </div>

        {settlementType !== 'exact' && (
          <div className="form-group">
            <label className="form-label">
              Số tiền {settlementType === 'surplus' ? 'thừa nộp lại' : 'thiếu cần công ty chi thêm'} (VNĐ) <span className="required">*</span>
            </label>
            <input
              type="number"
              min="1000"
              required
              className="form-input font-mono"
              placeholder="0"
              value={settlementAmount || ''}
              onChange={(e) => setSettlementAmount(Number(e.target.value))}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Paperclip size={15} color="var(--primary)" />
            <span>Tài liệu / Chứng từ đính kèm (PDF, Excel, Ảnh hóa đơn, v.v.):</span>
          </label>

          {/* Upload Drop Zone with True Drag & Drop */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem 1rem',
              backgroundColor: isDragging ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border-color)'}`,
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              transition: 'var(--transition)',
              gap: '0.4rem',
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) {
                processFiles(e.dataTransfer.files);
              }
            }}
            onClick={() => {
              const input = document.getElementById('settlement-file-input') as HTMLInputElement;
              if (input) input.click();
            }}
          >
            {fileUploading ? (
              <Loader2 size={30} className="animate-spin" color="var(--primary)" />
            ) : (
              <UploadCloud size={30} color={isDragging ? 'var(--accent-cyan)' : 'var(--primary)'} />
            )}
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
              {fileUploading
                ? 'Đang tải và lưu tệp vào ổ cứng máy chủ...'
                : isDragging
                ? 'Thả file vào đây ngay'
                : 'Nhấp để chọn file hoặc kéo thả vào đây'}
            </div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              Hỗ trợ PDF, Excel (.xlsx, .xls), Word (.docx), Ảnh (.jpg, .png, hóa đơn) tối đa 15MB/file (Lưu trực tiếp vào ổ cứng server)
            </div>
            <input
              id="settlement-file-input"
              type="file"
              multiple
              disabled={fileUploading}
              accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.jpg,.jpeg,.png,.webp"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>

          {/* Attached Files Preview List in Modal */}
          {settlementAttachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Đã chọn ({settlementAttachments.length} file đính kèm):
              </div>
              {settlementAttachments.map((att, idx) => {
                const isImage = att.type?.includes('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.name);
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden', flex: 1 }}>
                      {isImage ? (
                        <img
                          src={att.url}
                          alt={att.name}
                          style={{
                            width: 32,
                            height: 32,
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        getFileIcon(att.name, att.type)
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span
                          style={{
                            fontSize: '0.825rem',
                            fontWeight: 600,
                            color: '#ffffff',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                          }}
                          title={att.name}
                        >
                          {att.name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {formatFileSize(att.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleRemoveAttachment(idx)}
                      style={{ color: 'var(--danger)', padding: '0.35rem', flexShrink: 0 }}
                      title="Xóa file này"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Ghi chú hoàn ứng:</label>
          <textarea
            className="form-textarea"
            placeholder="Nội dung chi tiết..."
            value={settlementNote}
            onChange={(e) => setSettlementNote(e.target.value)}
          />
        </div>

        <div className="modal-footer" style={{ margin: '1.5rem -1.65rem -1.65rem -1.65rem' }}>
          <button onClick={() => setIsSettlementOpen(false)} className="btn btn-secondary">Hủy</button>
          <button onClick={handleSubmitSettlement} disabled={actionLoading} className="btn btn-primary">
            {actionLoading ? 'Đang gửi...' : 'Nộp Báo Cáo Cho Kế Toán'}
          </button>
        </div>
      </Modal>

      {/* 5. MODAL KẾ TOÁN XÁC NHẬN QUYẾT TOÁN HOÀN ỨNG */}
      <Modal isOpen={isConfirmSettlementOpen} onClose={() => setIsConfirmSettlementOpen(false)} title="Xác Nhận Quyết Toán Hoàn Ứng">
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Kế toán kiểm tra chứng từ hoàn tạm ứng và xác nhận đóng đơn:
          </p>
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.85rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.825rem',
            }}
          >
            <div>Loại quyết toán: <strong>{proposal.settlement?.type === 'surplus' ? 'Thừa nộp lại' : proposal.settlement?.type === 'deficit' ? 'Thiếu chi bù' : 'Quyết toán đủ'}</strong></div>
            {proposal.settlement?.amount ? (
              <div>Số tiền chênh lệch: <strong className="font-mono">{formatCurrency(proposal.settlement.amount)}</strong></div>
            ) : null}
            {proposal.settlement?.note ? (
              <div>Ghi chú: {proposal.settlement.note}</div>
            ) : null}

            {/* Danh sách chứng từ đính kèm trong modal kế toán xác nhận */}
            {proposal.settlement?.attachments && proposal.settlement.attachments.length > 0 && (
              <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem' }}>
                <div style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Paperclip size={13} color="var(--primary)" />
                  <span>Chứng từ đính kèm ({proposal.settlement.attachments.length} file):</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }}>
                  {proposal.settlement.attachments.map((att: any, idx: number) => {
                    const isObj = typeof att === 'object' && att !== null;
                    const fileName = isObj ? att.name : String(att);
                    const fileUrl = isObj ? att.url : '';
                    const fileSize = isObj ? att.size : 0;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.4rem 0.6rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.775rem',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                          {getFileIcon(fileName, isObj ? att.type : undefined)}
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                            {fileName}
                          </span>
                          {fileSize > 0 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({formatFileSize(fileSize)})</span>
                          )}
                        </div>
                        {fileUrl && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenPreview(fileName, fileUrl, isObj ? att.type : undefined)}
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', gap: '0.25rem' }}
                              title="Xem trực tiếp"
                            >
                              <Eye size={12} />
                              <span>Xem</span>
                            </button>
                            <a
                              href={fileUrl}
                              download={fileName}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.35rem', color: 'var(--text-muted)' }}
                              title="Tải về máy"
                            >
                              <Download size={12} />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Ý kiến kế toán:</label>
          <textarea
            className="form-textarea"
            placeholder="Đã thu đủ số tiền thừa nộp quỹ / Đã chuyển khoản số tiền thiếu bù thêm..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="modal-footer" style={{ margin: '1.5rem -1.65rem -1.65rem -1.65rem' }}>
          <button onClick={() => setIsConfirmSettlementOpen(false)} className="btn btn-secondary">Hủy</button>
          <button onClick={handleConfirmSettlement} disabled={actionLoading} className="btn btn-success">
            {actionLoading ? 'Đang xác nhận...' : 'Xác Nhận & Hoàn Tất Đơn'}
          </button>
        </div>
      </Modal>

      {/* 7. MODAL CHỈNH SỬA VÀ GỬI LẠI ĐƠN TẠM ỨNG (KHI BỊ TỪ CHỐI) */}
      <Modal
        isOpen={isResubmitOpen}
        onClose={() => setIsResubmitOpen(false)}
        title="Chỉnh Sửa & Gửi Lại Đơn Tạm Ứng"
        maxWidth="750px"
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Đơn của bạn đã được chuyển trả về để chỉnh sửa. Vui lòng rà soát lại thông tin tài khoản hoặc mục đích, số tiền tạm ứng rồi gửi lại để tiếp tục quy trình duyệt.
          </p>
          {proposal.rejectionReason && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.825rem',
                color: '#f87171',
              }}
            >
              <strong>Lý do từ chối trước đó:</strong> {proposal.rejectionReason}
            </div>
          )}
        </div>

        {/* Thông tin tài khoản thụ hưởng */}
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CreditCard size={16} color="var(--accent-cyan)" />
            <span>Thông Tin Tài Khoản Nhận Tạm Ứng</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.775rem' }}>Tên Ngân Hàng <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="VD: MB Bank, Vietcombank..."
                value={resubmitBankAccount.bankName}
                onChange={(e) => setResubmitBankAccount({ ...resubmitBankAccount, bankName: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.775rem' }}>Số Tài Khoản <span className="required">*</span></label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="VD: 0987654321"
                value={resubmitBankAccount.accountNumber}
                onChange={(e) => setResubmitBankAccount({ ...resubmitBankAccount, accountNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.775rem' }}>Chủ Tài Khoản</label>
              <input
                type="text"
                className="form-input"
                placeholder="Tên chủ tài khoản..."
                value={resubmitBankAccount.accountHolder}
                onChange={(e) => setResubmitBankAccount({ ...resubmitBankAccount, accountHolder: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Danh sách mục chi tạm ứng */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Banknote size={16} color="var(--primary)" />
              <span>Nội Dung / Mục Đích Tạm Ứng Chi Tiết</span>
            </div>
            <button
              type="button"
              onClick={handleAddResubmitItem}
              className="btn btn-secondary btn-sm"
              style={{ gap: '0.35rem', fontSize: '0.75rem' }}
            >
              <Plus size={14} />
              <span>Thêm Dòng</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {resubmitItems.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 180px 36px',
                  gap: '0.5rem',
                  alignItems: 'center',
                }}
              >
                <div style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  #{idx + 1}
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Mục đích tạm ứng..."
                  value={item.mucDich}
                  onChange={(e) => handleUpdateResubmitItem(idx, 'mucDich', e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  className="form-input font-mono"
                  placeholder="Số tiền..."
                  value={item.soTien || ''}
                  onChange={(e) => handleUpdateResubmitItem(idx, 'soTien', Number(e.target.value))}
                />
                <button
                  type="button"
                  disabled={resubmitItems.length === 1}
                  onClick={() => handleRemoveResubmitItem(idx)}
                  className="btn btn-ghost btn-sm"
                  style={{ color: resubmitItems.length === 1 ? 'var(--text-muted)' : 'var(--danger)', padding: '0.35rem' }}
                  title="Xóa dòng này"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Tổng tiền và cấp duyệt dự kiến */}
          <div
            style={{
              marginTop: '1rem',
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cấp phê duyệt theo số tiền mới:</span>
              <div style={{ marginTop: '0.2rem' }}>
                <span className={`badge ${isResubmitOverTenMillion ? 'badge-purple' : 'badge-info'}`}>
                  {isResubmitOverTenMillion ? '👑 Đơn > 10 triệu: Chủ tịch duyệt' : '👔 Đơn ≤ 10 triệu: Sếp (Giám đốc) duyệt'}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tổng Tiền Mới:</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-cyan)' }} className="font-mono">
                {formatCurrency(resubmitTotalAmount)}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ margin: '1.5rem -1.65rem -1.65rem -1.65rem' }}>
          <button onClick={() => setIsResubmitOpen(false)} className="btn btn-secondary">Hủy</button>
          <button onClick={handleResubmit} disabled={actionLoading} className="btn btn-primary" style={{ gap: '0.4rem' }}>
            <FileCheck size={16} />
            <span>{actionLoading ? 'Đang gửi lại...' : 'Xác Nhận & Gửi Lại Đơn Tạm Ứng'}</span>
          </button>
        </div>
      </Modal>

      {/* 8. MODAL KẾ TOÁN TỪ CHỐI HOÀN TẠM ỨNG */}
      <Modal
        isOpen={isRejectSettlementOpen}
        onClose={() => setIsRejectSettlementOpen(false)}
        title="Từ Chối Chứng Từ Hoàn Tạm Ứng"
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Kế toán từ chối hồ sơ hoàn tạm ứng và yêu cầu người tạo chỉnh sửa/bổ sung chứng từ làm lại:
          </p>
        </div>
        <div className="form-group">
          <label className="form-label">Lý do từ chối & Yêu cầu làm lại <span className="required">*</span></label>
          <textarea
            className="form-textarea"
            required
            rows={4}
            placeholder="VD: Hóa đơn chưa có thuế VAT hợp lệ / Số tiền thừa thực nộp thiếu 200.000đ, vui lòng kiểm tra và gửi lại..."
            value={rejectSettlementReason}
            onChange={(e) => setRejectSettlementReason(e.target.value)}
          />
        </div>
        <div className="modal-footer" style={{ margin: '1.5rem -1.65rem -1.65rem -1.65rem' }}>
          <button onClick={() => setIsRejectSettlementOpen(false)} className="btn btn-secondary">Hủy</button>
          <button
            onClick={handleRejectSettlement}
            disabled={actionLoading || !rejectSettlementReason.trim()}
            className="btn btn-danger"
          >
            {actionLoading ? 'Đang xử lý...' : 'Xác Nhận Từ Chối & Yêu Cầu Làm Lại'}
          </button>
        </div>
      </Modal>

      {/* 6. MODAL XEM TRỰC TIẾP TÀI LIỆU / ẢNH CHỨNG TỪ */}
      <Modal
        isOpen={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        title={`Xem Tài Liệu: ${previewAttachment?.name || ''}`}
        maxWidth="860px"
      >
        {previewAttachment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            {previewAttachment.type?.includes('image') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(previewAttachment.name) ? (
              <div
                style={{
                  width: '100%',
                  maxHeight: '70vh',
                  overflow: 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                }}
              >
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '65vh',
                    objectFit: 'contain',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                  }}
                />
              </div>
            ) : previewAttachment.type?.includes('pdf') || /\.pdf$/i.test(previewAttachment.name) ? (
              <div style={{ width: '100%', height: '70vh', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <iframe
                  src={previewAttachment.url}
                  title={previewAttachment.name}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            ) : (
              <div
                style={{
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-md)',
                  width: '100%',
                  border: '1px dashed var(--border-color)',
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  {getFileIcon(previewAttachment.name, previewAttachment.type)}
                </div>
                <h4 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>{previewAttachment.name}</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  Định dạng này (Excel/Word) cần mở bằng phần mềm chuyên dụng hoặc tải về máy để xem chi tiết.
                </p>
                <a
                  href={previewAttachment.url}
                  download={previewAttachment.name}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Download size={16} />
                  <span>Tải Về Máy</span>
                </a>
              </div>
            )}

            {/* Các nút thao tác dưới chân modal */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {previewAttachment.name}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href={previewAttachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '0.35rem' }}
                >
                  <ExternalLink size={14} />
                  <span>Mở Tab Mới</span>
                </a>
                <a
                  href={previewAttachment.url}
                  download={previewAttachment.name}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '0.35rem' }}
                >
                  <Download size={14} />
                  <span>Tải Về</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="btn btn-primary btn-sm"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL POPUP XÁC NHẬN GIẢI NGÂN THÀNH CÔNG */}
      <Modal
        isOpen={isDisburseSuccessOpen}
        onClose={() => setIsDisburseSuccessOpen(false)}
        title="Giải Ngân Tạm Ứng Thành Công"
        maxWidth="500px"
      >
        <div style={{ textAlign: 'center', padding: '1rem 0.5rem 0.5rem 0.5rem' }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              color: 'var(--success)',
              boxShadow: '0 0 30px rgba(16, 185, 129, 0.25)',
            }}
          >
            <CheckCircle2 size={40} />
          </div>

          <h3 style={{ fontSize: '1.25rem', color: '#ffffff', marginBottom: '0.4rem', fontWeight: 700 }}>
            Giải Ngân Tạm Ứng Thành Công!
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Khoản tiền tạm ứng đã được xác nhận chuyển khoản cho nhân viên yêu cầu.
          </p>

          {disburseSuccessInfo && (
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                textAlign: 'left',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mã Đề Xuất:</span>
                <span className="font-mono" style={{ fontWeight: 700, color: '#ffffff' }}>
                  {disburseSuccessInfo.code}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Số Tiền Tạm Ứng:</span>
                <span className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--success)' }}>
                  {formatCurrency(disburseSuccessInfo.amount)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Người Nhận Tiền:</span>
                <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.875rem' }}>
                  {disburseSuccessInfo.beneficiaryName}
                </span>
              </div>
              {disburseSuccessInfo.accountNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tài Khoản / Ngân Hàng:</span>
                  <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {disburseSuccessInfo.accountNumber} ({disburseSuccessInfo.bankName})
                  </span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setIsDisburseSuccessOpen(false)}
              className="btn btn-primary"
              style={{ minWidth: '140px', padding: '0.65rem 1.75rem', fontWeight: 600 }}
            >
              Hoàn Tất
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL XEM TRƯỚC VÀ IN BIỂU MẪU GIẤY ĐỀ NGHỊ TẠM ỨNG */}
      <AdvancePrintModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        proposal={proposal}
      />

      {/* MODAL XEM TRƯỚC VÀ KIỂM TRA CHỨNG TỪ HOÀN ỨNG / HÓA ĐƠN */}
      <FilePreviewModal
        isOpen={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        file={previewAttachment}
        files={previewFileList}
        initialIndex={previewFileIndex}
        title="Kiểm Tra Chứng Từ Quyết Toán Hoàn Ứng"
      />
    </div>
  );
};
