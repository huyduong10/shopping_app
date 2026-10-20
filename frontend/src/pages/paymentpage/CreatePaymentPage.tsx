import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { purchaseProposalService, paymentProposalService, uploadService, authService } from '../../services';
import { PurchaseProposal, User } from '../../models';
import { FilePreviewModal, PreviewFileItem } from '../../component';
import { formatCurrency } from '../../utils/formatters';
import {
  createLocalAttachments,
  uploadPendingLocalAttachments,
  revokeLocalAttachment,
  LocalAttachment,
} from '../../utils/clientAttachmentHelper';
import { useAuth } from '../../context/AuthContext';
import {
  CreditCard,
  ArrowLeft,
  Save,
  AlertCircle,
  Loader2,
  FileText,
  Search,
  ChevronDown,
  Building,
  User as UserIcon,
  Paperclip,
  UploadCloud,
  Trash2,
  CheckCircle2,
  Info,
  Eye,
  Download,
  FileCheck,
  Layers,
  ExternalLink,
  Receipt,
} from 'lucide-react';

export const CreatePaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPurchaseId = searchParams.get('purchaseProposalId');
  const { user } = useAuth();

  // Chỉ Kế toán (hoặc Quản trị viên) mới có nghiệp vụ lập đề xuất thanh toán
  useEffect(() => {
    if (user && !['ke_toan', 'admin'].includes(user.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [purchaseProposals, setPurchaseProposals] = useState<PurchaseProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<PurchaseProposal | null>(null);
  const [searchPurchase, setSearchPurchase] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    authService.getAllUsers().then(setUsers).catch(console.error);
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [quoteUploading, setQuoteUploading] = useState(false);
  const [contractUploading, setContractUploading] = useState(false);
  const [invoiceUploading, setInvoiceUploading] = useState(false);

  // Preview chứng từ (hóa đơn, hợp đồng, báo giá)
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

  // [LUỒNG MỚI] Hồ sơ đề xuất thanh toán bao gồm:
  // 1. Danh mục yêu cầu vật tư
  // 2. Bảng báo giá từ nhà cung cấp
  // 3. Hợp đồng kinh tế
  // 4. Hóa đơn / chứng từ thanh toán do bên Thu mua cung cấp
  const [form, setForm] = useState({
    amount: 0,
    installmentNote: '',
    paymentReason: '',
    paymentMethod: 'bank_transfer' as 'bank_transfer' | 'cash',
    beneficiary: {
      name: '',
      accountNumber: '',
      bankName: '',
      branch: '',
    },
    attachments: [] as Array<{ name: string; url: string; size?: number; type?: string }>,
    items: [] as Array<{
      stt?: number;
      tenVatTu: string;
      soLuong: number;
      donGiaThucTe: number;
      nhaCungCap?: string;
      yeuCauKiThuat?: string;
      phongBanSuDung?: string;
      thanhTien?: number;
    }>,
    quotationAttachments: [] as Array<{ name: string; url: string; size?: number; type?: string }>,
    contractInfo: {
      contractNumber: '',
      partnerName: '',
      files: [] as Array<{ name: string; url: string; size?: number; type?: string }>,
    },
    contractAttachments: [] as Array<{ name: string; url: string; size?: number; type?: string }>,
    invoiceInfo: {
      invoiceNumber: '',
      invoiceDate: '',
      files: [] as Array<{ name: string; url: string; size?: number; type?: string }>,
    },
  });

  const handleSelectProposal = (proposal: PurchaseProposal) => {
    setSelectedProposal(proposal);
    setShowDropdown(false);
    setSearchPurchase('');

    const totalAmount = proposal.totalActualAmount || proposal.totalEstimatedAmount;
    const remaining = Math.max(0, totalAmount - (proposal.totalDisbursed || 0));

    // [QUY TRÌNH MỚI] Khâu chi trả thanh toán sẽ trả về cho bên Thu mua (người thực hiện mua sắm/hợp đồng), KHÔNG phải nhân viên đề xuất
    const submittedByObj = (proposal.procurementExecution?.submittedBy as any);
    const procurerUser = (typeof submittedByObj === 'object' && submittedByObj !== null)
      ? submittedByObj
      : users.find((u) => u._id === submittedByObj || u.role === 'thu_mua');
    const procurerBank = procurerUser?.bankAccount;
    const partnerName = (proposal as any).procurementExecution?.contractInfo?.partnerName;

    const beneficiaryName = procurerUser?.fullName || procurerBank?.accountHolder || partnerName || 'Bên Thu Mua';
    const accountNumber = procurerBank?.accountNumber || '';
    const bankName = procurerBank?.bankName || '';
    const branch = procurerBank?.branch || '';

    // [LUỒNG MỚI] Kế thừa danh mục yêu cầu vật tư được thanh toán
    const proposalItems = (proposal.items || []).map((it, idx) => ({
      stt: it.stt || idx + 1,
      tenVatTu: it.tenVatTu,
      soLuong: Number(it.soLuong) || 1,
      donGiaThucTe: Number(it.donGiaThucTe) || 0,
      nhaCungCap: it.nhaCungCap || '',
      yeuCauKiThuat: it.yeuCauKiThuat || '',
      phongBanSuDung: it.phongBanSuDung || proposal.department?.name || '',
      thanhTien: (Number(it.soLuong) || 1) * (Number(it.donGiaThucTe) || 0),
    }));

    // [LUỒNG MỚI] Kế thừa hợp đồng kinh tế và bảng báo giá từ Thu mua
    const executionContract = (proposal as any).procurementExecution?.contractInfo || {};
    const contractFiles: Array<{ name: string; url: string; size?: number; type?: string }> = executionContract.files || [];

    // [LUỒNG MỚI] Kế thừa hóa đơn / chứng từ do bên Thu mua cung cấp
    const executionInvoice = (proposal as any).procurementExecution?.invoiceInfo || {};
    const invoiceFiles: Array<{ name: string; url: string; size?: number; type?: string }> = executionInvoice.files || [];
    const quotationFiles: Array<{ name: string; url: string; size?: number; type?: string }> = proposal.quotationAttachments || [];

    // [LUỒNG MỚI]: Tự động thêm toàn bộ hóa đơn, hợp đồng và bảng báo giá vào danh sách chứng từ đính kèm (attachments)
    // Người dùng không cần phải tải về rồi đính kèm thủ công nữa!
    const autoAttachments: Array<{ name: string; url: string; size?: number; type?: string }> = [];
    const seenUrls = new Set<string>();

    const addFilesWithPrefix = (files: Array<{ name: string; url: string; size?: number; type?: string }>, prefix: string) => {
      for (const f of files) {
        if (f && f.url && !seenUrls.has(f.url)) {
          seenUrls.add(f.url);
          const nameWithPrefix = f.name?.startsWith('[') ? f.name : `${prefix} ${f.name || 'chứng từ'}`;
          autoAttachments.push({
            name: nameWithPrefix,
            url: f.url,
            size: f.size,
            type: f.type,
          });
        }
      }
    };

    // 1. Tự động gắn Hóa đơn do bên Thu mua cung cấp
    addFilesWithPrefix(invoiceFiles, '[Hóa đơn Thu mua]');
    // 2. Tự động gắn Hợp đồng do bên Thu mua cung cấp
    addFilesWithPrefix(contractFiles, '[Hợp đồng kinh tế]');
    // 3. Tự động gắn Bảng báo giá đối tác
    addFilesWithPrefix(quotationFiles, '[Bảng báo giá]');

    // Định dạng ngày hóa đơn cho input date
    let formattedInvoiceDate = '';
    if (executionInvoice.invoiceDate) {
      try {
        formattedInvoiceDate = new Date(executionInvoice.invoiceDate).toISOString().slice(0, 10);
      } catch (e) {
        formattedInvoiceDate = '';
      }
    }

    // Tự động điền nội dung thanh toán thông minh theo số hóa đơn / số hợp đồng
    let smartReason = `Thanh toán chi phí mua sắm vật tư cho đơn ${proposal.proposalCode}`;
    if (executionInvoice.invoiceNumber) {
      smartReason = `Thanh toán chi phí mua sắm theo Hóa đơn số ${executionInvoice.invoiceNumber} cho đơn ${proposal.proposalCode}`;
    } else if (executionContract.contractNumber) {
      smartReason = `Thanh toán chi phí mua sắm theo Hợp đồng số ${executionContract.contractNumber} cho đơn ${proposal.proposalCode}`;
    }

    // [QUY TRÌNH MỚI] Kiểm tra khoản Thu mua đã xác nhận tạm ứng độc lập để tự động đối trừ
    const isAdv = Boolean(proposal.procurementExecution?.isAdvanced);
    const advAmount = Number(proposal.procurementExecution?.advanceAmount) || 0;
    const advNote = proposal.procurementExecution?.advanceNote || '';
    const remainingAfterAdv = Math.max(0, remaining - (isAdv ? advAmount : 0));

    // Mặc định đề xuất số tiền thanh toán: Nếu có tạm ứng thì lấy phần còn thiếu sau đối trừ, ngược lại lấy toàn bộ số tiền còn lại
    const defaultAmount = isAdv && advAmount > 0 ? remainingAfterAdv : remaining;
    let defaultInstallmentNote = '';
    if (isAdv && advAmount > 0) {
      defaultInstallmentNote = `Đối trừ tạm ứng ${formatCurrency(advAmount)}${advNote ? ` (${advNote})` : ''} - Chi trả số tiền còn thiếu`;
    }

    setForm((prev) => ({
      ...prev,
      amount: defaultAmount,
      paymentReason: smartReason,
      installmentNote: defaultInstallmentNote,
      beneficiary: {
        name: beneficiaryName,
        accountNumber: accountNumber,
        bankName: bankName,
        branch: branch || prev.beneficiary.branch || '',
      },
      items: proposalItems,
      quotationAttachments: quotationFiles,
      contractInfo: {
        contractNumber: executionContract.contractNumber || '',
        partnerName: executionContract.partnerName || '',
        files: contractFiles,
      },
      contractAttachments: contractFiles,
      invoiceInfo: {
        invoiceNumber: executionInvoice.invoiceNumber || '',
        invoiceDate: formattedInvoiceDate,
        files: invoiceFiles,
      },
      attachments: autoAttachments,
    }));
  };

  const handleFillProcurerBeneficiary = () => {
    const submittedByObj = (selectedProposal?.procurementExecution?.submittedBy as any);
    const procurerUser = (typeof submittedByObj === 'object' && submittedByObj !== null)
      ? submittedByObj
      : users.find((u) => u._id === submittedByObj || u.role === 'thu_mua');
    if (!procurerUser) return;
    const procurerBank = procurerUser.bankAccount;
    setForm((prev) => ({
      ...prev,
      beneficiary: {
        name: procurerUser.fullName || procurerBank?.accountHolder || 'Bên Thu Mua',
        accountNumber: procurerBank?.accountNumber || '',
        bankName: procurerBank?.bankName || '',
        branch: procurerBank?.branch || '',
      },
    }));
  };

  const handleFillPartnerBeneficiary = () => {
    const partner = (selectedProposal as any)?.procurementExecution?.contractInfo?.partnerName;
    if (!partner) return;
    setForm((prev) => ({
      ...prev,
      beneficiary: {
        name: partner,
        accountNumber: '',
        bankName: '',
        branch: '',
      },
    }));
  };

  // Tải danh sách đơn mua sắm có status "pending_payment" hoặc "disbursing"
  useEffect(() => {
    const loadPurchaseProposals = async () => {
      setLoadingProposals(true);
      try {
        const data = await purchaseProposalService.getAll();
        // [LUỒNG MỚI] Lọc các đơn mua sắm đủ điều kiện để Kế toán lập đề xuất thanh toán:
        // Đã qua khâu GĐ duyệt / Thu mua nộp hồ sơ (pending_accounting, procurement_execution, pending_payment, disbursing...)
        const eligible = data.filter((p) =>
          [
            'pending_accounting',
            'accounting_review',
            'procurement_execution',
            'pending_payment',
            'pending_payment_approval',
            'disbursing',
            'final_approved',
            'completed',
          ].includes(p.status)
        );
        setPurchaseProposals(eligible);

        if (preselectedPurchaseId) {
          const found = eligible.find((p) => p._id === preselectedPurchaseId);
          if (found) {
            handleSelectProposal(found);
          } else {
            try {
              const single = await purchaseProposalService.getById(preselectedPurchaseId);
              if (single) {
                setPurchaseProposals((prev) => [single, ...prev.filter((p) => p._id !== single._id)]);
                handleSelectProposal(single);
              }
            } catch (sErr) {
              console.error('Không tìm thấy đơn mua sắm chỉ định:', sErr);
            }
          }
        }
      } catch (err) {
        console.error('Error loading purchase proposals:', err);
      } finally {
        setLoadingProposals(false);
      }
    };
    loadPurchaseProposals();
  }, [preselectedPurchaseId]);

  const filteredPurchaseProposals = purchaseProposals.filter((p) =>
    p.proposalCode.toLowerCase().includes(searchPurchase.toLowerCase()) ||
    p.creator?.fullName?.toLowerCase().includes(searchPurchase.toLowerCase()) ||
    p.department?.name?.toLowerCase().includes(searchPurchase.toLowerCase())
  );

  // [TỐI ƯU CƠ CHẾ GỬI ẢNH] Lưu tệp chứng từ cục bộ ở máy khách, khi bấm Gửi mới upload lên máy chủ
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { attachments: localFiles, oversizedCount } = createLocalAttachments(Array.from(files));
    if (oversizedCount > 0) {
      alert('Một số tệp vượt quá dung lượng tối đa 15MB đã bị bỏ qua.');
    }

    setForm((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...(localFiles as any)],
    }));
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setForm((prev) => {
      const target = prev.attachments[index];
      if (target) revokeLocalAttachment(target as any);
      return {
        ...prev,
        attachments: prev.attachments.filter((_, idx) => idx !== index),
      };
    });
  };

  // [LUỒNG MỚI] Xử lý tải thêm bảng báo giá đối tác (Lưu cục bộ)
  const handleQuoteUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { attachments: localFiles, oversizedCount } = createLocalAttachments(Array.from(files));
    if (oversizedCount > 0) {
      alert('Một số tệp vượt quá dung lượng tối đa 15MB đã bị bỏ qua.');
    }

    setForm((prev) => ({
      ...prev,
      quotationAttachments: [...prev.quotationAttachments, ...(localFiles as any)],
    }));
    e.target.value = '';
  };

  const handleRemoveQuote = (index: number) => {
    setForm((prev) => {
      const target = prev.quotationAttachments[index];
      if (target) revokeLocalAttachment(target as any);
      return {
        ...prev,
        quotationAttachments: prev.quotationAttachments.filter((_, idx) => idx !== index),
      };
    });
  };

  // [LUỒNG MỚI] Xử lý tải thêm tệp hợp đồng kinh tế (Lưu cục bộ)
  const handleContractUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { attachments: localFiles, oversizedCount } = createLocalAttachments(Array.from(files));
    if (oversizedCount > 0) {
      alert('Một số tệp vượt quá dung lượng tối đa 15MB đã bị bỏ qua.');
    }

    setForm((prev) => ({
      ...prev,
      contractInfo: {
        ...prev.contractInfo,
        files: [...(prev.contractInfo.files || []), ...(localFiles as any)],
      },
      contractAttachments: [...prev.contractAttachments, ...(localFiles as any)],
    }));
    e.target.value = '';
  };

  const handleRemoveContractFile = (index: number) => {
    setForm((prev) => {
      const target = prev.contractInfo.files?.[index];
      if (target) revokeLocalAttachment(target as any);
      const updatedFiles = (prev.contractInfo.files || []).filter((_, idx) => idx !== index);
      return {
        ...prev,
        contractInfo: { ...prev.contractInfo, files: updatedFiles },
        contractAttachments: updatedFiles,
      };
    });
  };

  // [LUỒNG MỚI] Xử lý tải thêm tệp hóa đơn VAT (Lưu cục bộ)
  const handleInvoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { attachments: localFiles, oversizedCount } = createLocalAttachments(Array.from(files));
    if (oversizedCount > 0) {
      alert('Một số tệp vượt quá dung lượng tối đa 15MB đã bị bỏ qua.');
    }

    setForm((prev) => {
      const updatedInvoiceFiles = [...(prev.invoiceInfo.files || []), ...(localFiles as any)];
      const updatedAtts = [
        ...prev.attachments,
        ...localFiles.map((f) => ({
          ...f,
          name: `[Hóa đơn Thu mua] ${f.name}`,
        })),
      ];
      return {
        ...prev,
        invoiceInfo: { ...prev.invoiceInfo, files: updatedInvoiceFiles },
        attachments: updatedAtts as any,
      };
    });
    e.target.value = '';
  };

  const handleRemoveInvoiceFile = (index: number) => {
    setForm((prev) => {
      const targetFile = prev.invoiceInfo.files?.[index];
      if (targetFile) revokeLocalAttachment(targetFile as any);
      const updatedFiles = (prev.invoiceInfo.files || []).filter((_, idx) => idx !== index);
      const updatedAtts = targetFile
        ? prev.attachments.filter((a) => a.url !== targetFile.url)
        : prev.attachments;
      return {
        ...prev,
        invoiceInfo: { ...prev.invoiceInfo, files: updatedFiles },
        attachments: updatedAtts,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProposal) {
      setError('Vui lòng chọn đơn mua sắm gốc để lập đề xuất thanh toán.');
      return;
    }

    if (form.amount <= 0) {
      setError('Số tiền thanh toán phải lớn hơn 0.');
      return;
    }

    const totalAmount = selectedProposal.totalActualAmount || selectedProposal.totalEstimatedAmount;
    const remaining = Math.max(0, totalAmount - (selectedProposal.totalDisbursed || 0));
    if (form.amount > remaining) {
      setError(`Số tiền thanh toán vượt quá số tiền còn lại (${formatCurrency(remaining)}).`);
      return;
    }

    if (
      !form.beneficiary.name.trim() ||
      !form.beneficiary.accountNumber.trim() ||
      !form.beneficiary.bankName.trim()
    ) {
      setError('Vui lòng điền đầy đủ thông tin người thụ hưởng (Tên, Số tài khoản, Ngân hàng).');
      return;
    }

    if (!form.paymentReason.trim()) {
      setError('Vui lòng nhập nội dung thanh toán.');
      return;
    }

    setSubmitting(true);
    try {
      // [TỐI ƯU CƠ CHẾ GỬI ẢNH] Chỉ khi bấm gửi mới upload các tệp cục bộ lên server
      const serverAttachments = await uploadPendingLocalAttachments(form.attachments as any);
      const serverQuotes = await uploadPendingLocalAttachments(form.quotationAttachments as any);
      const serverContractFiles = await uploadPendingLocalAttachments((form.contractInfo.files || []) as any);
      const serverInvoiceFiles = await uploadPendingLocalAttachments((form.invoiceInfo.files || []) as any);

      const result = await paymentProposalService.create({
        purchaseProposalId: selectedProposal._id,
        amount: form.amount,
        installmentNote: form.installmentNote,
        paymentReason: form.paymentReason,
        paymentMethod: form.paymentMethod,
        beneficiary: form.beneficiary,
        attachments: serverAttachments,
        items: form.items,
        quotationAttachments: serverQuotes,
        contractInfo: {
          ...form.contractInfo,
          files: serverContractFiles,
        },
        contractAttachments: serverContractFiles,
        invoiceInfo: {
          ...form.invoiceInfo,
          files: serverInvoiceFiles,
        },
      });
      navigate(`/payment/${result._id}`);
    } catch (err: any) {
      setError(err.message || 'Không thể tạo đề xuất thanh toán. Vui lòng thử lại.');
      setSubmitting(false);
    }
  };

  const isSelectedAdvanced = Boolean(selectedProposal?.procurementExecution?.isAdvanced);
  const advanceAmount = Number(selectedProposal?.procurementExecution?.advanceAmount) || 0;
  const advanceNote = selectedProposal?.procurementExecution?.advanceNote || '';

  const remainingAmount = selectedProposal
    ? Math.max(0, (selectedProposal.totalActualAmount || selectedProposal.totalEstimatedAmount) - (selectedProposal.totalDisbursed || 0))
    : 0;

  // Số tiền còn lại thực tế cần chi trả sau khi đối trừ số tiền Thu mua đã tạm ứng trước:
  const remainingAfterAdvance = Math.max(0, remainingAmount - (isSelectedAdvanced ? advanceAmount : 0));

  if (!user || !['ke_toan', 'admin'].includes(user.role)) {
    return null;
  }

  return (
    <div>
      {/* Tiêu đề trang */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link to="/payment" className="btn btn-ghost btn-sm" style={{ padding: '0.4rem' }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: '1.5rem', color: '#ffffff' }}>Lập Đề Xuất Thanh Toán Mới</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Kế toán tiếp nhận hóa đơn / hợp đồng từ Thu mua để lập đề xuất thanh toán trình Lãnh đạo (Giám đốc/Chủ tịch) xác nhận giải ngân, sau đó duyệt chi.
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* BƯỚC 1: Chọn đơn mua sắm gốc */}
        <div className="card" style={{ marginBottom: '1.75rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary) 0%, #818cf8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 800,
              }}
            >
              1
            </div>
            <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Chọn Đơn Mua Sắm Gốc</h3>
          </div>

          {loadingProposals ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', padding: '1rem 0' }}>
              <Loader2 size={18} className="animate-spin" />
              <span style={{ fontSize: '0.875rem' }}>Đang tải danh sách đơn mua sắm...</span>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  padding: '0.85rem 1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: selectedProposal
                    ? '1px solid rgba(99, 102, 241, 0.4)'
                    : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'var(--transition)',
                }}
              >
                {selectedProposal ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    <span className="font-mono" style={{ fontWeight: 700, color: '#ffffff' }}>
                      {selectedProposal.proposalCode}
                    </span>
                    <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      {selectedProposal.department?.name}
                    </span>
                    <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>•</span>
                    <span className="font-mono" style={{ fontWeight: 600, color: 'var(--success)' }}>
                      {formatCurrency(selectedProposal.totalActualAmount || selectedProposal.totalEstimatedAmount)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                      (Còn lại: {formatCurrency(remainingAmount)})
                    </span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Bấm để chọn đơn mua sắm cần lập thanh toán...
                  </span>
                )}
                <ChevronDown size={16} color="var(--text-muted)" />
              </div>

              {showDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    backgroundColor: '#1a1f2e',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    zIndex: 100,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                >
                  <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ position: 'relative' }}>
                      <Search
                        size={14}
                        style={{
                          position: 'absolute',
                          left: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)',
                        }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: '32px', fontSize: '0.825rem' }}
                        placeholder="Tìm mã đơn, người tạo, phòng ban..."
                        value={searchPurchase}
                        onChange={(e) => setSearchPurchase(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>

                  {filteredPurchaseProposals.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Không tìm thấy đơn mua sắm nào đủ điều kiện thanh toán.
                    </div>
                  ) : (
                    filteredPurchaseProposals.map((p) => {
                      const total = p.totalActualAmount || p.totalEstimatedAmount;
                      const remaining = Math.max(0, total - (p.totalDisbursed || 0));
                      return (
                        <div
                          key={p._id}
                          onClick={() => handleSelectProposal(p)}
                          style={{
                            padding: '0.85rem 1rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'var(--transition)',
                            backgroundColor: selectedProposal?._id === p._id ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              selectedProposal?._id === p._id ? 'rgba(99, 102, 241, 0.08)' : 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span className="font-mono" style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.9rem' }}>
                                {p.proposalCode}
                              </span>
                              <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                {p.creator?.fullName} — {p.department?.name}
                              </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className="font-mono" style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.875rem' }}>
                                {formatCurrency(total)}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: remaining > 0 ? 'var(--accent-cyan)' : 'var(--success)' }}>
                                {remaining > 0 ? `Còn lại: ${formatCurrency(remaining)}` : 'Đã giải ngân hết'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Thông tin tóm tắt đơn mua sắm đã chọn */}
          {selectedProposal && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem 1.25rem',
                backgroundColor: 'rgba(99, 102, 241, 0.06)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Người tạo đơn
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>
                    {selectedProposal.creator?.fullName}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Phòng ban
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>
                    {selectedProposal.department?.name}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tổng giá trị
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--success)' }}>
                    {formatCurrency(selectedProposal.totalActualAmount || selectedProposal.totalEstimatedAmount)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Đã giải ngân
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {formatCurrency(selectedProposal.totalDisbursed || 0)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Số vật tư
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>
                    {selectedProposal.items?.length || 0} mục
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* [QUY TRÌNH MỚI] Thông báo tình trạng Tạm Ứng Độc Lập của Thu Mua */}
          {selectedProposal && isSelectedAdvanced && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1.15rem 1.25rem',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={20} color="#f59e0b" />
                  <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.95rem' }}>
                    Thu mua xác nhận: Đơn hàng này ĐÃ ĐƯỢC TẠM ỨNG trước đó
                  </span>
                </div>
                <span className="badge badge-warning" style={{ fontSize: '0.775rem', fontWeight: 700 }}>
                  Đã nhận tạm ứng: {formatCurrency(advanceAmount)}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.85rem',
                  padding: '0.85rem 1rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '0.85rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Số Tiền Đã Tạm Ứng
                  </div>
                  <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 800, color: '#fbbf24' }}>
                    {formatCurrency(advanceAmount)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Mã Đơn / Ghi Chú Tạm Ứng
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
                    {advanceNote || 'Không có ghi chú cụ thể'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Số Tiền Còn Thiếu Sau Tạm Ứng
                  </div>
                  <div className="font-mono" style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
                    {formatCurrency(remainingAfterAdvance)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>Thao tác điền nhanh:</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      amount: remainingAfterAdvance,
                      installmentNote: `Đối trừ tạm ứng: ${formatCurrency(advanceAmount)}${advanceNote ? ` (${advanceNote})` : ''} - Chi trả số tiền còn thiếu`,
                    }));
                  }}
                >
                  Điền số tiền còn thiếu sau đối trừ ({formatCurrency(remainingAfterAdvance)})
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', color: 'var(--text-muted)' }}
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      amount: remainingAmount,
                      installmentNote: '',
                    }));
                  }}
                >
                  Điền toàn bộ giá trị đơn ({formatCurrency(remainingAmount)})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* [LUỒNG MỚI] BƯỚC 2: HỒ SƠ CĂN CỨ THANH TOÁN (YÊU CẦU VẬT TƯ, BÁO GIÁ, HỢP ĐỒNG) */}
        {selectedProposal && (
          <div className="card" style={{ marginBottom: '1.75rem', padding: '1.5rem', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                  }}
                >
                  2
                </div>
                <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Hồ Sơ Căn Cứ Thanh Toán (Vật Tư, Báo Giá, Hợp Đồng)</h3>
              </div>
              <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                Tự động trích xuất từ đơn mua sắm {selectedProposal.proposalCode}
              </span>
            </div>

            {/* 1. BẢNG DANH MỤC YÊU CẦU VẬT TƯ */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
                <Layers size={17} color="var(--primary)" />
                <h4 style={{ fontSize: '0.95rem', color: '#ffffff', fontWeight: 600 }}>
                  1. Danh Mục Yêu Cầu Vật Tư Mua Sắm ({form.items.length} hạng mục)
                </h4>
              </div>

              {form.items.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                  Không có danh mục vật tư trong đơn mua sắm này.
                </div>
              ) : (
                <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <table className="table" style={{ fontSize: '0.825rem', margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                        <th>Tên Vật Tư & Quy Cách</th>
                        <th style={{ textAlign: 'center' }}>Số Lượng</th>
                        <th style={{ textAlign: 'right' }}>Đơn Giá Khảo Sát</th>
                        <th style={{ textAlign: 'right' }}>Thành Tiền</th>
                        <th>Nhà Cung Cấp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it, idx) => (
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
                            {it.soLuong}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }} className="font-mono">
                            {formatCurrency(it.donGiaThucTe)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }} className="font-mono">
                            {formatCurrency((it.soLuong || 1) * (it.donGiaThucTe || 0))}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                            {it.nhaCungCap || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', fontWeight: 700 }}>
                        <td colSpan={2} style={{ textAlign: 'right' }}>Tổng cộng vật tư:</td>
                        <td style={{ textAlign: 'center' }} className="font-mono">
                          {form.items.reduce((s, it) => s + (Number(it.soLuong) || 1), 0)}
                        </td>
                        <td></td>
                        <td style={{ textAlign: 'right', color: 'var(--success)', fontSize: '0.9rem' }} className="font-mono">
                          {formatCurrency(form.items.reduce((s, it) => s + ((Number(it.soLuong) || 1) * (Number(it.donGiaThucTe) || 0)), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* 2. BẢNG BÁO GIÁ ĐỐI TÁC / NHÀ CUNG CẤP */}
            <div style={{ marginBottom: '1.75rem', padding: '1.25rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <FileText size={17} color="var(--accent-cyan)" />
                  <h4 style={{ fontSize: '0.95rem', color: '#ffffff', fontWeight: 600 }}>
                    2. Bảng Báo Giá Đối Tác ({form.quotationAttachments.length} tài liệu)
                  </h4>
                </div>
                <label
                  className={`btn btn-secondary btn-sm ${quoteUploading ? 'disabled' : ''}`}
                  style={{ cursor: quoteUploading ? 'not-allowed' : 'pointer', fontSize: '0.75rem', gap: '0.35rem' }}
                >
                  {quoteUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                  <span>{quoteUploading ? 'Đang tải lên...' : 'Tải thêm bảng báo giá'}</span>
                  <input
                    type="file"
                    multiple
                    disabled={quoteUploading}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc"
                    style={{ display: 'none' }}
                    onChange={handleQuoteUpload}
                  />
                </label>
              </div>

              {form.quotationAttachments.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                  Chưa có bảng báo giá đính kèm. Kế toán có thể bấm "Tải thêm bảng báo giá" ở trên nếu đối tác bổ sung bảng chào giá.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.65rem' }}>
                  {form.quotationAttachments.map((file, qIdx) => (
                    <div
                      key={qIdx}
                      style={{
                        padding: '0.6rem 0.85rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                        <FileText size={15} color="var(--accent-cyan)" />
                        <span style={{ fontSize: '0.775rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }} title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => handlePreviewFile(file, form.quotationAttachments, qIdx)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '0.25rem', color: 'var(--accent-cyan)' }}
                          title="Xem báo giá"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveQuote(qIdx)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)', padding: '0.25rem' }}
                          title="Xóa"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. HỢP ĐỒNG KINH TẾ & HỒ SƠ MUA SẮM */}
            <div style={{ padding: '1.25rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <FileCheck size={17} color="var(--success)" />
                  <h4 style={{ fontSize: '0.95rem', color: '#ffffff', fontWeight: 600 }}>
                    3. Hợp Đồng Kinh Tế & Hồ Sơ Ký Kết ({(form.contractInfo.files || []).length} tệp)
                  </h4>
                </div>
                <label
                  className={`btn btn-secondary btn-sm ${contractUploading ? 'disabled' : ''}`}
                  style={{ cursor: contractUploading ? 'not-allowed' : 'pointer', fontSize: '0.75rem', gap: '0.35rem' }}
                >
                  {contractUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                  <span>{contractUploading ? 'Đang tải lên...' : 'Tải thêm tệp hợp đồng'}</span>
                  <input
                    type="file"
                    multiple
                    disabled={contractUploading}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.doc"
                    style={{ display: 'none' }}
                    onChange={handleContractUpload}
                  />
                </label>
              </div>

              {/* Thông tin số hợp đồng & bên ký */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '0.85rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Số Hiệu Hợp Đồng:</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.825rem' }}
                    placeholder="VD: HĐ-2026/PROFLOW-01"
                    value={form.contractInfo.contractNumber || ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        contractInfo: { ...prev.contractInfo, contractNumber: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Tên Đối Tác Ký Hợp Đồng:</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.825rem' }}
                    placeholder="VD: Công ty TNHH Thiết bị Văn phòng..."
                    value={form.contractInfo.partnerName || ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        contractInfo: { ...prev.contractInfo, partnerName: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              {/* Danh sách tệp hợp đồng */}
              {(form.contractInfo.files || []).length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                  Chưa có tệp văn bản hợp đồng đính kèm. Kế toán có thể bấm "Tải thêm tệp hợp đồng" ở trên nếu có bản scan hợp đồng kinh tế.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.65rem' }}>
                  {(form.contractInfo.files || []).map((file, cIdx) => (
                    <div
                      key={cIdx}
                      style={{
                        padding: '0.6rem 0.85rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                        <FileCheck size={15} color="var(--success)" />
                        <span style={{ fontSize: '0.775rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }} title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => handlePreviewFile(file, form.contractInfo.files, cIdx)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '0.25rem', color: 'var(--success)' }}
                          title="Xem hợp đồng"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveContractFile(cIdx)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)', padding: '0.25rem' }}
                          title="Xóa"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* [LUỒNG MỚI] 4. HÓA ĐƠN VAT / CHỨNG TỪ BÊN THU MUA CUNG CẤP */}
            <div style={{ marginTop: '1.75rem', padding: '1.25rem', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Receipt size={17} color="#f59e0b" />
                  <h4 style={{ fontSize: '0.95rem', color: '#ffffff', fontWeight: 600 }}>
                    4. Hóa Đơn VAT / Chứng Từ Thu Mua ({(form.invoiceInfo.files || []).length} tệp)
                  </h4>
                </div>
                <label
                  className={`btn btn-secondary btn-sm ${invoiceUploading ? 'disabled' : ''}`}
                  style={{ cursor: invoiceUploading ? 'not-allowed' : 'pointer', fontSize: '0.75rem', gap: '0.35rem' }}
                >
                  {invoiceUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                  <span>{invoiceUploading ? 'Đang tải lên...' : 'Tải thêm hóa đơn'}</span>
                  <input
                    type="file"
                    multiple
                    disabled={invoiceUploading}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc"
                    style={{ display: 'none' }}
                    onChange={handleInvoiceUpload}
                  />
                </label>
              </div>

              {/* Thông tin số hóa đơn & ngày hóa đơn */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '0.85rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Số Hóa Đơn VAT:</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.825rem' }}
                    placeholder="VD: HD-001289"
                    value={form.invoiceInfo.invoiceNumber || ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        invoiceInfo: { ...prev.invoiceInfo, invoiceNumber: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Ngày Lập Hóa Đơn:</label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ fontSize: '0.825rem' }}
                    value={form.invoiceInfo.invoiceDate || ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        invoiceInfo: { ...prev.invoiceInfo, invoiceDate: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>

              {/* Danh sách tệp hóa đơn do Thu mua tải lên */}
              {(form.invoiceInfo.files || []).length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                  Chưa có tệp hóa đơn VAT từ bên Thu mua. Kế toán có thể bấm "Tải thêm hóa đơn" ở trên nếu đối tác gửi bổ sung hóa đơn điện tử.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.65rem' }}>
                  {(form.invoiceInfo.files || []).map((file, iIdx) => (
                    <div
                      key={iIdx}
                      style={{
                        padding: '0.6rem 0.85rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                        <Receipt size={15} color="#f59e0b" />
                        <span style={{ fontSize: '0.775rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }} title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => handlePreviewFile(file, form.invoiceInfo.files, iIdx)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '0.25rem', color: '#f59e0b' }}
                          title="Xem hóa đơn"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveInvoiceFile(iIdx)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)', padding: '0.25rem' }}
                          title="Xóa"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BƯỚC 3: Thông tin thanh toán */}
        <div className="card" style={{ marginBottom: '1.75rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 800,
              }}
            >
              3
            </div>
            <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Thông Tin Thanh Toán</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {/* Số tiền thanh toán */}
            <div>
              <label className="form-label">
                Số Tiền Thanh Toán (VNĐ) <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                className="form-input font-mono"
                placeholder="0"
                value={form.amount || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
              />
              {selectedProposal && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.5 }}>
                  {isSelectedAdvanced && advanceAmount > 0 ? (
                    <div>
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                        Đã tạm ứng trước: {formatCurrency(advanceAmount)}.
                      </span>{' '}
                      Số tiền còn thiếu thực tế: <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{formatCurrency(remainingAfterAdvance)}</span>
                      {' '}(Tối đa khả dụng theo đơn: {formatCurrency(remainingAmount)})
                    </div>
                  ) : (
                    <div>
                      Số tiền còn lại khả dụng: <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{formatCurrency(remainingAmount)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Phương thức thanh toán */}
            <div>
              <label className="form-label">Phương Thức Thanh Toán</label>
              <select
                className="form-select"
                value={form.paymentMethod}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value as 'bank_transfer' | 'cash' }))}
              >
                <option value="bank_transfer">Chuyển khoản ngân hàng</option>
                <option value="cash">Tiền mặt</option>
              </select>
            </div>

            {/* Nội dung thanh toán */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">
                Nội Dung Thanh Toán <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Mô tả nội dung khoản thanh toán..."
                value={form.paymentReason}
                onChange={(e) => setForm((prev) => ({ ...prev, paymentReason: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Ghi chú đợt thanh toán */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Ghi Chú Đợt Thanh Toán</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ví dụ: Đợt 1 — Tạm ứng 50%"
                value={form.installmentNote}
                onChange={(e) => setForm((prev) => ({ ...prev, installmentNote: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* BƯỚC 4: Thông tin người thụ hưởng */}
        <div className="card" style={{ marginBottom: '1.75rem', padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                }}
              >
                4
              </div>
              <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Thông Tin Người Thụ Hưởng</h3>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleFillProcurerBeneficiary}
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.75rem', gap: '0.4rem', padding: '0.35rem 0.75rem' }}
                title="Điền thông tin tài khoản ngân hàng của bên Thu mua thực hiện mua sắm"
              >
                <UserIcon size={14} />
                <span>
                  Điền theo Thu Mua (
                  {(typeof selectedProposal?.procurementExecution?.submittedBy === 'object' && selectedProposal?.procurementExecution?.submittedBy !== null
                    ? (selectedProposal.procurementExecution.submittedBy as any).fullName
                    : users.find((u) => u.role === 'thu_mua')?.fullName) || 'Bên Thu Mua'}
                  )
                </span>
              </button>

              {(selectedProposal as any)?.procurementExecution?.contractInfo?.partnerName && (
                <button
                  type="button"
                  onClick={handleFillPartnerBeneficiary}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', gap: '0.4rem', padding: '0.35rem 0.75rem' }}
                  title="Điền tên đối tác / nhà cung cấp theo hợp đồng kinh tế"
                >
                  <Building size={14} />
                  <span>
                    Điền theo Đối Tác HĐ ({(selectedProposal as any).procurementExecution.contractInfo.partnerName})
                  </span>
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              fontSize: '0.8rem',
              color: '#bae6fd',
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <Info size={17} color="var(--accent-cyan)" />
            <span>
              <strong>Quy định thanh toán:</strong> Khâu chi trả thanh toán sẽ chi trả về cho bên <strong>Thu Mua</strong> (người thực hiện mua sắm / hợp đồng), <strong>KHÔNG</strong> chi trả cho nhân viên đề xuất vật tư.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label className="form-label">
                Tên Người Nhận <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Tên cá nhân hoặc tổ chức thụ hưởng"
                value={form.beneficiary.name}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    beneficiary: { ...prev.beneficiary, name: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <label className="form-label">
                Số Tài Khoản <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                className="form-input font-mono"
                placeholder="Số tài khoản ngân hàng"
                value={form.beneficiary.accountNumber}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    beneficiary: { ...prev.beneficiary, accountNumber: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <label className="form-label">
                Ngân Hàng <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Tên ngân hàng (VD: Vietcombank)"
                value={form.beneficiary.bankName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    beneficiary: { ...prev.beneficiary, bankName: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <label className="form-label">Chi Nhánh</label>
              <input
                type="text"
                className="form-input"
                placeholder="Chi nhánh ngân hàng (không bắt buộc)"
                value={form.beneficiary.branch}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    beneficiary: { ...prev.beneficiary, branch: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        </div>

        {/* BƯỚC 5: Đính kèm chứng từ */}
        <div className="card" style={{ marginBottom: '1.75rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 800,
              }}
            >
              5
            </div>
            <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Đính Kèm Chứng Từ Khác</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Hóa đơn đỏ, chứng từ bổ sung - Không bắt buộc)</span>
          </div>

          <div
            style={{
              padding: '1.5rem',
              border: '2px dashed var(--border-color)',
              borderRadius: 'var(--radius-md)',
              textAlign: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'var(--transition)',
            }}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
              }}
            />
            {fileUploading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                <Loader2 size={20} className="animate-spin" />
                <span style={{ fontSize: '0.875rem' }}>Đang tải tệp lên...</span>
              </div>
            ) : (
              <>
                <UploadCloud size={28} color="var(--text-muted)" />
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  Kéo thả hoặc bấm để tải lên hóa đơn, bảng tính, chứng từ
                </div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  PDF, DOC, XLS, JPG, PNG — Tối đa 15MB / tệp
                </div>
              </>
            )}
          </div>

          {form.attachments.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {form.attachments.map((file, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0.85rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Paperclip size={14} color="var(--primary)" />
                    <span style={{ fontSize: '0.825rem', fontWeight: 500 }}>{file.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => handlePreviewFile(file, form.attachments, idx)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--accent-cyan)', padding: '0.25rem' }}
                      title="Xem trước chứng từ"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)', padding: '0.25rem' }}
                      title="Xóa tệp"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Thanh tổng kết và nút gửi */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          {/* Hướng dẫn quy trình */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Info size={18} color="var(--primary)" />
              <h4 style={{ fontSize: '0.95rem', color: '#ffffff' }}>Luồng Phê Duyệt Chi</h4>
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Sau khi gửi, đề xuất thanh toán sẽ được chuyển:
              <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={13} color="var(--warning)" />
                  <span>Giám đốc / Chủ tịch <strong>xác nhận giải ngân</strong> (tùy theo mức tiền)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={13} color="var(--accent-cyan)" />
                  <span>Kế toán <strong>duyệt chi</strong> và chuyển tiền</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tổng tiền thanh toán */}
          <div
            className="card"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.06) 100%)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Số Tiền Đề Xuất Thanh Toán
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  marginTop: '0.25rem',
                }}
                className="font-mono"
              >
                {formatCurrency(form.amount)}
              </div>
              {selectedProposal && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Đơn gốc: {selectedProposal.proposalCode} • Phương thức: {form.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <Link to="/payment" className="btn btn-secondary">
                Hủy Bỏ
              </Link>
              <button
                type="submit"
                disabled={submitting || !selectedProposal || form.amount <= 0}
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.5rem' }}
              >
                <Save size={16} />
                <span>{submitting ? 'Đang gửi...' : 'Gửi Đề Xuất Lên Sếp Xác Nhận Giải Ngân'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* MODAL XEM TRƯỚC VÀ KIỂM TRA CHỨNG TỪ (HÓA ĐƠN / HỢP ĐỒNG / BÁO GIÁ) */}
      <FilePreviewModal
        isOpen={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        file={previewAttachment}
        files={previewFileList}
        initialIndex={previewFileIndex}
        title="Kiểm Tra Chứng Từ Hóa Đơn / Hợp Đồng"
      />
    </div>
  );
};
