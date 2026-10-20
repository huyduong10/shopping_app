import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { purchaseProposalService } from '../../services';
import { PurchaseProposal } from '../../models';
import { StatusBadge, PurchasePrintModal, Pagination } from '../../component';
import { formatCurrency, formatDate, getRoleLabel } from '../../utils/formatters';
import {
  ShoppingCart,
  PlusCircle,
  Search,
  Filter,
  Eye,
  Loader2,
  FileQuestion,
  Printer,
  FileCheck,
  Receipt,
} from 'lucide-react';

export const PurchaseListPage: React.FC = () => {
  const [proposals, setProposals] = useState<PurchaseProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'invoices_completed'>('all');
  const [printProposal, setPrintProposal] = useState<PurchaseProposal | null>(null);

  // [MỚI] Quản lý phân trang cho danh sách đề xuất mua sắm
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const data = await purchaseProposalService.getAll();
      setProposals(data);
    } catch (err) {
      console.error('Error loading purchase proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProposals();
  }, []);

  const isCompletedInvoice = (p: PurchaseProposal) => {
    return Boolean(
      p.isInvoiceCompleted ||
      (p.status === 'completed' &&
        (p.procurementExecution?.invoiceInfo?.invoiceNumber ||
          (p.procurementExecution?.invoiceInfo?.files && p.procurementExecution.invoiceInfo.files.length > 0) ||
          p.procurementExecution?.contractInfo?.contractNumber))
    );
  };

  const filteredProposals = proposals.filter((p) => {
    const matchesSearch =
      p.proposalCode.toLowerCase().includes(search.toLowerCase()) ||
      p.creator?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      (p.procurementExecution?.invoiceInfo?.invoiceNumber && p.procurementExecution.invoiceInfo.invoiceNumber.toLowerCase().includes(search.toLowerCase())) ||
      (p.procurementExecution?.contractInfo?.contractNumber && p.procurementExecution.contractInfo.contractNumber.toLowerCase().includes(search.toLowerCase())) ||
      p.items.some((i) => i.tenVatTu.toLowerCase().includes(search.toLowerCase()));

    // Lọc theo tab chuyên biệt
    if (activeTab === 'invoices_completed') {
      if (!isCompletedInvoice(p)) return false;
    } else if (activeTab === 'pending') {
      if (p.status === 'completed' || p.status === 'rejected') return false;
    }

    const matchesStatus =
      statusFilter === 'all' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalProposals = proposals.length;
  const pendingCount = proposals.filter((p) =>
    [
      'pending_tp_approval',
      'procurement_pricing',
      'pending_director_approval',
      'pending_chairman_approval',
      'procurement_execution',
      'pending_accounting',
      'pending_approval',
      'procurement_review',
      'accounting_review',
      'pending_final_approval',
      'pending_payment',
      'pending_payment_approval',
    ].includes(p.status)
  ).length;
  const disbursingCount = proposals.filter((p) => p.status === 'disbursing').length;
  const invoiceCompletedCount = proposals.filter(isCompletedInvoice).length;

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
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <ShoppingCart size={20} />
            </div>
            <h1>Danh Sách Đề Xuất Mua Sắm</h1>
          </div>
          <p style={{ fontSize: '0.875rem' }}>
            Quản lý, theo dõi tiến độ khảo giá và duyệt chi các đề xuất vật tư trang thiết bị.
          </p>
        </div>

        <div className="page-header-actions">
          <Link to="/purchase/create" className="btn btn-primary">
            <PlusCircle size={17} />
            <span>Tạo Đơn Mua Sắm Mới</span>
          </Link>
        </div>
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
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tổng Số Đơn</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>{totalProposals}</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>Đang Chờ Duyệt / Xử Lý</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24' }}>{pendingCount}</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>Đang Giải Ngân</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>{disbursingCount}</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Hóa Đơn Đã Hoàn Thành</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>{invoiceCompletedCount}</div>
        </div>
      </div>

      {/* Thanh tab phân loại nhanh */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('all')}
          style={{ fontSize: '0.825rem' }}
        >
          <span>Tất Cả Đơn Mua ({totalProposals})</span>
        </button>
        <button
          className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('pending')}
          style={{ fontSize: '0.825rem' }}
        >
          <span>Đang Xử Lý & Chờ Duyệt ({pendingCount})</span>
        </button>
        <button
          className={`btn ${activeTab === 'invoices_completed' ? 'btn-success' : 'btn-ghost'}`}
          onClick={() => setActiveTab('invoices_completed')}
          style={{
            fontSize: '0.825rem',
            gap: '0.4rem',
            backgroundColor: activeTab === 'invoices_completed' ? 'var(--success)' : 'rgba(16, 185, 129, 0.12)',
            color: activeTab === 'invoices_completed' ? '#ffffff' : '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.35)',
          }}
        >
          <Receipt size={15} />
          <span>Hóa Đơn Đã Hoàn Thành ({invoiceCompletedCount})</span>
        </button>
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
            placeholder="Tìm theo mã đơn, người tạo hoặc tên vật tư..."
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
            style={{ width: 'auto', minWidth: '180px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            {/* [LUỒNG MỚI] */}
            <option value="pending_tp_approval">Chờ Trưởng phòng duyệt</option>
            <option value="rejected_by_tp">Bị từ chối (TP yêu cầu sửa)</option>
            <option value="procurement_pricing">Thu mua lập báo giá</option>
            <option value="rejected_by_director">Bị từ chối (Khảo giá lại)</option>
            <option value="pending_director_approval">Chờ Giám đốc duyệt mua (đơn &le; 10tr)</option>
            <option value="pending_chairman_approval">Chờ Chủ tịch duyệt mua (đơn &gt; 10tr)</option>
            <option value="procurement_execution">Thu mua đang thực hiện</option>
            <option value="rejected_by_accounting">Bị từ chối (Kế toán yêu cầu sửa HĐ)</option>
            <option value="pending_accounting">Chờ Kế toán xử lý</option>
            {/* [LUỒNG CŨ - Tương thích dữ liệu cũ] */}
            <option value="pending_approval">Chờ duyệt sơ bộ (cũ)</option>
            <option value="procurement_review">Thu mua khảo giá (cũ)</option>
            <option value="accounting_review">Kế toán xác nhận (cũ)</option>
            <option value="pending_final_approval">Chờ duyệt giá chốt (cũ)</option>
            <option value="pending_payment">Chờ kế toán lập thanh toán</option>
            <option value="pending_payment_approval">Chờ duyệt thanh toán</option>
            <option value="disbursing">Đang giải ngân</option>
            <option value="completed">Đã hoàn thành</option>
            <option value="rejected">Bị từ chối</option>
          </select>
        </div>
      </div>

      {/* Bảng danh sách các đề xuất mua sắm */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader2 size={36} className="animate-spin" color="var(--primary)" />
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <FileQuestion size={28} />
          </div>
          <h3 style={{ color: '#ffffff' }}>Không tìm thấy đề xuất mua sắm nào</h3>
          <p style={{ fontSize: '0.85rem' }}>
            {search || statusFilter !== 'all'
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.'
              : 'Hãy tạo đơn mua sắm vật tư đầu tiên cho phòng ban của bạn!'}
          </p>
          <Link to="/purchase/create" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
            <PlusCircle size={15} />
            <span>Tạo Đơn Mới</span>
          </Link>
        </div>
      ) : (
        <div>
          <div className="table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="table" style={{ minWidth: '980px' }}>
              <thead>
                <tr>
                  <th>Mã Đề Xuất</th>
                  <th>Người Tạo</th>
                  <th>Phòng Ban</th>
                  <th>Số Vật Tư</th>
                  <th>Dự Toán</th>
                  <th>Thực Tế</th>
                  <th>Trạng Thái</th>
                  <th>Bước Kế Tiếp</th>
                  <th style={{ textAlign: 'right' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {filteredProposals
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((p) => (
                <tr key={p._id}>
                  <td>
                    <Link
                      to={`/purchase/${p._id}`}
                      style={{ fontWeight: 700, color: '#ffffff' }}
                      className="font-mono"
                    >
                      {p.proposalCode}
                    </Link>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      {formatDate(p.createdAt)}
                    </div>
                    {p.procurementExecution?.invoiceInfo?.invoiceNumber && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>
                        HĐ: <strong>{p.procurementExecution.invoiceInfo.invoiceNumber}</strong>
                      </div>
                    )}
                    {p.procurementExecution?.contractInfo?.contractNumber && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--purple)', marginTop: '0.15rem' }}>
                        HĐKT: <strong>{p.procurementExecution.contractInfo.contractNumber}</strong>
                      </div>
                    )}
                    {isCompletedInvoice(p) && (
                      <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', marginTop: '0.25rem', display: 'inline-block' }}>
                        ✓ Hóa đơn hoàn tất
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.creator?.fullName}</div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      {getRoleLabel(p.creator?.role)}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>{p.department?.name}</span>
                  </td>
                  <td>
                    <span className="badge badge-secondary">{p.items?.length || 0} mục</span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatCurrency(p.totalEstimatedAmount > 0 ? p.totalEstimatedAmount : (p.totalActualAmount || 0))}
                  </td>
                  <td>
                    {p.totalActualAmount ? (
                      <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                        {formatCurrency(p.totalActualAmount)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.825rem' }}>Chưa chốt</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={p.status} type="purchase" />
                  </td>
                  <td>
                    {p.currentApprovalRole ? (
                      <span className="badge badge-warning">
                        {getRoleLabel(p.currentApprovalRole)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => setPrintProposal(p)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.4rem 0.65rem', color: 'var(--accent-cyan)' }}
                        title="Xem trước và In biểu mẫu PDF"
                      >
                        <Printer size={14} />
                        <span>In PDF</span>
                      </button>
                      <Link
                        to={`/purchase/${p._id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.4rem 0.75rem' }}
                      >
                        <Eye size={14} />
                        <span>Chi tiết</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* THANH PHÂN TRANG DANH SÁCH ĐỀ XUẤT */}
        {filteredProposals.length > 5 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredProposals.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[5, 10, 20, 50]}
            itemName="đơn mua sắm"
          />
        )}
      </div>
      )}

      {/* MODAL XEM TRƯỚC VÀ IN BIỂU MẪU ĐỀ XUẤT MUA SẮM VẬT TƯ */}
      <PurchasePrintModal
        isOpen={!!printProposal}
        onClose={() => setPrintProposal(null)}
        proposal={printProposal}
      />
    </div>
  );
};
