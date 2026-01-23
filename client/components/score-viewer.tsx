'use client';
import { useEffect, useRef, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Button } from '@/components/ui/button';
import { generateScore, generateTab } from '@/lib/api';
import { Loader2, Download, RefreshCw, FileMusic } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';

interface ScoreViewerProps {
  projectId: string;
  autoLoad?: boolean;
  existingInstruments?: string[];
  currentTime?: number;
  bpm?: number;
}

export function ScoreViewer({
  projectId,
  autoLoad = false,
  existingInstruments = [],
  currentTime = 0,
  bpm: initialBpm,
}: ScoreViewerProps) {
  const [instrument, setInstrument] = useState<string>('vocals');
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('생성 중...');
  const [zoom, setZoom] = useState(0.8);
  const [followCursor, setFollowCursor] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const lastMeasureRef = useRef(-1);

  const loadScore = async (targetInstrument?: string) => {
    const instToLoad = targetInstrument || instrument;
    setLoading(true);
    // We don't know for sure if it's in DB yet, but we can assume if it's autoLoad it might be
    setLoadingMessage('악보를 불러오는 중...');
    try {
      const xml = await generateScore(projectId, instToLoad);
      setXmlContent(xml);
      toast.success(`${instToLoad} 악보 생성 완료!`);
    } catch (error) {
      console.error(error);
      toast.error('악보 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad && existingInstruments.length > 0) {
      // 보관함에 악보가 있으면 첫 번째 악보를 자동으로 불러옴
      const firstInst = existingInstruments[0];
      setInstrument(firstInst);
      loadScore(firstInst);
    }
  }, [autoLoad, projectId]);

  useEffect(() => {
    if (!xmlContent || !containerRef.current) return;

    // Cleanup previous instance
    if (containerRef.current.innerHTML) {
      containerRef.current.innerHTML = '';
    }

    try {
      const osmd = new OpenSheetMusicDisplay(containerRef.current, {
        autoResize: true,
        backend: 'svg',
        drawingParameters: 'compacttight', // Compact rendering
        drawTitle: true,
      });

      osmd.load(xmlContent).then(() => {
        osmd.render();
        osmdRef.current = osmd;
        updateZoom(zoom);

        // 커서 설정
        osmd.cursor.show();
        osmd.cursor.reset();
      });
    } catch (e) {
      console.error('OSMD Render Error:', e);
    }
  }, [xmlContent]);

  // 시간 업데이트에 따른 커서 이동 (BPM 기반 동기화)
  useEffect(() => {
    if (!osmdRef.current || !xmlContent || !followCursor || !initialBpm) return;

    const osmd = osmdRef.current;
    if (!osmd.cursor) return;

    const bpm = initialBpm;
    const beatsPerMeasure = 4; // 임시 4/4 박자
    const secondsPerMeasure = (60 / bpm) * beatsPerMeasure;

    // 현재 재생 시간에 따른 목표 마디 인덱스 계산 (0-indexed)
    const targetMeasureIndex = Math.floor(currentTime / secondsPerMeasure);

    if (targetMeasureIndex !== lastMeasureRef.current) {
      lastMeasureRef.current = targetMeasureIndex;

      // 커서 위치 동기화
      osmd.cursor.reset();

      // 목표 마디까지 이동 (안전 장치 추가)
      let currentIdx = (osmd.cursor.iterator as any).currentMeasureIndex;
      let safetyCounter = 0;

      while (currentIdx < targetMeasureIndex && safetyCounter < 500) {
        osmd.cursor.next();
        const nextIdx = (osmd.cursor.iterator as any).currentMeasureIndex;
        if (nextIdx === currentIdx) break; // 더 이상 이동 불가
        currentIdx = nextIdx;
        safetyCounter++;
      }

      osmd.cursor.show();
    }
  }, [currentTime, followCursor, initialBpm, xmlContent]);

  const updateZoom = (z: number) => {
    setZoom(z);
    if (osmdRef.current) {
      osmdRef.current.Zoom = z;
      osmdRef.current.render();
    }
  };

  const downloadMusicXML = () => {
    if (!xmlContent) return;
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${instrument}_score.musicxml`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
        <div className="flex items-center gap-4">
          <Select
            value={instrument}
            onValueChange={(val) => {
              setInstrument(val);
              setXmlContent(null);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="악기 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vocals">Vocals (Melody)</SelectItem>
              <SelectItem value="guitar">Guitar</SelectItem>
              <SelectItem value="bass">Bass</SelectItem>
              <SelectItem value="piano">Piano / Keys</SelectItem>
              <SelectItem value="drums">Drums (Rhythm)</SelectItem>
              <SelectItem value="other">Others</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => {
              setLoadingMessage(
                existingInstruments.includes(instrument)
                  ? '악보를 불러오는 중...'
                  : '악보 생성 중...',
              );
              loadScore();
            }}
            disabled={loading}
          >
            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            {loading
              ? loadingMessage
              : existingInstruments.includes(instrument)
                ? '보관함에서 불러오기 (Load From Archive)'
                : '악보 생성 (Generate Score)'}
          </Button>
        </div>

        {xmlContent && (
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-900 rounded-md border border-zinc-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateZoom(Math.max(0.4, zoom - 0.1))}
              >
                -
              </Button>
              <span className="text-xs w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateZoom(Math.min(2.0, zoom + 0.1))}
              >
                +
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={downloadMusicXML}>
              <Download className="mr-2 h-4 w-4" /> MusicXML
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              <FileMusic className="mr-2 h-4 w-4" /> PDF 인쇄
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white min-h-[400px] p-4 rounded-lg relative overflow-auto border border-zinc-300 shadow-inner">
        {!xmlContent && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
            <FileMusic className="w-16 h-16 mb-4 opacity-50" />
            <p>상단에서 악기를 선택하고 버튼을 눌러주세요.</p>
            {existingInstruments.includes(instrument) && (
              <p className="text-pink-500 font-medium mt-2">
                ✨ {instrument} 악보가 이미 보관함에 보관되어 있습니다!
              </p>
            )}
            <p className="text-sm mt-2 text-zinc-500">
              Drums, Vocals, Keyboards 등 모든 악기를 지원합니다.
            </p>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="w-10 h-10 animate-spin text-zinc-600" />
          </div>
        )}

        <div ref={containerRef} className="w-full origin-top-left" />
      </div>

      <p className="text-xs text-muted-foreground text-center">
        * PDF 저장을 원하시면 'PDF 인쇄' 버튼을 누른 후 대상 프린터를 'PDF로 저장'으로 설정하세요.
      </p>
    </div>
  );
}
