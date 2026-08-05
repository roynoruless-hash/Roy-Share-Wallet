import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, FastForward, Film, CheckCircle, Clock, Award, ShieldAlert, Zap, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ReplayStep {
  id: string;
  stepType: string;
  timestamp: number;
  timeOffsetSec: number;
  title: string;
  description: string;
  badge: string;
  metadata?: any;
}

interface LiveReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string;
}

export const LiveReplayModal: React.FC<LiveReplayModalProps> = ({ isOpen, onClose, eventId }) => {
  const [replayData, setReplayData] = useState<{
    code: string;
    timeline: ReplayStep[];
    winners: any[];
    summaryStats: any;
  }>({
    code: 'ROY500',
    timeline: [],
    winners: [],
    summaryStats: null,
  });

  const [loading, setLoading] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/live-event/replay${eventId ? `?eventId=${eventId}` : ''}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setReplayData({
            code: data.code || 'ROY500',
            timeline: data.replayTimeline || [],
            winners: data.winners || [],
            summaryStats: data.summaryStats || {},
          });
        }
      })
      .catch((err) => console.error('Failed to load replay timeline:', err))
      .finally(() => setLoading(false));
  }, [isOpen, eventId]);

  useEffect(() => {
    let timer: any = null;
    if (isPlaying && replayData.timeline.length > 0) {
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= replayData.timeline.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000 / playbackSpeed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, replayData.timeline, playbackSpeed]);

  if (!isOpen) return null;

  const currentStep = replayData.timeline[currentStepIndex];
  const maxStepIndex = Math.max(0, replayData.timeline.length - 1);

  const handleExportReplayLog = () => {
    const content = JSON.stringify(replayData, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event_replay_${eventId || 'current'}.json`;
    a.click();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-amber-500/30 bg-gray-900 p-6 text-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <Film className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Live Event Replay Engine</span>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30">
                    4K REPLAY
                  </span>
                </h3>
                <p className="text-xs text-gray-400">Step-by-step event replay timeline & telemetry audit</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportReplayLog}
                className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              >
                <Download className="h-3.5 w-3.5" /> Export JSON
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"></div>
              <p className="mt-3 text-sm text-gray-400">Generating Replay Timeline...</p>
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              {/* Active Replay Inspector Screen */}
              <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-black/60 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-amber-400">
                    TIMELINE STEP {currentStepIndex + 1} OF {replayData.timeline.length}
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    +{currentStep?.timeOffsetSec || 0}s Offset
                  </span>
                </div>

                <div className="mt-4 flex items-start gap-4">
                  <div className="text-4xl">{currentStep?.badge || '⚡'}</div>
                  <div>
                    <h4 className="text-lg font-bold text-amber-300">{currentStep?.title || 'Event Step'}</h4>
                    <p className="mt-1 text-sm text-gray-300">{currentStep?.description}</p>
                    <p className="mt-2 text-xs text-gray-500 font-mono">
                      Timestamp: {currentStep?.timestamp ? new Date(currentStep.timestamp).toLocaleTimeString() : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Progress Scrub Bar */}
                <div className="mt-6">
                  <input
                    type="range"
                    min={0}
                    max={maxStepIndex}
                    value={currentStepIndex}
                    onChange={(e) => setCurrentStepIndex(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer h-2 rounded-lg bg-gray-800"
                  />
                  <div className="mt-2 flex justify-between text-xs text-gray-400 font-mono">
                    <span>0s (Start)</span>
                    <span>+{replayData.timeline[maxStepIndex]?.timeOffsetSec || 300}s (End)</span>
                  </div>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-950 p-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentStepIndex(0)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
                    title="Reset to Beginning"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-4 w-4" /> PAUSE REPLAY
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-current" /> PLAY REPLAY
                      </>
                    )}
                  </button>
                </div>

                {/* Speed Controls */}
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="mr-1 text-gray-500">Speed:</span>
                  {[1, 2, 4].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`rounded-md px-2.5 py-1 font-mono font-bold transition ${
                        playbackSpeed === speed
                          ? 'bg-amber-500 text-black'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Step Timeline Feed */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-800 bg-black/40 p-3 space-y-2">
                {replayData.timeline.map((step, idx) => {
                  const isActive = idx === currentStepIndex;
                  return (
                    <div
                      key={step.id || idx}
                      onClick={() => setCurrentStepIndex(idx)}
                      className={`flex items-center justify-between rounded-lg p-2.5 text-xs cursor-pointer transition ${
                        isActive
                          ? 'border border-amber-500/50 bg-amber-500/10 text-amber-200'
                          : 'border border-transparent hover:bg-gray-800/50 text-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{step.badge}</span>
                        <div>
                          <span className="font-bold text-gray-200">{step.title}</span>
                          <p className="text-gray-400 text-[11px] truncate max-w-sm">{step.description}</p>
                        </div>
                      </div>
                      <span className="font-mono text-gray-500 text-[11px]">+{step.timeOffsetSec}s</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
