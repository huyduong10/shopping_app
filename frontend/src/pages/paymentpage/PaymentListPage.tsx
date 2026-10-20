import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { paymentProposalService } from '../../services';
import { PaymentProposal } from '../../models';
import { StatusBadge, PaymentPrintModal, InvoiceDetailModal, Pagination } from '../../component';
import { formatCurrency, formatDate, getRoleLabel } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import {
  CreditCard,
  PlusCircle,
  Search,
  Filter,
  Eye,
  Loader2,
  FileQuestion,
  ShieldCheck,
  DollarSign,
  CheckCircle2,
  Clock,
  Printer,
} from 'lucide-react';

export const PaymentListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<PaymentProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [printProposal, setPrintProposal] = useState<PaymentProposal | null>(null);
  // [MỚI] Xem nhanh chi tiết hóa đơn khi bấm vào dòng
  const [viewingPayment, setViewingPayment] = useState<PaymentProposal | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Cho phép Kế toán, Giám đốc, Chủ tịch truy cập danh sách đề xuất thanh toán
  useEffect(() => {
    if (user && !['ke_toan', 'giam_doc', 'chu_tich', 'admin'].includes(user.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const data = await paymentProposalService.getAll();
      setProposals(data);
    } catch (err) {
      console.error('Error loading payment proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProposals();
  }, []);

  const filteredProposals = proposals.filter((p) => {
    const matchesSearch =
      p.proposalCode?.toLowerCase().includes(search.toLowerCase()) ||
      (typeof p.purchaseProposal === 'object' &&
        p.purchaseProposal?.proposalCode?.toLowerCase().includes(search.toLowerCase())) ||
      p.creator?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      p.beneficiary?.name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalProposals = proposals.length;
  const pendingCount = proposals.filter((p) =>
    ['pending_director', 'pending_chairman'].includes(p.status)
  ).length;
  const pendingDisbursement = proposals.filter((p) => p.status === 'pending_disbursement').length;
  const completedCount = proposals.filter((p) => p.status === 'completed').length;

  const totalAmount = proposals.reduce((sum, p) => sum + (p.amount || 0), 0);

  if (!user || !['ke_toan', 'giam_doc', 'chu_tich', 'admin'].includes(user.role)) {
    return null;
  }

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
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <CreditCard size={20} />
            </div>
            <h1>Đề Xuất Thanh Toán</h1>
          </div>
          <p style={{ fontSize: '0.875rem' }}>
            Kế toán tiếp nhận chứng từ từ Thu mua để lập đề xuất thanh toán trình Sếp xác nhận giải ngân và duyệt chi.
          </p>
        </div>

        {['ke_toan', 'admin'].includes(user.role) && (
          <div className="page-header-actions">
            <Link to="/payment/create" className="btn btn-primary">
              <PlusCircle size={17} />
              <span>Lập Đề Xuất Thanh Toán Mới</span>
            </Link>
          </div>
        )}
      </div>

      {/* Thẻ thống kê nhanh */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <CreditCard size={13} />
            Tổng Đề Xuất
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>{totalProposals}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Tổng giá trị: {formatCurrency(totalAmount)}
          </div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={13} />
            Chờ Sếp Xác Nhận Giải Ngân
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24' }}>{pendingCount}</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <DollarSign size={13} />
            Chờ Kế Toán Duyệt Chi
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>{pendingDisbursement}</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 size={13} />
            Đã Duyệt Chi & Hoàn Tất
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>{completedCount}</div>
        </div>
      </div>

      {/* Thanh tìm kiếm và bộ lọc */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px' }}
            placeholder="Tìm theo mã đề xuất, mã đơn mua sắm, người tạo, người thụ hưởng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Filter size={15} />
            <span>Trạng thái:</span>
          </div>
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '200px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending_director">Chờ Giám đốc xác nhận giải ngân</option>
            <option value="pending_chairman">Chờ Chủ tịch xác nhận giải ngân</option>
            <option value="pending_disbursement">Chờ Kế toán duyệt chi</option>
            <option value="completed">Đã duyệt chi & hoàn thành</option>
            <option value="rejected">Bị từ chối</option>
          </select>
        </div>
      </div>

      {/* Bảng danh sách đề xuất thanh toán */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader2 size={36} className="animate-spin" color="var(--primary)" />
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <FileQuestion size={28} />
          </div>
          <h3 style={{ color: '#ffffff' }}>Không tìm thấy đề xuất thanh toán nào</h3>
          <p style={{ fontSize: '0.85rem' }}>
            {search || statusFilter !== 'all'
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.'
              : 'Hãy lập đề xuất thanh toán đầu tiên cho đơn mua sắm đã được phê duyệt!'}
          </p>
          <Link to="/payment/create" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
            <PlusCircle size={15} />
            <span>Lập Đề Xuất Mới</span>
          </Link>
        </div>
      ) : (
        <div>
          <div className="table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="table" style={{ minWidth: '950px' }}>
              <thead>
                <tr>
                  <th>Mã Đề Xuất TT</th>
                  <th>Đơn Mua Sắm Gốc</th>
                  <th>Người Tạo</th>
                  <th>Người Thụ Hưởng</th>
                  <th>Phương Thức</th>
                  <th>Số Tiền</th>
                  <th>Trạng Thái</th>
                  <th>Ngày Tạo</th>
                  <th style={{ textAlign: 'right' }}>Hành Động</th>
                </tr>
              </thead>
            <tbody>
              {filteredProposals
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((p) => {
                const purchaseCode = typeof p.purchaseProposal === 'object'
                  ? p.purchaseProposal?.proposalCode
                  : '—';
                const purchaseId = typeof p.purchaseProposal === 'object'
                  ? p.purchaseProposal?._id
                  : p.purchaseProposal;

                return (
                  <tr
                    key={p._id}
                    onClick={() => setViewingPayment(p)}
                    style={{ cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                    title="Bấm vào dòng này để xem chi tiết hóa đơn & in thông tin"
                    className="table-row-clickable"
                  >
                    <td>
                      <span
                        style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}
                        className="font-mono"
                      >
                        {p.proposalCode || `TT-${p._id.slice(-6).toUpperCase()}`}
                      </span>
                    </td>
                    <td>
                      {purchaseId ? (
                        <Link
                          to={`/purchase/${purchaseId}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontWeight: 600, color: 'var(--accent-cyan)', fontSize: '0.85rem' }}
                          className="font-mono"
                        >
                          {purchaseCode}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.creator?.fullName}</div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        {getRoleLabel(p.creator?.role)}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.beneficiary?.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {p.beneficiary?.bankName} • {p.beneficiary?.accountNumber}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${p.paymentMethod === 'bank_transfer' ? 'badge-info' : 'badge-warning'}`}>
                        {p.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }} className="font-mono">
                      {formatCurrency(p.amount)}
                    </td>
                    <td>
                      <StatusBadge status={p.status} type="payment" />
                    </td>
                    <td>
                      <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        {formatDate(p.createdAt)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrintProposal(p);
                          }}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '0.4rem 0.65rem', color: 'var(--accent-cyan)', gap: '0.25rem' }}
                          title="Xem trước và In biểu mẫu PDF"
                        >
                          <Printer size={14} />
                          <span>In PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingPayment(p);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.4rem 0.75rem', gap: '0.25rem' }}
                        >
                          <Eye size={14} />
                          <span>Chi tiết</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* THANH PHÂN TRANG DANH SÁCH ĐỀ XUẤT THANH TOÁN */}
        {filteredProposals.length > 5 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredProposals.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20, 50]}
            itemName="hóa đơn / đề xuất"
          />
        )}
      </div>
      )}

      {/* MODAL XEM CHI TIẾT HÓA ĐƠN KHI BẤM VÀO DÒNG */}
      <InvoiceDetailModal
        isOpen={Boolean(viewingPayment)}
        onClose={() => setViewingPayment(null)}
        payment={viewingPayment}
        onPrint={(pay) => setPrintProposal(pay)}
      />

      {/* MODAL XEM TRƯỚC VÀ IN BIỂU MẪU ĐỀ NGHỊ THANH TOÁN */}
      <PaymentPrintModal
        isOpen={!!printProposal}
        onClose={() => setPrintProposal(null)}
        proposal={printProposal}
      />
    </div>
  );
};
