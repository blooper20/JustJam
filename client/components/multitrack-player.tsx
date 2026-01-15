'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StemFiles {
    vocals?: string | null;
    bass?: string | null;
    drums?: string | null;
    guitar?: string | null;
    piano?: string | null;
    other?: string | null;
}

interface MultiTrackPlayerProps {
    stems: StemFiles;
}

interface TrackControl {
    name: string;
    url: string;
    volume: number;
    isMuted: boolean;
    isSolo: boolean;
    instance: WaveSurfer | null;
}

const TRACK_COLORS: Record<string, string> = {
    vocals: '#f472b6', // pink-400
    bass: '#fbbf24',   // amber-400
    drums: '#60a5fa',  // blue-400
    guitar: '#a78bfa', // violet-400
    piano: '#34d399',  // emerald-400
    other: '#9ca3af',  // gray-400
};

export function MultiTrackPlayer({ stems }: MultiTrackPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [tracks, setTracks] = useState<TrackControl[]>([]);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const timelineRef = useRef<HTMLDivElement>(null);
    const readyCount = useRef(0);

    // Initialize Tracks
    useEffect(() => {
        const validStems = Object.entries(stems).filter(([_, url]) => !!url) as [string, string][];

        const newTracks: TrackControl[] = validStems.map(([name, url]) => ({
            name,
            url,
            volume: 0.8,
            isMuted: false,
            isSolo: false,
            instance: null,
        }));

        setTracks(newTracks);

        return () => {
            newTracks.forEach(t => t.instance?.destroy());
        };
    }, [stems]);

    // Initialize WaveSurfer instances
    useEffect(() => {
        if (tracks.length === 0) return;

        tracks.forEach((track, index) => {
            if (track.instance) return; // Already initialized

            const container = containerRefs.current[track.name];
            if (!container) return;

            const ws = WaveSurfer.create({
                container,
                waveColor: TRACK_COLORS[track.name] || '#9ca3af',
                progressColor: 'rgba(255, 255, 255, 0.3)',
                url: track.url,
                height: 64,
                barWidth: 2,
                barGap: 1,
                barRadius: 2,
                cursorWidth: 0,
                interact: false, // Disable interaction on individual waveforms for now
                normalize: true,
            });

            ws.on('ready', () => {
                readyCount.current++;
                if (index === 0) { // Use first track for duration
                    setDuration(ws.getDuration());
                }
                ws.setVolume(track.volume);
            });

            // Master time update
            if (index === 0) {
                ws.on('timeupdate', (time) => {
                    setCurrentTime(time);
                });

                ws.on('finish', () => {
                    setIsPlaying(false);
                });
            }

            setTracks(prev => prev.map(t => t.name === track.name ? { ...t, instance: ws } : t));
        });
    }, [tracks]);

    const togglePlay = useCallback(() => {
        if (isPlaying) {
            tracks.forEach(t => t.instance?.pause());
        } else {
            tracks.forEach(t => t.instance?.play());
        }
        setIsPlaying(!isPlaying);
    }, [tracks, isPlaying]);

    const handleSeek = (value: number[]) => {
        const time = value[0];
        const progress = time / duration;
        tracks.forEach(t => t.instance?.seekTo(progress));
        setCurrentTime(time);
    };

    const toggleMute = (trackName: string) => {
        setTracks(prev => {
            const newTracks = prev.map(t => {
                if (t.name === trackName) {
                    const newMuted = !t.isMuted;
                    t.instance?.setVolume(newMuted ? 0 : t.volume);
                    return { ...t, isMuted: newMuted };
                }
                return t;
            });
            return newTracks;
        });
    };

    const toggleSolo = (trackName: string) => {
        setTracks(prev => {
            const targetTrack = prev.find(t => t.name === trackName);
            const isSoloing = !targetTrack?.isSolo; // Toggle solo state

            // If enabling solo, mute everyone else. If disabling, restore.
            // This simple logic assumes single solo. Multi-solo logic is complex.
            // Let's implement exclusive solo for simplicity first.

            const newTracks = prev.map(t => {
                if (t.name === trackName) {
                    const newSolo = !t.isSolo;
                    // If we are soloing this, unmute it.
                    if (newSolo) {
                        t.instance?.setVolume(t.volume);
                    }
                    return { ...t, isSolo: newSolo, isMuted: false };
                } else {
                    // If we are enabling solo on target, mute others.
                    if (isSoloing) {
                        t.instance?.setVolume(0);
                        return { ...t, isSolo: false };
                    } else {
                        // Un-soloing, restore volume if it wasn't manually muted?
                        // Ideally we should store 'prevMuteState'. 
                        // For now simply unmute all if no one is solo.
                        t.instance?.setVolume(t.volume);
                        return { ...t, isSolo: false, isMuted: false };
                    }
                }
            });
            return newTracks;
        });
    };

    const handleVolume = (trackName: string, val: number[]) => {
        const volume = val[0];
        setTracks(prev => prev.map(t => {
            if (t.name === trackName) {
                if (!t.isMuted) {
                    t.instance?.setVolume(volume);
                }
                return { ...t, volume };
            }
            return t;
        }));
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="space-y-6 select-none">
            {/* Master Controls */}
            <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800 sticky top-4 z-20 shadow-xl backdrop-blur-md bg-opacity-90">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                    onClick={togglePlay}
                >
                    {isPlaying ? <Pause className="fill-current w-6 h-6" /> : <Play className="fill-current w-6 h-6 ml-1" />}
                </Button>

                <div className="flex-1 space-y-2">
                    <Slider
                        value={[currentTime]}
                        max={duration}
                        step={0.1}
                        onValueChange={handleSeek}
                        className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
            </div>

            {/* Tracks */}
            <div className="grid gap-3">
                {tracks.map(track => (
                    <Card key={track.name} className={cn(
                        "bg-zinc-950/50 border-zinc-800/50 overflow-hidden transition-all",
                        track.isSolo && "border-primary ring-1 ring-primary bg-zinc-900",
                        track.isMuted && "opacity-60 grayscale"
                    )}>
                        <div className="flex items-center p-3 gap-4">
                            {/* Controls */}
                            <div className="w-48 flex flex-col gap-2 shrink-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold uppercase text-xs tracking-wider" style={{ color: TRACK_COLORS[track.name] }}>
                                        {track.name}
                                    </span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => toggleMute(track.name)}
                                            className={cn("px-2 py-0.5 text-[10px] rounded border font-mono transition-colors",
                                                track.isMuted ? "bg-red-500/20 text-red-500 border-red-500/50" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
                                            )}
                                        >
                                            M
                                        </button>
                                        <button
                                            onClick={() => toggleSolo(track.name)}
                                            className={cn("px-2 py-0.5 text-[10px] rounded border font-mono transition-colors",
                                                track.isSolo ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/50" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
                                            )}
                                        >
                                            S
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Volume2 size={12} className="text-zinc-500" />
                                    <Slider
                                        value={[track.volume]}
                                        max={1}
                                        step={0.01}
                                        onValueChange={(val) => handleVolume(track.name, val)}
                                        className="h-4"
                                    />
                                </div>
                            </div>

                            {/* Waveform */}
                            <div
                                className="flex-1 h-16 rounded-md overflow-hidden relative cursor-crosshair"
                                ref={el => { containerRefs.current[track.name] = el; }}
                            />
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
