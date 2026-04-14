import { TrendingDown, Files, HardDrive } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';
import type { CompressedFile } from '@/components/FileCard';

interface CompressionStatsProps {
  files: CompressedFile[];
}

export function CompressionStats({ files }: CompressionStatsProps) {
  const completedFiles = files.filter((f) => f.status === 'completed');

  if (completedFiles.length === 0) return null;

  const totalOriginal = completedFiles.reduce((sum, f) => sum + f.originalSize, 0);
  const totalCompressed = completedFiles.reduce(
    (sum, f) => sum + (f.compressedSize || 0),
    0
  );
  const totalSavings = totalOriginal - totalCompressed;
  const savingsPercent = Math.round(totalSavings / totalOriginal * 100);

  return (
    <div data-ev-id="ev_fb647d6c5e" className="grid grid-cols-3 gap-4 mb-6">
			<div data-ev-id="ev_324a99bc9b" className="bg-surface rounded-xl border border-border p-4 text-center">
				<div data-ev-id="ev_cb7aee527d" className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
					<Files className="w-5 h-5" />
				</div>
				<p data-ev-id="ev_a70ebd1a41" className="text-2xl font-bold text-gray-900">{completedFiles.length}</p>
				<p data-ev-id="ev_8ea6792716" className="text-sm text-muted-foreground">Files compressed</p>
			</div>

			<div data-ev-id="ev_1117620b29" className="bg-surface rounded-xl border border-border p-4 text-center">
				<div data-ev-id="ev_9420d1cb89" className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center mx-auto mb-2">
					<TrendingDown className="w-5 h-5" />
				</div>
				<p data-ev-id="ev_16780ec45e" className="text-2xl font-bold text-gray-900">{savingsPercent}%</p>
				<p data-ev-id="ev_2865d0800a" className="text-sm text-muted-foreground">Space saved</p>
			</div>

			<div data-ev-id="ev_d92f399402" className="bg-surface rounded-xl border border-border p-4 text-center">
				<div data-ev-id="ev_7728dd1fd7" className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-2">
					<HardDrive className="w-5 h-5" />
				</div>
				<p data-ev-id="ev_dd5eab3f44" className="text-2xl font-bold text-gray-900">{formatFileSize(totalSavings)}</p>
				<p data-ev-id="ev_e3614b91eb" className="text-sm text-muted-foreground">Total saved</p>
			</div>
		</div>);

}
