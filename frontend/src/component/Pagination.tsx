import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  itemName = 'mục',
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalItems === 0) return null;

  const startItem = (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Tính toán dãy số trang hiển thị
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, safeCurrentPage - 1);
      let end = Math.min(totalPages, safeCurrentPage + 1);

      if (safeCurrentPage <= 2) {
        end = 3;
      } else if (safeCurrentPage >= totalPages - 1) {
        start = totalPages - 2;
      }

      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div
      className={`pagination-container ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.85rem',
        padding: '0.85rem 1rem',
        marginTop: '0.75rem',
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(255, 255, 255, 0.01)',
        borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
        fontSize: '0.825rem',
      }}
    >
      {/* Thông tin số lượng & số dòng/trang */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--text-secondary)' }}>
          Hiển thị{' '}
          <strong style={{ color: '#ffffff' }}>
            {startItem}-{endItem}
          </strong>{' '}
          trên tổng số{' '}
          <strong style={{ color: 'var(--accent-cyan)' }}>{totalItems}</strong> {itemName}
        </div>

        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
            <span>Số dòng:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="form-select"
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.8rem',
                width: 'auto',
                height: 'auto',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                  {opt} / trang
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Điều hướng các trang */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        {/* Về trang đầu */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1}
          className="btn btn-ghost btn-sm"
          style={{
            padding: '0.35rem 0.45rem',
            opacity: safeCurrentPage === 1 ? 0.4 : 1,
            cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
          }}
          title="Trang đầu"
        >
          <ChevronsLeft size={15} />
        </button>

        {/* Trang trước */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className="btn btn-ghost btn-sm"
          style={{
            padding: '0.35rem 0.5rem',
            opacity: safeCurrentPage === 1 ? 0.4 : 1,
            cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
          }}
          title="Trang trước"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Các số trang */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '0.2rem 0.45rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                  }}
                >
                  ...
                </span>
              );
            }

            const pageNum = Number(p);
            const isActive = pageNum === safeCurrentPage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                style={{
                  minWidth: '30px',
                  height: '30px',
                  padding: '0 0.4rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.04)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                }}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Trang sau */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages}
          className="btn btn-ghost btn-sm"
          style={{
            padding: '0.35rem 0.5rem',
            opacity: safeCurrentPage === totalPages ? 0.4 : 1,
            cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
          }}
          title="Trang sau"
        >
          <ChevronRight size={15} />
        </button>

        {/* Đến trang cuối */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage === totalPages}
          className="btn btn-ghost btn-sm"
          style={{
            padding: '0.35rem 0.45rem',
            opacity: safeCurrentPage === totalPages ? 0.4 : 1,
            cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
          }}
          title="Trang cuối"
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
};
