import React, { useState } from 'react';
import { X, Bot, Sparkles, Copy, Check, MessageSquare, ShieldAlert, Award, FileText, Send } from 'lucide-react';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyContent?: (content: string) => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose, onApplyContent }) => {
  const [promptType, setPromptType] = useState('BROADCAST_MSG');
  const [topic, setTopic] = useState('Golden Speed Drop #101');
  const [contextInput, setContextInput] = useState('Prize: ₹500, Max Claims: 50, Code Unlocks at 8:00 PM');
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptType,
          topic,
          contextData: { text: contextInput },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedContent(data.content);
      } else {
        alert(data.error || 'AI generation failed.');
      }
    } catch (err: any) {
      alert(`Error calling AI Assistant: ${err?.message || 'Network error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl relative text-white">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                AI Event Assistant <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-300">Powered by Gemini 3.6 Flash</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Preset Buttons */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Select Generator Mode</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'BROADCAST_MSG', label: 'Broadcast', icon: MessageSquare },
                { id: 'GENERATE_TITLE', label: 'Titles & Taglines', icon: Sparkles },
                { id: 'RULES', label: 'Contest Rules', icon: FileText },
                { id: 'WINNER_ANNOUNCEMENT', label: 'Winners Post', icon: Award },
                { id: 'COUNTDOWN_MSG', label: 'Countdown', icon: Send },
                { id: 'FRAUD_ALERT', label: 'Fraud Report', icon: ShieldAlert },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setPromptType(item.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition ${
                      promptType === item.id
                        ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                        : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topic & Context */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Event Topic / Title</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Golden Code Surge #1"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Context / Rules / Stats</label>
              <textarea
                value={contextInput}
                onChange={e => setContextInput(e.target.value)}
                rows={2}
                placeholder="Add reward details, winner stats, or rules parameters..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Gemini Generating Content...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" /> Generate Content
              </>
            )}
          </button>

          {/* Generated Content Box */}
          {generatedContent && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Generated Output (Telegram HTML)</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-200 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  {onApplyContent && (
                    <button
                      onClick={() => {
                        onApplyContent(generatedContent);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold rounded-lg text-white transition"
                    >
                      Apply Directly
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-xl font-mono text-xs text-slate-200 whitespace-pre-wrap max-h-60 overflow-y-auto">
                {generatedContent}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
