import { useState, useCallback } from 'react';
import { Upload, FileText, Image } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
}

// Accepted file types
const ACCEPTED_TYPES = [
'application/pdf',
'image/jpeg',
'image/jpg',
'image/png',
'image/webp',
'image/heic',
'image/heif'];


const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif';

export function DropZone({ onFilesSelected, isProcessing }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const isValidFile = (file: File): boolean => {
    return ACCEPTED_TYPES.includes(file.type) ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif');
  };

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

      const files = Array.from(e.dataTransfer.files).filter(isValidFile);

      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected, isProcessing]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isProcessing) return;

      const files = e.target.files ? Array.from(e.target.files).filter(isValidFile) : [];
      if (files.length > 0) {
        onFilesSelected(files);
      }
      e.target.value = '';
    },
    [onFilesSelected, isProcessing]
  );

  return (
    <div data-ev-id="ev_343af36c84"
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

      <input data-ev-id="ev_93ac219cfc"
      type="file"
      accept={ACCEPTED_EXTENSIONS}
      multiple
      onChange={handleFileInput}
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      disabled={isProcessing} />


      <div data-ev-id="ev_0cdca4c71d" className="flex flex-col items-center gap-4 text-center">
        <div data-ev-id="ev_c939ad96bc" className={`
          w-16 h-16 rounded-2xl flex items-center justify-center
          transition-all duration-300
          ${isDragOver ? 'bg-primary text-white scale-110' : 'bg-primary/10 text-primary'}
        `}>
          {isDragOver ?
          <FileText className="w-8 h-8" /> :

          <Upload className="w-8 h-8" />
          }
        </div>

        <div data-ev-id="ev_49b068095d">
          <h3 data-ev-id="ev_e434d1598a" className="text-lg font-semibold text-gray-900 mb-1">
            {isDragOver ? 'Drop your files here' : 'Drag & drop files here'}
          </h3>
          <p data-ev-id="ev_24dfee0858" className="text-sm text-muted-foreground">
            or <span data-ev-id="ev_7decf7d50d" className="text-primary font-medium">browse files</span> from your device
          </p>
        </div>

        <div data-ev-id="ev_b3283ca7e4" className="flex items-center gap-2 text-xs text-muted-foreground">
          <span data-ev-id="ev_932f39e985" className="px-2 py-1 bg-muted rounded-md flex items-center gap-1">
            <FileText className="w-3 h-3" /> PDF
          </span>
          <span data-ev-id="ev_49073cb1a2" className="px-2 py-1 bg-muted rounded-md flex items-center gap-1">
            <Image className="w-3 h-3" /> Images
          </span>
          <span data-ev-id="ev_19c868ea6f">Up to 50MB per file</span>
        </div>
      </div>
    </div>);

}
