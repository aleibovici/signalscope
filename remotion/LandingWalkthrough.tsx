import type { ReactNode } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BackgroundMusic } from "./BackgroundMusic";
import { LANDING } from "./landing-theme";

function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 800,
        letterSpacing: "-0.03em",
        color: LANDING.text,
      }}
    >
      Signal<span style={{ color: LANDING.sky }}>Scope</span>
    </div>
  );
}

function useEntrance(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, frame - delay);
  const opacity = spring({
    frame: t,
    fps,
    config: { damping: 18, mass: 0.4 },
    from: 0,
    to: 1,
  });
  const y = interpolate(t, [0, 12], [28, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  return { opacity, transform: `translateY(${y}px)` };
}

function SceneChrome({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        padding: "80px 96px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 96,
          opacity: 0.92,
        }}
      >
        <BrandMark size={34} />
      </div>
      {children}
    </AbsoluteFill>
  );
}

function HeroScene() {
  const a = useEntrance(0);
  const b = useEntrance(10);
  const c = useEntrance(22);
  const d = useEntrance(36);

  return (
    <SceneChrome>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 70% 20%, rgba(56,189,248,0.12), transparent 55%),
            radial-gradient(ellipse 70% 50% at 15% 80%, rgba(52,211,153,0.08), transparent 50%),
            ${LANDING.bg}`,
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 64px",
        }}
      >
        <div style={{ maxWidth: 1580, textAlign: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 92,
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: "-0.03em",
              color: LANDING.text,
              ...a,
            }}
          >
            Spot breakout stocks
            <br />
            <span style={{ color: LANDING.sky }}>before the crowd</span>
          </h1>
          <p
            style={{
              marginTop: 36,
              fontSize: 34,
              lineHeight: 1.42,
              color: LANDING.muted,
              maxWidth: 1100,
              marginLeft: "auto",
              marginRight: "auto",
              ...b,
            }}
          >
            AI-filtered signals from eight sources—validated with fundamentals,
            reports, and ML backtesting as the dataset grows.
          </p>
          <div
            style={{
              marginTop: 48,
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              justifyContent: "center",
              ...c,
            }}
          >
            {[
              "Live multi-source scans",
              "AI scoring + pump filters",
              "Dashboard free to use",
            ].map((label, i) => (
              <span
                key={label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 28px",
                  borderRadius: 999,
                  border: `1px solid ${LANDING.border}`,
                  background: LANDING.bgCard,
                  fontSize: 24,
                  fontWeight: 600,
                  color: LANDING.muted,
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background:
                      i === 0
                        ? LANDING.emerald
                        : i === 1
                          ? LANDING.sky
                          : "#a78bfa",
                  }}
                />
                {label}
              </span>
            ))}
          </div>
          <p
            style={{
              marginTop: 40,
              fontSize: 20,
              color: LANDING.dim,
              ...d,
            }}
          >
            Free — no credit card required.
          </p>
        </div>
      </AbsoluteFill>
    </SceneChrome>
  );
}

function StatsScene() {
  const frame = useCurrentFrame();
  const items = [
    { n: "8", label: "Signal sources" },
    { n: "13", label: "P&D flags" },
    { n: "4", label: "Signal stages" },
  ];

  return (
    <SceneChrome>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          paddingTop: 48,
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 56,
            fontSize: 58,
            fontWeight: 700,
            color: LANDING.text,
            textAlign: "center",
            opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Built for traders who want the full picture
        </h2>
        <div
          style={{
            display: "flex",
            gap: 36,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {items.map((item, i) => {
            const delay = 8 + i * 10;
            const op = interpolate(frame, [delay, delay + 14], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            });
            const sc = interpolate(frame, [delay, delay + 16], [0.92, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            });
            return (
              <div
                key={item.label}
                style={{
                  width: 380,
                  padding: "48px 36px",
                  borderRadius: 24,
                  border: `1px solid ${LANDING.border}`,
                  background: LANDING.bgCard,
                  textAlign: "center",
                  boxShadow: "0 0 56px -16px rgba(56,189,248,0.4)",
                  opacity: op,
                  transform: `scale(${sc})`,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 80,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    color: LANDING.text,
                  }}
                >
                  {item.n}
                </p>
                <p
                  style={{
                    marginTop: 14,
                    marginBottom: 0,
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: LANDING.dim,
                  }}
                >
                  {item.label}
                </p>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneChrome>
  );
}

function FeaturesScene() {
  const frame = useCurrentFrame();
  const cards = [
    {
      title: "Multi-source monitoring",
      body: "Reddit, X, StockTwits, SEC insider, Congress, options flow, volume spikes, and Polymarket — one scan.",
      accent: LANDING.sky,
    },
    {
      title: "AI scoring & ML backtesting",
      body: "Opportunity score for timing, AI confidence for evidence strength — RidgeCV refines thresholds over time.",
      accent: "#a78bfa",
    },
    {
      title: "Pump & dump filter",
      body: "13 statistical flags plus AI edge-case review so manipulated names get filtered before the dashboard.",
      accent: LANDING.emerald,
    },
  ];

  return (
    <SceneChrome>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "110px 80px 0",
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 20,
            fontSize: 58,
            fontWeight: 700,
            color: LANDING.text,
            textAlign: "center",
            opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Everything you need to find breakouts
        </h2>
        <p
          style={{
            margin: 0,
            marginBottom: 48,
            fontSize: 28,
            color: LANDING.dim,
            textAlign: "center",
            maxWidth: 1000,
            opacity: interpolate(frame, [6, 18], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          From raw chatter to validated, scored signals — automated end to end.
        </p>
        <div
          style={{
            display: "flex",
            gap: 32,
            justifyContent: "center",
            flexWrap: "wrap",
            maxWidth: 1840,
          }}
        >
          {cards.map((c, i) => {
            const delay = 12 + i * 14;
            const op = interpolate(frame, [delay, delay + 12], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            });
            return (
              <div
                key={c.title}
                style={{
                  width: 520,
                  padding: 36,
                  borderRadius: 22,
                  border: `1px solid ${LANDING.border}`,
                  background: LANDING.bgCard,
                  opacity: op,
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 5,
                    background: c.accent,
                    marginBottom: 20,
                  }}
                />
                <h3
                  style={{
                    margin: 0,
                    fontSize: 30,
                    fontWeight: 700,
                    color: LANDING.text,
                  }}
                >
                  {c.title}
                </h3>
                <p
                  style={{
                    marginTop: 16,
                    marginBottom: 0,
                    fontSize: 22,
                    lineHeight: 1.48,
                    color: LANDING.muted,
                  }}
                >
                  {c.body}
                </p>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneChrome>
  );
}

const PIPELINE = [
  { step: "1", label: "Discover", short: "8 feeds in every scan" },
  { step: "2", label: "Aggregate", short: "By symbol & velocity" },
  { step: "3", label: "Score", short: "AI + opportunity rank" },
  { step: "4", label: "Filter", short: "P&D + risk flags" },
  { step: "5", label: "Validate", short: "Fundamentals & reports" },
];

function PipelineScene() {
  const frame = useCurrentFrame();

  return (
    <SceneChrome>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "100px 40px 0",
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 16,
            fontSize: 58,
            fontWeight: 700,
            color: LANDING.text,
            opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          How it works
        </h2>
        <p
          style={{
            margin: 0,
            marginBottom: 52,
            fontSize: 28,
            color: LANDING.dim,
            textAlign: "center",
            maxWidth: 1000,
            opacity: interpolate(frame, [6, 18], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Five stages — from raw data to validated breakout candidates.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 0,
            width: "100%",
            flexWrap: "nowrap",
          }}
        >
          {PIPELINE.map((p, i) => {
            const delay = 10 + i * 12;
            const op = interpolate(frame, [delay, delay + 14], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            });
            return (
              <div
                key={p.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 288,
                    padding: "0 8px",
                    textAlign: "center",
                    opacity: op,
                  }}
                >
                  <div
                    style={{
                      width: 66,
                      height: 66,
                      margin: "0 auto 18px",
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${LANDING.sky}, ${LANDING.skyDeep})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      fontWeight: 800,
                      color: "#fff",
                      boxShadow: "0 10px 28px rgba(14,165,233,0.4)",
                    }}
                  >
                    {p.step}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 26,
                      fontWeight: 700,
                      color: LANDING.text,
                    }}
                  >
                    {p.label}
                  </p>
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: 18,
                      color: LANDING.dim,
                      lineHeight: 1.35,
                    }}
                  >
                    {p.short}
                  </p>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div
                    style={{
                      width: 36,
                      height: 6,
                      marginTop: 33,
                      flexShrink: 0,
                      background: "rgba(56,189,248,0.28)",
                      borderRadius: 3,
                      opacity: interpolate(frame, [delay + 8, delay + 22], [0, 1], {
                        extrapolateRight: "clamp",
                        extrapolateLeft: "clamp",
                      }),
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneChrome>
  );
}

const SOURCES = [
  "Reddit",
  "X / Twitter",
  "StockTwits",
  "SEC Insider",
  "Congress",
  "Options flow",
  "Volume spike",
  "Polymarket",
];

function SourcesScene() {
  const frame = useCurrentFrame();

  return (
    <SceneChrome>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "110px 88px 0",
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 16,
            fontSize: 58,
            fontWeight: 700,
            color: LANDING.text,
            textAlign: "center",
            opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Signal sources
        </h2>
        <p
          style={{
            margin: 0,
            marginBottom: 44,
            fontSize: 28,
            color: LANDING.dim,
            textAlign: "center",
            maxWidth: 1040,
            opacity: interpolate(frame, [6, 18], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Social, filings, flow, technicals, and prediction markets — monitored every scan.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 22,
            width: "100%",
            maxWidth: 1760,
          }}
        >
          {SOURCES.map((name, i) => {
            const delay = 10 + i * 5;
            const op = interpolate(frame, [delay, delay + 10], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            });
            return (
              <div
                key={name}
                style={{
                  padding: "26px 28px",
                  borderRadius: 18,
                  border: `1px solid ${LANDING.border}`,
                  background: LANDING.bgCard,
                  opacity: op,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 28,
                    fontWeight: 700,
                    color: LANDING.text,
                  }}
                >
                  {name}
                </p>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneChrome>
  );
}

const ML_STEPS = [
  { label: "Track prices", sub: "Snapshots 3× daily" },
  { label: "Measure returns", sub: "1d · 3d · 7d · 30d" },
  { label: "Train model", sub: "RidgeCV + features" },
  { label: "Optimize", sub: "Thresholds & filters" },
];

function MLScene() {
  const frame = useCurrentFrame();

  return (
    <SceneChrome>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "110px 56px 0",
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 16,
            fontSize: 58,
            fontWeight: 700,
            color: LANDING.text,
            textAlign: "center",
            opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Continuously learning
        </h2>
        <p
          style={{
            margin: 0,
            marginBottom: 48,
            fontSize: 28,
            color: LANDING.dim,
            textAlign: "center",
            maxWidth: 1000,
            opacity: interpolate(frame, [6, 18], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Outcomes feed back into scoring — the pipeline gets smarter as data grows.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          {ML_STEPS.map((s, i) => {
            const delay = 12 + i * 14;
            const op = interpolate(frame, [delay, delay + 12], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            });
            return (
              <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && (
                  <span
                    style={{
                      fontSize: 38,
                      color: "rgba(56,189,248,0.65)",
                      margin: "0 8px",
                      opacity: op,
                    }}
                  >
                    →
                  </span>
                )}
                <div
                  style={{
                    width: 268,
                    padding: "26px 20px",
                    borderRadius: 18,
                    border: `1px solid ${LANDING.border}`,
                    background: "rgba(24,24,27,0.9)",
                    textAlign: "center",
                    opacity: op,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 24,
                      fontWeight: 700,
                      color: LANDING.text,
                    }}
                  >
                    {s.label}
                  </p>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 19,
                      color: LANDING.dim,
                    }}
                  >
                    {s.sub}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SceneChrome>
  );
}

function AgentsScene() {
  const frame = useCurrentFrame();

  return (
    <SceneChrome>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${LANDING.bg} 0%, rgba(49,46,129,0.25) 45%, ${LANDING.bg} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "96px 112px 0",
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 20,
            fontSize: 58,
            fontWeight: 700,
            color: LANDING.text,
            textAlign: "center",
            opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Built for AI agents
        </h2>
        <p
          style={{
            margin: 0,
            marginBottom: 40,
            fontSize: 30,
            color: LANDING.violet,
            fontWeight: 600,
            textAlign: "center",
            maxWidth: 1200,
            opacity: interpolate(frame, [8, 20], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          x402 micropayments — pay per call in USDC on Base, no signup
        </p>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            maxWidth: 980,
          }}
        >
          {[
            "Agent Skill + REST API for trending tickers, history, and reports",
            "From $0.005 per call — atomic billing on success",
            "API keys & portfolio tools for registered users",
          ].map((line, i) => {
            const delay = 18 + i * 12;
            const op = interpolate(frame, [delay, delay + 12], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            });
            return (
              <li
                key={line}
                style={{
                  display: "flex",
                  gap: 18,
                  alignItems: "flex-start",
                  marginBottom: 22,
                  fontSize: 28,
                  lineHeight: 1.42,
                  color: LANDING.muted,
                  opacity: op,
                }}
              >
                <span
                  style={{
                    color: LANDING.sky,
                    fontWeight: 700,
                    fontSize: 30,
                    lineHeight: 1.2,
                  }}
                >
                  ✓
                </span>
                {line}
              </li>
            );
          })}
        </ul>
      </AbsoluteFill>
    </SceneChrome>
  );
}

function OutroScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.35 },
    from: 0.94,
    to: 1,
  });

  return (
    <SceneChrome>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${LANDING.bg} 0%, rgba(30,58,138,0.45) 50%, ${LANDING.bg} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 48,
        }}
      >
        <div style={{ textAlign: "center", transform: `scale(${scale})` }}>
          <h2
            style={{
              margin: 0,
              fontSize: 76,
              fontWeight: 800,
              color: LANDING.text,
              letterSpacing: "-0.02em",
            }}
          >
            Ready to find the next breakout?
          </h2>
          <p
            style={{
              marginTop: 28,
              fontSize: 32,
              color: LANDING.muted,
            }}
          >
            Browse signals free at{" "}
            <span style={{ color: LANDING.sky, fontWeight: 700 }}>
              signalscopes.com
            </span>
          </p>
          <p
            style={{
              marginTop: 44,
              fontSize: 20,
              color: LANDING.dim,
              maxWidth: 800,
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.5,
            }}
          >
            Not financial advice — always do your own due diligence.
          </p>
        </div>
      </AbsoluteFill>
    </SceneChrome>
  );
}

export function LandingWalkthrough() {
  return (
    <AbsoluteFill style={{ backgroundColor: LANDING.bg }}>
      <BackgroundMusic />
      <Sequence durationInFrames={150}>
        <HeroScene />
      </Sequence>
      <Sequence from={150} durationInFrames={120}>
        <StatsScene />
      </Sequence>
      <Sequence from={270} durationInFrames={180}>
        <FeaturesScene />
      </Sequence>
      <Sequence from={450} durationInFrames={210}>
        <PipelineScene />
      </Sequence>
      <Sequence from={660} durationInFrames={150}>
        <SourcesScene />
      </Sequence>
      <Sequence from={810} durationInFrames={150}>
        <MLScene />
      </Sequence>
      <Sequence from={960} durationInFrames={150}>
        <AgentsScene />
      </Sequence>
      <Sequence from={1110} durationInFrames={120}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
}
