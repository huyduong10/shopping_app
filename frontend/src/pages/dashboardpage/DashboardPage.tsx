import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { purchaseProposalService, advanceProposalService } from '../../services';
import { PurchaseProposal, AdvanceProposal } from '../../models';
import { StatCard, StatusBadge } from '../../component';
import { formatCurrency, getRoleLabel } from '../../utils/formatters';
import {
  ShoppingCart,
  Banknote,
  CheckCircle2,
  DollarSign,
  PlusCircle,
  ArrowRight,
  AlertTriangle,
  FileText,
  Loader2,
} from 'lucide-react';


export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [purchaseProposals, setPurchaseProposals] = useState<PurchaseProposal[]>([]);
  const [advanceProposals, setAdvanceProposals] = useState<AdvanceProposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [purchases, advances] = await Promise.all([
          purchaseProposalService.getAll(),
          advanceProposalService.getAll(),
        ]);
        setPurchaseProposals(purchases);
        setAdvanceProposals(advances);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Tính toán các chỉ số thống kê
  const totalPurchaseEst = purchaseProposals.reduce(
    (sum, p) => sum + (p.totalEstimatedAmount || 0),
    0
  );
  const totalAdvanceAmount = advanceProposals.reduce(
    (sum, a) => sum + (a.totalAmount || 0),
    0
  );
  const totalDisbursed =
    purchaseProposals.reduce((sum, p) => sum + (p.totalDisbursed || 0), 0) +
    advanceProposals.reduce((sum, a) => sum + (a.totalDisbursed || 0), 0);

  // Đề xuất đang chờ xử lý theo vai trò của người dùng hiện tại
  const pendingMyPurchases = purchaseProposals.filter(
    (p) => p.currentApprovalRole === user?.role
  );
  const pendingMyAdvances = advanceProposals.filter((a) => {
    const totalAmount = a.totalAmount || 0;
    const isOverTenMillion = totalAmount > 10000000;
    if (user?.role === 'giam_doc') {
      return a.currentApprovalRole === 'giam_doc' && !isOverTenMillion;
    }
    if (user?.role === 'chu_tich') {
      return a.currentApprovalRole === 'chu_tich' || (a.currentApprovalRole === 'giam_doc' && isOverTenMillion);
    }
    return a.currentApprovalRole === user?.role;
  });
  const totalPendingMyAction = pendingMyPurchases.length + pendingMyAdvances.length;

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '1rem',
        }}
      >
        <Loader2 size={36} className="animate-spin" color="var(--primary)" />
        <span style={{ color: 'var(--text-secondary)' }}>Đang tải số liệu tổng quan...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Khối biểu ngữ chào mừng */}
      <div
        className="card-glass"
        style={{
          padding: '1.75rem 2rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <h1 style={{ fontSize: '1.6rem', color: '#ffffff' }}>
              Xin chào, {user?.fullName}! 👋
            </h1>
            <span className="badge badge-primary">
              {getRoleLabel(user?.role)}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Hệ thống quản lý & phê duyệt đề xuất mua sắm, tạm ứng dự án — Công Ty TNHH TAG (Xây dựng & Thiết kế Khách sạn cao cấp).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 1 }}>
          <Link to="/purchase/create" className="btn btn-primary">
            <PlusCircle size={16} />
            <span>Tạo Đơn Mua Sắm</span>
          </Link>
          <Link to="/advance/create" className="btn btn-secondary">
            <PlusCircle size={16} />
            <span>Tạo Đơn Tạm Ứng</span>
          </Link>
        </div>
      </div>

      {/* Biểu ngữ nhắc nhở hồ sơ đang chờ người dùng xử lý */}
      {totalPendingMyAction > 0 && (
        <div
          style={{
            padding: '1.25rem 1.75rem',
            marginBottom: '2rem',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.08) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--warning)',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.975rem', color: '#fbbf24' }}>
                Bạn có {totalPendingMyAction} đề xuất đang chờ vai trò "{getRoleLabel(user?.role)}" xử lý!
              </div>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Bao gồm {pendingMyPurchases.length} đơn mua sắm và {pendingMyAdvances.length} đơn tạm ứng cần duyệt/xác nhận.
              </div>
            </div>
          </div>

          <Link to="/approval" className="btn btn-warning btn-sm">
            <span>Vào Xử Lý Ngay</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Lưới thẻ thống kê số liệu */}
      <div className="stats-grid">
        <StatCard
          title="Đề Xuất Mua Sắm"
          value={purchaseProposals.length}
          subtitle={`Tổng dự toán: ${formatCurrency(totalPurchaseEst)}`}
          icon={<ShoppingCart size={22} />}
          gradient="linear-gradient(135deg, #6366f1 0%, #4338ca 100%)"
          badgeText="Mua sắm"
          badgeType="primary"
        />

        <StatCard
          title="Đề Xuất Tạm Ứng"
          value={advanceProposals.length}
          subtitle={`Tổng số tiền: ${formatCurrency(totalAdvanceAmount)}`}
          icon={<Banknote size={22} />}
          gradient="linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)"
          badgeText="Tạm ứng"
          badgeType="primary"
        />

        <StatCard
          title="Cần Tôi Phê Duyệt"
          value={totalPendingMyAction}
          subtitle="Đang chờ bạn quyết định"
          icon={<CheckCircle2 size={22} />}
          gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
          badgeText={totalPendingMyAction > 0 ? 'Cần duyệt' : 'Đã sạch'}
          badgeType={totalPendingMyAction > 0 ? 'warning' : 'success'}
        />

        <StatCard
          title="Tổng Đã Giải Ngân"
          value={formatCurrency(totalDisbursed)}
          subtitle="Tiền đã chi thực tế"
          icon={<DollarSign size={22} />}
          gradient="linear-gradient(135deg, #10b981 0%, #047857 100%)"
          badgeText="Thực chi"
          badgeType="success"
        />
      </div>

      {/* Hai cột danh sách đề xuất gần đây */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.75rem' }}>
        {/* Đề xuất mua sắm gần đây */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShoppingCart size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Mua Sắm Gần Đây</h3>
            </div>
            <Link to="/purchase" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Xem tất cả <ArrowRight size={13} />
            </Link>
          </div>

          {purchaseProposals.length === 0 ? (
            <div className="empty-state">
              <FileText size={32} />
              <span>Chưa có đơn mua sắm nào</span>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã Đơn</th>
                    <th>Người Tạo</th>
                    <th>Dự Toán</th>
                    <th>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseProposals.slice(0, 5).map((p) => (
                    <tr key={p._id}>
                      <td>
                        <Link to={`/purchase/${p._id}`} style={{ fontWeight: 600 }} className="font-mono">
                          {p.proposalCode}
                        </Link>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.825rem' }}>{p.creator?.fullName}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          {p.department?.name}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {formatCurrency(p.totalEstimatedAmount)}
                      </td>
                      <td>
                        <StatusBadge status={p.status} type="purchase" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Đề xuất tạm ứng gần đây */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Banknote size={18} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1.05rem', color: '#ffffff' }}>Tạm Ứng Gần Đây</h3>
            </div>
            <Link to="/advance" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Xem tất cả <ArrowRight size={13} />
            </Link>
          </div>

          {advanceProposals.length === 0 ? (
            <div className="empty-state">
              <FileText size={32} />
              <span>Chưa có đơn tạm ứng nào</span>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã Đơn</th>
                    <th>Người Tạo</th>
                    <th>Số Tiền</th>
                    <th>Trạng Thái</th>
                  </tr>
                </thead>
                <tbody>
                  {advanceProposals.slice(0, 5).map((a) => (
                    <tr key={a._id}>
                      <td>
                        <Link to={`/advance/${a._id}`} style={{ fontWeight: 600 }} className="font-mono">
                          {a.proposalCode}
                        </Link>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.825rem' }}>{a.creator?.fullName}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          {a.bankAccount?.bankName} ({a.bankAccount?.accountNumber})
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {formatCurrency(a.totalAmount)}
                      </td>
                      <td>
                        <StatusBadge status={a.status} type="advance" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
