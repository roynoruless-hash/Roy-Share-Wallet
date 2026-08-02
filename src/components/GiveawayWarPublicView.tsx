import React, { useState, useEffect } from 'react';
import {
  Swords,
  Trophy,
  Users,
  Crown,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Share2,
  Copy,
  Flame,
  UserCheck,
  Zap,
  Gift
} from 'lucide-react';
import { GiveawayWar, WarTeam, WarMember } from '../types';
import { getGiveawayWarById, getGiveawayWars, getWarMembers } from '../services/giveawayWarService';

interface GiveawayWarPublicViewProps {
  botUsername?: string;
}

export const GiveawayWarPublicView: React.FC<GiveawayWarPublicViewProps> = ({
  botUsername = 'Roy_wallett_bot'
}) => {
  const [war, setWar] = useState<GiveawayWar | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<WarTeam | null>(null);
  const [teamTag, setTeamTag] = useState<string>('teamA');
  const [members, setMembers] = useState<WarMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    loadWarData();
  }, []);

  const loadWarData = async () => {
    setIsLoading(true);
    try {
      const path = window.location.pathname; // e.g. /war/teamA/war_123 or /war/teamB/war_123
      const parts = path.split('/').filter(Boolean); // ['war', 'teamA', 'war_123']

      let parsedTeamTag = 'teamA';
      let parsedWarId = '';

      if (parts.length >= 3) {
        parsedTeamTag = parts[1];
        parsedWarId = parts[2];
      } else if (parts.length === 2) {
        if (parts[0] === 'war') {
          parsedTeamTag = parts[1];
        } else {
          parsedWarId = parts[1];
        }
      }

      setTeamTag(parsedTeamTag);

      let loadedWar: GiveawayWar | null = null;
      if (parsedWarId) {
        loadedWar = await getGiveawayWarById(parsedWarId);
      }

      if (!loadedWar) {
        const allWars = await getGiveawayWars();
        loadedWar = allWars.find((w) => w.status === 'live') || allWars[0] || null;
      }

      setWar(loadedWar);

      if (loadedWar) {
        const warMembers = await getWarMembers(loadedWar.id);
        setMembers(warMembers);

        // Resolve Team
        const cleanTag = parsedTeamTag.toLowerCase();
        let targetTeam = loadedWar.teams.find((t, idx) => {
          const tId = t.id.toLowerCase();
          if (cleanTag === 'teama' || cleanTag === 'team_a' || cleanTag === 'a') return idx === 0;
          if (cleanTag === 'teamb' || cleanTag === 'team_b' || cleanTag === 'b') return idx === 1;
          return tId === cleanTag || tId.includes(cleanTag);
        });

        if (!targetTeam && loadedWar.teams.length > 0) {
          targetTeam = cleanTag.includes('b') ? (loadedWar.teams[1] || loadedWar.teams[0]) : loadedWar.teams[0];
        }

        setSelectedTeam(targetTeam || loadedWar.teams[0] || null);
      }
    } catch (err) {
      console.error('Error loading public Giveaway War page:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanBotUser = (botUsername || 'Roy_wallett_bot').replace(/^@/, '');
  const activeWarId = war?.id || 'live';
  const tgDeepLink = `https://t.me/${cleanBotUser}?start=${teamTag}_${activeWarId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(tgDeepLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 animate-bounce">
          <Swords className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-300">Loading Giveaway War Registration...</p>
      </div>
    );
  }

  const leaderTelegramId = selectedTeam?.leaderTelegramId;
  const hasLeader = Boolean(leaderTelegramId);
  const leaderMember = hasLeader ? members.find((m) => String(m.telegramId) === String(leaderTelegramId)) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 lg:p-8 selection:bg-amber-500 selection:text-slate-950">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2 py-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest">
            <Flame className="w-4 h-4 text-red-500 animate-pulse" />
            <span>Official Giveaway War</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center justify-center gap-3">
            <Swords className="w-8 h-8 text-amber-400 shrink-0" />
            <span>{war?.title || 'Giveaway War Event'}</span>
          </h1>
          {war?.prizePool && (
            <p className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Prize Pool: ₹{war.prizePool}</span>
            </p>
          )}
        </div>

        {/* War Event Overview Card */}
        {war && (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">War Description & Rules</span>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                war.status === 'live' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                ● {war.status}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {war.description || 'Join your team, complete tasks, and fight for victory in the Giveaway War!'}
            </p>
          </div>
        )}

        {/* Selected Team & Team Leader Card */}
        {selectedTeam && (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full" style={{ backgroundColor: selectedTeam.color || '#EF4444' }} />
                <div>
                  <h2 className="text-xl font-black text-white">{selectedTeam.name}</h2>
                  <p className="text-xs text-slate-400">Team Members: {selectedTeam.membersCount || 0} warriors</p>
                </div>
              </div>
              <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-black">
                Score: {selectedTeam.score || 0} Pts
              </span>
            </div>

            {/* LEADER STATUS */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  Official Team Leader Status
                </span>
                {hasLeader ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                    ASSIGNED
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold animate-pulse">
                    OPEN FOR FIRST USER
                  </span>
                )}
              </div>

              {hasLeader ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Leader Name:</span>
                    <span className="font-bold text-white">{selectedTeam.leaderName || 'Official Leader'}</span>
                  </div>
                  {selectedTeam.leaderUsername && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Username:</span>
                      <span className="font-mono text-amber-300">@{selectedTeam.leaderUsername.replace('@', '')}</span>
                    </div>
                  )}
                  {selectedTeam.leaderTelegramId && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Telegram ID:</span>
                      <span className="font-mono text-slate-300">{selectedTeam.leaderTelegramId}</span>
                    </div>
                  )}
                  {selectedTeam.leaderInviteLink && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Leader Personal Invite Link:</span>
                      <code className="text-xs text-amber-300 font-mono break-all select-all block bg-slate-900 p-2 rounded-lg border border-slate-800">
                        {selectedTeam.leaderInviteLink}
                      </code>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center space-y-2">
                  <p className="text-sm font-black text-amber-300 flex items-center justify-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400 animate-bounce" />
                    👑 {selectedTeam.name} Leader: Waiting for First User...
                  </p>
                  <p className="text-xs text-slate-300">
                    Be the <strong>FIRST verified user</strong> to join this team from this link to automatically claim permanent 👑 <strong>Team Leader</strong> status!
                  </p>
                </div>
              )}
            </div>

            {/* JOIN TEAM CTA BUTTONS */}
            <div className="space-y-3 pt-2">
              <a
                href={tgDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/20 transition transform active:scale-98"
              >
                <Swords className="w-5 h-5" />
                <span>Join {selectedTeam.name} via Telegram Bot</span>
                <ExternalLink className="w-4 h-4 ml-auto" />
              </a>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Copy className="w-4 h-4 text-amber-400" />
                  <span>{copiedLink ? 'Copied Link!' : 'Copy Bot Link'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center space-y-1 text-slate-500 text-xs py-4">
          <p className="font-semibold">Roy Share Wallet • Giveaway War System</p>
          <p>Verified users only. Self-referrals and fraudulent accounts will be disqualified.</p>
        </div>
      </div>
    </div>
  );
};
