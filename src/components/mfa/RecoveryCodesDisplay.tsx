import { useState } from 'react';
import { Copy, Download, ShieldAlert, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  codes: string[];
  onDone?: () => void;
  doneLabel?: string;
}

export function RecoveryCodesDisplay({ codes, onDone, doneLabel = "I've saved my codes" }: Props) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      toast.success('Recovery codes copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy. Please copy manually.');
    }
  };

  const download = () => {
    const content = [
      'Zaago Milk — Two-Factor Recovery Codes',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'Each code can be used once. Keep them somewhere safe.',
      '',
      ...codes,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zaago-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
        <ShieldAlert className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-sm text-amber-900 dark:text-amber-100">
          <p className="font-medium">Save these codes now — they won't be shown again.</p>
          <p className="mt-1 text-xs opacity-90">
            Use one code if you lose access to your authenticator app. Each code works only once.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-secondary/40 p-3 font-mono text-sm">
        {codes.map((code, idx) => (
          <div
            key={idx}
            className="rounded bg-background px-2 py-1.5 text-center tracking-wider"
          >
            {code}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={copyAll}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? 'Copied' : 'Copy all'}
        </Button>
        <Button variant="outline" className="flex-1" onClick={download}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>

      {onDone && (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span className="text-sm">
            I have saved my recovery codes in a secure place.
          </span>
        </label>
      )}

      {onDone && (
        <Button className="w-full" disabled={!acknowledged} onClick={onDone}>
          {doneLabel}
        </Button>
      )}
    </div>
  );
}
