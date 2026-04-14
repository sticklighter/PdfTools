import { FileText, Download, Check, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

export type FileStatus = 'pending' | 'compressing' | 'completed' | 'error';

export interface CompressedFile {
  id: string;
  originalFile: File;
  originalSize: number;
  status: FileStatus;
  progress: number;
  error?: string;
  compressedSize?: number;
  compressedBlob?: Blob;
  alreadyOptimized?: boolean;
  progressText?: string; // Current compression stage text
}

interface FileCardProps {
  file: CompressedFile;
  onDownload: (file: CompressedFile) => void;
  onRemove: (id: string) => void;
}

export function FileCard({ file, onDownload, onRemove }: FileCardProps) {
  const savings = file.compressedSize ?
  Math.round((1 - file.compressedSize / file.originalSize) * 100) :
  0;
  const isAlreadyOptimized = file.alreadyOptimized || savings <= 0;

  return (
    <div data-ev-id="ev_08b8386be5" className="bg-surface rounded-xl border border-border p-4 transition-all duration-200 hover:shadow-md">
      <div data-ev-id="ev_b753ee9613" className="flex items-start gap-4">
        {/* Icon */}
        <div data-ev-id="ev_3b2b42677e" className={`
          w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
          ${file.status === 'completed' ? 'bg-success/10 text-success' : ''}
          ${file.status === 'error' ? 'bg-destructive/10 text-destructive' : ''}
          ${file.status === 'pending' || file.status === 'compressing' ? 'bg-primary/10 text-primary' : ''}
        `}>
          {file.status === 'compressing' ?
          <Loader2 className="w-6 h-6 animate-spin" /> :
          file.status === 'completed' ?
          <Check className="w-6 h-6" /> :
          file.status === 'error' ?
          <AlertCircle className="w-6 h-6" /> :

          <FileText className="w-6 h-6" />
          }
        </div>

        {/* Content */}
        <div data-ev-id="ev_7833fc96ad" className="flex-1 min-w-0">
          <div data-ev-id="ev_754e6cbfb4" className="flex items-center justify-between">
            <h4 data-ev-id="ev_9d51cdf958" className="font-medium text-gray-900 truncate pr-2">
              {file.originalFile.name}
            </h4>
            <button data-ev-id="ev_a80a4c2f1e"
            onClick={() => onRemove(file.id)}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
            title="Remove">

              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          {/* Compressing state */}
          {file.status === 'compressing' &&
          <div data-ev-id="ev_90c828f92f" className="mt-2">
              <div data-ev-id="ev_c63f2259e5" className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                <span data-ev-id="ev_87d3906c6e">{file.progressText || 'Compressing...'}</span>
                <span data-ev-id="ev_ca6520285e">{file.progress}%</span>
              </div>
              <div data-ev-id="ev_89cd09d93f" className="h-2 bg-muted rounded-full overflow-hidden">
                <div data-ev-id="ev_3c3f5b04c5"
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${file.progress}%` }} />

              </div>
            </div>
          }

          {/* Completed state */}
          {file.status === 'completed' && file.compressedSize &&
          <div data-ev-id="ev_adb4b30de3" className="mt-2">
              <div data-ev-id="ev_d2b4849fec" className="flex items-center gap-4 text-sm">
                <div data-ev-id="ev_92b8ef3bcf" className="flex items-center gap-2">
                  {isAlreadyOptimized ?
                <span data-ev-id="ev_f065cda7ee" className="font-semibold text-gray-900">
                      {formatFileSize(file.originalSize)}
                    </span> :

                <>
                      <span data-ev-id="ev_a0e01d604a" className="text-muted-foreground line-through">
                        {formatFileSize(file.originalSize)}
                      </span>
                      <span data-ev-id="ev_cb2b7e075d" className="text-gray-400">→</span>
                      <span data-ev-id="ev_227ec30008" className="font-semibold text-gray-900">
                        {formatFileSize(file.compressedSize)}
                      </span>
                    </>
                }
                </div>
                <span data-ev-id="ev_b28c1f4772"
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              isAlreadyOptimized ?
              'bg-muted text-muted-foreground' :
              'bg-success/10 text-success'}`
              }>

                  {isAlreadyOptimized ? 'Already optimized' : `${savings}% smaller`}
                </span>
              </div>
            </div>
          }

          {/* Pending state */}
          {file.status === 'pending' &&
          <p data-ev-id="ev_2a266efe68" className="mt-1 text-sm text-muted-foreground">
              {formatFileSize(file.originalSize)} • Waiting to compress
            </p>
          }

          {/* Error state */}
          {file.status === 'error' &&
          <p data-ev-id="ev_490430eda2" className="mt-1 text-sm text-destructive">
              {file.error || 'Compression failed'}
            </p>
          }
        </div>

        {/* Download button */}
        {file.status === 'completed' &&
        <button data-ev-id="ev_37bf0e2119"
        onClick={() => onDownload(file)}
        className="p-3 rounded-xl bg-success text-white hover:bg-success/90 transition-colors flex-shrink-0"
        title="Download">

            <Download className="w-5 h-5" />
          </button>
        }
      </div>
    </div>);

}
