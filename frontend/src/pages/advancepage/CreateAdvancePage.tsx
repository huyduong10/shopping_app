import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { advanceProposalService } from '../../services';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import {
  Banknote,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  AlertCircle,
  CreditCard,
  HelpCircle,
} from 'lucide-react';

interface AdvanceFormItem {
  id: string;
  mucDich: string;
  soTien: number;
}

export const CreateAdvancePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<AdvanceFormItem[]>([
    {
      id: '1',
      mucDich: '',
      soTien: 0,
    },
  ]);

  const [bankAccount, setBankAccount] = useState({
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tự động điền tài khoản ngân hàng từ thông tin tài khoản người dùng
  useEffect(() => {
    if (user?.bankAccount) {
      setBankAccount({
        bankName: user.bankAccount.bankName || '',
        accountNumber: user.bankAccount.accountNumber || '',
        accountHolder: user.bankAccount.accountHolder || user.fullName || '',
      });
    }
  }, [user]);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        mucDich: '',
        soTien: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateItem = (index: number, field: keyof AdvanceFormItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const totalAmount = items.reduce(
    (sum, item) => sum + (Number(item.soTien) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Kiểm tra tính hợp lệ của dữ liệu nhập (Validation)
    if (!bankAccount.bankName.trim() || !bankAccount.accountNumber.trim()) {
      setError('Vui lòng điền đầy đủ Tên ngân hàng và Số tài khoản nhận tiền');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].mucDich.trim()) {
        setError(`Vui lòng nhập mục đích tạm ứng cho dòng số ${i + 1}`);
        return;
      }
      if (items[i].soTien <= 0) {
        setError(`Số tiền dòng số ${i + 1} phải lớn hơn 0`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        bankAccount,
        items: items.map((item, index) => ({
          stt: index + 1,
          mucDich: item.mucDich.trim(),
          soTien: Number(item.soTien),
        })),
      };

      const result = await advanceProposalService.create(payload);
      navigate(`/advance/${result._id}`);
    } catch (err: any) {
      setError(err.message || 'Không thể tạo đề xuất tạm ứng');
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Tiêu đề trang */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link to="/advance" className="btn btn-ghost btn-sm" style={{ padding: '0.4rem' }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: '1.5rem', color: '#ffffff' }}>Tạo Đề Xuất Tạm Ứng Mới</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Lập phiếu đề xuất tạm ứng kinh phí công tác, mua sắm phục vụ công việc.
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
        {/* Thẻ thông tin tài khoản ngân hàng thụ hưởng */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <CreditCard size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.1rem', color: '#ffffff' }}>Tài Khoản Ngân Hàng Nhận Tiền</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                Tên Ngân Hàng <span className="required">*</span>
              </label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Ví dụ: Vietcombank, Techcombank, MBBank..."
                value={bankAccount.bankName}
                onChange={(e) => setBankAccount({ ...bankAccount, bankName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Số Tài Khoản <span className="required">*</span>
              </label>
              <input
                type="text"
                required
                className="form-input font-mono"
                placeholder="0123456789..."
                value={bankAccount.accountNumber}
                onChange={(e) => setBankAccount({ ...bankAccount, accountNumber: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tên Chủ Tài Khoản</label>
              <input
                type="text"
                className="form-input"
                placeholder="NGUYEN VAN A..."
                value={bankAccount.accountHolder}
                onChange={(e) => setBankAccount({ ...bankAccount, accountHolder: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Thẻ bảng danh mục mục đích tạm ứng */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Banknote size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1.1rem', color: '#ffffff' }}>Danh Mục Mục Đích Tạm Ứng</h3>
            </div>
            <button type="button" onClick={addItem} className="btn btn-secondary btn-sm">
              <Plus size={15} />
              <span>Thêm mục tạm ứng</span>
            </button>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                  <th>Mục Đích Tạm Ứng <span style={{ color: 'var(--danger)' }}>*</span></th>
                  <th style={{ width: '220px' }}>Số Tiền (VNĐ) <span style={{ color: 'var(--danger)' }}>*</span></th>
                  <th style={{ width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{index + 1}</td>
                    <td>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="Ví dụ: Tạm ứng công tác phí thị trường miền Trung..."
                        value={item.mucDich}
                        onChange={(e) => updateItem(index, 'mucDich', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1000"
                        step="any"
                        required
                        className="form-input font-mono"
                        placeholder="0"
                        value={item.soTien || ''}
                        onChange={(e) => updateItem(index, 'soTien', Number(e.target.value))}
                      />
                    </td>
                    <td>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)', padding: '0.4rem' }}
                          title="Xóa dòng này"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Khối tổng kết quy trình và tổng tiền */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HelpCircle size={18} color="var(--accent-cyan)" />
                <h4 style={{ fontSize: '0.95rem', color: '#ffffff' }}>Quy Trình Phân Cấp Duyệt Tạm Ứng</h4>
              </div>
              {totalAmount > 0 && (
                <span className={`badge ${totalAmount > 10000000 ? 'badge-purple' : 'badge-info'}`} style={{ fontSize: '0.75rem' }}>
                  {totalAmount > 10000000 ? '👑 Cấp duyệt: Chủ tịch' : '👔 Cấp duyệt: Sếp (Giám đốc)'}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              • <strong>Số tiền ≤ 10.000.000 VNĐ:</strong> Sếp (Giám đốc) duyệt &rarr; Kế toán giải ngân chuyển khoản.<br />
              • <strong>Số tiền &gt; 10.000.000 VNĐ:</strong> Chủ tịch trực tiếp duyệt chi &rarr; Kế toán giải ngân chuyển khoản.<br />
              • Sau khi chi tiêu xong, bạn nộp chứng từ hoàn tạm ứng (Thừa / Thiếu / Đủ) để Kế toán tất toán.
            </div>
          </div>

          {/* Tổng số tiền tạm ứng */}
          <div
            className="card"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Tổng Số Tiền Xin Tạm Ứng
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: 'var(--accent-cyan)',
                  letterSpacing: '-0.02em',
                  marginTop: '0.25rem',
                }}
                className="font-mono"
              >
                {formatCurrency(totalAmount)}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <Link to="/advance" className="btn btn-secondary">
                Hủy Bỏ
              </Link>
              <button
                type="submit"
                disabled={submitting || totalAmount <= 0}
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.5rem' }}
              >
                <Save size={16} />
                <span>{submitting ? 'Đang gửi...' : 'Gửi Đề Xuất Tạm Ứng'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
