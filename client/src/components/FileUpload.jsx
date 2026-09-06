import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, UploadCloud, X } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * Modern drag-and-drop file upload zone with live thumbnail preview.
 */
const FileUpload = ({
  label,
  file,
  onChange,
  accept = 'image/jpeg,image/png,image/webp',
  currentImageUrl,
  className = '',
}) => {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(currentImageUrl || null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, currentImageUrl]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      onChange(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onChange(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </label>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'relative flex cursor-pointer items-center gap-4 rounded-lg border-2 border-dashed p-3 transition-all duration-150',
          isDragging
            ? 'border-brand-500 bg-brand-50/50'
            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              onChange(e.target.files[0]);
            }
          }}
        />

        {preview ? (
          <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
            <img
              src={preview}
              alt="Upload preview"
              className="size-full object-contain"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-red-600"
              title="Remove image"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400">
            <ImageIcon className="size-6" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          {file ? (
            <div>
              <p className="truncate text-xs font-medium text-slate-900">{file.name}</p>
              <p className="text-[11px] text-slate-400">
                {(file.size / 1024).toFixed(1)} KB · Click to replace
              </p>
            </div>
          ) : currentImageUrl ? (
            <div>
              <p className="text-xs font-medium text-slate-700">Existing product image</p>
              <p className="text-[11px] text-slate-400">Click to upload new image</p>
            </div>
          ) : (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <UploadCloud className="size-4 text-brand-600" />
                <span>Upload an image</span>
              </p>
              <p className="text-[11px] text-slate-400">
                Drag and drop or browse (PNG, JPG, WebP)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
