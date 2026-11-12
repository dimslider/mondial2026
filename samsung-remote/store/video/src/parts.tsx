import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const C = {
  bg: '#0b1220',
  ink: '#ffffff',
  muted: '#9aa4b2',
  accent: '#2EC4A6',
  accentInk: '#06231d',
  font: 'Inter, system-ui, sans-serif',
};

// Screens are 1030 x 2288 captures of the real app.
const SCREEN_RATIO = 2288 / 1030;

export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const x = 30 + Math.sin(f / 90) * 8;
  return (
    <AbsoluteFill
      style={{ background: `radial-gradient(70% 60% at ${x}% 20%, #17324f 0%, ${C.bg} 55%, #070b12 100%)` }}
    />
  );
};

/** 0..1 ease-in that starts at `delay` frames. */
export const useIn = (delay = 0, damping = 200) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - delay, fps, config: { damping } });
};

/** Fades a whole scene in and out over its own length. */
export const SceneFade: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 10, len - 10, len], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

export const Pro: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <span
    style={{
      display: 'inline-block', fontFamily: C.font, fontWeight: 900, fontSize: size, letterSpacing: size * 0.1,
      color: C.accentInk, background: C.accent, borderRadius: size * 0.4, padding: `${size * 0.18}px ${size * 0.55}px`,
      boxShadow: `0 8px 30px ${C.accent}55`, lineHeight: 1,
    }}
  >
    PRO
  </span>
);

/** Big caption with an optional PRO badge and a smaller line under it. */
export const Caption: React.FC<{ title: string; sub?: string; pro?: boolean; delay?: number; align?: 'left' | 'center' }> = ({
  title, sub, pro, delay = 6, align = 'left',
}) => {
  const a = useIn(delay);
  const b = useIn(delay + 10);
  return (
    <div style={{ fontFamily: C.font, textAlign: align }}>
      {pro && (
        <div style={{ opacity: b, transform: `scale(${0.6 + 0.4 * b})`, transformOrigin: align === 'left' ? 'left center' : 'center', marginBottom: 22 }}>
          <Pro />
        </div>
      )}
      <div style={{ color: C.ink, fontSize: 76, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5, opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
        {title}
      </div>
      {sub && (
        <div style={{ color: C.muted, fontSize: 34, fontWeight: 500, marginTop: 20, lineHeight: 1.3, opacity: b, transform: `translateY(${(1 - b) * 20}px)` }}>
          {sub}
        </div>
      )}
    </div>
  );
};

/** A tap ripple at (x, y), as fractions of the phone screen, starting at frame `at`. */
export type Tap = { x: number; y: number; at: number };

export const Phone: React.FC<{ screen: string; width: number; taps?: Tap[]; shake?: [number, number]; children?: React.ReactNode }> = ({
  screen, width, taps = [], shake, children,
}) => {
  const f = useCurrentFrame();
  const h = width * SCREEN_RATIO;
  const pad = width * 0.03;
  let rot = 0;
  if (shake && f >= shake[0] && f <= shake[1]) rot = Math.sin(f * 2.2) * 2.2;
  return (
    <div
      style={{
        width: width + pad * 2, height: h + pad * 2, borderRadius: width * 0.12, background: '#05080d', padding: pad, boxSizing: 'border-box',
        boxShadow: `0 0 0 3px #2b3644, 0 40px 120px #000c, 0 0 160px ${C.accent}22`, transform: `rotate(${rot}deg)`, position: 'relative',
      }}
    >
      <div style={{ width, height: h, borderRadius: width * 0.1, overflow: 'hidden', position: 'relative' }}>
        <Img src={staticFile(`screens/${screen}.png`)} style={{ width, height: h, display: 'block' }} />
        {taps.map((t, i) => {
          const p = interpolate(f - t.at, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          if (f < t.at || f > t.at + 16) return null;
          const s = width * 0.16;
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: t.x * width - s / 2, top: t.y * h - s / 2, width: s, height: s, borderRadius: '50%',
                background: '#ffffff', opacity: 0.45 * (1 - p), transform: `scale(${0.4 + p})`,
              }}
            />
          );
        })}
        {children}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- the TV

export type TvState = {
  content: 'home' | 'movie';
  focus?: number; // focused tile on the home screen (can be fractional while moving)
  pressed?: number; // 0..1 press flash on the focused tile
  volume?: { level: number; show: number }; // show: 0..1
  muted?: number; // 0..1
  paused?: number; // 0..1
  off?: number; // 0..1 (screen fades to black)
  moon?: number; // 0..1
};

const TILE_COLORS = [
  ['#ff6b6b', '#c0392b'], ['#4dabf7', '#1c5fa8'], ['#51cf66', '#2b8a3e'], ['#fcc419', '#e67700'], ['#cc5de8', '#862e9c'],
];

const Home: React.FC<{ focus: number; pressed: number }> = ({ focus, pressed }) => {
  const W = 880, tileW = 140, gap = 24, left = 50;
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #1b2735 0%, #0e141c 100%)' }}>
      <div style={{ position: 'absolute', left, top: 40, width: W - left * 2, height: 210, borderRadius: 18, background: 'linear-gradient(120deg, #2d4f7c, #6a3d8f 60%, #c1567a)' }}>
        <div style={{ position: 'absolute', left: 36, top: 60, width: 260, height: 26, borderRadius: 13, background: '#ffffffcc' }} />
        <div style={{ position: 'absolute', left: 36, top: 104, width: 180, height: 18, borderRadius: 9, background: '#ffffff77' }} />
      </div>
      {TILE_COLORS.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: left + i * (tileW + gap), top: 290, width: tileW, height: 140, borderRadius: 16,
            background: `linear-gradient(135deg, ${c[0]}, ${c[1]})`,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute', left: left + focus * (tileW + gap) - 8, top: 282, width: tileW + 16, height: 156, borderRadius: 22,
          border: '5px solid #ffffff', boxShadow: `0 0 30px #ffffff88`, background: `rgba(255,255,255,${0.35 * pressed})`,
        }}
      />
    </AbsoluteFill>
  );
};

