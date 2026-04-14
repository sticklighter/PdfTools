import { useState, useCallback } from 'react';
import { Download, RefreshCw, Zap, FileStack, File } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { DropZone } from '@/components/DropZone';
import { FileCard, type CompressedFile } from '@/components/FileCard';
import { CompressionStats } from '@/components/CompressionStats';
import { generateId } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { scanDocument } from '@/lib/documentScanner';

type OutputMode = 'single' | 'separate';

// Check if file is an image
const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/') ||
  file.name.toLowerCase().endsWith('.heic') ||
  file.name.toLowerCase().endsWith('.heif');
};

// Check if file is a PDF
const isPdfFile = (file: File): boolean => {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
};

export default function Index() {
  const [outputMode, setOutputMode] = useState<OutputMode>('separate');
  const [files, setFiles] = useState<CompressedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Convert base64 to blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // Convert blob to data URL for jsPDF
  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Convert single image to PDF
  const imageToPdf = async (imageBlob: Blob): Promise<Blob> => {
    const dataUrl = await blobToDataUrl(imageBlob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const orientation = img.width > img.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'px', format: [img.width, img.height] });
    pdf.addImage(dataUrl, 'JPEG', 0, 0, img.width, img.height);
    return pdf.output('blob');
  };

  // Convert multiple images to single PDF
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

      let width = img.width;
      let height = img.height;
      const scale = Math.min(
        (pageWidth - margin * 2) / width,
        (pageHeight - margin * 2) / height,
        1
      );
      width *= scale;
      height *= scale;

      const x = (pageWidth - width) / 2;
      const y = (pageHeight - height) / 2;

      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, 'JPEG', x, y, width, height);
    }

    return pdf.output('blob');
  };

  // Merge multiple PDFs into one using pdf-lib
  const mergePdfs = async (pdfBlobs: Blob[]): Promise<Blob> => {
    const mergedPdf = await PDFDocument.create();

    for (const pdfBlob of pdfBlobs) {
      const pdfBytes = await pdfBlob.arrayBuffer();
      const pdf = await PDFDocument.load(pdfBytes);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    return new Blob([mergedBytes], { type: 'application/pdf' });
  };

  // Stage 1: Compress PDF using PassportPDF (maximum compression)
  const compressWithPassportPdf = async (pdfBlob: Blob, filename: string): Promise<Blob> => {
    if (!supabase) throw new Error('Backend not configured');

    const base64 = await blobToBase64(pdfBlob);
    const result = await supabase.functions.invoke('compress-pdf-passportpdf', {
      body: { pdfBase64: base64, filename }
    });

    if (result.error || !result.data?.compressedBase64) {
      throw new Error(result.data?.error || result.error?.message || 'PassportPDF compression failed');
    }

    return base64ToBlob(result.data.compressedBase64, 'application/pdf');
  };

  // Stage 2: Compress PDF using iLovePDF (medium compression)
  const compressWithILovePdf = async (pdfBlob: Blob, filename: string): Promise<Blob> => {
    if (!supabase) throw new Error('Backend not configured');

    const base64 = await blobToBase64(pdfBlob);
    const result = await supabase.functions.invoke('compress-pdf-ilovepdf', {
      body: { pdfBase64: base64, filename }
    });

    if (result.error || !result.data?.compressedBase64) {
      throw new Error(result.data?.error || result.error?.message || 'iLovePDF compression failed');
    }

    return base64ToBlob(result.data.compressedBase64, 'application/pdf');
  };

  // Two-stage compression: PassportPDF max → iLovePDF medium
  const compressTwoStage = async (
  pdfBlob: Blob,
  filename: string,
  onProgress: (stage: string) => void)
  : Promise<Blob> => {
    // Stage 1: PassportPDF maximum compression
    onProgress('Compressing with PassportPDF...');
    const stage1Result = await compressWithPassportPdf(pdfBlob, filename);
    console.log(`[Two-Stage] Stage 1 (PassportPDF): ${pdfBlob.size} → ${stage1Result.size} bytes`);

    // Stage 2: iLovePDF medium compression
    onProgress('Compressing with iLovePDF...');
    const stage2Result = await compressWithILovePdf(stage1Result, filename);
    console.log(`[Two-Stage] Stage 2 (iLovePDF): ${stage1Result.size} → ${stage2Result.size} bytes`);

    // Return the smaller result (in case stage 2 made it larger)
    if (stage2Result.size < stage1Result.size) {
      console.log(`[Two-Stage] Final: Using iLovePDF result (${stage2Result.size} bytes)`);
      return stage2Result;
    } else {
      console.log(`[Two-Stage] Final: Using PassportPDF result (${stage1Result.size} bytes)`);
      return stage1Result;
    }
  };

  // Handle file selection
  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    setIsProcessing(true);

    const pdfFiles = selectedFiles.filter(isPdfFile);
    const imageFiles = selectedFiles.filter(isImageFile);

    if (outputMode === 'single') {
      await processSingleMode(pdfFiles, imageFiles);
    } else {
      await processSeparateMode(pdfFiles, imageFiles);
    }

    setIsProcessing(false);
  }, [outputMode]);

  const processSingleMode = async (pdfFiles: File[], imageFiles: File[]) => {
    const totalFiles = pdfFiles.length + imageFiles.length;
    if (totalFiles === 0) return;

    const fileId = generateId();
    const filename = totalFiles === 1 ?
    pdfFiles[0]?.name || imageFiles[0]?.name.replace(/\.[^.]+$/, '.pdf') :
    'merged-document.pdf';

    const totalSize = [...pdfFiles, ...imageFiles].reduce((sum, f) => sum + f.size, 0);

    setFiles([{
      id: fileId,
      originalFile: pdfFiles[0] || imageFiles[0],
      originalSize: totalSize,
      status: 'compressing',
      progress: 10
    }]);

    const updateProgress = (stage: string) => {
      setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, progressText: stage } : f));
    };

    try {
      const allPdfBlobs: Blob[] = [];

      // Process images first
      if (imageFiles.length > 0) {
        updateProgress('Scanning images...');
        setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, progress: 15 } : f));

        const scannedBlobs: Blob[] = [];
        for (const img of imageFiles) {
          const scanned = await scanDocument(img, { enhance: true });
          scannedBlobs.push(scanned);
        }

        updateProgress('Converting to PDF...');
        setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, progress: 25 } : f));

        const imagesPdf = await imagesToSinglePdf(scannedBlobs);
        allPdfBlobs.push(imagesPdf);
      }

      // Add PDF files
      for (const pdfFile of pdfFiles) {
        allPdfBlobs.push(pdfFile);
      }

      // Merge if needed
      let pdfToCompress: Blob;
      if (allPdfBlobs.length === 1) {
        pdfToCompress = allPdfBlobs[0];
      } else {
        updateProgress('Merging PDFs...');
        setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, progress: 35 } : f));
        pdfToCompress = await mergePdfs(allPdfBlobs);
      }

      // Two-stage compression
      setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, progress: 50 } : f));

      const compressedBlob = await compressTwoStage(pdfToCompress, filename, (stage) => {
        updateProgress(stage);
        if (stage.includes('iLovePDF')) {
          setFiles((prev) => prev.map((f) => f.id === fileId ? { ...f, progress: 75 } : f));
        }
      });

      setFiles((prev) => prev.map((f) => f.id === fileId ? {
        ...f,
        status: 'completed',
        progress: 100,
        compressedSize: compressedBlob.size,
        compressedBlob,
        progressText: undefined
      } : f));

    } catch (error) {
      setFiles((prev) => prev.map((f) => f.id === fileId ? {
        ...f,
        status: 'error',
        progress: 100,
        error: error instanceof Error ? error.message : 'Processing failed',
        progressText: undefined
      } : f));
    }
  };

  const processSeparateMode = async (pdfFiles: File[], imageFiles: File[]) => {
    const pdfEntries: CompressedFile[] = pdfFiles.map((file) => ({
      id: generateId(),
      originalFile: file,
      originalSize: file.size,
      status: 'compressing' as const,
      progress: 10
    }));

    const imageEntries: CompressedFile[] = imageFiles.map((file) => ({
      id: generateId(),
      originalFile: file,
      originalSize: file.size,
      status: 'compressing' as const,
      progress: 10
    }));

    const allEntries = [...pdfEntries, ...imageEntries];
    setFiles((prev) => [...prev, ...allEntries]);

    // Process PDFs with two-stage compression
    await Promise.all(pdfEntries.map(async (entry) => {
      try {
        const updateProgress = (stage: string) => {
          setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, progressText: stage } : f));
        };

        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, progress: 30 } : f));

        const compressedBlob = await compressTwoStage(
          entry.originalFile,
          entry.originalFile.name,
          (stage) => {
            updateProgress(stage);
            if (stage.includes('iLovePDF')) {
              setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, progress: 70 } : f));
            }
          }
        );

        setFiles((prev) => prev.map((f) => f.id === entry.id ? {
          ...f,
          status: 'completed',
          progress: 100,
          compressedSize: compressedBlob.size,
          compressedBlob,
          progressText: undefined
        } : f));
      } catch (error) {
        setFiles((prev) => prev.map((f) => f.id === entry.id ? {
          ...f,
          status: 'error',
          progress: 100,
          error: error instanceof Error ? error.message : 'Compression failed',
          progressText: undefined
        } : f));
      }
    }));

    // Process images: scan → convert → two-stage compression
    await Promise.all(imageEntries.map(async (entry) => {
      try {
        const updateProgress = (stage: string) => {
          setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, progressText: stage } : f));
        };

        // Scan image
        updateProgress('Scanning image...');
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, progress: 15 } : f));
        const scanned = await scanDocument(entry.originalFile, { enhance: true });

        // Convert to PDF
        updateProgress('Converting to PDF...');
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, progress: 25 } : f));
        const pdfBlob = await imageToPdf(scanned);

        // Two-stage compression
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, progress: 40 } : f));
        const filename = entry.originalFile.name.replace(/\.[^.]+$/, '.pdf');

        const compressedBlob = await compressTwoStage(pdfBlob, filename, (stage) => {
          updateProgress(stage);
          if (stage.includes('iLovePDF')) {
            setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, progress: 75 } : f));
          }
        });

        setFiles((prev) => prev.map((f) => f.id === entry.id ? {
          ...f,
          status: 'completed',
          progress: 100,
          compressedSize: compressedBlob.size,
          compressedBlob,
          progressText: undefined
        } : f));
      } catch (error) {
        setFiles((prev) => prev.map((f) => f.id === entry.id ? {
          ...f,
          status: 'error',
          progress: 100,
          error: error instanceof Error ? error.message : 'Processing failed',
          progressText: undefined
        } : f));
      }
    }));
  };

  const handleDownload = (file: CompressedFile) => {
    const blob = file.compressedBlob;
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    let filename = file.originalFile.name;
    if (!filename.toLowerCase().endsWith('.pdf')) {
      filename = filename.replace(/\.[^.]+$/, '.pdf');
    }
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    const completedFiles = files.filter((f) => f.status === 'completed' && f.compressedBlob);
    if (completedFiles.length === 0) return;

    if (completedFiles.length === 1) {
      handleDownload(completedFiles[0]);
      return;
    }

    const zip = new JSZip();
    completedFiles.forEach((file) => {
      if (file.compressedBlob) {
        let filename = file.originalFile.name;
        if (!filename.toLowerCase().endsWith('.pdf')) {
          filename = filename.replace(/\.[^.]+$/, '.pdf');
        }
        zip.file(filename, file.compressedBlob);
      }
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'compressed-pdfs.zip');
  };

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleReset = () => {
    setFiles([]);
    setIsProcessing(false);
  };

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const hasFiles = files.length > 0;

  return (
    <div data-ev-id="ev_f2c7cd3299" className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header data-ev-id="ev_fe8121946c" className="bg-surface border-b border-border">
        <div data-ev-id="ev_440b14b572" className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div data-ev-id="ev_7d060e9b85" className="flex items-center gap-3">
            <div data-ev-id="ev_9272da408b" className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div data-ev-id="ev_1a2f6838c2">
              <h1 data-ev-id="ev_b7a5028133" className="text-lg font-bold text-gray-900">PDF Tools</h1>
              <p data-ev-id="ev_1c2feb83dc" className="text-xs text-muted-foreground">Fast • Free • Secure</p>
            </div>
          </div>

          {hasFiles &&
          <button data-ev-id="ev_36787c3de5"
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-gray-900 transition-colors">

              <RefreshCw className="w-4 h-4" />
              Start Over
            </button>
          }
        </div>
      </header>

      {/* Main Content */}
      <main data-ev-id="ev_07d8109c2d" className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
        {!hasFiles ?
        <div data-ev-id="ev_7718980470" className="py-0">
            <div data-ev-id="ev_33867095db" className="text-center mb-6">
              <h2 data-ev-id="ev_e69516d4fe" className="text-gray-900 font-bold text-3xl mb-2">
                PDF & Image Compressor
              </h2>
              <p data-ev-id="ev_01f34647cf" className="text-lg text-muted-foreground max-w-md mx-auto">
                Drop PDFs or images. We'll compress, convert, and optimize automatically.
              </p>
            </div>

            <div data-ev-id="ev_df8420040e" className="flex justify-center mb-6">
              <div data-ev-id="ev_885a02034a" className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
                <button data-ev-id="ev_eebb2b13c9"
              onClick={() => setOutputMode('separate')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              outputMode === 'separate' ?
              'bg-white text-gray-900 shadow-sm' :
              'text-muted-foreground hover:text-gray-900'}`
              }>

                  <FileStack className="w-4 h-4" />
                  Separate PDFs
                </button>
                <button data-ev-id="ev_465f72833b"
              onClick={() => setOutputMode('single')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              outputMode === 'single' ?
              'bg-white text-gray-900 shadow-sm' :
              'text-muted-foreground hover:text-gray-900'}`
              }>

                  <File className="w-4 h-4" />
                  Single PDF
                </button>
              </div>
            </div>

            <DropZone onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />

            <div data-ev-id="ev_2f6023a51c" className="mt-12 grid grid-cols-3 gap-6 text-center">
              <div data-ev-id="ev_38aeb6e5ba">
                <div data-ev-id="ev_e30e551151" className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 data-ev-id="ev_33ff1183b6" className="font-semibold text-gray-900 mb-1">Two-Stage Compression</h3>
                <p data-ev-id="ev_42b35bb94c" className="text-sm text-muted-foreground">PassportPDF + iLovePDF</p>
              </div>
              <div data-ev-id="ev_4a3700e36c">
                <div data-ev-id="ev_bb9d3d06d9" className="w-12 h-12 rounded-xl bg-success/10 text-success flex items-center justify-center mx-auto mb-3">
                  <svg data-ev-id="ev_a8e1a18ee5" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path data-ev-id="ev_ddec1e409e" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 data-ev-id="ev_875d2d2c28" className="font-semibold text-gray-900 mb-1">Smart Detection</h3>
                <p data-ev-id="ev_f37dc44f10" className="text-sm text-muted-foreground">PDFs & images auto-detected</p>
              </div>
              <div data-ev-id="ev_ac592ee406">
                <div data-ev-id="ev_1decf8ef28" className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-3">
                  <FileStack className="w-6 h-6" />
                </div>
                <h3 data-ev-id="ev_787c8359d7" className="font-semibold text-gray-900 mb-1">Merge & Compress</h3>
                <p data-ev-id="ev_7b75944df8" className="text-sm text-muted-foreground">Combine into one PDF</p>
              </div>
            </div>
          </div> :

        <div data-ev-id="ev_c938748ebf">
            <CompressionStats files={files} />

            <div data-ev-id="ev_314fdf2bf1" className="flex justify-center mb-4">
              <div data-ev-id="ev_fa476baafc" className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
                <button data-ev-id="ev_7a757ad036"
              onClick={() => setOutputMode('separate')}
              disabled={isProcessing}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              outputMode === 'separate' ?
              'bg-white text-gray-900 shadow-sm' :
              'text-muted-foreground hover:text-gray-900'} ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>

                  <FileStack className="w-4 h-4" />
                  Separate PDFs
                </button>
                <button data-ev-id="ev_67388a49d0"
              onClick={() => setOutputMode('single')}
              disabled={isProcessing}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              outputMode === 'single' ?
              'bg-white text-gray-900 shadow-sm' :
              'text-muted-foreground hover:text-gray-900'} ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>

                  <File className="w-4 h-4" />
                  Single PDF
                </button>
              </div>
            </div>

            <div data-ev-id="ev_79e367e871" className="mb-6">
              <DropZone onFilesSelected={handleFilesSelected} isProcessing={isProcessing} />
            </div>

            <div data-ev-id="ev_6f2aced55f" className="flex flex-col gap-3 mb-6">
              {files.map((file) =>
            <FileCard
              key={file.id}
              file={file}
              onDownload={handleDownload}
              onRemove={handleRemove} />

            )}
            </div>

            {completedCount > 0 &&
          <button data-ev-id="ev_a3a119f9ed"
          onClick={handleDownloadAll}
          className="w-full py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">

                <Download className="w-5 h-5" />
                {completedCount === 1 ?
            'Download Compressed PDF' :
            `Download All (${completedCount} files)`}
              </button>
          }
          </div>
        }
      </main>

      {/* Footer */}
      <footer data-ev-id="ev_0f4d7515ad" className="border-t border-border py-6 mt-auto">
        <div data-ev-id="ev_f66896c3d2" className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p data-ev-id="ev_4eab0114c9">Your files are processed securely and never stored on our servers.</p>
        </div>
      </footer>
    </div>);

}
