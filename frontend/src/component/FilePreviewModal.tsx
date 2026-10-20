import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  ExternalLink,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileCheck,
  Receipt,
  File as FileGeneric,
} from 'lucide-react';
import { formatFileSize } from '../utils/formatters';

export interface PreviewFileItem {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

export interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file?: PreviewFileItem | null;
  files?: PreviewFileItem[];
  fileList?: PreviewFileItem[];
  initialIndex?: number;
  currentIndex?: number;
  title?: string;
  onNavigate?: (index: number) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  files,
  fileList: aliasFileList,
  initialIndex = 0,
  currentIndex: controlledIndex,
  title,
  onNavigate,
}) => {
  // Tổng hợp danh sách tệp (hỗ trợ cả prop files và alias fileList)
  const resolvedFiles = (files && files.length > 0)
    ? files
    : (aliasFileList && aliasFileList.length > 0)
    ? aliasFileList
    : file
    ? [file]
    : [];
  const fileList: PreviewFileItem[] = resolvedFiles;

  const effectiveInitial = controlledIndex !== undefined ? controlledIndex : initialIndex;
  const [currentIndex, setCurrentIndex] = useState(effectiveInitial);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Đồng bộ index khi mở modal hoặc thay đổi initialIndex / file
  useEffect(() => {
    if (isOpen) {
      if (resolvedFiles.length > 0) {
        const foundIdx = file ? resolvedFiles.findIndex((f) => f.url === file.url) : -1;
        const targetIdx = foundIdx >= 0 ? foundIdx : Math.min(effectiveInitial, resolvedFiles.length - 1);
        setCurrentIndex(targetIdx);
        if (onNavigate) onNavigate(targetIdx);
      } else {
        setCurrentIndex(0);
      }
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, file, files, aliasFileList, effectiveInitial]);

  const currentFile = fileList[currentIndex] || null;

  // Reset transform khi đổi tệp
  const resetTransform = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleNext = useCallback(() => {
    if (fileList.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % fileList.length);
      resetTransform();
    }
  }, [fileList.length, resetTransform]);

  const handlePrev = useCallback(() => {
    if (fileList.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + fileList.length) % fileList.length);
      resetTransform();
    }
  }, [fileList.length, resetTransform]);

  // Phím tắt điều khiển
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(z + 0.25, 4));
      } else if (e.key === '-') {
        setZoom((z) => Math.max(z - 0.25, 0.5));
      } else if (e.key === '0') {
        resetTransform();
      } else if (e.key === 'r' || e.key === 'R') {
        setRotation((r) => (r + 90) % 360);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, handleNext, handlePrev, resetTransform]);

  if (!isOpen || !currentFile) return null;

  // Kiểm tra loại tệp
  const fileName = currentFile.name || 'Tai_lieu';
  const fileUrl = currentFile.url || '';
  const fileType = currentFile.type || '';

  const isImage =
    fileType.includes('image') ||
    /\.(jpg|jpeg|png|webp|gif|svg|bmp|ico)$/i.test(fileName) ||
    /\.(jpg|jpeg|png|webp|gif|svg|bmp|ico)$/i.test(fileUrl.split('?')[0]) ||
    fileUrl.startsWith('data:image/');

  const isPdf =
    fileType.includes('pdf') ||
    /\.pdf$/i.test(fileName) ||
    /\.pdf$/i.test(fileUrl.split('?')[0]);

  const isExcel =
    /\.(xlsx?|csv)$/i.test(fileName) ||
    fileType.includes('sheet') ||
    fileType.includes('excel');

  const isWord =
    /\.(docx?)$/i.test(fileName) ||
    fileType.includes('word') ||
    fileType.includes('officedocument');

  // Hàm in ấn
  const handlePrint = () => {
    if (isImage) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>In tài liệu - ${fileName}</title>
              <style>
                body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; background: #fff; }
                img { max-width: 100%; max-height: 96vh; object-fit: contain; }
                @media print { body { padding: 0; } img { width: 100%; } }
              </style>
            </head>
            <body>
              <img src="${fileUrl}" onload="window.print(); window.close();" />
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } else {
      window.open(fileUrl, '_blank');
    }
  };

  // Kéo chuột di chuyển ảnh khi zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Lăn chuột zoom ảnh
  const handleWheel = (e: React.WheelEvent) => {
    if (isImage) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoom((z) => Math.min(z + 0.15, 4));
      } else {
        setZoom((z) => Math.max(z - 0.15, 0.5));
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 15, 29, 0.92)',
        backdropFilter: 'blur(10px)',
        zIndex: 1050,
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      {/* 1. THANH TIÊU ĐỀ & CÔNG CỤ (HEADER) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.5rem',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#ffffff',
          zIndex: 10,
          gap: '1rem',
          flexWrap: 'wrap',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thông tin tên file & số thứ tự */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              backgroundColor: isImage
                ? 'rgba(56, 189, 248, 0.15)'
                : isPdf
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isImage ? '#38bdf8' : isPdf ? '#f87171' : 'var(--primary)',
              flexShrink: 0,
            }}
          >
            {isImage ? (
              <ImageIcon size={20} />
            ) : isPdf ? (
              <FileText size={20} />
            ) : isExcel ? (
              <FileSpreadsheet size={20} />
            ) : isWord ? (
              <FileCheck size={20} />
            ) : (
              <FileGeneric size={20} />
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '420px',
                }}
                title={fileName}
              >
                {title ? `${title}: ${fileName}` : fileName}
              </h3>
              {fileList.length > 1 && (
                <span
                  className="badge badge-info"
                  style={{ fontSize: '0.725rem', padding: '0.15rem 0.5rem' }}
                >
                  {currentIndex + 1} / {fileList.length}
                </span>
              )}
            </div>
            {currentFile.size && (
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                {formatFileSize(currentFile.size)}
              </span>
            )}
          </div>
        </div>

        {/* CÁC NÚT ĐIỀU KHIỂN & CÔNG CỤ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {/* Nhóm nút Zoom / Xoay (Áp dụng khi xem ảnh) */}
          {isImage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderRadius: 'var(--radius-md)',
                padding: '0.2rem 0.4rem',
                marginRight: '0.5rem',
              }}
            >
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.35rem', color: '#e2e8f0' }}
                title="Thu nhỏ (-)"
              >
                <ZoomOut size={16} />
              </button>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  minWidth: '45px',
                  textAlign: 'center',
                  color: '#94a3b8',
                }}
              >
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.35rem', color: '#e2e8f0' }}
                title="Phóng to (+)"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={resetTransform}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.35rem', color: '#e2e8f0' }}
                title="Vừa màn hình / Cỡ chuẩn (0)"
              >
                <Maximize2 size={15} />
              </button>
              <div style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 0.2rem' }} />
              <button
                type="button"
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.35rem', color: '#e2e8f0' }}
                title="Xoay trái 90°"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.35rem', color: '#e2e8f0' }}
                title="Xoay phải 90° (R)"
              >
                <RotateCw size={15} />
              </button>
            </div>
          )}

          {/* Mở tab mới */}
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.775rem', gap: '0.35rem', padding: '0.35rem 0.65rem' }}
            title="Mở tài liệu trong tab mới"
          >
            <ExternalLink size={14} />
            <span>Mở Tab Mới</span>
          </a>

          {/* In tài liệu */}
          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.775rem', gap: '0.35rem', padding: '0.35rem 0.65rem' }}
            title="In tài liệu hoặc hóa đơn"
          >
            <Printer size={14} />
            <span>In</span>
          </button>

          {/* Tải về */}
          <a
            href={fileUrl}
            download={fileName}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.775rem', gap: '0.35rem', padding: '0.35rem 0.65rem', color: 'var(--success)' }}
            title="Tải tệp tin về máy"
          >
            <Download size={14} />
            <span>Tải Về</span>
          </a>

          {/* Đóng Modal */}
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{
              padding: '0.45rem',
              color: '#ffffff',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderRadius: 'var(--radius-md)',
              marginLeft: '0.25rem',
            }}
            title="Đóng (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 2. KHU VỰC HIỂN THỊ NỘI DUNG (MAIN VIEWER CANVAS) */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0d14',
          cursor: isImage && zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Nút điều hướng tệp Trước / Sau ở 2 bên */}
        {fileList.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              style={{
                position: 'absolute',
                left: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 20,
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
              title="Tệp trước (Phím mũi tên trái)"
            >
              <ChevronLeft size={24} />
            </button>

            <button
              type="button"
              onClick={handleNext}
              style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 20,
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
              title="Tệp tiếp theo (Phím mũi tên phải)"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        {/* VIEW THEO LOẠI TỆP */}
        {isImage ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              padding: '1.5rem',
            }}
          >
            <img
              src={fileUrl}
              alt={fileName}
              draggable={false}
              style={{
                maxWidth: '94%',
                maxHeight: '94%',
                objectFit: 'contain',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65)',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                transform: `scale(${zoom}) rotate(${rotation}deg) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              }}
            />
          </div>
        ) : isPdf ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <iframe
              src={`${fileUrl}#toolbar=1&navpanes=1`}
              title={fileName}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#ffffff',
              }}
            />
          </div>
        ) : (
          /* File Word, Excel hoặc các định dạng văn phòng khác */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '2.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--border-color)',
              maxWidth: '560px',
              margin: 'auto',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                backgroundColor: isExcel
                  ? 'rgba(16, 185, 129, 0.15)'
                  : isWord
                  ? 'rgba(59, 130, 246, 0.15)'
                  : 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
                color: isExcel ? 'var(--success)' : isWord ? '#38bdf8' : 'var(--primary)',
              }}
            >
              {isExcel ? <FileSpreadsheet size={36} /> : <FileCheck size={36} />}
            </div>

            <h4 style={{ fontSize: '1.15rem', color: '#ffffff', marginBottom: '0.4rem', fontWeight: 700 }}>
              {fileName}
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Tài liệu định dạng <strong>{fileName.split('.').pop()?.toUpperCase()}</strong>. Bạn có thể mở trực tiếp trong tab mới hoặc tải về máy tính để xem và chỉnh sửa bằng phần mềm chuyên dụng.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ gap: '0.4rem' }}
              >
                <ExternalLink size={15} />
                <span>Mở Trong Tab Mới</span>
              </a>
              <a
                href={fileUrl}
                download={fileName}
                className="btn btn-primary"
                style={{ gap: '0.4rem' }}
              >
                <Download size={15} />
                <span>Tải Tệp Về Máy</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* 3. THANH DANH SÁCH THUMBNAIL (NẾU CÓ NHIỀU HƠN 1 TỆP) */}
      {fileList.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.65rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            overflowX: 'auto',
            maxHeight: '90px',
            zIndex: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {fileList.map((item, idx) => {
            const isThumbImg =
              item.type?.includes('image') ||
              /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(item.name || item.url);
            const isSelected = idx === currentIndex;

            return (
              <div
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  resetTransform();
                }}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--accent-cyan)' : '1px solid rgba(255, 255, 255, 0.15)',
                  opacity: isSelected ? 1 : 0.6,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  flexShrink: 0,
                  transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                }}
                title={item.name}
              >
                {isThumbImg ? (
                  <img
                    src={item.url}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <FileText size={20} color={isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
