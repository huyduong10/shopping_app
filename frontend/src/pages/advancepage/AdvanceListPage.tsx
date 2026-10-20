import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { advanceProposalService } from '../../services';
import { AdvanceProposal } from '../../models';
import { StatusBadge, AdvancePrintModal } from '../../component';
import { formatCurrency, formatDate, getRoleLabel } from '../../utils/formatters';
import {
  Banknote,
  PlusCircle,
  Search,
  Filter,
  Eye,
  Loader2,
  FileQuestion,
  Printer,
} from 'lucide-react';

export const AdvanceListPage: React.FC = () => {
  const [proposals, setProposals] = useState<AdvanceProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [printProposal, setPrintProposal] = useState<AdvanceProposal | null>(null);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const data = await advanceProposalService.getAll();
      setProposals(data);
    } catch (err) {
      console.error('Error loading advance proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProposals();
  }, []);

  const filteredProposals = proposals.filter((p) => {
    const matchesSearch =
      p.proposalCode.toLowerCase().includes(search.toLowerCase()) ||
      p.creator?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      p.items.some((i) => i.mucDich.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'rejected_all'
        ? ['rejected', 'rejected_by_director', 'rejected_by_chairman', 'rejected_by_accounting', 'rejected_settlement'].includes(p.status)
        : p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalProposals = proposals.length;
  const pendingCount = proposals.filter((p) =>
    ['pending_director', 'pending_chairman', 'pending_accounting'].includes(p.status)
  ).length;
  const rejectedCount = proposals.filter((p) =>
    ['rejected', 'rejected_by_director', 'rejected_by_chairman', 'rejected_by_accounting', 'rejected_settlement'].includes(p.status)
  ).length;
  const settlementCount = proposals.filter((p) =>
    ['pending_settlement', 'settlement_submitted'].includes(p.status)
  ).length;
  const completedCount = proposals.filter((p) => p.status === 'completed').length;

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
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)',
              }}
            >
              <Banknote size={20} />
            </div>
            <h1>Danh Sách Đề Xuất Tạm Ứng</h1>
          </div>
          <p style={{ fontSize: '0.875rem' }}>
            Quản lý đề xuất xin tạm ứng kinh phí công tác, mua sắm nội bộ và theo dõi tiến trình hoàn ứng.
          </p>
        </div>

        <div className="page-header-actions">
          <Link to="/advance/create" className="btn btn-primary">
            <PlusCircle size={17} />
            <span>Tạo Đơn Tạm Ứng Mới</span>
          </Link>
        </div>
      </div>

      {/* Thẻ thống kê số liệu nhanh */}
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
          <div style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>Đang Chờ Duyệt</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24' }}>{pendingCount}</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Bị Từ Chối (Làm Lại)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>{rejectedCount}</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--purple)' }}>Chờ Hoàn Ứng</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c084fc' }}>{settlementCount}</div>
        </div>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Đã Hoàn Thành</div>
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
            placeholder="Tìm theo mã đơn, người tạo hoặc mục đích..."
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
            <option value="pending_director">Chờ Giám đốc duyệt</option>
            <option value="pending_chairman">Chờ Chủ tịch duyệt</option>
            <option value="pending_accounting">Chờ Kế toán duyệt</option>
            <option value="pending_settlement">Chờ hoàn tạm ứng</option>
            <option value="settlement_submitted">Đã nộp chứng từ hoàn</option>
            <option value="completed">Đã hoàn thành</option>
            <option value="rejected_all">🔴 Tất cả đơn bị từ chối</option>
            <option value="rejected_by_director">🔴 Bị từ chối (GĐ yêu cầu sửa)</option>
            <option value="rejected_by_chairman">🔴 Bị từ chối (Chủ tịch yêu cầu sửa)</option>
            <option value="rejected_by_accounting">🔴 Bị từ chối (Kế toán yêu cầu sửa)</option>
            <option value="rejected_settlement">🔴 Bị từ chối (Kế toán yêu cầu sửa hoàn ứng)</option>
          </select>
        </div>
      </div>

      {/* Bảng danh sách đề xuất tạm ứng */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader2 size={36} className="animate-spin" color="var(--primary)" />
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">
            <FileQuestion size={28} />
          </div>
          <h3 style={{ color: '#ffffff' }}>Không tìm thấy đề xuất tạm ứng nào</h3>
          <p style={{ fontSize: '0.85rem' }}>
            {search || statusFilter !== 'all'
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.'
              : 'Hãy tạo đơn đề xuất tạm ứng đầu tiên!'}
          </p>
          <Link to="/advance/create" className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
            <PlusCircle size={15} />
            <span>Tạo Đơn Mới</span>
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Mã Đề Xuất</th>
                <th>Người Nhận Tạm Ứng</th>
                <th>Tài Khoản Nhận</th>
                <th>Mục Đích Tạm Ứng</th>
                <th>Số Tiền</th>
                <th>Trạng Thái</th>
                <th>Bước Kế Tiếp</th>
                <th style={{ textAlign: 'right' }}>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {filteredProposals.map((a) => (
                <tr key={a._id}>
                  <td>
                    <Link
                      to={`/advance/${a._id}`}
                      style={{ fontWeight: 700, color: '#ffffff' }}
                      className="font-mono"
                    >
                      {a.proposalCode}
                    </Link>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      {formatDate(a.createdAt)}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.creator?.fullName}</div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      {a.department?.name}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                      {a.bankAccount?.bankName}
                    </div>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }} className="font-mono">
                      {a.bankAccount?.accountNumber}
                    </div>
                  </td>
                  <td>
                    <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {a.items?.[0]?.mucDich || 'Tạm ứng chi phí'}
                      {a.items?.length > 1 && ` (+${a.items.length - 1} mục khác)`}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }} className="font-mono">
                    <div>{formatCurrency(a.totalAmount)}</div>
                    {(a.totalAmount || 0) <= 10000000 ? (
                      <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', marginTop: '0.25rem', display: 'inline-block' }}>
                        ≤ 10tr (Sếp duyệt)
                      </span>
                    ) : (
                      <span className="badge badge-purple" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', marginTop: '0.25rem', display: 'inline-block' }}>
                        &gt; 10tr (Chủ tịch duyệt)
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={a.status} type="advance" />
                  </td>
                  <td>
                    {a.currentApprovalRole ? (
                      <span
                        className={`badge ${
                          a.currentApprovalRole === 'chu_tich'
                            ? 'badge-purple'
                            : a.currentApprovalRole === 'giam_doc'
                            ? 'badge-warning'
                            : a.currentApprovalRole === 'creator'
                            ? 'badge-info'
                            : 'badge-primary'
                        }`}
                      >
                        {a.currentApprovalRole === 'giam_doc'
                          ? 'Sếp (GĐ) duyệt'
                          : a.currentApprovalRole === 'chu_tich'
                          ? 'Chủ tịch duyệt'
                          : a.currentApprovalRole === 'creator'
                          ? 'Người tạo hoàn ứng'
                          : getRoleLabel(a.currentApprovalRole)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => setPrintProposal(a)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.4rem 0.65rem', color: 'var(--accent-cyan)' }}
                        title="Xem trước và In biểu mẫu PDF"
                      >
                        <Printer size={14} />
                        <span>In PDF</span>
                      </button>
                      <Link
                        to={`/advance/${a._id}`}
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
      )}

      {/* MODAL XEM TRƯỚC VÀ IN BIỂU MẪU ĐỀ NGHỊ TẠM ỨNG */}
      <AdvancePrintModal
        isOpen={!!printProposal}
        onClose={() => setPrintProposal(null)}
        proposal={printProposal}
      />
    </div>
  );
};
