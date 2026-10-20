import React from 'react';
import { Link } from 'react-router-dom';
import { PaymentProposal } from '../models';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  Receipt,
  Printer,
  ExternalLink,
  CreditCard,
  FileText,
  Eye,
  CheckCircle2,
} from 'lucide-react';

export interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentProposal | any | null;
  onPrint: (payment: any) => void;
  onPreviewFile?: (file: { name: string; url: string; type?: string }) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  isOpen,
  onClose,
  payment,
  onPrint,
  onPreviewFile,
}) => {
  if (!payment) return null;

  const txnCode = (payment as any).transactionCode || payment.disbursementInfo?.transactionCode;

  // Tổng hợp tất cả tệp hóa đơn, hợp đồng và minh chứng đính kèm
  const allFiles: Array<{ name: string; url: string; type?: string; tag?: string }> = [];

  if (payment.attachments && payment.attachments.length > 0) {
    payment.attachments.forEach((f: any) =>
      allFiles.push({ ...f, tag: 'Chứng từ đính kèm' })
    );
  }
  if (payment.invoiceInfo?.files && payment.invoiceInfo.files.length > 0) {
    payment.invoiceInfo.files.forEach((f: any) =>
      allFiles.push({ ...f, tag: 'Hóa đơn VAT' })
    );
  }
  if (payment.contractInfo?.files && payment.contractInfo.files.length > 0) {
    payment.contractInfo.files.forEach((f: any) =>
      allFiles.push({ ...f, tag: 'Hợp đồng kinh tế' })
    );
  }

  const purchaseProposalCode =
    typeof payment.purchaseProposal === 'object' && payment.purchaseProposal && 'proposalCode' in payment.purchaseProposal
      ? (payment.purchaseProposal as any).proposalCode
      : typeof payment.purchaseProposal === 'string'
      ? payment.purchaseProposal
      : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Receipt size={18} />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
              Chi Tiết Hóa Đơn / Đề Xuất Thanh Toán
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} className="font-mono">
              Mã: {payment.proposalCode || (payment._id ? `TT-${payment._id.slice(-6).toUpperCase()}` : '—')}
            </div>
          </div>
        </div>
      }
      maxWidth="780px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Khối nổi bật: Số tiền & Trạng thái */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.06) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Số Tiền Đề Nghị Thanh Toán
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '0.2rem' }} className="font-mono">
              {formatCurrency(payment.amount)}
            </div>
            {payment.amountInWords && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.15rem' }}>
                ({payment.amountInWords})
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
            <StatusBadge status={payment.status} type="payment" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Đợt: <strong>{payment.installmentNote || 'Thanh toán trọn gói'}</strong>
            </span>
          </div>
        </div>

        {/* Thông tin tài khoản thụ hưởng & Phương thức thanh toán */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Cột 1: Người thụ hưởng */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.65rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
              <CreditCard size={15} color="var(--primary)" />
              <span>THÔNG TIN THỤ HƯỞNG</span>
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.35rem' }}>
              {payment.beneficiary?.name || '—'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div>Số TK: <strong className="font-mono" style={{ color: '#ffffff' }}>{payment.beneficiary?.accountNumber || '—'}</strong></div>
              <div>Ngân hàng: <strong>{payment.beneficiary?.bankName || '—'}</strong></div>
              {payment.beneficiary?.branch && <div>Chi nhánh: {payment.beneficiary.branch}</div>}
              <div style={{ marginTop: '0.35rem' }}>
                Hình thức: <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{payment.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'}</span>
              </div>
            </div>
          </div>

          {/* Cột 2: Lý do chi & Đơn liên kết */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.65rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
              <FileText size={15} color="var(--accent-cyan)" />
              <span>NỘI DUNG THANH TOÁN</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#ffffff', lineHeight: 1.5, marginBottom: '0.65rem' }}>
              {payment.paymentReason || 'Thanh toán kinh phí mua sắm theo hợp đồng/hóa đơn.'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div>
                Đơn mua sắm gốc:{' '}
                {purchaseProposalCode ? (
                  <strong className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
                    {purchaseProposalCode}
                  </strong>
                ) : (
                  '—'
                )}
              </div>
              <div>
                Người đề xuất: <strong>{payment.creator?.fullName || 'Kế toán'}</strong> ({formatDate(payment.createdAt)})
              </div>
            </div>
          </div>
        </div>

        {/* Thông tin hóa đơn VAT / Hợp đồng kinh tế nếu có */}
        {(payment.invoiceInfo?.invoiceNumber || payment.contractInfo?.contractNumber) && (
          <div
            style={{
              padding: '0.9rem 1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
              fontSize: '0.8rem',
            }}
          >
            {payment.invoiceInfo?.invoiceNumber && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Số Hóa Đơn VAT: </span>
                <strong style={{ color: '#ffffff' }}>{payment.invoiceInfo.invoiceNumber}</strong>
                {payment.invoiceInfo.invoiceDate && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                    ({formatDate(payment.invoiceInfo.invoiceDate)})
                  </span>
                )}
              </div>
            )}
            {payment.contractInfo?.contractNumber && (
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Số Hợp Đồng: </span>
                <strong style={{ color: '#ffffff' }}>{payment.contractInfo.contractNumber}</strong>
                {payment.contractInfo.partnerName && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                    ({payment.contractInfo.partnerName})
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Danh sách tệp / ảnh chứng từ hóa đơn đính kèm */}
        {allFiles.length > 0 && (
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Eye size={14} color="var(--primary)" />
              <span>Hồ sơ & Ảnh chứng từ hóa đơn ({allFiles.length}):</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.65rem' }}>
              {allFiles.map((file, fIdx) => {
                const isImg = file.type?.includes('image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name || file.url);
                return (
                  <div
                    key={fIdx}
                    onClick={() => onPreviewFile && onPreviewFile(file)}
                    style={{
                      padding: '0.6rem 0.75rem',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      cursor: onPreviewFile ? 'pointer' : 'default',
                      transition: 'var(--transition)',
                    }}
                    title="Bấm để xem tệp phóng to"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                      <FileText size={15} color={isImg ? '#10b981' : 'var(--primary)'} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '0.775rem', fontWeight: 600, color: '#ffffff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                          {file.name}
                        </div>
                        {file.tag && (
                          <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
                            {file.tag}
                          </div>
                        )}
                      </div>
                    </div>
                    {onPreviewFile && (
                      <span className="btn btn-ghost btn-sm" style={{ padding: '0.2rem', color: 'var(--accent-cyan)' }}>
                        <Eye size={13} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Thông tin giải ngân nếu đã hoàn tất */}
        {txnCode && (
          <div
            style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} color="var(--success)" />
              <span style={{ fontSize: '0.8rem', color: '#6ee7b7' }}>
                Đã giải ngân chuyển tiền thành công
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#ffffff' }}>
              Mã GD / UNC: <strong className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{txnCode}</strong>
            </div>
          </div>
        )}

        {/* [DƯỚI CÙNG] CÁC NÚT HÀNH ĐỘNG - NÚT IN THÔNG TIN Ở DƯỚI CÙNG */}
        <div
          className="modal-footer"
          style={{
            margin: '0.75rem -1.65rem -1.65rem -1.65rem',
            padding: '1rem 1.65rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            {/* NÚT IN THÔNG TIN DƯỚI CÙNG THEO YÊU CẦU */}
            <button
              type="button"
              onClick={() => onPrint(payment)}
              className="btn btn-primary"
              style={{
                gap: '0.45rem',
                padding: '0.55rem 1.25rem',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
              }}
              title="In phiếu đề nghị thanh toán / hóa đơn dạng PDF"
            >
              <Printer size={16} />
              <span>In Thông Tin (PDF)</span>
            </button>

            {/* Nút liên kết tới trang xử lý chi tiết nếu cần thao tác sâu */}
            <Link
              to={`/payment/${payment._id}`}
              className="btn btn-secondary"
              style={{ gap: '0.4rem', padding: '0.55rem 1rem', fontSize: '0.825rem' }}
            >
              <ExternalLink size={14} />
              <span>Mở Trang Chi Tiết & Xử Lý</span>
            </Link>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '0.55rem 1.15rem' }}
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
