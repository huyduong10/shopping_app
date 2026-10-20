import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { purchaseProposalService, advanceProposalService, paymentProposalService } from '../../services';
import { PurchaseProposal, AdvanceProposal, PaymentProposal } from '../../models';
import { StatusBadge } from '../../component';
import { formatCurrency, formatDate, getRoleLabel } from '../../utils/formatters';
import {
  CheckCircle2,
  ShoppingCart,
  Banknote,
  Eye,
  Loader2,
  Inbox,
  CreditCard,
} from 'lucide-react';

export const ApprovalPage: React.FC = () => {
  const { user } = useAuth();
  const [purchaseList, setPurchaseList] = useState<PurchaseProposal[]>([]);
  const [advanceList, setAdvanceList] = useState<AdvanceProposal[]>([]);
  const [paymentList, setPaymentList] = useState<PaymentProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'purchase' | 'advance' | 'payment'>('all');

  const fetchPendingProposals = useCallback(async () => {
    setLoading(true);
    try {
      const [purchases, advances, payments] = await Promise.all([
        purchaseProposalService.getAll(),
        advanceProposalService.getAll(),
        paymentProposalService.getAll(),
      ]);

      const myPurchases = purchases.filter((p) => {
        // Nếu đơn đã hoàn thành hoặc hóa đơn đã hoàn thành thì không hiển thị trong hộp thư cần duyệt
        if (p.status === 'completed' || p.isInvoiceCompleted) return false;

        const totalAmount = (p.totalActualAmount && p.totalActualAmount > 0)
          ? p.totalActualAmount
          : (p.totalEstimatedAmount || 0);
        const isOverTenMillion = totalAmount > 10000000;
        const isPendingLeaderApproval = ['pending_director_approval', 'pending_chairman_approval', 'pending_final_approval'].includes(p.status);

        // [QUY TRÌNH 1]: Thu mua nộp 3-4 báo giá trình Giám đốc/Chủ tịch duyệt mua
        if (isPendingLeaderApproval) {
          if (isOverTenMillion) {
            if (user?.role === 'chu_tich') return true;
            if (user?.role === 'giam_doc') return false;
          } else {
            if (user?.role === 'giam_doc' || user?.role === 'chu_tich') return true;
          }
        }

        // [QUY TRÌNH 1]: Kế toán tiếp nhận hóa đơn / hợp đồng từ Thu mua để lập Đề xuất thanh toán
        if (user?.role === 'ke_toan') {
          return p.status === 'pending_accounting' || p.status === 'accounting_review';
        }

        // [QUY TRÌNH 2]: Khi đơn đã chuyển sang khâu lập đề xuất thanh toán hoặc giải ngân (pending_payment_approval, disbursing),
        // khâu này đã được chuyển riêng vào danh mục Đề Xuất Thanh Toán (tab Thanh Toán), KHÔNG lặp lại ở tab Mua Sắm
        if (['pending_payment_approval', 'disbursing'].includes(p.status)) {
          return false;
        }

        if (p.currentApprovalRole === user?.role) return true;
        return false;
      });

      const myAdvances = advances.filter((a) => {
        const totalAmount =
          a.totalAmount ||
          (a.items ? a.items.reduce((s: number, i: any) => s + (Number(i.soTien) || 0), 0) : 0);
        const isOverTenMillion = totalAmount > 10000000;

        // [LUỒNG MỚI] Đơn tạm ứng <= 10 triệu do Sếp (Giám đốc) duyệt
        if (user?.role === 'giam_doc') {
          if (a.status === 'pending_director') {
            return !isOverTenMillion;
          }
          return false;
        }

        // [LUỒNG MỚI] Đơn tạm ứng > 10 triệu do Chủ tịch duyệt
        if (user?.role === 'chu_tich') {
          if (a.status === 'pending_chairman') return true;
          if (a.status === 'pending_director' && isOverTenMillion) return true;
          return a.currentApprovalRole === 'chu_tich';
        }

        // Kế toán: giải ngân hoặc hoàn ứng
        if (user?.role === 'ke_toan') {
          return (
            a.currentApprovalRole === 'ke_toan' ||
            ['pending_accounting', 'accounting_approved', 'disbursing', 'settlement_submitted'].includes(a.status)
          );
        }

        if (a.currentApprovalRole === user?.role) return true;
        if (a.currentApprovalRole === 'creator' && a.creator?._id === user?._id) return true;
        return false;
      });

      const myPayments = payments.filter((pay) => {
        if (user?.role === 'giam_doc') return pay.status === 'pending_director';
        if (user?.role === 'chu_tich') return pay.status === 'pending_chairman' || pay.status === 'pending_director';
        if (user?.role === 'ke_toan') return pay.status === 'pending_disbursement';
        return false;
      });

      setPurchaseList(myPurchases);
      setAdvanceList(myAdvances);
      setPaymentList(myPayments);
    } catch (err) {
      console.error('Lỗi khi tải danh sách đề xuất cần duyệt:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPendingProposals();
  }, [fetchPendingProposals]);

  const totalPending = purchaseList.length + advanceList.length + paymentList.length;

  return (
    <div>
      {/* Tiêu đề trang */}
      <div className="page-header">
        <div className="page-header-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--warning)',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <h1>Danh Sách Đề Xuất Cần Tôi Duyệt</h1>
          </div>
          <p style={{ fontSize: '0.875rem' }}>
            Hộp thư các đề xuất mua sắm & tạm ứng đang chờ xử lý theo vai trò{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{getRoleLabel(user?.role)}</strong> của bạn.
          </p>
        </div>
      </div>

      {/* Các tab phân loại đề xuất */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <button
          className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('all')}
          style={{ fontSize: '0.825rem' }}
        >
          <span>Tất Cả ({totalPending})</span>
        </button>
        <button
          className={`btn ${activeTab === 'purchase' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('purchase')}
          style={{ fontSize: '0.825rem' }}
        >
          <ShoppingCart size={15} />
          <span>Mua Sắm ({purchaseList.length})</span>
        </button>
        {user && ['thu_mua', 'ke_toan', 'giam_doc', 'chu_tich', 'admin'].includes(user.role) && (
          <button
            className={`btn ${activeTab === 'advance' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('advance')}
            style={{ fontSize: '0.825rem' }}
          >
            <Banknote size={15} />
            <span>Tạm Ứng ({advanceList.length})</span>
          </button>
        )}
        {user && ['ke_toan', 'giam_doc', 'chu_tich', 'admin'].includes(user.role) && (
          <button
            className={`btn ${activeTab === 'payment' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('payment')}
            style={{ fontSize: '0.825rem' }}
          >
            <CreditCard size={15} />
            <span>Thanh Toán ({paymentList.length})</span>
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
          <Loader2 size={36} className="animate-spin" color="var(--primary)" />
        </div>
      ) : totalPending === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
            <Inbox size={28} />
          </div>
          <h3 style={{ color: '#ffffff' }}>Tuyệt vời! Bạn không có đề xuất nào đang chờ xử lý</h3>
          <p style={{ fontSize: '0.85rem' }}>
            Toàn bộ đề xuất liên quan đến vai trò "{getRoleLabel(user?.role)}" đã được xử lý xong.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Danh sách đề xuất mua sắm chờ duyệt */}
          {(activeTab === 'all' || activeTab === 'purchase') && purchaseList.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <ShoppingCart size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Đề Xuất Mua Sắm Chờ Duyệt ({purchaseList.length})</h3>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mã Đơn</th>
                      <th>Người Tạo</th>
                      <th>Phòng Ban</th>
                      <th>Dự Toán</th>
                      <th>Trạng Thái Hiện Tại</th>
                      <th>Ngày Tạo</th>
                      <th style={{ textAlign: 'right' }}>Hành Động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseList.map((p) => (
                      <tr key={p._id}>
                        <td>
                          <Link to={`/purchase/${p._id}`} style={{ fontWeight: 700 }} className="font-mono">
                            {p.proposalCode}
                          </Link>
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.creator?.fullName}</td>
                        <td>{p.department?.name}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }} className="font-mono">
                          {formatCurrency((p.totalActualAmount && p.totalActualAmount > 0) ? p.totalActualAmount : p.totalEstimatedAmount)}
                        </td>
                        <td>
                          <StatusBadge status={p.status} type="purchase" />
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {formatDate(p.createdAt)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link to={`/purchase/${p._id}`} className="btn btn-warning btn-sm">
                            <Eye size={14} />
                            <span>Xử lý ngay</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Danh sách đề xuất thanh toán chờ duyệt / giải ngân */}
          {(activeTab === 'all' || activeTab === 'payment') && paymentList.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <CreditCard size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Đề Xuất Thanh Toán Chờ Xử Lý ({paymentList.length})</h3>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mã Đơn</th>
                      <th>Đơn Mua Sắm Gắn Kèm</th>
                      <th>Người Thụ Hưởng</th>
                      <th>Số Tiền</th>
                      <th>Cấp Phê Duyệt</th>
                      <th>Trạng Thái</th>
                      <th style={{ textAlign: 'right' }}>Hành Động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentList.map((pay) => {
                      const purchaseObj =
                        typeof pay.purchaseProposal === 'object' && pay.purchaseProposal !== null
                          ? pay.purchaseProposal
                          : null;
                      const purchaseId = purchaseObj ? (purchaseObj as any)._id : String(pay.purchaseProposal || '');
                      const purchaseCode = purchaseObj ? (purchaseObj as any).proposalCode : 'Đơn mua sắm';

                      return (
                        <tr key={pay._id}>
                          <td>
                            <Link to={`/payment/${pay._id}`} style={{ fontWeight: 700 }} className="font-mono">
                              {pay.proposalCode || `TT-${pay._id.slice(-6).toUpperCase()}`}
                            </Link>
                          </td>
                          <td>
                            {purchaseId ? (
                              <Link to={`/purchase/${purchaseId}`} className="font-mono" style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>
                                {purchaseCode}
                              </Link>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 600 }}>{pay.beneficiary?.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {pay.beneficiary?.bankName} - {pay.beneficiary?.accountNumber}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }} className="font-mono">
                            {formatCurrency(pay.amount)}
                          </td>
                          <td>
                            {pay.amount <= 10000000 ? (
                              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                ≤ 10tr (GĐ giải ngân)
                              </span>
                            ) : (
                              <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                                &gt; 10tr (Chủ tịch giải ngân)
                              </span>
                            )}
                          </td>
                          <td>
                            <StatusBadge status={pay.status} type="payment" />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Link to={`/payment/${pay._id}`} className="btn btn-warning btn-sm">
                              <Eye size={14} />
                              <span>{pay.status === 'pending_disbursement' ? 'Duyệt chi' : 'Xác nhận giải ngân'}</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Danh sách đề xuất tạm ứng chờ phê duyệt */}
          {(activeTab === 'all' || activeTab === 'advance') && advanceList.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Banknote size={18} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Đề Xuất Tạm Ứng Chờ Xử Lý ({advanceList.length})</h3>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mã Đơn</th>
                      <th>Người Nhận Tạm Ứng</th>
                      <th>Mục Đích</th>
                      <th>Số Tiền</th>
                      <th>Cấp Phê Duyệt</th>
                      <th>Trạng Thái</th>
                      <th>Ngày Tạo</th>
                      <th style={{ textAlign: 'right' }}>Hành Động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advanceList.map((a) => (
                      <tr key={a._id}>
                        <td>
                          <Link to={`/advance/${a._id}`} style={{ fontWeight: 700 }} className="font-mono">
                            {a.proposalCode}
                          </Link>
                        </td>
                        <td style={{ fontWeight: 600 }}>{a.creator?.fullName}</td>
                        <td style={{ fontSize: '0.85rem' }}>{a.items?.[0]?.mucDich || '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }} className="font-mono">
                          {formatCurrency(a.totalAmount)}
                        </td>
                        <td>
                          {(a.totalAmount || 0) <= 10000000 ? (
                            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                              ≤ 10tr (Sếp/GĐ)
                            </span>
                          ) : (
                            <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                              &gt; 10tr (Chủ tịch)
                            </span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={a.status} type="advance" />
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {formatDate(a.createdAt)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link to={`/advance/${a._id}`} className="btn btn-warning btn-sm">
                            <Eye size={14} />
                            <span>Xử lý ngay</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
