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
 * Generates a high-quality, high-resolution 1080x1080 PNG Winner Banner matching Leaderboard UI
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

    // 1. Background Gradient (Premium Dark Navy + Black Pitch-Dark Theme)
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    bgGrad.addColorStop(0, '#020617'); // Slate Black
    bgGrad.addColorStop(0.35, '#040d21'); // Deep Esports Navy
    bgGrad.addColorStop(0.7, '#081330'); // Electric Navy Base
    bgGrad.addColorStop(1, '#000000'); // Deep Pitch Black
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Dynamic Esports Cyber-Grid Pattern Overlay (Very subtle lines for professional texture)
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.035)';
    ctx.lineWidth = 1.5;
    // Diagonal lines group A
    for (let i = -1080; i < 1080; i += 60) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 1080, 1080);
      ctx.stroke();
    }
    // Diagonal lines group B
    for (let i = -1080; i < 1080; i += 120) {
      ctx.beginPath();
      ctx.moveTo(i + 1080, 0);
      ctx.lineTo(i, 1080);
      ctx.stroke();
    }
    ctx.restore();

    // Deep Radial Neon Ambiance Glows
    const radialGlow1 = ctx.createRadialGradient(540, 360, 100, 540, 360, 500);
    radialGlow1.addColorStop(0, 'rgba(56, 189, 248, 0.12)'); // Electric cyan/blue core glow
    radialGlow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radialGlow1;
    ctx.fillRect(0, 0, 1080, 1080);

    const radialGlow2 = ctx.createRadialGradient(880, 880, 50, 880, 880, 450);
    radialGlow2.addColorStop(0, 'rgba(212, 175, 55, 0.06)'); // Royal Gold subtle base glow
    radialGlow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radialGlow2;
    ctx.fillRect(0, 0, 1080, 1080);

    // 2. Dual Border Frame (Premium Gold & Blue Neon Glow)
    // Outer Premium Gold Border
    ctx.strokeStyle = '#D4AF37'; // Premium Royal Gold
    ctx.lineWidth = 12;
    ctx.strokeRect(30, 30, 1020, 1020);

    // Inner Neon Blue Border (Glow effect)
    ctx.save();
    ctx.strokeStyle = '#38bdf8'; // Blue Neon
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
    ctx.shadowBlur = 14;
    ctx.strokeRect(48, 48, 984, 984);
    ctx.restore();

    // Four Corner Gold Stud Ornaments
    const cornerStuds = [
      [30, 30],
      [1050, 30],
      [30, 1050],
      [1050, 1050]
    ];
    cornerStuds.forEach(([cx, cy]) => {
      // Outer Stud Ring
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Solid Stud Circle
      ctx.fillStyle = '#D4AF37';
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 3. Top Header Section (Y: 65 to 140)
    ctx.textAlign = 'center';

    // Brand Name with Premium Gold Metallic Gradient
    const goldGrad = ctx.createLinearGradient(0, 65, 0, 110);
    goldGrad.addColorStop(0, '#FFFBF0');
    goldGrad.addColorStop(0.3, '#FFD700');
    goldGrad.addColorStop(0.7, '#D4AF37');
    goldGrad.addColorStop(1, '#966E0A');

    ctx.font = '900 40px system-ui, sans-serif';
    ctx.fillStyle = goldGrad;
    ctx.save();
    ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillText('🏆 ROY SHARE WALLET', 540, 105);
    ctx.restore();

    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8'; // Blue Neon
    ctx.fillText('VERIFIED VOTING CONTEST • OFFICIAL STANDINGS', 540, 138);

    // 4. Large Winner Badge (Podium-styled based on rank)
    let rankColor = '#38bdf8'; // Default Blue
    let badgeText = `🏅 RANK #${rank} PLACE`;
    let badgeBg = 'rgba(56, 189, 248, 0.15)';
    let badgeBorder = 'rgba(56, 189, 248, 0.4)';

    if (rank === 1) {
      rankColor = '#FFD700'; // Gold
      badgeText = '🥇 1ST PLACE';
      badgeBg = 'rgba(212, 175, 55, 0.22)';
      badgeBorder = '#D4AF37';
    } else if (rank === 2) {
      rankColor = '#E2E8F0'; // Silver
      badgeText = '🥈 2ND PLACE';
      badgeBg = 'rgba(226, 232, 240, 0.18)';
      badgeBorder = '#94a3b8';
    } else if (rank === 3) {
      rankColor = '#CD7F32'; // Bronze
      badgeText = '🥉 3RD PLACE';
      badgeBg = 'rgba(205, 127, 50, 0.22)';
      badgeBorder = '#b45309';
    }

    // Flanking bars for Rank Badge (Adds a professional tournament trophy look)
    ctx.save();
    ctx.fillStyle = rankColor;
    ctx.shadowColor = rankColor;
    ctx.shadowBlur = 10;
    // Left Wing Bar
    drawRoundRect(332, 182, 38, 30, 4);
    ctx.fill();
    // Right Wing Bar
    drawRoundRect(710, 182, 38, 30, 4);
    ctx.fill();
    ctx.restore();

    // Draw glassmorphism rank badge pill
    ctx.save();
    ctx.fillStyle = badgeBg;
    ctx.strokeStyle = badgeBorder;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = rankColor;
    ctx.shadowBlur = 12;
    drawRoundRect(385, 170, 310, 54, 27);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Fill rank badge text
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillStyle = rankColor;
    ctx.fillText(badgeText, 540, 205);

    // 5. Large Circular Avatar (Center Y: 360, Radius: 90)
    const avatarCenterX = 540;
    const avatarCenterY = 360;
    const avatarRadius = 90;

    // Outer Segmented Technical Orbital Rings (Gives Sci-Fi/Premium cyber vibes)
    ctx.save();
    ctx.strokeStyle = rank === 1 ? 'rgba(212, 175, 55, 0.35)' : 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Glowing Ring (Neon Blue Glow as requested)
    ctx.save();
    for (let i = 1; i <= 10; i++) {
      ctx.strokeStyle = 'rgba(56, 189, 248, ' + (0.16 - i * 0.015) + ')';
      ctx.lineWidth = i * 2;
      ctx.beginPath();
      ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Solid Inner Gold Ring Border (Premium Gold ring around the avatar as requested)
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 3, 0, Math.PI * 2);
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
      // PREMIUM CUSTOM FALLBACK AVATAR
      // Gradient background inside
      const avatarBg = ctx.createLinearGradient(avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarCenterX + avatarRadius, avatarCenterY + avatarRadius);
      avatarBg.addColorStop(0, '#020617'); // Pitch Black Navy
      avatarBg.addColorStop(0.5, '#0f172a'); // Slate
      avatarBg.addColorStop(1, '#1e3a8a'); // Royal Blue
      ctx.fillStyle = avatarBg;
      ctx.fillRect(avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);

      // Extract first letter of username or name
      let firstLetter = 'W';
      if (winner.username) {
        const cleanUser = winner.username.replace('@', '');
        if (cleanUser.length > 0) {
          firstLetter = cleanUser.charAt(0).toUpperCase();
        }
      } else if (winner.name) {
        firstLetter = winner.name.charAt(0).toUpperCase();
      }

      // Draw first letter with glowing gold gradient
      ctx.font = '900 85px system-ui, sans-serif';
      const letterGrad = ctx.createLinearGradient(0, avatarCenterY - 30, 0, avatarCenterY + 40);
      letterGrad.addColorStop(0, '#FFFFFF');
      letterGrad.addColorStop(0.5, '#FFD700');
      letterGrad.addColorStop(1, '#D4AF37');
      ctx.fillStyle = letterGrad;
      ctx.fillText(firstLetter, avatarCenterX, avatarCenterY + 30);
    }
    ctx.restore();

    // Royal Floating Crown on top of all avatars
    ctx.font = '54px system-ui, sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('👑', avatarCenterX, avatarCenterY - avatarRadius - 16);

    // 6. Winner Details Panel (Name, @Username, Telegram ID)
    // Winner Name in heavy uppercase typography
    let displayName = (winner.name || 'Anonymous User').toUpperCase();
    if (displayName.length > 24) displayName = displayName.slice(0, 22) + '...';
    ctx.font = '900 42px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillText(displayName, 540, 495);
    ctx.restore();

    // @Username in neon cyan text
    let displayUsername = winner.username
      ? (winner.username.startsWith('@') ? winner.username : `@${winner.username}`)
      : '@anonymous_user';
    if (displayUsername.length > 24) displayUsername = displayUsername.slice(0, 22) + '...';
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8'; // Neon Blue Text
    ctx.fillText(displayUsername, 540, 532);

    // Telegram ID
    const displayTgId = winner.telegramId ? `Telegram ID: ${winner.telegramId}` : 'Telegram ID: Verified Participant';
    ctx.font = '600 18px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(displayTgId, 540, 565);

    // 7. Premium Glassmorphic Side-By-Side Cards (Votes & Prize)
    // Left Card: Verified Votes (Y: 595, X: 140, Width: 380, Height: 155)
    ctx.save();
    const cardBg1 = ctx.createLinearGradient(140, 595, 140, 750);
    cardBg1.addColorStop(0, 'rgba(10, 20, 45, 0.9)');
    cardBg1.addColorStop(1, 'rgba(3, 7, 20, 0.98)');
    ctx.fillStyle = cardBg1;
    drawRoundRect(140, 595, 380, 155, 20);
    ctx.fill();

    // Glowing electric blue border
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.2)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();

    // Diagonal Glossy swipe across Left Card
    ctx.save();
    ctx.beginPath();
    drawRoundRect(140, 595, 380, 155, 20);
    ctx.clip();
    const swipe1 = ctx.createLinearGradient(140, 595, 520, 750);
    swipe1.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    swipe1.addColorStop(0.3, 'rgba(255, 255, 255, 0.03)');
    swipe1.addColorStop(0.31, 'rgba(255, 255, 255, 0)');
    swipe1.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = swipe1;
    ctx.fill();
    ctx.restore();

    // Render Left Card details
    ctx.textAlign = 'center';
    ctx.font = '900 15px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8'; // Electric blue label
    ctx.fillText('👥 VERIFIED VOTES', 330, 642);

    ctx.font = '900 48px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.save();
    ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(`${winner.votesCount || 0}`, 330, 706);
    ctx.restore();

    // Right Card: Prize Won (Y: 595, X: 560, Width: 380, Height: 155)
    ctx.save();
    const cardBg2 = ctx.createLinearGradient(560, 595, 560, 750);
    cardBg2.addColorStop(0, 'rgba(22, 18, 10, 0.9)');
    cardBg2.addColorStop(1, 'rgba(3, 7, 20, 0.98)');
    ctx.fillStyle = cardBg2;
    drawRoundRect(560, 595, 380, 155, 20);
    ctx.fill();

    // Glowing premium gold border
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(212, 175, 55, 0.18)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();

    // Diagonal Glossy swipe across Right Card
    ctx.save();
    ctx.beginPath();
    drawRoundRect(560, 595, 380, 155, 20);
    ctx.clip();
    const swipe2 = ctx.createLinearGradient(560, 595, 940, 750);
    swipe2.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    swipe2.addColorStop(0.3, 'rgba(255, 255, 255, 0.03)');
    swipe2.addColorStop(0.31, 'rgba(255, 255, 255, 0)');
    swipe2.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = swipe2;
    ctx.fill();
    ctx.restore();

    // Compute Prize Value
    const prizeText = winner.winnerPrize
      ? `${winner.winnerPrize}`
      : winner.prizeAmount && winner.prizeAmount > 0
      ? `₹${winner.prizeAmount}`
      : Array.isArray(contest.winnerPrizes) && contest.winnerPrizes[rank - 1] !== undefined && contest.winnerPrizes[rank - 1] > 0
      ? `₹${contest.winnerPrizes[rank - 1]}`
      : contest.winnerRewardAmount && contest.winnerRewardAmount > 0
      ? `₹${contest.winnerRewardAmount}`
      : '🏆 Champion Prize';

    // Render Right Card details
    ctx.font = '900 15px system-ui, sans-serif';
    ctx.fillStyle = '#D4AF37'; // Gold label
    ctx.fillText('💰 WINNER PRIZE', 750, 642);

    ctx.font = '900 36px system-ui, sans-serif';
    ctx.fillStyle = '#FFD700'; // Royal Gold Value
    ctx.save();
    ctx.shadowColor = 'rgba(212, 175, 55, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(prizeText, 750, 702);
    ctx.restore();

    // 8. Bottom Congratulations Panel (Y: 775, Width: 800, Height: 135)
    ctx.save();
    const congratBg = ctx.createLinearGradient(140, 775, 140, 910);
    congratBg.addColorStop(0, 'rgba(15, 23, 42, 0.8)');
    congratBg.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
    ctx.fillStyle = congratBg;
    drawRoundRect(140, 775, 800, 135, 20);
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Gloss swipe across congratulations panel
    ctx.save();
    ctx.beginPath();
    drawRoundRect(140, 775, 800, 135, 20);
    ctx.clip();
    const swipeCongrat = ctx.createLinearGradient(140, 775, 940, 910);
    swipeCongrat.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    swipeCongrat.addColorStop(0.2, 'rgba(255, 255, 255, 0.02)');
    swipeCongrat.addColorStop(0.21, 'rgba(255, 255, 255, 0)');
    swipeCongrat.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = swipeCongrat;
    ctx.fill();
    ctx.restore();

    // Render Congratulations Content
    ctx.textAlign = 'center';

    const congratGold = ctx.createLinearGradient(0, 790, 0, 825);
    congratGold.addColorStop(0, '#FFFFFF');
    congratGold.addColorStop(0.4, '#FFD700');
    congratGold.addColorStop(1, '#D4AF37');

    ctx.font = '900 28px system-ui, sans-serif';
    ctx.fillStyle = congratGold;
    ctx.save();
    ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
    ctx.shadowBlur = 8;
    ctx.fillText('🎉 CONGRATULATIONS 🎉', 540, 815);
    ctx.restore();

    // Contest Name in uppercase, crisp white
    let displayTitle = (contest.title || 'VOTING CONTEST').toUpperCase();
    if (displayTitle.length > 42) displayTitle = displayTitle.slice(0, 40) + '...';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(displayTitle, 540, 854);

    // Winning Date / Verified Result
    const winTimeStr = winner.winningTime
      ? new Date(winner.winningTime).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8'; // Blue Neon accent
    ctx.fillText(`Winning Date: ${winTimeStr} • Authenticated Standings`, 540, 888);

    // 9. Footer & Verified Authentication Badge (Y: 940 to 1010)
    // Footer Left Layout
    ctx.textAlign = 'left';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = '#D4AF37'; // Premium Royal Gold
    ctx.fillText('👑 ROY SHARE WALLET', 140, 955);

    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('🤖 Bot: t.me/RoyShareWalletBot', 140, 978);
    ctx.fillText('🌐 Official Website: roysharewallet.com', 140, 998);

    // Footer Right Layout (Verified Stamp & Authenticity statement)
    ctx.textAlign = 'center';

    // Gold Pill Badge
    ctx.save();
    ctx.fillStyle = '#D4AF37';
    drawRoundRect(750, 942, 190, 32, 16);
    ctx.fill();
    ctx.restore();

    ctx.font = '900 13px system-ui, sans-serif';
    ctx.fillStyle = '#0F172A'; // Dark charcoal text inside gold pill
    ctx.fillText('✓ VERIFIED WINNER', 845, 963);

    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8'; // Neon Blue Description
    ctx.fillText('100% AUTHENTIC SYSTEM STANDINGS', 845, 992);

    return canvas.toDataURL('image/png');
  };

  try {
    return await renderCanvas(true);
  } catch (err) {
    console.warn('Canvas render fallback (cross-origin image load prevented):', err);
    return await renderCanvas(false);
  }
}
