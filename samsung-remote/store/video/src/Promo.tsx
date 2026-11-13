import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import spots from './spots.json';
import { Background, C, Caption, Phone, Pro, SceneFade, Svg, Icon, Tv, TvState, useIn } from './parts';

// Scene lengths in frames (30 fps).
const S = { hook: 105, remote: 240, chips: 135, call: 240, lock: 165, sleep: 165, more: 180, end: 150 };
export const PROMO_FRAMES = Object.values(S).reduce((a, b) => a + b, 0);

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const PHONE_W = 400;

/** Phone on the left, caption and TV on the right: the layout most scenes share. */
const Stage: React.FC<{ phone: React.ReactNode; caption: React.ReactNode; tv: TvState }> = ({ phone, caption, tv }) => {
  const p = useIn(0);
  const t = useIn(8);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 200, top: 83, transform: `translateY(${(1 - p) * 80}px)`, opacity: p }}>{phone}</div>
      <div style={{ position: 'absolute', left: 790, top: 80, width: 1040 }}>{caption}</div>
      <div style={{ position: 'absolute', left: 870, top: 480, opacity: t, transform: `translateX(${(1 - t) * 60}px)` }}>
        <Tv state={tv} width={820} />
      </div>
    </AbsoluteFill>
  );
};

const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const b = useIn(40);
  const words = ['Lost', 'the', 'remote', 'again?'];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: C.font }}>
      <div style={{ display: 'flex', gap: 28, fontSize: 120, fontWeight: 800, color: C.ink, letterSpacing: -3 }}>
        {words.map((w, i) => {
          const s = interpolate(f, [4 + i * 6, 14 + i * 6], [0, 1], clamp);
          return <span key={w} style={{ opacity: s, transform: `translateY(${(1 - s) * 40}px)` }}>{w}</span>;
        })}
      </div>
      <div style={{ marginTop: 34, fontSize: 46, color: C.accent, fontWeight: 700, opacity: b, transform: `translateY(${(1 - b) * 20}px)` }}>
        It's already in your pocket.
      </div>
    </AbsoluteFill>
  );
};

const Remote: React.FC = () => {
  const f = useCurrentFrame();
  const volTaps = [40, 58, 76];
  const rightTaps = [104, 122];
  const okTap = 145;
  const level = 30 + volTaps.filter((t) => f >= t + 3).length * 7.5;
  const volShow = interpolate(f, [40, 44, 100, 108], [0, 1, 1, 0], clamp);
  const focus = interpolate(f, [104, 112, 122, 130], [0, 1, 1, 2], clamp);
  const pressed = interpolate(f, [okTap, okTap + 4, okTap + 12], [0, 1, 0], clamp);
  const tv: TvState = f < okTap + 14 ? { content: 'home', focus, pressed, volume: { level, show: volShow } } : { content: 'movie' };
  return (
    <Stage
      phone={
        <Phone
          screen="main"
          width={PHONE_W}
          taps={[
            ...volTaps.map((at) => ({ ...spots.volup, at })),
            ...rightTaps.map((at) => ({ ...spots.right, at })),
            { ...spots.ok, at: okTap },
          ]}
        />
      }
      caption={<Caption title="Your TV, right on your phone" sub="Volume, arrows and apps over your home Wi-Fi" />}
      tv={tv}
    />
  );
};

const Chips: React.FC = () => {
  const items = ['Finds your TV by itself', 'No account, no sign-in', 'Works with popular smart TVs', 'No IR blaster needed'];
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: C.font, gap: 60 }}>
      <Caption title="Set up in seconds" align="center" delay={2} />
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', width: 1500 }}>
        {items.map((t, i) => (
          <Chip key={t} delay={14 + i * 8}>{t}</Chip>
        ))}
      </div>
    </AbsoluteFill>
  );
};
const Chip: React.FC<{ delay: number; children: React.ReactNode }> = ({ delay, children }) => {
  const a = useIn(delay);
  return (
    <div
      style={{
        opacity: a, transform: `scale(${0.85 + 0.15 * a})`, color: C.ink, fontSize: 46, fontWeight: 600, padding: '22px 40px',
        borderRadius: 999, background: '#ffffff0f', border: `2px solid ${C.accent}88`,
      }}
    >
      <span style={{ color: C.accent, marginRight: 14 }}>✓</span>
      {children}
    </div>
  );
};

