import { Contest, Contestant } from '../types';

/**
 * Downloads a data URL as a file in browser
 */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates a high-quality 1080x1080 PNG Winner Banner
 */
export async function generateWinnerBannerDataUrl(
  contest: Contest,
  winner: Contestant,
  rank: number,
  contestTotalVotes: number
): Promise<string> {
  const renderCanvas = async (includePhoto: boolean): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Polyfill roundRect if needed
    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }
    };

    // 1. Background Gradient (Modern Dark Navy & Deep Royal Blue Theme)
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    bgGrad.addColorStop(0, '#0a0e1a');
    bgGrad.addColorStop(0.35, '#0f172a');
    bgGrad.addColorStop(0.75, '#1e1b4b');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Decorative Gold & Cyan Radial Light Glows
    const topGlow = ctx.createRadialGradient(540, 220, 40, 540, 220, 480);
    topGlow.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
    topGlow.addColorStop(0.5, 'rgba(56, 189, 248, 0.1)');
    topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, 1080, 1080);

    // Outer Dual Border Frame (Gold & Blue)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 8;
    ctx.strokeRect(32, 32, 1016, 1016);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(44, 44, 992, 992);

    // Four Corner Gold Circles
    const corners = [
      [32, 32],
      [1048, 32],
      [32, 1048],
      [1048, 1048]
    ];
    corners.forEach(([cx, cy]) => {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Header Logo & Platform Name
    ctx.textAlign = 'center';
    ctx.font = '900 32px system-ui, sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('👑 ROY SHARE WALLET', 540, 95);

    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('VERIFIED VOTING CONTEST • OFFICIAL WINNER', 540, 125);

    // 3. Contest Title Banner Box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    drawRoundRect(140, 145, 800, 65, 16);
    ctx.fill();
    ctx.stroke();

    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText((contest.title || 'VOTING CONTEST').toUpperCase(), 540, 187);

    // 4. Winner Rank Badge Box
    let rankLabel = `RANK #${rank} WINNER`;
    let badgeBgGrad = ctx.createLinearGradient(300, 0, 780, 0);

    if (rank === 1) {
      rankLabel = '🥇 1st PLACE WINNER';
      badgeBgGrad.addColorStop(0, '#d97706');
      badgeBgGrad.addColorStop(0.5, '#fbbf24');
      badgeBgGrad.addColorStop(1, '#f59e0b');
    } else if (rank === 2) {
      rankLabel = '🥈 2nd PLACE WINNER';
      badgeBgGrad.addColorStop(0, '#64748b');
      badgeBgGrad.addColorStop(0.5, '#f1f5f9');
      badgeBgGrad.addColorStop(1, '#94a3b8');
    } else if (rank === 3) {
      rankLabel = '🥉 3rd PLACE WINNER';
      badgeBgGrad.addColorStop(0, '#78350f');
      badgeBgGrad.addColorStop(0.5, '#d97706');
      badgeBgGrad.addColorStop(1, '#b45309');
    } else {
      rankLabel = `🏅 RANK #${rank} WINNER`;
      badgeBgGrad.addColorStop(0, '#0369a1');
      badgeBgGrad.addColorStop(0.5, '#38bdf8');
      badgeBgGrad.addColorStop(1, '#0284c7');
    }

    ctx.fillStyle = badgeBgGrad;
    drawRoundRect(290, 230, 500, 56, 28);
    ctx.fill();

    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillStyle = rank === 2 ? '#0f172a' : '#ffffff';
    ctx.fillText(rankLabel, 540, 267);

    // 5. Winner Photo Frame
    const avatarCenterX = 540;
    const avatarCenterY = 430;
    const avatarRadius = 110;

    // Glowing Ring
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = rank === 1 ? '#f59e0b' : '#38bdf8';
    ctx.stroke();

    // Try loading profile picture
    let loadedImg: HTMLImageElement | null = null;
    if (includePhoto && winner.imageUrl) {
      try {
        loadedImg = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = winner.imageUrl!;
        });
      } catch (e) {
        loadedImg = null;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.clip();

    if (loadedImg) {
      ctx.drawImage(loadedImg, avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      ctx.font = '900 70px system-ui, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('👤', avatarCenterX, avatarCenterY + 24);
    }
    ctx.restore();

    // 6. Winner Name & Username
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(winner.name, 540, 595);

    if (winner.username || winner.telegramId) {
      ctx.font = '700 24px system-ui, sans-serif';
      ctx.fillStyle = '#38bdf8';
      const handleText = winner.username
        ? (winner.username.startsWith('@') ? winner.username : `@${winner.username}`)
        : `ID: ${winner.telegramId}`;
      ctx.fillText(handleText, 540, 635);
    }

    // 7. Stats Cards (Votes & Prize)
    // Card 1: Verified Votes
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    drawRoundRect(140, 675, 380, 140, 20);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('🗳 VERIFIED VOTES', 330, 715);

    ctx.font = '900 42px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${winner.votesCount || 0}`, 330, 770);

    // Card 2: Winner Prize
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.lineWidth = 2;
    drawRoundRect(560, 675, 380, 140, 20);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('💰 WINNER PRIZE', 750, 715);

    const prizeText = winner.winnerPrize
      ? `${winner.winnerPrize}`
      : winner.prizeAmount && winner.prizeAmount > 0
      ? `₹${winner.prizeAmount}`
      : Array.isArray(contest.winnerPrizes) && contest.winnerPrizes[rank - 1] !== undefined && contest.winnerPrizes[rank - 1] > 0
      ? `₹${contest.winnerPrizes[rank - 1]}`
      : contest.winnerRewardAmount && contest.winnerRewardAmount > 0
      ? `₹${contest.winnerRewardAmount}`
      : '🏆 Champion Prize';

    ctx.font = '900 30px system-ui, sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(prizeText, 750, 770);

    // 8. Congratulations Banner
    ctx.font = '900 32px system-ui, sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('🎉 CONGRATULATIONS! 🎉', 540, 875);

    // Timestamp & Stamp
    const winTimeStr = winner.winningTime
      ? new Date(winner.winningTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Winning Date: ${winTimeStr} • Authenticated Standings`, 540, 915);

    // Bottom Ribbon
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(44, 975, 992, 50);

    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('t.me/RoyShareWalletBot  •  Roy Share Wallet Official', 540, 1007);

    return canvas.toDataURL('image/png');
  };

  try {
    return await renderCanvas(true);
  } catch (err) {
    console.warn('Canvas render fallback (cross-origin image prevented):', err);
    return await renderCanvas(false);
  }
}
