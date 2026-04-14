import { useState, useCallback } from 'react';
import { Upload, Image } from 'lucide-react';

interface ImageDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function ImageDropZone({ onFilesSelected, isProcessing }: ImageDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (isProcessing) return;

      const files = Array.from(e.dataTransfer.files).filter((file) =>
      ACCEPTED_IMAGE_TYPES.includes(file.type)
      );

      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected, isProcessing]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isProcessing) return;

      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) {
        onFilesSelected(files);
      }
      e.target.value = '';
    },
    [onFilesSelected, isProcessing]
  );

  return (
    <div data-ev-id="ev_acc846aa6a"
    onDragOver={handleDragOver}
    onDragLeave={handleDragLeave}
    onDrop={handleDrop}
    className={`
        relative w-full max-w-2xl mx-auto p-12 rounded-2xl border-2 border-dashed
        transition-all duration-300 ease-out cursor-pointer
        ${isDragOver ?
    'border-primary bg-primary/5 scale-[1.02]' :
    'border-border bg-surface hover:border-primary/50 hover:bg-muted'}
        ${isProcessing ? 'pointer-events-none opacity-50' : ''}
      `}>

      <input data-ev-id="ev_2786c284bd"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      multiple
      onChange={handleFileInput}
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      disabled={isProcessing} />


      <div data-ev-id="ev_65d4bfef6e" className="flex flex-col items-center gap-4 text-center">
        <div data-ev-id="ev_53f2e17d67"
        className={`
            w-16 h-16 rounded-2xl flex items-center justify-center
            transition-all duration-300
            ${isDragOver ? 'bg-primary text-white scale-110' : 'bg-primary/10 text-primary'}
          `}>

          {isDragOver ? <Image className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
        </div>

        <div data-ev-id="ev_0fc9880796">
          <h3 data-ev-id="ev_5a993ce87c" className="text-lg font-semibold text-gray-900 mb-1">
            {isDragOver ? 'Drop your images here' : 'Drag & drop images here'}
          </h3>
          <p data-ev-id="ev_99f741a804" className="text-sm text-muted-foreground">
            or <span data-ev-id="ev_813af8240c" className="text-primary font-medium">browse files</span> from your device
          </p>
        </div>

        <div data-ev-id="ev_60fb69701c" className="flex items-center gap-2 text-xs text-muted-foreground">
          <span data-ev-id="ev_e9d3321cfa" className="px-2 py-1 bg-muted rounded-md">JPG</span>
          <span data-ev-id="ev_991726d1a5" className="px-2 py-1 bg-muted rounded-md">PNG</span>
          <span data-ev-id="ev_8b5143219b" className="px-2 py-1 bg-muted rounded-md">WebP</span>
          <span data-ev-id="ev_7a4b976f0a" className="px-2 py-1 bg-muted rounded-md">GIF</span>
        </div>
      </div>
    </div>);

}
