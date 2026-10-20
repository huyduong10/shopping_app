import React, { useState, useEffect, useRef } from 'react';
import {
  ExternalLink,
  Camera,
  CheckCircle,
  AlertCircle,
  Monitor,
  Loader2,
  X,
  Store,
  Clock,
  Clipboard,
  Upload,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import {
  stampProofWatermarkOnImage,
  generatePriceProofCanvas,
  LocalAttachment,
} from '../utils/clientAttachmentHelper';
import { formatCurrency } from '../utils/formatters';

interface WebReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  supplierName: string;
  price: number;
  itemName: string;
  itemQuantity?: number;
  onCaptureSuccess: (attachment: LocalAttachment, price: number, supplierName: string) => void;
}

export const WebReferenceModal: React.FC<WebReferenceModalProps> = ({
  isOpen,
  onClose,
  url,
  supplierName,
  price,
  itemName,
  itemQuantity = 1,
  onCaptureSuccess,
}) => {
  const [capturing, setCapturing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastCapturedImage, setLastCapturedImage] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Xử lý khi có ảnh chụp màn hình thực tế (từ Screen Capture, Paste Ctrl+V, hoặc Tải từ máy)
  const handleProcessActualScreenshot = async (rawImageBlob: Blob | File) => {
    setCapturing(true);
    setSuccessMsg(null);
    setErrorMessage(null);

    try {
      const now = new Date();

      // Đóng dấu ghi chú thực tế: Giá tại thời điểm chụp & Ngày giờ chụp lên bức ảnh chụp màn hình đó
      const stampedFile = await stampProofWatermarkOnImage(rawImageBlob, {
        itemName,
        itemQuantity,
        supplierName,
        price,
        sourceUrl: url,
        capturedAtDate: now,
      });

      const previewUrl = URL.createObjectURL(stampedFile);
      setLastCapturedImage({ url: previewUrl, name: stampedFile.name });

      const localAtt: LocalAttachment = {
        file: stampedFile,
        name: stampedFile.name,
        url: previewUrl,
        size: stampedFile.size,
        type: 'image/png',
        isLocal: true,
        capturedAt: now.toISOString(),
        selectedPrice: price,
        supplierName,
        sourceUrl: url,
      };

      onCaptureSuccess(localAtt, price, supplierName);

      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} - ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

      setSuccessMsg(
        `✅ Đã lưu ảnh chụp màn hình chứng cứ thực tế! Ghi chú giá: ${formatCurrency(price)} • Thời gian chụp: ${timeStr}. Ảnh đã sẵn sàng gửi cho Giám đốc/Chủ tịch duyệt.`
      );
    } catch (err: any) {
      setErrorMessage('Lỗi xử lý ảnh chụp màn hình: ' + (err.message || 'Không thể tạo chứng từ'));
    } finally {
      setCapturing(false);
    }
  };

  // 1. Chức năng Chụp trực tiếp màn hình Tab / Cửa sổ trang web bằng Screen Capture API
  const handleCaptureScreenTab = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setErrorMessage('Trình duyệt không hỗ trợ chụp tự động. Bạn hãy bấm "Mở Tab Mới" rồi dùng Win + Shift + S hoặc PrtScn để chụp, sau đó bấm Ctrl + V vào đây!');
      return;
    }

    setCapturing(true);
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as any,
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      await new Promise((res) => {
        video.onloadedmetadata = () => res(true);
      });

      // Đợi ổn định khung hình
      await new Promise((res) => setTimeout(res, 350));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      // Tắt stream sau khi đã chụp 1 frame ảnh
      stream.getTracks().forEach((track) => track.stop());

      canvas.toBlob(async (blob) => {
        if (blob) {
          await handleProcessActualScreenshot(blob);
        } else {
          setErrorMessage('Không thể trích xuất ảnh chụp từ màn hình');
          setCapturing(false);
        }
      }, 'image/png');
    } catch (err: any) {
      setCapturing(false);
      if (err.name !== 'NotAllowedError') {
        setErrorMessage('Không thể chụp tab: ' + err.message);
      }
    }
  };

  // 2. Chức năng Dán ảnh chụp màn hình (Ctrl + V) từ Snipping Tool hoặc PrtScn
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            handleProcessActualScreenshot(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, price, supplierName, itemName, url]);

  // 3. Chức năng Tải ảnh chụp màn hình từ tệp máy tính
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessActualScreenshot(file);
      e.target.value = '';
    }
  };

  // 4. Fallback tạo phiếu chứng nhận nếu người dùng không muốn cap màn hình
  const handleFallbackCanvasProof = async () => {
    setCapturing(true);
    setSuccessMsg(null);
    setErrorMessage(null);
    try {
      const now = new Date();
      const proofFile = await generatePriceProofCanvas({
        itemName,
        itemQuantity,
        supplierName,
        price,
        sourceUrl: url,
        capturedAtDate: now,
      });

      const previewUrl = URL.createObjectURL(proofFile);
      setLastCapturedImage({ url: previewUrl, name: proofFile.name });

      const localAtt: LocalAttachment = {
        file: proofFile,
        name: proofFile.name,
        url: previewUrl,
        size: proofFile.size,
        type: 'image/png',
        isLocal: true,
        capturedAt: now.toISOString(),
        selectedPrice: price,
        supplierName,
        sourceUrl: url,
      };

      onCaptureSuccess(localAtt, price, supplierName);
      setSuccessMsg(`✅ Đã lưu phiếu xác thực khảo giá với mức giá ${formatCurrency(price)}!`);
    } catch (err: any) {
      setErrorMessage('Lỗi tạo chứng từ: ' + err.message);
    } finally {
      setCapturing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '1150px',
          width: '95vw',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.75)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Store size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                  {supplierName}
                </span>
                <span className="badge badge-primary font-mono" style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                  {formatCurrency(price)}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Vật tư: <strong style={{ color: '#e2e8f0' }}>{itemName}</strong> (Số lượng: {itemQuantity})
              </div>
            </div>
          </div>

          {/* Các nút hành động chụp ảnh chứng cứ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* 1. NÚT CHỤP MÀN HÌNH TAB TRANG WEB */}
            <button
              type="button"
              onClick={handleCaptureScreenTab}
              disabled={capturing}
              className="btn btn-success"
              style={{
                gap: '0.45rem',
                fontSize: '0.825rem',
                fontWeight: 700,
                padding: '0.45rem 0.9rem',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
              }}
              title="Chụp lại chính xác ảnh màn hình trang web đối tác kèm dải ghi chú mức giá & ngày giờ chụp"
            >
              {capturing ? <Loader2 size={16} className="animate-spin" /> : <Monitor size={16} />}
              <span>{capturing ? 'Đang chụp...' : '🖥️ Chụp Màn Hình Trang Này'}</span>
            </button>

            {/* 2. NÚT DÁN ẢNH CHỤP MÀN HÌNH TỪ CLIPBOARD */}
            <button
              type="button"
              onClick={async () => {
                if (navigator.clipboard && navigator.clipboard.read) {
                  try {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                      const imageType = item.types.find((t) => t.startsWith('image/'));
                      if (imageType) {
                        const blob = await item.getType(imageType);
                        await handleProcessActualScreenshot(blob);
                        return;
                      }
                    }
                    alert('Chưa có ảnh trong bộ nhớ tạm. Hãy dùng phím Win + Shift + S để chụp màn hình trang web, sau đó bấm Ctrl + V vào đây!');
                  } catch (e: any) {
                    alert('Vui lòng bấm trực tiếp tổ hợp phím Ctrl + V trên bàn phím để dán ảnh chụp màn hình!');
                  }
                } else {
                  alert('Vui lòng bấm tổ hợp phím Ctrl + V trên bàn phím để dán ảnh chụp màn hình!');
                }
              }}
              className="btn btn-secondary btn-sm"
              style={{ gap: '0.35rem', fontSize: '0.8rem' }}
              title="Dán ảnh chụp màn hình bạn vừa chụp bằng Win+Shift+S hoặc PrtScn (Ctrl+V)"
            >
              <Clipboard size={14} />
              <span>Dán Ảnh (Ctrl+V)</span>
            </button>

            {/* 3. NÚT TẢI ẢNH CAP TỪ MÁY */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary btn-sm"
              style={{ gap: '0.35rem', fontSize: '0.8rem' }}
              title="Tải ảnh chụp màn hình có sẵn từ máy tính"
            >
              <Upload size={14} />
              <span>Tải Ảnh Cap</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />

            {/* 4. NÚT TRUY CẬP TRANG GỐC */}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{
                  gap: '0.35rem',
                  fontSize: '0.8rem',
                  backgroundColor: '#0284c7',
                  border: '1px solid #38bdf8',
                  color: '#ffffff',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
                }}
                title="Mở liên kết web gốc của nhà cung cấp trong tab mới ngoài trình duyệt để kiểm tra chi tiết giá"
              >
                <ExternalLink size={14} />
                <span>🔗 Truy Cập Trang</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm"
              style={{ padding: '0.4rem', color: 'var(--text-muted)' }}
              title="Đóng popup"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Thanh hướng dẫn 3 bước thao tác chuẩn */}
        <div
          style={{
            padding: '0.45rem 1.25rem',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.775rem',
            color: '#bae6fd',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📌 <strong>Cách lấy ảnh chứng cứ trang:</strong></span>
            <span>Cách 1: Bấm nút <strong>🖥️ Chụp Màn Hình Trang Này</strong></span>
            <span>•</span>
            <span>Cách 2: Nhấn <strong>Win + Shift + S</strong> để cap vùng sản phẩm rồi bấm <strong>Ctrl + V</strong> dán vào đây</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a7f3d0' }}>
            <span>Tự động in: <strong>Giá {formatCurrency(price)}</strong> & <strong>Ngày giờ chụp thực tế</strong></span>
          </div>
        </div>

        {/* Thông báo kết quả / Lỗi */}
        {successMsg && (
          <div
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '1rem' }}
            >
              ×
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding: '0.6rem 1.25rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={15} />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Khu vực hiển thị Trang web HOẶC Ảnh chụp màn hình vừa cap */}
        <div style={{ flex: 1, position: 'relative', backgroundColor: '#020617', display: 'flex', flexDirection: 'column' }}>
          {/* Nếu vừa chụp được ảnh, hiển thị khung xem trước ảnh chụp thực tế có đóng dấu */}
          {lastCapturedImage ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                overflowY: 'auto',
              }}
            >
              <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                  ✓ ẢNH CHỤP MÀN HÌNH CHỨNG CỨ THỰC TẾ ĐÃ ĐƯỢC ĐÓNG DẤU GIÁ & THỜI GIAN
                </span>
                <button
                  type="button"
                  onClick={() => setLastCapturedImage(null)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.725rem', padding: '0.2rem 0.5rem' }}
                >
                  Quay lại xem trang web
                </button>
              </div>
              <div
                style={{
                  maxWidth: '90%',
                  maxHeight: '65vh',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  border: '2px solid rgba(16, 185, 129, 0.4)',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
                }}
              >
                <img
                  src={lastCapturedImage.url}
                  alt="Ảnh chụp chứng cứ khảo giá"
                  style={{ width: '100%', height: 'auto', maxHeight: '65vh', objectFit: 'contain', display: 'block' }}
                />
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
                Ảnh trên đã được lưu vào danh sách chứng từ khảo giá của đơn mua sắm. Bạn có thể chụp lại bằng các nút phía trên hoặc đóng popup.
              </div>
            </div>
          ) : url ? (
            <iframe
              src={url}
              title={`Khảo giá ${supplierName}`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#ffffff',
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
                gap: '0.75rem',
              }}
            >
              <Store size={48} style={{ opacity: 0.4 }} />
              <div>Nhà cung cấp không có link web trực tiếp.</div>
              <div>Bạn có thể dùng <strong>Win + Shift + S</strong> để chụp màn hình từ ứng dụng đối tác rồi bấm <strong>Ctrl + V</strong> dán vào đây!</div>
            </div>
          )}

          {/* Dải điều khiển nổi phía chân popup hỗ trợ các trang chặn iframe */}
          {!lastCapturedImage && (
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 16,
                right: 16,
                padding: '0.65rem 1rem',
                backgroundColor: 'rgba(15, 23, 42, 0.94)',
                backdropFilter: 'blur(10px)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: '#e2e8f0',
                flexWrap: 'wrap',
                gap: '0.75rem',
                boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>💡</span>
                <span>
                  Nếu trang Shopee/Tiki/Lazada chặn nhúng iframe (màn hình trắng), hãy bấm nút{' '}
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: 700 }}
                  >
                    🔗 Truy Cập Trang
                  </a>
                  {' '}để kiểm tra trực tiếp giá sản phẩm, sau đó dùng nút <strong>🖥️ Chụp Màn Hình Trang Này</strong> hoặc ấn <strong>Win+Shift+S</strong> rồi quay lại đây bấm <strong>Ctrl+V</strong>!
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCaptureScreenTab}
                  disabled={capturing}
                  className="btn btn-success btn-sm"
                  style={{ gap: '0.35rem', fontWeight: 700 }}
                >
                  <Camera size={14} />
                  <span>Chụp Ảnh Màn Hình Thực Tế</span>
                </button>

                <button
                  type="button"
                  onClick={handleFallbackCanvasProof}
                  disabled={capturing}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem' }}
                  title="Tạo nhanh phiếu xác nhận khảo giá nếu không chụp màn hình"
                >
                  Tạo Phiếu Thẩm Định
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
