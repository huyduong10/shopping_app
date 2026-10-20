import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { paymentProposalService, uploadService } from '../../services';
import { PaymentProposal } from '../../models';
import { StatusBadge, ApprovalFlowTracker, Modal, PaymentPrintModal, FilePreviewModal, PreviewFileItem } from '../../component';
import { formatCurrency, formatDate, getRoleLabel } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  XCircle,
  DollarSign,
  Building,
  User as UserIcon,
  Loader2,
  AlertCircle,
  Paperclip,
  FileText,
  Eye,
  Download,
  ExternalLink,
  ShieldCheck,
  Banknote,
  UploadCloud,
  Printer,
  Layers,
  FileCheck,
  Receipt,
  Crown,
} from 'lucide-react';

export const PaymentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [proposal, setProposal] = useState<PaymentProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isDisburseOpen, setIsDisburseOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Giải ngân
  const [disburseData, setDisburseData] = useState({
    transactionCode: '',
    note: '',
    receiptAttachment: null as any,
  });
  const [receiptUploading, setReceiptUploading] = useState(false);

  // Popup thông báo xác nhận giải ngân thành công
  const [isDisburseSuccessOpen, setIsDisburseSuccessOpen] = useState(false);
  const [disburseSuccessInfo, setDisburseSuccessInfo] = useState<{
    code: string;
    amount: number;
    beneficiaryName: string;
    accountNumber: string;
    bankName: string;
    transactionCode: string;
    note: string;
  } | null>(null);

  // Preview chứng từ (ảnh, PDF, hợp đồng, hóa đơn)
  const [previewAttachment, setPreviewAttachment] = useState<PreviewFileItem | null>(null);
  const [previewFileList, setPreviewFileList] = useState<PreviewFileItem[]>([]);
  const [previewFileIndex, setPreviewFileIndex] = useState(0);

  const handlePreviewFile = (fileItem: PreviewFileItem, list?: PreviewFileItem[], index?: number) => {
    setPreviewAttachment(fileItem);
    if (list && list.length > 0) {
      setPreviewFileList(list);
      setPreviewFileIndex(index !== undefined ? index : list.findIndex((f) => f.url === fileItem.url));
    } else {
      setPreviewFileList([fileItem]);
      setPreviewFileIndex(0);
    }
  };

  const fetchProposal = useCallback(async (propId: string) => {
    setLoading(true);
    try {
      const data = await paymentProposalService.getById(propId);
      setProposal(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải chi tiết đề xuất thanh toán');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) fetchProposal(id);
  }, [id, fetchProposal]);

  // Handlers
  const handleApprove = async () => {
    if (!proposal) return;
    setActionLoading(true);
    try {
      await paymentProposalService.approve(proposal._id, comment);
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
      await paymentProposalService.reject(proposal._id, rejectReason);
      setIsRejectOpen(false);
      setRejectReason('');
      fetchProposal(proposal._id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptUploading(true);
    try {
      const res = await uploadService.uploadFile(file);
      setDisburseData((prev) => ({
        ...prev,
        receiptAttachment: {
          name: res.name || file.name,
          url: res.url,
          size: res.size || file.size,
          type: res.type || file.type,
        },
      }));
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tải lên file biên lai / UNC');
    } finally {
      setReceiptUploading(false);
      e.target.value = '';
    }
  };

  const handleDisburse = async () => {
    if (!proposal) return;
    setActionLoading(true);
    try {
      const savedTxCode = disburseData.transactionCode;
      const savedNote = disburseData.note;

      await paymentProposalService.disburse(proposal._id, {
        transactionCode: disburseData.transactionCode,
        note: disburseData.note,
        receiptAttachment: disburseData.receiptAttachment,
      });

      // Lưu lại thông tin vừa giải ngân để hiển thị popup chúc mừng
      setDisburseSuccessInfo({
        code: proposal.proposalCode,
        amount: proposal.amount,
        beneficiaryName: proposal.beneficiary?.name || '',
        accountNumber: proposal.beneficiary?.accountNumber || '',
        bankName: proposal.beneficiary?.bankName || '',
        transactionCode: savedTxCode,
        note: savedNote,
      });

      setIsDisburseOpen(false);
      setDisburseData({ transactionCode: '', note: '', receiptAttachment: null });
      setIsDisburseSuccessOpen(true);
      fetchProposal(proposal._id);
    } catch (err: any) {
      alert(err.message || 'Có lỗi xảy ra khi xác nhận giải ngân');
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
        <h3 style={{ color: '#ffffff' }}>{error || 'Không tìm thấy đề xuất thanh toán'}</h3>
        <Link to="/payment" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  // Quyền hành động
  const isOverTenMillion = (proposal.amount || 0) > 10000000;
  const isLeaderPending = proposal.status === 'pending_director' || proposal.status === 'pending_chairman';
  const canApprove =
    isLeaderPending &&
    ((isOverTenMillion && user?.role === 'chu_tich') ||
     (!isOverTenMillion && (user?.role === 'giam_doc' || user?.role === 'chu_tich')));
  const canDisburse = proposal.status === 'pending_disbursement' && user?.role === 'ke_toan';
  const isDisburseTurn = canDisburse;

  const purchaseProposal = typeof proposal.purchaseProposal === 'object' ? proposal.purchaseProposal : null;
  const execution = (purchaseProposal as any)?.procurementExecution;
  const isAdv = Boolean(execution?.isAdvanced);
  const advAmount = Number(execution?.advanceAmount) || 0;
  const advNote = execution?.advanceNote || '';

  return (
    <div>
      {/* Thanh điều hướng quay lại và Tiêu đề */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/payment" className="btn btn-ghost btn-sm" style={{ padding: '0.4rem' }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h1 style={{ fontSize: '1.5rem', color: '#ffffff' }} className="font-mono">
                {proposal.proposalCode || `TT-${proposal._id.slice(-6).toUpperCase()}`}
              </h1>
              <StatusBadge status={proposal.status} type="payment" />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
              <span>Ngày lập: {formatDate(proposal.createdAt)}</span>
              <span>•</span>
              <span>Phòng ban: {proposal.department?.name}</span>
              {purchaseProposal && (
                <>
                  <span>•</span>
                  <span>
                    Đơn gốc:{' '}
                    <Link
                      to={`/purchase/${purchaseProposal._id}`}
                      style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}
                    >
                      {purchaseProposal.proposalCode}
                    </Link>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Nút hành động */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {canApprove && (
            <>
              <button onClick={() => setIsApproveOpen(true)} className="btn btn-success">
                {user?.role === 'chu_tich' ? <Crown size={16} /> : <CheckCircle2 size={16} />}
                <span>{user?.role === 'chu_tich' ? 'Chủ Tịch Xác Nhận Giải Ngân' : 'GĐ Xác Nhận Giải Ngân'}</span>
              </button>
              <button onClick={() => setIsRejectOpen(true)} className="btn btn-danger">
                <XCircle size={16} />
                <span>Từ Chối Giải Ngân</span>
              </button>
            </>
          )}

          {canDisburse && (
            <button
              onClick={() => {
                setDisburseData({
                  transactionCode: '',
                  note: `Duyệt chi cho đơn ${proposal.proposalCode}`,
                  receiptAttachment: null,
                });
                setIsDisburseOpen(true);
              }}
              className="btn btn-primary"
            >
              <DollarSign size={16} />
              <span>Kế Toán Duyệt Chi (Chi Tiền)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsPrintOpen(true)}
            className="btn btn-secondary"
            style={{ gap: '0.4rem' }}
            title="Xem trước và in biểu mẫu đề xuất thanh toán PDF"
          >
            <Printer size={16} />
            <span>In / Xuất PDF</span>
          </button>
        </div>
      </div>

      {/* [QUY TRÌNH 2 MỚI] Thông báo trạng thái duyệt chi và thanh toán hoàn tất */}
      {proposal.status === 'pending_disbursement' && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: 'rgba(6, 182, 212, 0.12)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            borderRadius: 'var(--radius-md)',
            color: '#a5f3fc',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <CheckCircle2 size={20} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.875rem' }}>
              <strong>Lãnh đạo đã xác nhận giải ngân:</strong> Đề xuất thanh toán đã được duyệt và đưa về cho Kế toán để thực hiện duyệt chi (chi trả cho bên Thu mua / đối tác thực hiện hợp đồng).
            </span>
          </div>
          {isDisburseTurn && (
            <button
              onClick={() => {
                setDisburseData({
                  transactionCode: '',
                  note: `Duyệt chi thanh toán theo đề xuất ${proposal.proposalCode}`,
                  receiptAttachment: null,
                });
                setIsDisburseOpen(true);
              }}
              className="btn btn-primary btn-sm"
              style={{ gap: '0.4rem' }}
            >
              <DollarSign size={14} />
              <span>Duyệt Chi Ngay</span>
            </button>
          )}
        </div>
      )}

      {proposal.status === 'completed' && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 'var(--radius-md)',
            color: '#a7f3d0',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <CheckCircle2 size={22} color="var(--success)" />
            <span style={{ fontSize: '0.875rem' }}>
              <strong>Đã thanh toán hoàn tất:</strong> Kế toán đã thanh toán chi tiền hợp đồng/hóa đơn cho Thu mua thành công. Hóa đơn này đã được lưu trữ trong danh mục <strong>Hóa Đơn Đã Hoàn Thành</strong>.
            </span>
          </div>
          {purchaseProposal && (
            <Link
              to={`/purchase/${purchaseProposal._id}`}
              className="btn btn-secondary btn-sm"
              style={{ gap: '0.35rem' }}
            >
              <ExternalLink size={14} />
              <span>Xem Đơn Mua Sắm & Hóa Đơn Lưu Trữ</span>
            </Link>
          )}
        </div>
      )}

      {/* Bố cục chính */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.75rem' }}>
        {/* Cột trái: Thông tin chi tiết */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Thẻ thông tin người tạo & Phòng ban */}
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.25rem',
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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Người Lập Đề Xuất</div>
                  <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>{proposal.creator?.fullName}</div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                    {getRoleLabel(proposal.creator?.role)}
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
                  <Building size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phòng Ban</div>
                  <div style={{ fontWeight: 700, fontSize: '0.925rem' }}>{proposal.department?.name}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Thẻ thông tin thanh toán chính */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <CreditCard size={18} color="#10b981" />
              <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Thông Tin Thanh Toán</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Số Tiền Thanh Toán
                </div>
                <div
                  style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff' }}
                  className="font-mono"
                >
                  {formatCurrency(proposal.amount)}
                </div>
                {proposal.amountInWords && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                    {proposal.amountInWords}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Phương Thức
                </div>
                <span className={`badge ${proposal.paymentMethod === 'bank_transfer' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.825rem' }}>
                  {proposal.paymentMethod === 'bank_transfer' ? '🏦 Chuyển khoản ngân hàng' : '💵 Tiền mặt'}
                </span>
              </div>

              {purchaseProposal && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    Đơn Mua Sắm Gốc
                  </div>
                  <Link
                    to={`/purchase/${purchaseProposal._id}`}
                    style={{ fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    className="font-mono"
                  >
                    {purchaseProposal.proposalCode}
                    <ExternalLink size={13} />
                  </Link>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Giá trị: {formatCurrency(purchaseProposal.totalActualAmount || purchaseProposal.totalEstimatedAmount)}
                    {isAdv && advAmount > 0 && (
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}> • Đã tạm ứng: {formatCurrency(advAmount)}</span>
                    )}
                    {' '}• Đã giải ngân: {formatCurrency(purchaseProposal.totalDisbursed)}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Cấp Phê Duyệt
                </div>
                {proposal.amount <= 10000000 ? (
                  <span className="badge badge-info">≤ 10 triệu — Giám đốc duyệt</span>
                ) : (
                  <span className="badge badge-purple">&gt; 10 triệu — Chủ tịch duyệt</span>
                )}
              </div>
            </div>

            {/* [QUY TRÌNH MỚI] Thông báo đơn đã đối trừ khoản tiền Thu mua nhận tạm ứng độc lập */}
            {isAdv && advAmount > 0 && (
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.85rem 1.15rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <AlertCircle size={18} color="#f59e0b" />
                  <span style={{ fontSize: '0.85rem', color: '#fbbf24' }}>
                    <strong>Đơn hàng đã được đối trừ tạm ứng:</strong> Thu mua đã nhận tạm ứng trước{' '}
                    <strong className="font-mono">{formatCurrency(advAmount)}</strong>
                    {advNote ? ` (${advNote})` : ''}. Số tiền đề xuất thanh toán ở trên là phần còn thiếu cần chi trả thực tế.
                  </span>
                </div>
                <span className="badge badge-warning" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Đã tạm ứng: {formatCurrency(advAmount)}
                </span>
              </div>
            )}

            {/* Nội dung thanh toán */}
            <div style={{ marginTop: '1.25rem', padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                Nội Dung Thanh Toán
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {proposal.paymentReason || '—'}
              </div>
              {proposal.installmentNote && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                  Ghi chú đợt: <strong>{proposal.installmentNote}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Thẻ thông tin người thụ hưởng */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Banknote size={18} color="var(--warning)" />
              <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                Thông Tin Người Nhận Tiền / Thụ Hưởng (Bên Thu Mua / Đối Tác HĐ)
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Tên Người Nhận
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                  {proposal.beneficiary?.name || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Số Tài Khoản
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }} className="font-mono">
                  {proposal.beneficiary?.accountNumber || '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Ngân Hàng
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>
                  {proposal.beneficiary?.bankName || '—'}
                </div>
              </div>
              {proposal.beneficiary?.branch && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    Chi Nhánh
                  </div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                    {proposal.beneficiary.branch}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* [LUỒNG MỚI] 1. THẺ HỒ SƠ CĂN CỨ: DANH MỤC YÊU CẦU VẬT TƯ ĐƯỢC THANH TOÁN */}
          {(() => {
            const displayItems = (proposal.items && proposal.items.length > 0)
              ? proposal.items
              : ((purchaseProposal as any)?.items || []);
            if (displayItems.length === 0) return null;

            return (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                      Danh Mục Yêu Cầu Vật Tư Mua Sắm ({displayItems.length} hạng mục)
                    </h3>
                  </div>
                  {purchaseProposal && (
                    <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                      Căn cứ đơn {purchaseProposal.proposalCode}
                    </span>
                  )}
                </div>

                <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <table className="table" style={{ fontSize: '0.825rem', margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                        <th>Tên Vật Tư & Quy Cách</th>
                        <th style={{ textAlign: 'center' }}>Số Lượng</th>
                        <th style={{ textAlign: 'right' }}>Đơn Giá Thực Tế</th>
                        <th style={{ textAlign: 'right' }}>Thành Tiền</th>
                        <th>Nhà Cung Cấp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayItems.map((it: any, idx: number) => {
                        const qty = Number(it.soLuong) || 1;
                        const price = Number(it.donGiaThucTe) || 0;
                        const lineTotal = it.thanhTien || (qty * price);
                        return (
                          <tr key={idx}>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.stt || idx + 1}</td>
                            <td>
                              <div style={{ fontWeight: 600, color: '#ffffff' }}>{it.tenVatTu}</div>
                              {it.yeuCauKiThuat && (
                                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                  YC: {it.yeuCauKiThuat}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }} className="font-mono">
                              {qty}
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }} className="font-mono">
                              {price > 0 ? formatCurrency(price) : 'Chờ cập nhật'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }} className="font-mono">
                              {formatCurrency(lineTotal)}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                              {it.nhaCungCap || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', fontWeight: 700 }}>
                        <td colSpan={2} style={{ textAlign: 'right' }}>Tổng cộng:</td>
                        <td style={{ textAlign: 'center' }} className="font-mono">
                          {displayItems.reduce((s: number, it: any) => s + (Number(it.soLuong) || 1), 0)}
                        </td>
                        <td></td>
                        <td style={{ textAlign: 'right', color: 'var(--success)', fontSize: '0.925rem' }} className="font-mono">
                          {formatCurrency(
                            displayItems.reduce(
                              (s: number, it: any) => s + ((it.thanhTien) || ((Number(it.soLuong) || 1) * (Number(it.donGiaThucTe) || 0))),
                              0
                            )
                          )}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* [LUỒNG MỚI] 2. THẺ BẢNG BÁO GIÁ ĐỐI TÁC / NHÀ CUNG CẤP */}
          {(() => {
            const quotes = (proposal.quotationAttachments && proposal.quotationAttachments.length > 0)
              ? proposal.quotationAttachments
              : ((purchaseProposal as any)?.quotationAttachments || []);
            if (quotes.length === 0) return null;

            return (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <FileText size={18} color="var(--accent-cyan)" />
                  <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                    Bảng Báo Giá Đối Tác ({quotes.length} tài liệu)
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem' }}>
                  {quotes.map((qFile: any, qIdx: number) => (
                    <div
                      key={qIdx}
                      style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                        <FileText size={16} color="var(--accent-cyan)" />
                        <span
                          style={{ fontSize: '0.8rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '130px' }}
                          title={qFile.name}
                        >
                          {qFile.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => handlePreviewFile(qFile, quotes, qIdx)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '0.3rem', color: 'var(--accent-cyan)' }}
                          title="Xem bảng báo giá"
                        >
                          <Eye size={14} />
                        </button>
                        <a
                          href={qFile.url}
                          download={qFile.name}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '0.3rem' }}
                          title="Tải về"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* [LUỒNG MỚI] 3. THẺ HỢP ĐỒNG KINH TẾ */}
          {(() => {
            const contractData = proposal.contractInfo || (purchaseProposal as any)?.procurementExecution?.contractInfo;
            const contractFiles = (proposal.contractAttachments && proposal.contractAttachments.length > 0)
              ? proposal.contractAttachments
              : (contractData?.files || []);

            if (!contractData?.contractNumber && !contractData?.partnerName && contractFiles.length === 0) {
              return null;
            }

            return (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <FileCheck size={18} color="var(--success)" />
                  <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                    Hợp Đồng Kinh Tế
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: contractFiles.length > 0 ? '1rem' : 0 }}>
                  {contractData?.contractNumber && (
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                        Số Hiệu Hợp Đồng
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }} className="font-mono">
                        {contractData.contractNumber}
                      </div>
                    </div>
                  )}
                  {contractData?.partnerName && (
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                        Đối Tác Ký Kết
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {contractData.partnerName}
                      </div>
                    </div>
                  )}
                </div>

                {contractFiles.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {contractFiles.map((cFile: any, cIdx: number) => (
                      <div
                        key={cIdx}
                        style={{
                          padding: '0.75rem 1rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                          <FileCheck size={16} color="var(--success)" />
                          <span
                            style={{ fontSize: '0.8rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '130px' }}
                            title={cFile.name}
                          >
                            {cFile.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handlePreviewFile(cFile, contractFiles, cIdx)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '0.3rem', color: 'var(--success)' }}
                            title="Xem hợp đồng"
                          >
                            <Eye size={14} />
                          </button>
                          <a
                            href={cFile.url}
                            download={cFile.name}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '0.3rem' }}
                            title="Tải về"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* [LUỒNG MỚI] 4. THẺ HÓA ĐƠN VAT / CHỨNG TỪ BÊN THU MUA CUNG CẤP */}
          {(() => {
            const invoiceData = proposal.invoiceInfo || (purchaseProposal as any)?.procurementExecution?.invoiceInfo;
            const invoiceFiles = (invoiceData?.files && invoiceData.files.length > 0)
              ? invoiceData.files
              : [];

            if (!invoiceData?.invoiceNumber && !invoiceData?.invoiceDate && invoiceFiles.length === 0) {
              return null;
            }

            return (
              <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Receipt size={18} color="#f59e0b" />
                  <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                    Hóa Đơn VAT & Chứng Từ Bên Thu Mua
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: invoiceFiles.length > 0 ? '1rem' : 0 }}>
                  {invoiceData?.invoiceNumber && (
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                        Số Hóa Đơn VAT
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b' }} className="font-mono">
                        {invoiceData.invoiceNumber}
                      </div>
                    </div>
                  )}
                  {invoiceData?.invoiceDate && (
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                        Ngày Lập Hóa Đơn
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatDate(invoiceData.invoiceDate)}
                      </div>
                    </div>
                  )}
                </div>

                {invoiceFiles.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                    {invoiceFiles.map((iFile: any, iIdx: number) => (
                      <div
                        key={iIdx}
                        style={{
                          padding: '0.75rem 1rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                          <Receipt size={16} color="#f59e0b" />
                          <span
                            style={{ fontSize: '0.8rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '130px' }}
                            title={iFile.name}
                          >
                            {iFile.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handlePreviewFile(iFile, invoiceFiles, iIdx)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '0.3rem', color: '#f59e0b' }}
                            title="Xem hóa đơn"
                          >
                            <Eye size={14} />
                          </button>
                          <a
                            href={iFile.url}
                            download={iFile.name}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '0.3rem' }}
                            title="Tải về"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Thẻ tài liệu đính kèm */}
          {proposal.attachments && proposal.attachments.length > 0 && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Paperclip size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                  Chứng Từ Đính Kèm Khác ({proposal.attachments.length})
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {proposal.attachments.map((att, aIdx) => (
                  <div
                    key={aIdx}
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                      <FileText size={16} color="var(--primary)" />
                      <span
                        style={{ fontSize: '0.8rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '130px' }}
                        title={att.name}
                      >
                        {att.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => handlePreviewFile(att, proposal.attachments, aIdx)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.3rem', color: 'var(--primary)' }}
                        title="Xem tài liệu"
                      >
                        <Eye size={14} />
                      </button>
                      <a
                        href={att.url}
                        download={att.name}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.3rem' }}
                        title="Tải về máy"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thông tin giải ngân nếu đã giải ngân */}
          {proposal.disbursementInfo && proposal.disbursementInfo.disbursedAt && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <DollarSign size={18} color="var(--success)" />
                <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Thông Tin Giải Ngân</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    Thời Gian Giải Ngân
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                    {formatDate(proposal.disbursementInfo.disbursedAt)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    Người Thực Hiện
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>
                    {(proposal.disbursementInfo.disbursedBy as any)?.fullName || 'Kế toán'}
                  </div>
                </div>
                {proposal.disbursementInfo.transactionCode && (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                      Mã Giao Dịch
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)' }} className="font-mono">
                      {proposal.disbursementInfo.transactionCode}
                    </div>
                  </div>
                )}
                {proposal.disbursementInfo.note && (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                      Ghi Chú
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {proposal.disbursementInfo.note}
                    </div>
                  </div>
                )}
              </div>

              {proposal.disbursementInfo.receiptAttachment && (
                <div style={{ marginTop: '1rem' }}>
                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={16} color="var(--success)" />
                      <span style={{ fontSize: '0.825rem', fontWeight: 500, color: 'var(--success)' }}>
                        Biên lai / UNC: {proposal.disbursementInfo.receiptAttachment.name || 'Tài liệu giải ngân'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => handlePreviewFile(proposal.disbursementInfo!.receiptAttachment)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.3rem', color: 'var(--success)' }}
                        title="Xem biên lai / UNC"
                      >
                        <Eye size={14} />
                      </button>
                      <a
                        href={proposal.disbursementInfo.receiptAttachment.url}
                        download
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.3rem' }}
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cột phải: Tiến trình phê duyệt */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#ffffff', marginBottom: '1.25rem' }}>
              Tiến Trình Phê Duyệt Chi
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
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '0.35rem' }}>
                Lý Do Từ Chối:
              </div>
              <div style={{ fontSize: '0.85rem', color: '#fca5a5' }}>
                {proposal.rejectionReason}
              </div>
            </div>
          )}

          {/* Tổng quan tài chính */}
          <div
            className="card"
            style={{
              padding: '1.25rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.06) 100%)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Tổng Kết</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Số tiền đề xuất</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }} className="font-mono">
                  {formatCurrency(proposal.amount)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Trạng thái</span>
                <StatusBadge status={proposal.status} type="payment" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Phương thức</span>
                <span style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                  {proposal.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL XÁC NHẬN GIẢI NGÂN */}
      <Modal
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        title={user?.role === 'chu_tich' ? 'Chủ Tịch Xác Nhận Giải Ngân' : 'Giám Đốc Xác Nhận Giải Ngân'}
      >
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Xác nhận giải ngân cho đề xuất thanh toán <strong>{proposal.proposalCode}</strong> với
          số tiền <strong style={{ color: '#ffffff' }}>{formatCurrency(proposal.amount)}</strong>?
        </div>
        <textarea
          className="form-input"
          rows={3}
          placeholder="Nhận xét (không bắt buộc)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ resize: 'vertical', marginBottom: '1rem' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" onClick={() => setIsApproveOpen(false)} className="btn btn-secondary">
            Hủy
          </button>
          <button type="button" onClick={handleApprove} disabled={actionLoading} className="btn btn-success">
            <CheckCircle2 size={16} />
            <span>{actionLoading ? 'Đang xử lý...' : 'Xác Nhận Giải Ngân'}</span>
          </button>
        </div>
      </Modal>

      {/* MODAL TỪ CHỐI */}
      <Modal isOpen={isRejectOpen} onClose={() => setIsRejectOpen(false)} title="Từ Chối Đề Xuất Thanh Toán">
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Vui lòng nhập lý do từ chối đề xuất thanh toán <strong>{proposal.proposalCode}</strong>:
        </div>
        <textarea
          className="form-input"
          rows={3}
          placeholder="Lý do từ chối (bắt buộc)..."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          style={{ resize: 'vertical', marginBottom: '1rem' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" onClick={() => setIsRejectOpen(false)} className="btn btn-secondary">
            Hủy
          </button>
          <button type="button" onClick={handleReject} disabled={actionLoading || !rejectReason.trim()} className="btn btn-danger">
            <XCircle size={16} />
            <span>{actionLoading ? 'Đang xử lý...' : 'Xác Nhận Từ Chối'}</span>
          </button>
        </div>
      </Modal>

      {/* MODAL DUYỆT CHI (KẾ TOÁN) */}
      <Modal
        isOpen={isDisburseOpen}
        onClose={() => setIsDisburseOpen(false)}
        title="Kế Toán Duyệt Chi (Chi Tiền)"
      >
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Xác nhận duyệt chi và chuyển tiền cho đề xuất <strong>{proposal.proposalCode}</strong> với
          số tiền <strong style={{ color: 'var(--success)' }}>{formatCurrency(proposal.amount)}</strong> cho người nhận tiền / thụ hưởng:{' '}
          <strong style={{ color: '#ffffff' }}>{proposal.beneficiary?.name || 'Bên Thu Mua'}</strong>
          {proposal.beneficiary?.accountNumber && (
            <span> ({proposal.beneficiary.bankName} - {proposal.beneficiary.accountNumber})</span>
          )}:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label className="form-label">Mã Giao Dịch / Số UNC</label>
            <input
              type="text"
              className="form-input font-mono"
              placeholder="Ví dụ: FT26123456789..."
              value={disburseData.transactionCode}
              onChange={(e) => setDisburseData((prev) => ({ ...prev, transactionCode: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Ghi Chú Duyệt Chi</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Ghi chú bổ sung..."
              value={disburseData.note}
              onChange={(e) => setDisburseData((prev) => ({ ...prev, note: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div>
            <label className="form-label">Biên Lai / Ủy Nhiệm Chi (Ảnh chụp)</label>
            {disburseData.receiptAttachment ? (
              <div
                style={{
                  padding: '0.6rem 0.85rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Paperclip size={14} color="var(--success)" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                    {disburseData.receiptAttachment.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDisburseData((prev) => ({ ...prev, receiptAttachment: null }))}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '0.2rem', color: 'var(--danger)' }}
                >
                  <XCircle size={14} />
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleReceiptUpload}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
                <div
                  style={{
                    padding: '0.85rem',
                    border: '2px dashed var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '0.825rem',
                  }}
                >
                  {receiptUploading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang tải lên...</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                      <UploadCloud size={16} />
                      <span>Tải lên biên lai / UNC</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" onClick={() => setIsDisburseOpen(false)} className="btn btn-secondary">
            Hủy
          </button>
          <button type="button" onClick={handleDisburse} disabled={actionLoading} className="btn btn-primary">
            <DollarSign size={16} />
            <span>{actionLoading ? 'Đang xử lý...' : 'Xác Nhận Duyệt Chi'}</span>
          </button>
        </div>
      </Modal>

      {/* MODAL XEM TRƯỚC VÀ KIỂM TRA CHỨNG TỪ (HÓA ĐƠN / HỢP ĐỒNG / BÁO GIÁ / PDF) */}
      <FilePreviewModal
        isOpen={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        file={previewAttachment}
        files={previewFileList}
        initialIndex={previewFileIndex}
        title="Kiểm Tra Hồ Sơ Chứng Từ Thanh Toán"
      />

      {/* MODAL POPUP XÁC NHẬN GIẢI NGÂN THÀNH CÔNG */}
      <Modal
        isOpen={isDisburseSuccessOpen}
        onClose={() => setIsDisburseSuccessOpen(false)}
        title="Giải Ngân Thành Công"
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
            Xác Nhận Giải Ngân Thành Công!
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Khoản tiền đã được xác nhận thanh toán thành công và đồng bộ cập nhật lũy kế giải ngân vào đơn mua sắm vật tư.
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
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Số Tiền Giải Ngân:</span>
                <span className="font-mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--success)' }}>
                  {formatCurrency(disburseSuccessInfo.amount)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Người Thụ Hưởng:</span>
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
              {disburseSuccessInfo.transactionCode && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mã Giao Dịch / UNC:</span>
                  <span className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                    {disburseSuccessInfo.transactionCode}
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

      {/* MODAL XEM TRƯỚC VÀ IN BIỂU MẪU ĐỀ NGHỊ THANH TOÁN */}
      <PaymentPrintModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        proposal={proposal}
      />
    </div>
  );
};