const Call: React.FC = () => {
  const f = useCurrentFrame();
  const ring = 30;
  const muted = interpolate(f, [ring + 8, ring + 16], [0, 1], clamp);
  // ring waves around the phone while it rings
  const waves = [0, 12, 24].map((d) => {
    const p = ((f - ring - d) % 36) / 36;
    return f < ring || f > ring + 90 ? null : p;
  });
  return (
    <Stage
      phone={
        <div style={{ position: 'relative' }}>
          {waves.map((p, i) =>
            p == null || p < 0 ? null : (
              <div
                key={i}
                style={{
                  position: 'absolute', left: '50%', top: '18%', width: 300, height: 300, marginLeft: -150, marginTop: -150, borderRadius: '50%',
                  border: `4px solid ${C.accent}`, opacity: 1 - p, transform: `scale(${0.6 + p * 1.2})`,
                }}
              />
            ),
          )}
          <Phone screen="call" width={PHONE_W} shake={[ring, ring + 60]} />
        </div>
      }
      caption={<Caption pro title="Phone rings? The TV hushes." sub="Works for phone and internet calls" />}
      tv={{ content: 'movie', muted }}
    />
  );
};

const Lock: React.FC = () => {
  const f = useCurrentFrame();
  const tap = 50;
  const paused = interpolate(f, [tap + 4, tap + 12], [0, 1], clamp);
  return (
    <Stage
      phone={<Phone screen="lock" width={PHONE_W} taps={[{ x: 0.845, y: 0.4075, at: tap }]} />}
      caption={<Caption pro title="Remote on your lock screen" sub="Power, volume, mute, pause – no unlocking" />}
      tv={{ content: 'movie', paused }}
    />
  );
};

const Sleep: React.FC = () => {
  const f = useCurrentFrame();
  const off = interpolate(f, [45, 85], [0, 1], clamp);
  const moon = interpolate(f, [70, 90, 112, 120], [0, 1, 1, 0.6], clamp);
  return (
    <Stage
      phone={<Phone screen="sleep" width={PHONE_W} />}
      caption={<Caption pro title="Fall asleep? The TV turns off." sub="Works even with the phone locked" />}
      tv={{ content: 'movie', off, moon }}
    />
  );
};

const More: React.FC = () => {
  const cards: { screen: string; label: string; pro: boolean }[] = [
    { screen: 'simple', label: 'Simple mode', pro: false },
    { screen: 'macro', label: 'Macros', pro: true },
    { screen: 'voice', label: 'Voice', pro: true },
    { screen: 'tvs', label: 'All your TVs', pro: true },
  ];
  return (
    <AbsoluteFill style={{ fontFamily: C.font }}>
      <div style={{ position: 'absolute', top: 50, width: '100%' }}>
        <Caption title="And much more" align="center" delay={0} />
      </div>
      <div style={{ position: 'absolute', top: 200, width: '100%', display: 'flex', justifyContent: 'center', gap: 44 }}>
        {cards.map((c, i) => (
          <MoreCard key={c.screen} delay={6 + i * 7} {...c} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
const MoreCard: React.FC<{ screen: string; label: string; pro: boolean; delay: number }> = ({ screen, label, pro, delay }) => {
  const a = useIn(delay);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, opacity: a, transform: `translateY(${(1 - a) * 60}px)` }}>
      <Phone screen={screen} width={330} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: C.ink, fontSize: 40, fontWeight: 700 }}>
        {label}
        {pro && <Pro size={26} />}
      </div>
    </div>
  );
};

const End: React.FC = () => {
  const a = useIn(0);
  const b = useIn(12);
  const c = useIn(24);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: C.font, textAlign: 'center' }}>
      <Img
        src={staticFile('icon.png')}
        style={{ width: 230, height: 230, borderRadius: 52, boxShadow: `0 20px 80px #000a, 0 0 120px ${C.accent}33`, opacity: a, transform: `scale(${0.7 + 0.3 * a})` }}
      />
      <div style={{ marginTop: 50, color: C.ink, fontSize: 92, fontWeight: 800, letterSpacing: -2, opacity: b, transform: `translateY(${(1 - b) * 30}px)` }}>
        Universal Smart TV Remote
      </div>
      <div style={{ marginTop: 26, color: C.muted, fontSize: 42, fontWeight: 500, lineHeight: 1.45, opacity: c }}>
        Basic remote included
        <br />
        <span style={{ color: C.accent, fontWeight: 700 }}>Pro</span> extras: one-time purchase · try Pro for 7 days
      </div>
      <div style={{ marginTop: 40, display: 'flex', gap: 18, alignItems: 'center', opacity: c, color: C.muted, fontSize: 34 }}>
        <Svg d={Icon.vol} size={30} color={C.accent} /> Over your home Wi-Fi · no account
      </div>
    </AbsoluteFill>
  );
};

export const Promo: React.FC = () => {
  const order: [keyof typeof S, React.FC][] = [
    ['hook', Hook], ['remote', Remote], ['chips', Chips], ['call', Call], ['lock', Lock], ['sleep', Sleep], ['more', More], ['end', End],
  ];
  let from = 0;
  return (
    <AbsoluteFill>
      <Background />
      {order.map(([name, Scene]) => {
        const start = from;
        from += S[name];
        return (
          <Sequence key={name} from={start} durationInFrames={S[name]} name={name}>
            <SceneFade len={S[name]}>
              <Scene />
            </SceneFade>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
