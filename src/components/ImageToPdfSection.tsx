import { useState, useCallback } from 'react';
import { Download, FileText, Image, Loader2, Check, Trash2, FileStack, File, ScanLine } from 'lucide-react';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ImageDropZone } from '@/components/ImageDropZone';
import { formatFileSize, generateId } from '@/lib/utils';
import { scanDocument, type ScanOptions } from '@/lib/documentScanner';
import { compressPdf } from '@/lib/compressPdf';

type OutputMode = 'single' | 'separate';
type ConversionStatus = 'pending' | 'scanning' | 'converting' | 'compressing' | 'completed' | 'error';

interface ConvertedFile {
  id: string;
  name: string;
  originalSize: number;
  finalSize?: number;
  pdfBlob?: Blob;
  status: ConversionStatus;
  progress: number;
  error?: string;
}

export function ImageToPdfSection() {
  const [outputMode, setOutputMode] = useState<OutputMode>('single');
  const [files, setFiles] = useState<ConvertedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Convert blob to base64 for jsPDF
  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Convert scanned image to PDF
  const imageToPdf = async (imageBlob: Blob): Promise<Blob> => {
    const dataUrl = await blobToDataUrl(imageBlob);

    // Load to get dimensions
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    // Create PDF matching image dimensions
    const orientation = img.width > img.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [img.width, img.height]
    });

    pdf.addImage(dataUrl, 'JPEG', 0, 0, img.width, img.height);
    return pdf.output('blob');
  };

  // Convert multiple scanned images to single PDF
  const imagesToSinglePdf = async (imageBlobs: Blob[]): Promise<Blob> => {
    const pdf = new jsPDF();

    for (let i = 0; i < imageBlobs.length; i++) {
      const dataUrl = await blobToDataUrl(imageBlobs[i]);

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      // Scale to fit page
      let width = img.width;
      let height = img.height;
      const scale = Math.min(
        (pageWidth - margin * 2) / width,
        (pageHeight - margin * 2) / height,
        1
      );
      width *= scale;
      height *= scale;

      // Center on page
      const x = (pageWidth - width) / 2;
      const y = (pageHeight - height) / 2;

      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, 'JPEG', x, y, width, height);
    }

    return pdf.output('blob');
  };

  const processImages = async (images: File[]) => {
    setIsProcessing(true);
    const scanOptions: ScanOptions = { enhance: true };

    if (outputMode === 'single') {
      const fileId = generateId();
      const filename = images.length === 1 ?
      images[0].name.replace(/\.[^.]+$/, '.pdf') :
      'scanned-documents.pdf';

      setFiles([{
        id: fileId,
        name: filename,
        originalSize: images.reduce((sum, f) => sum + f.size, 0),
        status: 'scanning',
        progress: 10
      }]);

      try {
        // Scan all images
        const scannedBlobs: Blob[] = [];
        for (let i = 0; i < images.length; i++) {
          const scanned = await scanDocument(images[i], scanOptions);
          scannedBlobs.push(scanned);

          const progress = 10 + Math.round((i + 1) / images.length * 40);
          setFiles((prev) => prev.map((f) =>
          f.id === fileId ? { ...f, progress } : f
          ));
        }

        // Convert to PDF
        setFiles((prev) => prev.map((f) =>
        f.id === fileId ? { ...f, status: 'converting', progress: 55 } : f
        ));

        const pdfBlob = await imagesToSinglePdf(scannedBlobs);

        // Compress PDF
        setFiles((prev) => prev.map((f) =>
        f.id === fileId ? { ...f, status: 'compressing', progress: 75 } : f
        ));

        const compressed = await compressPdf(pdfBlob, filename);

        setFiles((prev) => prev.map((f) =>
        f.id === fileId ? {
          ...f,
          status: 'completed',
          progress: 100,
          pdfBlob: compressed.blob,
          finalSize: compressed.compressedSize
        } : f
        ));
      } catch (error) {
        console.error('Processing error:', error);
        setFiles((prev) => prev.map((f) =>
        f.id === fileId ? {
          ...f,
          status: 'error',
          error: error instanceof Error ? error.message : 'Processing failed'
        } : f
        ));
      }
    } else {
      // Separate PDFs
      const newFiles: ConvertedFile[] = images.map((img) => ({
        id: generateId(),
        name: img.name.replace(/\.[^.]+$/, '.pdf'),
        originalSize: img.size,
        status: 'scanning' as const,
        progress: 10
      }));

      setFiles(newFiles);

      await Promise.all(images.map(async (image, index) => {
        const fileId = newFiles[index].id;
        const filename = newFiles[index].name;

        try {
          const scanned = await scanDocument(image, scanOptions);

          setFiles((prev) => prev.map((f) =>
          f.id === fileId ? { ...f, status: 'converting', progress: 40 } : f
          ));

          const pdfBlob = await imageToPdf(scanned);

          // Compress PDF
          setFiles((prev) => prev.map((f) =>
          f.id === fileId ? { ...f, status: 'compressing', progress: 70 } : f
          ));

          const compressed = await compressPdf(pdfBlob, filename);

          setFiles((prev) => prev.map((f) =>
          f.id === fileId ? {
            ...f,
            status: 'completed',
            progress: 100,
            pdfBlob: compressed.blob,
            finalSize: compressed.compressedSize
          } : f
          ));
        } catch (error) {
          console.error('Processing error:', error);
          setFiles((prev) => prev.map((f) =>
          f.id === fileId ? {
            ...f,
            status: 'error',
            error: error instanceof Error ? error.message : 'Processing failed'
          } : f
          ));
        }
      }));
    }

    setIsProcessing(false);
  };

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    processImages(selectedFiles);
  }, [outputMode]);

  const handleDownload = (file: ConvertedFile) => {
    if (!file.pdfBlob) return;
    const url = URL.createObjectURL(file.pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    const completed = files.filter((f) => f.status === 'completed' && f.pdfBlob);
    if (completed.length === 0) return;

    if (completed.length === 1) {
      handleDownload(completed[0]);
      return;
    }

    const zip = new JSZip();
    completed.forEach((f) => f.pdfBlob && zip.file(f.name, f.pdfBlob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'scanned-documents.zip');
  };

  const handleRemove = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const handleReset = () => {setFiles([]);setIsProcessing(false);};

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const hasFiles = files.length > 0;

  return (
    <div data-ev-id="ev_f986bfcddd">
      {!hasFiles ?
      <div data-ev-id="ev_ced241d0c3" className="py-0">
          {/* Hero */}
          <div data-ev-id="ev_2d336031e2" className="text-center mb-2">
            <h2 data-ev-id="ev_232c9c406a" className="text-gray-900 font-bold text-3xl mb-2">Scan & Convert to PDF</h2>
            <p data-ev-id="ev_38f727ed6f" className="text-lg text-muted-foreground max-w-md mx-auto">
              Auto-detect documents, fix perspective, and enhance quality.
            </p>
          </div>

          {/* Options */}
          <div data-ev-id="ev_e5c5280246" className="flex-col items-center mb-2 gap-4 flex">
            {/* Output mode toggle */}
            <div data-ev-id="ev_1cc8e1cf44" className="inline-flex items-center gap-1 p-1 bg-muted rounded-xl">
              <button data-ev-id="ev_8e0b0e9d38"
            onClick={() => setOutputMode('single')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            outputMode === 'single' ?
            'bg-white text-gray-900 shadow-sm' :
            'text-muted-foreground hover:text-gray-900'}`
            }>

                <FileStack className="w-4 h-4" />
                Single PDF
              </button>
              <button data-ev-id="ev_649224e35b"
            onClick={() => setOutputMode('separate')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            outputMode === 'separate' ?
            'bg-white text-gray-900 shadow-sm' :
            'text-muted-foreground hover:text-gray-900'}`
            }>

                <File className="w-4 h-4" />
                Separate PDFs
              </button>
            </div>
          </div>

          <p data-ev-id="ev_e22c66d306" className="text-muted-foreground text-sm text-center mb-2">
            {outputMode === 'single' ?
          'All images will be scanned and combined into one PDF' :
          'Each image will be scanned and saved as its own PDF'}
          </p>

          <ImageDropZone onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />

          {/* Features */}
          <div data-ev-id="ev_a9e76308b0" className="mt-12 grid grid-cols-4 gap-4 text-center">
            <div data-ev-id="ev_6ebdd434ff">
              <div data-ev-id="ev_12a42f3e3b" className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                <ScanLine className="w-5 h-5" />
              </div>
              <h3 data-ev-id="ev_e3c19db56a" className="font-medium text-gray-900 text-sm mb-1">Edge Detection</h3>
              <p data-ev-id="ev_3553c5f17c" className="text-xs text-muted-foreground">Auto-find document</p>
            </div>
            <div data-ev-id="ev_9a3a65dbfb">
              <div data-ev-id="ev_71090c896d" className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center mx-auto mb-2">
                <svg data-ev-id="ev_60ce258979" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path data-ev-id="ev_a1069e9985" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </div>
              <h3 data-ev-id="ev_1122f72afc" className="font-medium text-gray-900 text-sm mb-1">Perspective Fix</h3>
              <p data-ev-id="ev_459658b991" className="text-xs text-muted-foreground">Straighten skewed</p>
            </div>
            <div data-ev-id="ev_25a56f6c9e">
              <div data-ev-id="ev_592882eef8" className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-2">
                <svg data-ev-id="ev_58247666ad" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path data-ev-id="ev_21c108cbe7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 data-ev-id="ev_5cf566c66d" className="font-medium text-gray-900 text-sm mb-1">Auto Enhance</h3>
              <p data-ev-id="ev_77ac6cee5a" className="text-xs text-muted-foreground">Better contrast</p>
            </div>
            <div data-ev-id="ev_688475f438">
              <div data-ev-id="ev_056820e75a" className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <h3 data-ev-id="ev_8a3c70622f" className="font-medium text-gray-900 text-sm mb-1">High Quality</h3>
              <p data-ev-id="ev_e51c7c3eb2" className="text-xs text-muted-foreground">PDF output</p>
            </div>
          </div>
        </div> :

      <div data-ev-id="ev_cf46b5e843" className="flex flex-col gap-6">
          {/* Stats */}
          {completedCount > 0 &&
        <div data-ev-id="ev_e4182c94af" className="grid grid-cols-2 gap-4">
              <div data-ev-id="ev_f278e62189" className="bg-surface rounded-xl border border-border p-4 text-center">
                <div data-ev-id="ev_218ae982b8" className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                  <FileText className="w-5 h-5" />
                </div>
                <p data-ev-id="ev_e1747af6d9" className="text-2xl font-bold text-gray-900">{completedCount}</p>
                <p data-ev-id="ev_a790ad4748" className="text-sm text-muted-foreground">PDFs created</p>
              </div>
              <div data-ev-id="ev_04fafd5c6e" className="bg-surface rounded-xl border border-border p-4 text-center">
                <div data-ev-id="ev_3447855f45" className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center mx-auto mb-2">
                  <Check className="w-5 h-5" />
                </div>
                <p data-ev-id="ev_88f9c68acc" className="text-2xl font-bold text-gray-900">Scanned</p>
                <p data-ev-id="ev_46f04d4559" className="text-sm text-muted-foreground">& enhanced</p>
              </div>
            </div>
        }

          {/* File list */}
          <div data-ev-id="ev_ddc03dd1e1" className="flex flex-col gap-3">
            {files.map((file) =>
          <div data-ev-id="ev_edb22a2324" key={file.id} className="bg-surface rounded-xl border border-border p-4">
                <div data-ev-id="ev_72f1ca83c1" className="flex items-start gap-4">
                  <div data-ev-id="ev_9dc5f73767" className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              file.status === 'completed' ? 'bg-success/10 text-success' :
              file.status === 'error' ? 'bg-destructive/10 text-destructive' :
              'bg-primary/10 text-primary'}`
              }>
                    {['scanning', 'converting', 'compressing'].includes(file.status) ?
                <Loader2 className="w-6 h-6 animate-spin" /> :
                file.status === 'completed' ?
                <Check className="w-6 h-6" /> :

                <Image className="w-6 h-6" />
                }
                  </div>

                  <div data-ev-id="ev_229891c96f" className="flex-1 min-w-0">
                    <h4 data-ev-id="ev_dffdd320a7" className="font-medium text-gray-900 truncate">{file.name}</h4>

                    {['scanning', 'converting', 'compressing'].includes(file.status) &&
                <div data-ev-id="ev_cdbd1bc7d8" className="mt-2">
                        <div data-ev-id="ev_43158ee08d" className="flex justify-between text-sm text-muted-foreground mb-1">
                          <span data-ev-id="ev_0d71bd5f70">{file.status === 'scanning' ? 'Scanning...' : file.status === 'converting' ? 'Creating PDF...' : 'Compressing...'}</span>
                          <span data-ev-id="ev_19c4d887c2">{file.progress}%</span>
                        </div>
                        <div data-ev-id="ev_15d769bc62" className="h-2 bg-muted rounded-full overflow-hidden">
                          <div data-ev-id="ev_27934cf765"
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${file.progress}%` }} />

                        </div>
                      </div>
                }

                    {file.status === 'completed' && file.finalSize &&
                <div data-ev-id="ev_6af58954e9" className="mt-2 flex items-center gap-3 text-sm">
                        <span data-ev-id="ev_4237c65288" className="font-semibold text-gray-900">{formatFileSize(file.finalSize)}</span>
                        <span data-ev-id="ev_8854302ff6" className="px-2 py-0.5 bg-success/10 text-success rounded-full text-xs font-semibold">Ready</span>
                      </div>
                }

                    {file.status === 'error' &&
                <p data-ev-id="ev_8442ca0b21" className="mt-1 text-sm text-destructive">{file.error}</p>
                }
                  </div>

                  <div data-ev-id="ev_a02e334ba6" className="flex items-center gap-2">
                    {file.status === 'completed' &&
                <button data-ev-id="ev_680b616adf"
                onClick={() => handleDownload(file)}
                className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90">

                        <Download className="w-5 h-5" />
                      </button>
                }
                    <button data-ev-id="ev_0872b12c5f"
                onClick={() => handleRemove(file.id)}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">

                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
          )}
          </div>

          {/* Actions */}
          {completedCount > 0 &&
        <div data-ev-id="ev_3884bfb776" className="flex justify-center gap-3">
              <button data-ev-id="ev_3451fefce9"
          onClick={handleDownloadAll}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90">

                <Download className="w-5 h-5" />
                {completedCount > 1 ? 'Download All (ZIP)' : 'Download PDF'}
              </button>
              <button data-ev-id="ev_e2af000861"
          onClick={handleReset}
          className="px-6 py-3 text-muted-foreground hover:text-gray-900 font-medium">

                Scan More
              </button>
            </div>
        }
        </div>
      }
    </div>);

}
