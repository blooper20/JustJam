import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateTab, TabResponse } from '@/lib/api';
import { Loader2, Copy, FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface TabViewerProps {
  projectId: string;
  autoLoad?: boolean;
  existingInstruments?: string[];
}

export function TabViewer({
  projectId,
  autoLoad = false,
  existingInstruments = [],
}: TabViewerProps) {
  const [activeTab, setActiveTab] = useState('guitar');
  const initializedRef = useRef(false);
  const [tabs, setTabs] = useState<Record<string, TabResponse | null>>({
    guitar: null,
    bass: null,
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({
    guitar: false,
    bass: false,
  });
  const [loadingMessage, setLoadingMessage] = useState<Record<string, string>>({
    guitar: 'Loading...',
    bass: 'Loading...',
  });

  const handleGenerate = async (instrument: 'guitar' | 'bass', isFirstLoad = false) => {
    setLoading((prev) => ({ ...prev, [instrument]: true }));
    setLoadingMessage((prev) => ({
      ...prev,
      [instrument]: isFirstLoad ? '불러오는 중...' : '생성 중...',
    }));
    try {
      const data = await generateTab(projectId, instrument);
      setTabs((prev) => ({ ...prev, [instrument]: data }));
      toast.success(`${instrument} Tab generated!`);
    } catch (error) {
      toast.error(`Failed to generate ${instrument} tab`);
      console.error(error);
    } finally {
      setLoading((prev) => ({ ...prev, [instrument]: false }));
    }
  };

  // Removed automatic handleGenerate on mount. User must explicitly click buttons.

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Tabs defaultValue="guitar" className="w-full" onValueChange={setActiveTab}>
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="guitar">Guitar Tab</TabsTrigger>
          <TabsTrigger value="bass">Bass Tab</TabsTrigger>
        </TabsList>
      </div>

      {['guitar', 'bass'].map((inst) => (
        <TabsContent key={inst} value={inst} className="space-y-4">
          {!tabs[inst] ? (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed border-zinc-700 rounded-lg bg-zinc-900/30">
              <FileText className="w-12 h-12 text-zinc-600 mb-4" />
              <h3 className="text-lg font-medium mb-2 capitalize">
                {inst} Tab {existingInstruments.includes(inst) ? '보관함 보관됨' : 'Not Generated'}
              </h3>
              <p className="text-zinc-500 text-sm mb-6 text-center max-w-sm">
                {existingInstruments.includes(inst)
                  ? '이 악보는 이미 보관함에 보관되어 있습니다. 아래 버튼을 눌러 즉시 불러오세요.'
                  : `Generate a precision ${inst} tablature from the separated stems using AI transcription.`}
              </p>
              <Button
                onClick={() => handleGenerate(inst as 'guitar' | 'bass')}
                disabled={loading[inst]}
                variant={existingInstruments.includes(inst) ? 'default' : 'outline'}
              >
                {loading[inst] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading[inst]
                  ? loadingMessage[inst]
                  : existingInstruments.includes(inst)
                    ? `보관함에서 불러오기 (${inst.charAt(0).toUpperCase() + inst.slice(1)})`
                    : `생성하기 (${inst.charAt(0).toUpperCase() + inst.slice(1)})`}
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute top-2 right-2 flex gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  PDF/Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(tabs[inst]?.tab || '')}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
              <pre className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 overflow-x-auto text-xs font-mono leading-tight text-zinc-300 whitespace-pre scrollbar-thin scrollbar-thumb-zinc-700">
                {tabs[inst]?.tab}
              </pre>
              <div className="mt-2 text-xs text-zinc-500 flex justify-between">
                <span>BPM: {tabs[inst]?.bpm.toFixed(1)}</span>
                <span>Notes: {tabs[inst]?.notes_count}</span>
              </div>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
