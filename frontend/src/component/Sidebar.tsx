import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Banknote,
  CreditCard,
  CheckCircle2,
  UserCheck,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TagLogo } from './TagLogo';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();

  const navItems = [
    {
      to: '/dashboard',
      label: 'Tổng Quan',
      icon: <LayoutDashboard size={19} />,
    },
    {
      to: '/purchase',
      label: 'Đề Xuất Mua Sắm',
      icon: <ShoppingCart size={19} />,
    },
    // Mục "Đề Xuất Tạm Ứng" chỉ hiển thị cho Thu mua, Kế toán, Giám đốc, Chủ tịch
    ...(user && ['thu_mua', 'ke_toan', 'giam_doc', 'chu_tich', 'admin'].includes(user.role)
      ? [
          {
            to: '/advance',
            label: 'Đề Xuất Tạm Ứng',
            icon: <Banknote size={19} />,
          },
        ]
      : []),
    // Mục "Đề Xuất Thanh Toán" chỉ hiển thị cho Kế toán, Giám đốc, Chủ tịch (Thu mua không có nghiệp vụ thanh toán)
    ...(user && ['ke_toan', 'giam_doc', 'chu_tich', 'admin'].includes(user.role)
      ? [
          {
            to: '/payment',
            label: 'Đề Xuất Thanh Toán',
            icon: <CreditCard size={19} />,
            accent: '#10b981', // Màu xanh lá để phân biệt
          },
        ]
      : []),
    {
      to: '/approval',
      label: 'Cần Tôi Duyệt',
      icon: <CheckCircle2 size={19} />,
      highlight: true,
    },
    {
      to: '/profile',
      label: user && ['ke_toan', 'thu_mua'].includes(user.role) ? 'Hồ Sơ & Ngân Hàng' : 'Hồ Sơ Cá Nhân',
      icon: <UserCheck size={19} />,
    },
  ];

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: '#0c101c',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ padding: '1.25rem 1rem' }}>
        {/* Brand Header */}
        <div style={{ padding: '0.25rem 0.5rem 1.25rem 0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
          <TagLogo size={36} subText="Thiết Kế & Xây Dựng Khách Sạn" />
        </div>

        {/* Navigation list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              marginBottom: '0.25rem',
            }}
          >
            Menu Chính
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.75rem 0.95rem',
                borderRadius: 'var(--radius-md)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.875rem',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'var(--transition)',
                textDecoration: 'none',
              })}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: item.highlight ? 'var(--warning)' : (item as any).accent ? (item as any).accent : 'inherit',
                }}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Role explanation badge at bottom */}
      <div
        style={{
          padding: '1.25rem',
          margin: '1rem',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <HelpCircle size={15} color="var(--primary)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Quy Trình Phê Duyệt
          </span>
        </div>
        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {user?.role === 'nhan_vien' && 'Nhân viên: Tạo đơn & hoàn tạm ứng sau giải ngân.'}
          {user?.role === 'truong_phong' && 'Trưởng phòng: Duyệt đơn phòng ban <= 1.000.000đ.'}
          {user?.role === 'thu_mua' && 'Thu mua: Điền đơn giá thực tế sau khi khảo giá.'}
          {user?.role === 'ke_toan' && 'Kế toán: Xác nhận giá, giải ngân, duyệt hoàn tạm ứng.'}
          {user?.role === 'giam_doc' && 'Giám đốc: Duyệt mua sắm <= 10.000.000đ & tạm ứng.'}
          {user?.role === 'chu_tich' && 'Chủ tịch: Thẩm quyền duyệt tối cao cho mọi đơn.'}
        </div>
      </div>
    </aside>
  );
};