const Movie: React.FC = () => {
  const f = useCurrentFrame();
  const pan = (f * 0.4) % 400;
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #ff9a5a 0%, #f7c873 35%, #8fb7d9 36%, #3e6d96 100%)' }}>
      <div style={{ position: 'absolute', left: 560, top: 70, width: 110, height: 110, borderRadius: '50%', background: '#fff3c4', boxShadow: '0 0 80px #ffe8a3' }} />
      <svg width={1280} height={495} viewBox="0 0 1280 495" style={{ position: 'absolute', left: -pan, top: 0 }}>
        <path d="M0 300 L120 200 L240 280 L380 170 L520 290 L660 210 L800 300 L940 190 L1080 280 L1280 200 L1280 495 L0 495Z" fill="#3b4f6b" />
        <path d="M0 360 L160 290 L320 350 L480 280 L640 360 L800 300 L960 370 L1120 290 L1280 350 L1280 495 L0 495Z" fill="#26364d" />
      </svg>
    </AbsoluteFill>
  );
};

const Badge: React.FC<{ show: number; children: React.ReactNode }> = ({ show, children }) => (
  <div
    style={{
      position: 'absolute', right: 30, top: 28, opacity: show, transform: `scale(${0.8 + 0.2 * show})`, transformOrigin: 'right top',
      display: 'flex', alignItems: 'center', gap: 12, background: '#000000aa', color: '#fff', fontFamily: C.font, fontSize: 28,
      fontWeight: 700, borderRadius: 16, padding: '12px 20px',
    }}
  >
    {children}
  </div>
);

export const Icon = {
  mute: 'M3,9.5h3.5L11,5.5v13l-4.5,-4H3z M15.6,9.1l1.4,-1.4 2,2 2,-2 1.4,1.4 -2,2 2,2 -1.4,1.4 -2,-2 -2,2 -1.4,-1.4 2,-2z',
  vol: 'M5,9v6h4l5,5V4L9,9H5z M16.5,12c0,-1.77 -1.02,-3.29 -2.5,-4.03v8.05c1.48,-0.73 2.5,-2.25 2.5,-4.02z',
  pause: 'M6,5h4v14H6z M14,5h4v14h-4z',
};
export const Svg: React.FC<{ d: string; size?: number; color?: string }> = ({ d, size = 32, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24"><path fill={color} d={d} /></svg>
);

export const Tv: React.FC<{ state: TvState; width?: number }> = ({ state, width = 880 }) => {
  const h = width * (495 / 880);
  const s = width / 880;
  return (
    <div style={{ position: 'relative', width, height: h + 60 * s }}>
      <div style={{ width, height: h, borderRadius: 14 * s, background: '#05070a', padding: 10 * s, boxSizing: 'border-box', boxShadow: '0 30px 90px #000a, 0 0 0 2px #1e2631' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 6 * s, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: 880, height: 495, transform: `scale(${(width - 20 * s) / 880})`, transformOrigin: 'left top', position: 'relative', overflow: 'hidden' }}>
            {state.content === 'home' ? <Home focus={state.focus ?? 0} pressed={state.pressed ?? 0} /> : <Movie />}
            {state.volume && (
              <div style={{ position: 'absolute', left: 40, top: 30, opacity: state.volume.show, display: 'flex', alignItems: 'center', gap: 16, background: '#000000aa', borderRadius: 16, padding: '14px 22px' }}>
                <Svg d={Icon.vol} size={34} />
                <div style={{ width: 280, height: 10, borderRadius: 5, background: '#ffffff33' }}>
                  <div style={{ width: `${state.volume.level}%`, height: '100%', borderRadius: 5, background: C.accent }} />
                </div>
                <div style={{ color: '#fff', fontFamily: C.font, fontSize: 28, fontWeight: 700, width: 44 }}>{Math.round(state.volume.level / 2.5)}</div>
              </div>
            )}
            <Badge show={state.muted ?? 0}><Svg d={Icon.mute} />Muted</Badge>
            <Badge show={state.paused ?? 0}><Svg d={Icon.pause} />Paused</Badge>
            <AbsoluteFill style={{ background: '#000', opacity: state.off ?? 0 }} />
            <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: state.moon ?? 0, fontFamily: C.font, color: '#cfd8e3', fontSize: 34, gap: 14 }}>
              <div style={{ fontSize: 90 }}>☾</div>Good night
            </AbsoluteFill>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: width / 2 - 90 * s, top: h, width: 180 * s, height: 40 * s, background: 'linear-gradient(#11161d, #0a0e13)', clipPath: 'polygon(30% 0, 70% 0, 100% 100%, 0 100%)' }} />
    </div>
  );
};
