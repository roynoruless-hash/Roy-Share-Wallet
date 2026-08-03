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
 * Generates an ultra-premium, viral, and high-resolution 1080x1080 PNG Winner Banner matching professional esports/championship aesthetics.
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

    // Helper to draw shiny 4-point star sparkles
    const drawSparkle = (cx: number, cy: number, size: number, color: string) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = size;
      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.quadraticCurveTo(cx, cy, cx + size, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy + size);
      ctx.quadraticCurveTo(cx, cy, cx - size, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy - size);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    // Helper to draw realistic vector Golden Trophy on the left
    const drawTrophy = (tx: number, ty: number, tw: number, th: number) => {
      ctx.save();
      // Metallic Gold Gradient for Trophy
      const goldGrad = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
      goldGrad.addColorStop(0, '#FFFDF0'); // White highlights
      goldGrad.addColorStop(0.25, '#FFE57F'); // Gold shine
      goldGrad.addColorStop(0.5, '#FFD700'); // Pure Gold
      goldGrad.addColorStop(0.75, '#D4AF37'); // Premium Gold
      goldGrad.addColorStop(1, '#8A640F'); // Dark Bronze gold

      ctx.fillStyle = goldGrad;
      ctx.strokeStyle = '#AA7C11';
      ctx.lineWidth = 1.5;

      // 1. Double Bevel Base
      // Bottom pedestal
      drawRoundRect(tx + tw * 0.15, ty + th * 0.82, tw * 0.7, th * 0.12, 4);
      ctx.fill();
      ctx.stroke();

      // Middle pedestal block
      drawRoundRect(tx + tw * 0.25, ty + th * 0.72, tw * 0.5, th * 0.1, 2);
      ctx.fill();
      ctx.stroke();

      // 2. Stem
      ctx.beginPath();
      ctx.moveTo(tx + tw * 0.44, ty + th * 0.72);
      ctx.lineTo(tx + tw * 0.44, ty + th * 0.52);
      ctx.lineTo(tx + tw * 0.56, ty + th * 0.52);
      ctx.lineTo(tx + tw * 0.56, ty + th * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Stem collar ring
      drawRoundRect(tx + tw * 0.38, ty + th * 0.52, tw * 0.24, th * 0.05, 2);
      ctx.fill();
      ctx.stroke();

      // 3. Cup body
      ctx.beginPath();
      ctx.moveTo(tx + tw * 0.25, ty + th * 0.15); // Left lip
      ctx.lineTo(tx + tw * 0.75, ty + th * 0.15); // Right lip
      ctx.quadraticCurveTo(tx + tw * 0.72, ty + th * 0.45, tx + tw * 0.5, ty + th * 0.52); // Right side curve
      ctx.quadraticCurveTo(tx + tw * 0.28, ty + th * 0.45, tx + tw * 0.25, ty + th * 0.15); // Left side curve
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 4. Handles (Left and Right)
      ctx.beginPath();
      // Left handle outer curve
      ctx.moveTo(tx + tw * 0.25, ty + th * 0.2);
      ctx.bezierCurveTo(tx + tw * 0.05, ty + th * 0.15, tx + tw * 0.08, ty + th * 0.4, tx + tw * 0.3, ty + th * 0.42);
      // Left handle inner curve back
      ctx.bezierCurveTo(tx + tw * 0.18, ty + th * 0.38, tx + tw * 0.15, ty + th * 0.22, tx + tw * 0.25, ty + th * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      // Right handle outer curve
      ctx.moveTo(tx + tw * 0.75, ty + th * 0.2);
      ctx.bezierCurveTo(tx + tw * 0.95, ty + th * 0.15, tx + tw * 0.92, ty + th * 0.4, tx + tw * 0.7, ty + th * 0.42);
      // Right handle inner curve back
      ctx.bezierCurveTo(tx + tw * 0.82, ty + th * 0.38, tx + tw * 0.85, ty + th * 0.22, tx + tw * 0.75, ty + th * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 5. Star detail inside Cup center
      ctx.font = 'bold 16px system-ui';
      ctx.fillStyle = '#0F172A';
      ctx.textAlign = 'center';
      ctx.fillText('★', tx + tw * 0.5, ty + th * 0.35);

      ctx.restore();
    };

    // Helper to draw premium metallic Verified Shield on the right
    const drawShield = (sx: number, sy: number, sw: number, sh: number) => {
      ctx.save();
      // 1. Crest Shape Path
      const drawShieldPath = () => {
        ctx.beginPath();
        ctx.moveTo(sx + sw * 0.5, sy); // Top Center
        ctx.quadraticCurveTo(sx + sw * 0.8, sy - sh * 0.05, sx + sw, sy + sh * 0.1); // Top right curve
        ctx.quadraticCurveTo(sx + sw * 0.95, sy + sh * 0.55, sx + sw * 0.5, sy + sh); // Right side to bottom point
        ctx.quadraticCurveTo(sx + sw * 0.05, sy + sh * 0.55, sx, sy + sh * 0.1); // Bottom point to left side
        ctx.quadraticCurveTo(sx + sw * 0.2, sy - sh * 0.05, sx + sw * 0.5, sy); // Left side to top center
        ctx.closePath();
      };

      // Outer Gold Shield
      drawShieldPath();
      const outerGold = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
      outerGold.addColorStop(0, '#FFE082');
      outerGold.addColorStop(0.5, '#FFD700');
      outerGold.addColorStop(1, '#AA7C11');
      ctx.fillStyle = outerGold;
      ctx.fill();
      ctx.strokeStyle = '#AA7C11';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner Dark Blue Shield
      ctx.save();
      ctx.beginPath();
      ctx.scale(0.85, 0.85);
      ctx.translate((sx + sw * 0.5) * (1 - 0.85) / 0.85, (sy + sh * 0.5) * (1 - 0.85) / 0.85);
      // Re-draw scaled shield path
      ctx.moveTo(sx + sw * 0.5, sy);
      ctx.quadraticCurveTo(sx + sw * 0.8, sy - sh * 0.05, sx + sw, sy + sh * 0.1);
      ctx.quadraticCurveTo(sx + sw * 0.95, sy + sh * 0.55, sx + sw * 0.5, sy + sh);
      ctx.quadraticCurveTo(sx + sw * 0.05, sy + sh * 0.55, sx, sy + sh * 0.1);
      ctx.quadraticCurveTo(sx + sw * 0.2, sy - sh * 0.05, sx + sw * 0.5, sy);
      ctx.closePath();

      const innerNavy = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
      innerNavy.addColorStop(0, '#040d21');
      innerNavy.addColorStop(1, '#020512');
      ctx.fillStyle = innerNavy;
      ctx.fill();

      // Inner glowing blue ring
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // 2. Large Green Verified Checkmark
      ctx.save();
      ctx.strokeStyle = '#22c55e'; // Emerald green
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(34, 197, 94, 0.6)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(sx + sw * 0.35, sy + sh * 0.44);
      ctx.lineTo(sx + sw * 0.48, sy + sh * 0.58);
      ctx.lineTo(sx + sw * 0.7, sy + sh * 0.32);
      ctx.stroke();
      ctx.restore();

      // 3. 100% Authentic Text inside Shield
      ctx.font = '900 11px system-ui, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText('100%', sx + sw * 0.5, sy + sh * 0.76);
      ctx.font = '800 8px system-ui, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('AUTHENTIC', sx + sw * 0.5, sy + sh * 0.86);

      ctx.restore();
    };

    // 1. Background Gradient (Dark Royal Navy + Black Premium Gradient)
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    bgGrad.addColorStop(0, '#010411'); // Midnight Royal Black
    bgGrad.addColorStop(0.25, '#020d2b'); // Royal Navy Core
    bgGrad.addColorStop(0.5, '#041641'); // Brilliant Blue Navy
    bgGrad.addColorStop(0.75, '#010514'); // Intense Charcoal
    bgGrad.addColorStop(1, '#000000'); // Pure Matte Black
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Diagonal Esports Tech Stripes Pattern (subtle backdrop layers)
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
    ctx.lineWidth = 2;
    for (let i = -1080; i < 1080; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 1080, 1080);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Light Rays / Stage Spotlights (Emanating from top-center)
    ctx.save();
    const rayOriginX = 540;
    const rayOriginY = -150;
    const numRays = 48;
    for (let i = 0; i < numRays; i++) {
      const angle = (Math.PI / numRays) * i;
      const length = 1500;
      const targetX = rayOriginX + Math.cos(angle) * length;
      const targetY = rayOriginY + Math.sin(angle) * length;

      ctx.beginPath();
      ctx.moveTo(rayOriginX, rayOriginY);
      ctx.lineTo(targetX, targetY);

      const rayGrad = ctx.createLinearGradient(rayOriginX, rayOriginY, targetX, targetY);
      rayGrad.addColorStop(0, 'rgba(56, 189, 248, 0.05)');
      rayGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.02)');
      rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.strokeStyle = rayGrad;
      ctx.lineWidth = 14 + (i % 3) * 6;
      ctx.stroke();
    }
    ctx.restore();

    // Radial Neon Glow Core Behind Avatar
    const centerGlow = ctx.createRadialGradient(540, 360, 50, 540, 360, 480);
    centerGlow.addColorStop(0, 'rgba(56, 189, 248, 0.16)'); // Cyan Core Glow
    centerGlow.addColorStop(0.5, 'rgba(4, 22, 65, 0.08)');
    centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, 1080, 1080);

    // 3. Floating Gold Particles / Dust System
    const seedRandom = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 35; i++) {
      const px = Math.floor(seedRandom(i + 1) * 1000) + 40;
      const py = Math.floor(seedRandom(i + 2) * 1000) + 40;
      const pSize = Math.floor(seedRandom(i + 3) * 6) + 2;
      const pOpacity = seedRandom(i + 4) * 0.45 + 0.15;

      const partGrad = ctx.createRadialGradient(px, py, 0, px, py, pSize);
      partGrad.addColorStop(0, `rgba(255, 215, 0, ${pOpacity})`);
      partGrad.addColorStop(1, 'rgba(212, 175, 55, 0)');

      ctx.save();
      ctx.fillStyle = partGrad;
      ctx.beginPath();
      ctx.arc(px, py, pSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Confetti System (Esports Championship style)
    const confettiColors = ['#FFD700', '#38bdf8', '#FFFFFF', '#1e40af', '#E2E8F0'];
    for (let i = 0; i < 24; i++) {
      const cx = Math.floor(seedRandom(i + 10) * 1000) + 40;
      const cy = Math.floor(seedRandom(i + 11) * 800) + 50;
      const cw = Math.floor(seedRandom(i + 12) * 12) + 6;
      const ch = Math.floor(seedRandom(i + 13) * 6) + 3;
      const col = confettiColors[Math.floor(seedRandom(i + 14) * confettiColors.length)];
      const angle = seedRandom(i + 15) * Math.PI;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
      ctx.restore();
    }

    // 5. Dual Border Frame (Premium Gold & Blue Neon Glow)
    // Outer Premium Gold Border
    ctx.strokeStyle = '#D4AF37'; // Royal Gold
    ctx.lineWidth = 12;
    ctx.strokeRect(30, 30, 1020, 1020);

    // Inner Neon Blue Border (Glow effect)
    ctx.save();
    ctx.strokeStyle = '#38bdf8'; // Blue Neon
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.75)';
    ctx.shadowBlur = 15;
    ctx.strokeRect(48, 48, 984, 984);
    ctx.restore();

    // Four Corner Gold Stud & Brackets Ornament
    const cornerStuds = [
      [30, 30],
      [1050, 30],
      [30, 1050],
      [1050, 1050]
    ];
    cornerStuds.forEach(([cx, cy]) => {
      // Corner structural lines
      ctx.save();
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (cx === 30) {
        ctx.moveTo(cx + 40, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + 40);
      } else {
        ctx.moveTo(cx - 40, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + 40);
      }
      if (cy === 1050) {
        if (cx === 30) {
          ctx.moveTo(cx + 40, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - 40);
        } else {
          ctx.moveTo(cx - 40, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - 40);
        }
      }
      ctx.stroke();
      ctx.restore();

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

    // 6. Top Header Section
    ctx.textAlign = 'center';

    // Premium Gold Metallic Gradient
    const goldGrad = ctx.createLinearGradient(0, 65, 0, 110);
    goldGrad.addColorStop(0, '#FFFBF0');
    goldGrad.addColorStop(0.35, '#FFD700');
    goldGrad.addColorStop(0.7, '#D4AF37');
    goldGrad.addColorStop(1, '#966E0A');

    ctx.font = '900 42px system-ui, sans-serif';
    ctx.fillStyle = goldGrad;
    ctx.save();
    ctx.shadowColor = 'rgba(212, 175, 55, 0.45)';
    ctx.shadowBlur = 12;
    ctx.fillText('🏆 ROY SHARE WALLET', 540, 105);
    ctx.restore();

    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8'; // Blue Neon
    ctx.fillText('VERIFIED VOTING CONTEST • OFFICIAL STANDINGS', 540, 138);

    // 7. Large Premium Rank Badge (Unique glow/medals based on rank)
    let rankColor = '#38bdf8'; // Default Blue
    let badgeText = `🏅 RANK #${rank} PLACE`;
    let badgeBg = 'rgba(56, 189, 248, 0.16)';
    let badgeBorder = 'rgba(56, 189, 248, 0.45)';

    if (rank === 1) {
      rankColor = '#FFD700'; // Gold
      badgeText = '🥇 1ST PLACE';
      badgeBg = 'rgba(212, 175, 55, 0.25)';
      badgeBorder = '#D4AF37';
    } else if (rank === 2) {
      rankColor = '#E2E8F0'; // Silver
      badgeText = '🥈 2ND PLACE';
      badgeBg = 'rgba(226, 232, 240, 0.2)';
      badgeBorder = '#94a3b8';
    } else if (rank === 3) {
      rankColor = '#CD7F32'; // Bronze
      badgeText = '🥉 3RD PLACE';
      badgeBg = 'rgba(205, 127, 50, 0.25)';
      badgeBorder = '#b45309';
    } else if (rank === 4) {
      rankColor = '#38bdf8'; // Blue
      badgeText = '🏅 4TH PLACE';
      badgeBg = 'rgba(56, 189, 248, 0.2)';
      badgeBorder = '#0284c7';
    }

    // Flanking bars for Rank Badge (Adds championship weight)
    ctx.save();
    ctx.fillStyle = rankColor;
    ctx.shadowColor = rankColor;
    ctx.shadowBlur = 12;
    // Left Wing Bar
    drawRoundRect(320, 182, 45, 30, 4);
    ctx.fill();
    // Right Wing Bar
    drawRoundRect(715, 182, 45, 30, 4);
    ctx.fill();
    ctx.restore();

    // Draw glassmorphism rank badge pill
    ctx.save();
    ctx.fillStyle = badgeBg;
    ctx.strokeStyle = badgeBorder;
    ctx.lineWidth = 3;
    ctx.shadowColor = rankColor;
    ctx.shadowBlur = 14;
    drawRoundRect(380, 170, 320, 54, 27);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Fill rank badge text
    ctx.font = '900 25px system-ui, sans-serif';
    ctx.fillStyle = rankColor;
    ctx.fillText(badgeText, 540, 205);

    // 8. Large Circular Avatar
    const avatarCenterX = 540;
    const avatarCenterY = 360;
    const avatarRadius = 90;

    // Glowing electric blue back ring system
    ctx.save();
    for (let i = 1; i <= 12; i++) {
      ctx.strokeStyle = 'rgba(56, 189, 248, ' + (0.18 - i * 0.015) + ')';
      ctx.lineWidth = i * 2.2;
      ctx.beginPath();
      ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 14, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Outer Segmented Technical Orbital Rings
    ctx.save();
    ctx.strokeStyle = rank === 1 ? 'rgba(212, 175, 55, 0.45)' : 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 18]);
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Solid Inner Gold Metallic Ring Border
    const goldRingGrad = ctx.createLinearGradient(avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarCenterX + avatarRadius, avatarCenterY + avatarRadius);
    goldRingGrad.addColorStop(0, '#FFF9E6');
    goldRingGrad.addColorStop(0.5, '#FFD700');
    goldRingGrad.addColorStop(1, '#AA7C11');
    ctx.strokeStyle = goldRingGrad;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 3.5, 0, Math.PI * 2);
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
      const avatarBg = ctx.createLinearGradient(avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarCenterX + avatarRadius, avatarCenterY + avatarRadius);
      avatarBg.addColorStop(0, '#020d2b'); // Dark Navy
      avatarBg.addColorStop(0.5, '#041641'); // Indigo Slate
      avatarBg.addColorStop(1, '#1e3a8a'); // Brilliant Blue
      ctx.fillStyle = avatarBg;
      ctx.fillRect(avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);

      // Extract initials
      let firstLetter = 'W';
      if (winner.username) {
        const cleanUser = winner.username.replace('@', '');
        if (cleanUser.length > 0) {
          firstLetter = cleanUser.charAt(0).toUpperCase();
        }
      } else if (winner.name) {
        firstLetter = winner.name.charAt(0).toUpperCase();
      }

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
    ctx.font = '56px system-ui, sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('👑', avatarCenterX, avatarCenterY - avatarRadius - 16);

    // Diagonal Glass Shine line crossing the avatar
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.clip();
    const avatarShine = ctx.createLinearGradient(avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarCenterX + avatarRadius, avatarCenterY + avatarRadius);
    avatarShine.addColorStop(0, 'rgba(255,255,255,0)');
    avatarShine.addColorStop(0.35, 'rgba(255,255,255,0)');
    avatarShine.addColorStop(0.4, 'rgba(255,255,255,0.22)');
    avatarShine.addColorStop(0.45, 'rgba(255,255,255,0.05)');
    avatarShine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = avatarShine;
    ctx.fillRect(avatarCenterX - avatarRadius, avatarCenterY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.restore();

    // Sparkle star next to Crown
    drawSparkle(avatarCenterX - 75, avatarCenterY - 110, 10, '#FFD700');
    drawSparkle(avatarCenterX + 75, avatarCenterY - 110, 12, '#38bdf8');

    // 9. Winner Details Panel
    // Winner Name in heavy uppercase typography
    let displayName = (winner.name || 'Anonymous User').toUpperCase();
    if (displayName.length > 24) displayName = displayName.slice(0, 22) + '...';
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.fillText(displayName, 540, 495);
    ctx.restore();

    // @Username in neon cyan text
    let displayUsername = winner.username
      ? (winner.username.startsWith('@') ? winner.username : `@${winner.username}`)
      : '@anonymous_user';
    if (displayUsername.length > 24) displayUsername = displayUsername.slice(0, 22) + '...';
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8'; // Neon Blue Text
    ctx.save();
    ctx.shadowColor = 'rgba(56, 189, 248, 0.4)';
    ctx.shadowBlur = 8;
    ctx.fillText(displayUsername, 540, 532);
    ctx.restore();

    // Telegram ID
    const displayTgId = winner.telegramId ? `Telegram ID: ${winner.telegramId}` : 'Telegram ID: Verified Participant';
    ctx.font = '600 18px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(displayTgId, 540, 565);

    // 10. Premium Glassmorphic Side-By-Side Cards (Votes & Prize)
    // Left Card: Verified Votes
    ctx.save();
    const cardBg1 = ctx.createLinearGradient(140, 595, 140, 750);
    cardBg1.addColorStop(0, 'rgba(6, 15, 38, 0.92)');
    cardBg1.addColorStop(1, 'rgba(1, 3, 10, 0.98)');
    ctx.fillStyle = cardBg1;
    drawRoundRect(140, 595, 380, 155, 20);
    ctx.fill();

    // Glowing electric blue border
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.25)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    // Diagonal Glossy swipe across Left Card
    ctx.save();
    ctx.beginPath();
    drawRoundRect(140, 595, 380, 155, 20);
    ctx.clip();
    const swipe1 = ctx.createLinearGradient(140, 595, 520, 750);
    swipe1.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    swipe1.addColorStop(0.25, 'rgba(255, 255, 255, 0.04)');
    swipe1.addColorStop(0.26, 'rgba(255, 255, 255, 0)');
    swipe1.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = swipe1;
    ctx.fill();
    ctx.restore();

    // Left Card Text
    ctx.textAlign = 'center';
    ctx.font = '900 16px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8'; // Electric blue label
    ctx.fillText('👥 VERIFIED VOTES', 330, 642);

    ctx.font = '900 50px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.save();
    ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
    ctx.shadowBlur = 12;
    ctx.fillText(`${winner.votesCount || 0}`, 330, 706);
    ctx.restore();

    // Right Card: Prize Won
    ctx.save();
    const cardBg2 = ctx.createLinearGradient(560, 595, 560, 750);
    cardBg2.addColorStop(0, 'rgba(24, 18, 5, 0.95)');
    cardBg2.addColorStop(1, 'rgba(1, 3, 10, 0.98)');
    ctx.fillStyle = cardBg2;
    drawRoundRect(560, 595, 380, 155, 20);
    ctx.fill();

    // Glowing gold border
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(212, 175, 55, 0.3)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    // Diagonal Glossy swipe across Right Card
    ctx.save();
    ctx.beginPath();
    drawRoundRect(560, 595, 380, 155, 20);
    ctx.clip();
    const swipe2 = ctx.createLinearGradient(560, 595, 940, 750);
    swipe2.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    swipe2.addColorStop(0.25, 'rgba(255, 255, 255, 0.04)');
    swipe2.addColorStop(0.26, 'rgba(255, 255, 255, 0)');
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

    // Right Card Text
    ctx.font = '900 16px system-ui, sans-serif';
    ctx.fillStyle = '#D4AF37'; // Gold label
    ctx.fillText('💰 WINNER PRIZE', 750, 642);

    ctx.font = '900 38px system-ui, sans-serif';
    ctx.fillStyle = '#FFD700'; // Royal Gold Value
    ctx.save();
    ctx.shadowColor = 'rgba(212, 175, 55, 0.65)';
    ctx.shadowBlur = 12;
    ctx.fillText(prizeText, 750, 702);
    ctx.restore();

    // Sparkles on stats cards
    drawSparkle(165, 615, 8, '#38bdf8');
    drawSparkle(915, 615, 8, '#FFD700');

    // 11. Big Celebration Area (Y: 775 to 910)
    ctx.save();
    const congratBg = ctx.createLinearGradient(140, 775, 140, 910);
    congratBg.addColorStop(0, 'rgba(10, 20, 50, 0.85)');
    congratBg.addColorStop(1, 'rgba(2, 6, 23, 0.98)');
    ctx.fillStyle = congratBg;
    drawRoundRect(140, 775, 800, 135, 20);
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Gloss swipe across congratulations panel
    ctx.save();
    ctx.beginPath();
    drawRoundRect(140, 775, 800, 135, 20);
    ctx.clip();
    const swipeCongrat = ctx.createLinearGradient(140, 775, 940, 910);
    swipeCongrat.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    swipeCongrat.addColorStop(0.2, 'rgba(255, 255, 255, 0.02)');
    swipeCongrat.addColorStop(0.21, 'rgba(255, 255, 255, 0)');
    swipeCongrat.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = swipeCongrat;
    ctx.fill();
    ctx.restore();

    // Render Congratulations Text with heavy metallic golden gradient & neon shadow
    const congratGold = ctx.createLinearGradient(0, 790, 0, 825);
    congratGold.addColorStop(0, '#FFFFFF');
    congratGold.addColorStop(0.4, '#FFD700');
    congratGold.addColorStop(1, '#D4AF37');

    ctx.font = '900 32px system-ui, sans-serif';
    ctx.fillStyle = congratGold;
    ctx.save();
    ctx.shadowColor = 'rgba(212, 175, 55, 0.6)';
    ctx.shadowBlur = 10;
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
    ctx.fillText(`Winning Date: ${winTimeStr} • Official Verified Standings`, 540, 888);

    // Golden Dividers
    ctx.save();
    const divGrad = ctx.createLinearGradient(160, 0, 920, 0);
    divGrad.addColorStop(0, 'rgba(212, 175, 55, 0)');
    divGrad.addColorStop(0.5, '#D4AF37');
    divGrad.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(160, 828);
    ctx.lineTo(920, 828);
    ctx.stroke();
    ctx.restore();

    // 12. Bottom Symmetrical Section
    // Left: Golden Trophy
    drawTrophy(125, 935, 75, 75);

    // Center: Bot & Web
    ctx.textAlign = 'center';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('🤖 Telegram Bot: t.me/RoyShareWalletBot', 540, 965);
    ctx.fillText('🌐 Official Website: roysharewallet.com', 540, 990);

    // Right: Shield
    drawShield(825, 930, 75, 82);

    // Symmetrical sparkles around bottom
    drawSparkle(215, 970, 8, '#FFD700');
    drawSparkle(805, 970, 8, '#38bdf8');

    return canvas.toDataURL('image/png');
  };

  try {
    return await renderCanvas(true);
  } catch (err) {
    console.warn('Canvas render fallback (cross-origin image load prevented):', err);
    return await renderCanvas(false);
  }
}
