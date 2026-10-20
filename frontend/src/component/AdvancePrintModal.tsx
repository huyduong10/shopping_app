import React, { useRef, useState } from 'react';
import { AdvanceProposal } from '../models';
import {
  formatCurrency,
  formatDate,
  formatDateToVietnameseLong,
  getRoleLabel,
  numberToVietnameseWords,
} from '../utils/formatters';
import { Printer, X, ZoomIn, ZoomOut } from 'lucide-react';

interface AdvancePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: AdvanceProposal | null;
}

export const AdvancePrintModal: React.FC<AdvancePrintModalProps> = ({
  isOpen,
  onClose,
  proposal,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(100);

  if (!isOpen || !proposal) return null;

  // Tìm người phê duyệt cuối cùng đã duyệt
  const approvedStep = [...(proposal.approvalFlow || [])]
    .reverse()
    .find((step) => step.status === 'approved' && step.approver);

  const isOverTenMillion = Number(proposal.totalAmount || 0) > 10000000;
  const approverName = (approvedStep?.approver as any)?.fullName || '';
  const approverRole = approvedStep?.role
    ? getRoleLabel(approvedStep.role)
    : (isOverTenMillion ? 'Chủ Tịch Phê Duyệt' : 'Giám Đốc Phê Duyệt');
  const approverDate = approvedStep?.date
    ? formatDateToVietnameseLong(approvedStep.date)
    : 'Ngày ..... tháng ..... năm 20....';

  const creatorDate = formatDateToVietnameseLong(proposal.createdAt);
  const words = numberToVietnameseWords(proposal.totalAmount);

  const handlePrint = () => {
    if (!printAreaRef.current) return;
    const content = printAreaRef.current.innerHTML;

    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) {
      alert('Vui lòng cho phép mở popup để xem bản in!');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Giấy Đề Nghị Tạm Ứng - ${proposal.proposalCode}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 20mm 15mm 20mm 25mm; /* Căn lề chuẩn văn bản: Top 20mm, Right 15mm, Bottom 20mm, Left 25mm */
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000000 !important;
              background-color: #ffffff !important;
              font-size: 13pt;
              line-height: 1.45;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-page {
              width: 100%;
              margin: 0 auto;
              background-color: #ffffff !important;
            }
          </style>
        </head>
        <body>
          <div class="print-page">
            ${content}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 600);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200, padding: '1.5rem' }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '920px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(30, 41, 59, 0.5)',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.1rem', color: '#ffffff', fontWeight: 700, margin: 0 }}>
              Xem Trước Bản In / Xuất PDF
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Đơn đề xuất tạm ứng — Mã: {proposal.proposalCode}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Bộ điều khiển thu phóng (Zoom) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(60, prev - 10))}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.25rem 0.4rem', color: '#ffffff' }}
                title="Thu nhỏ"
              >
                <ZoomOut size={15} />
              </button>
              <span style={{ fontSize: '0.8rem', minWidth: '40px', textAlign: 'center', fontWeight: 600, color: '#ffffff' }}>
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(140, prev + 10))}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.25rem 0.4rem', color: '#ffffff' }}
                title="Phóng to"
              >
                <ZoomIn size={15} />
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary"
              style={{ gap: '0.45rem', padding: '0.5rem 1.25rem', fontWeight: 600 }}
            >
              <Printer size={16} />
              <span>In / Lưu PDF</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ padding: '0.45rem', color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '2rem 1.5rem 3rem 1.5rem',
            backgroundColor: '#0b1120',
            display: 'block',
          }}
        >
          <div
            ref={printAreaRef}
            style={{
              width: '100%',
              maxWidth: '794px',
              minHeight: '1123px',
              backgroundColor: '#ffffff',
              color: '#000000',
              padding: '65px 60px 85px 60px',
              margin: '0 auto',
              boxShadow: '0 15px 45px rgba(0, 0, 0, 0.75)',
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: '12pt',
              lineHeight: 1.5,
              boxSizing: 'border-box',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease',
            }}
          >
            {/* Header */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px' }}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: 'top', width: '52%', border: 'none', padding: 0 }}>
                    <div style={{ fontSize: '10.5pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      CÔNG TY CỔ PHẦN CÔNG NGHỆ & ĐẦU TƯ PROFLOW
                    </div>
                    <div style={{ fontSize: '10.5pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      PHÒNG BAN: {proposal.department?.name || 'VẬN HÀNH'}
                    </div>
                    <div style={{ fontSize: '10pt', marginTop: '4px' }}>
                      Số: <strong style={{ fontFamily: 'monospace' }}>{proposal.proposalCode}</strong>
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'top', width: '48%', textAlign: 'center', border: 'none', padding: 0 }}>
                    <div style={{ fontSize: '10.5pt', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </div>
                    <div style={{ fontSize: '10.5pt', fontWeight: 'bold' }}>
                      Độc lập - Tự do - Hạnh phúc
                    </div>
                    <div
                      style={{
                        width: '120px',
                        height: '1px',
                        backgroundColor: '#000',
                        margin: '4px auto 8px auto',
                      }}
                    />
                    <div style={{ fontSize: '10.5pt', fontStyle: 'italic' }}>
                      Hà Nội, {creatorDate}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Tiêu đề */}
            <div
              style={{
                textAlign: 'center',
                fontSize: '15.5pt',
                fontWeight: 'bold',
                margin: '22px 0 4px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              GIẤY ĐỀ NGHỊ TẠM ỨNG
            </div>
            <div style={{ textAlign: 'center', fontSize: '10.5pt', fontStyle: 'italic', marginBottom: '22px' }}>
              (V/v: Tạm ứng kinh phí công tác, mua sắm phục vụ công việc)
            </div>

            {/* Nội dung */}
            <div style={{ marginBottom: '16px', lineHeight: 1.8, fontSize: '11pt' }}>
              <div>
                <strong>Kính gửi:</strong> Ban Giám Đốc, Phòng Kế toán - Tài chính
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ minWidth: '170px' }}><strong>Người đề nghị:</strong></span>
                <span>{proposal.creator?.fullName || '—'} (Chức vụ: {getRoleLabel(proposal.creator?.role)})</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ minWidth: '170px' }}><strong>Bộ phận / Phòng ban:</strong></span>
                <span>{proposal.department?.name || '—'}</span>
              </div>
              <div style={{ display: 'flex' }}>
                <span style={{ minWidth: '170px' }}><strong>Tài khoản nhận tiền:</strong></span>
                <span>
                  {proposal.bankAccount?.accountNumber ? (
                    <>STK: <strong>{proposal.bankAccount.accountNumber}</strong> tại <strong>{proposal.bankAccount.bankName}</strong></>
                  ) : (
                    'Tiền mặt'
                  )}
                </span>
              </div>
            </div>

            {/* Bảng danh mục tạm ứng */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                margin: '16px 0',
                fontSize: '10.5pt',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f2f2f2' }}>
                  <th style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', width: '45px' }}>STT</th>
                  <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left' }}>Mục Đích Tạm Ứng Chi Tiết</th>
                  <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', width: '180px' }}>Số Tiền (VNĐ)</th>
                </tr>
              </thead>
              <tbody>
                {proposal.items && proposal.items.length > 0 ? (
                  proposal.items.map((item, index) => (
                    <tr key={index}>
                      <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center' }}>
                        {item.stt || index + 1}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px 8px', fontWeight: 500 }}>
                        {item.mucDich}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>
                        {formatCurrency(item.soTien)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} style={{ border: '1px solid #000', padding: '12px', textAlign: 'center' }}>
                      Chưa có mục tạm ứng nào.
                    </td>
                  </tr>
                )}

                <tr style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                  <td colSpan={2} style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right' }}>
                    TỔNG CỘNG TIỀN TẠM ỨNG:
                  </td>
                  <td style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'right', fontSize: '11.5pt' }}>
                    {formatCurrency(proposal.totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ margin: '10px 0 25px 0', fontSize: '11pt', fontStyle: 'italic' }}>
              <strong>Bằng chữ:</strong> {words}
            </div>

            {/* PHẦN KÝ */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '35px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top', textAlign: 'center', border: 'none', padding: '0 10px' }}>
                    <div style={{ fontSize: '11pt', fontStyle: 'italic', marginBottom: '6px' }}>
                      Hà Nội, {creatorDate}
                    </div>
                    <div style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
                      NGƯỜI ĐỀ NGHỊ TẠM ỨNG
                    </div>
                    <div style={{ fontSize: '10pt', fontStyle: 'italic', color: '#555', marginBottom: '70px' }}>
                      (Ký và ghi rõ họ tên)
                    </div>
                    <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>
                      {proposal.creator?.fullName || 'Người đề xuất'}
                    </div>
                    <div style={{ fontSize: '10.5pt', fontStyle: 'italic', color: '#444' }}>
                      {getRoleLabel(proposal.creator?.role)}
                    </div>
                  </td>

                  <td style={{ width: '50%', verticalAlign: 'top', textAlign: 'center', border: 'none', padding: '0 10px' }}>
                    <div style={{ fontSize: '11pt', fontStyle: 'italic', marginBottom: '6px' }}>
                      Hà Nội, {approverDate}
                    </div>
                    <div style={{ fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
                      NGƯỜI PHÊ DUYỆT
                    </div>
                    <div style={{ fontSize: '10pt', fontStyle: 'italic', color: '#555', marginBottom: '70px' }}>
                      (Ký và ghi rõ họ tên)
                    </div>
                    <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>
                      {approverName || '(Chưa ký duyệt)'}
                    </div>
                    <div style={{ fontSize: '10.5pt', fontStyle: 'italic', color: '#444' }}>
                      {approverRole}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
