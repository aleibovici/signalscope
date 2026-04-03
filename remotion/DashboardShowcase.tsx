import type { ReactNode } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
} from "remotion";
import { BackgroundMusic } from "./BackgroundMusic";
import { LANDING } from "./landing-theme";

const D = {
  mainBg: "#09090b",
  sidebar: "#18181b",
  sidebarLine: "rgba(255,255,255,0.08)",
  navActive: "#3b82f6",
  navMuted: "#71717a",
  tabIdle: "#27272a",
  tabText: "#d4d4d8",
  emerald: "#34d399",
  amber: "#fbbf24",
  blue: "#60a5fa",
} as const;

const NAV = [
  "Signals",
  "Trending",
  "Connections",
  "Performance",
  "Portfolio",
  "API Access",
] as const;

function BrandMark({ size = 34 }: { size?: number }) {
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

function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [delay, delay + 14], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const y = interpolate(frame, [delay, delay + 16], [18, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  return (
    <div style={{ opacity: op, transform: `translateY(${y}px)` }}>{children}</div>
  );
}

function HeroScene() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: D.mainBg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 64,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(59,130,246,0.15), transparent 55%)",
        }}
      />
      <FadeIn>
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              marginBottom: 20,
              fontSize: 28,
              fontWeight: 600,
              color: D.blue,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Inside the app
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: 86,
              fontWeight: 800,
              color: LANDING.text,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Live signal dashboard
          </h1>
          <p
            style={{
              marginTop: 32,
              fontSize: 32,
              lineHeight: 1.4,
              color: LANDING.muted,
              maxWidth: 1000,
            }}
          >
            Every harvest run lands here — filter by stage, read Opportunity vs AI
            Confidence, star a watchlist, and drill into any ticker.
          </p>
        </div>
      </FadeIn>
    </AbsoluteFill>
  );
}

function SidebarScene() {
  const frame = useCurrentFrame();
  const cardShellOp = interpolate(frame, [108, 132], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const cardShellY = interpolate(frame, [108, 132], [22, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const integrateCaptionOp = interpolate(frame, [148, 172], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: D.mainBg,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ display: "flex", height: "100%" }}>
        <div
          style={{
            width: 320,
            borderRight: `1px solid ${D.sidebarLine}`,
            backgroundColor: D.sidebar,
            padding: "40px 28px",
          }}
        >
          <BrandMark size={30} />
          <nav style={{ marginTop: 48 }}>
            {NAV.map((label, i) => {
              const delay = 8 + i * 10;
              const op = interpolate(frame, [delay, delay + 12], [0, 1], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp",
              });
              const active = label === "Signals";
              return (
                <div
                  key={label}
                  style={{
                    opacity: op,
                    marginBottom: 14,
                    padding: "14px 18px",
                    borderRadius: 12,
                    backgroundColor: active ? "rgba(59,130,246,0.2)" : "transparent",
                    border: active ? `1px solid rgba(59,130,246,0.45)` : "1px solid transparent",
                    color: active ? "#fff" : D.navMuted,
                    fontSize: 22,
                    fontWeight: active ? 700 : 600,
                  }}
                >
                  {label}
                </div>
              );
            })}
          </nav>
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "36px 52px 36px 56px",
          }}
        >
          <div
            style={{
              opacity: interpolate(frame, [58, 82], [0, 1], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp",
              }),
              transform: `translateY(${interpolate(frame, [58, 82], [14, 0], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp",
              })}px)`,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 700,
                color: LANDING.muted,
                textAlign: "center",
                maxWidth: 680,
                lineHeight: 1.38,
              }}
            >
              One sidebar for Signals, Trending, Connections, Performance — plus
              Portfolio and API when you&apos;re signed in.
            </p>
          </div>

          <div
            style={{
              marginTop: 28,
              width: "100%",
              maxWidth: 520,
              opacity: cardShellOp,
              transform: `translateY(${cardShellY}px)`,
            }}
          >
            <MockCard
              symbol="PLTR"
              name="Palantir Technologies"
              stage="Emerging"
              rec="Strong Buy"
              recColor={D.emerald}
              opp={78}
              ai={84}
              tags={["High velocity", "Multi-source"]}
              delay={112}
              embedded
            />
          </div>

          <p
            style={{
              margin: "24px 0 0",
              fontSize: 22,
              fontWeight: 600,
              color: LANDING.dim,
              textAlign: "center",
              maxWidth: 520,
              lineHeight: 1.45,
              opacity: integrateCaptionOp,
            }}
          >
            Same screen: rail on the left, live ticker tiles in the main area — just
            like when you&apos;re signed in.
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
}

const STAGES = [
  { key: "ALL", label: "All", count: 28 },
  { key: "EM", label: "Emerging", count: 9 },
  { key: "BU", label: "Building", count: 11 },
  { key: "CO", label: "Consensus", count: 8 },
] as const;

function StageTabsScene() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: D.mainBg,
        fontFamily: "system-ui, -apple-system, sans-serif",
        justifyContent: "center",
        alignItems: "center",
        padding: 48,
      }}
    >
      <FadeIn>
        <h2
          style={{
            margin: 0,
            marginBottom: 40,
            fontSize: 48,
            fontWeight: 800,
            color: LANDING.text,
            textAlign: "center",
          }}
        >
          Stage tabs — Emerging → Consensus
        </h2>
      </FadeIn>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "center",
        }}
      >
        {STAGES.map((s, i) => {
          const delay = 12 + i * 12;
          const op = interpolate(frame, [delay, delay + 14], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          const selected = s.key === "ALL";
          return (
            <div
              key={s.key}
              style={{
                opacity: op,
                padding: "16px 32px",
                borderRadius: 999,
                fontSize: 24,
                fontWeight: 700,
                backgroundColor: selected ? D.navActive : D.tabIdle,
                color: selected ? "#fff" : D.tabText,
                border: selected ? "none" : `1px solid ${LANDING.border}`,
              }}
            >
              {s.label}
              <span
                style={{
                  marginLeft: 12,
                  opacity: 0.85,
                  fontWeight: 600,
                }}
              >
                {s.count}
              </span>
            </div>
          );
        })}
      </div>
      <FadeIn delay={70}>
        <p
          style={{
            marginTop: 48,
            fontSize: 26,
            color: LANDING.dim,
            textAlign: "center",
            maxWidth: 920,
            lineHeight: 1.45,
          }}
        >
          Slice the same scan by All, Emerging, Building, or Consensus — counts
          update per run.
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
}

function ScoreBar({
  label,
  value,
  color,
  delay,
  compact = false,
}: {
  label: string;
  value: number;
  color: string;
  delay: number;
  compact?: boolean;
}) {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [delay, delay + 20], [0, value], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  return (
    <div style={{ marginBottom: compact ? 14 : 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          fontSize: compact ? 15 : 18,
          fontWeight: 700,
          color: LANDING.muted,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <span>{label}</span>
        <span style={{ color: LANDING.text }}>{Math.round(w)}</span>
      </div>
      <div
        style={{
          height: compact ? 12 : 14,
          borderRadius: 6,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${w}%`,
            height: "100%",
            borderRadius: 6,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function MockCard({
  symbol,
  name,
  stage,
  rec,
  recColor,
  opp,
  ai,
  tags,
  delay,
  embedded = false,
}: {
  symbol: string;
  name: string;
  stage: string;
  rec: string;
  recColor: string;
  opp: number;
  ai: number;
  tags: string[];
  delay: number;
  embedded?: boolean;
}) {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [delay, delay + 14], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const sc = interpolate(frame, [delay, delay + 18], [0.96, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const symSize = embedded ? 36 : 42;
  const nameSize = embedded ? 18 : 20;
  const stagePad = embedded ? "6px 12px" : "8px 16px";
  const stageFs = embedded ? 14 : 16;
  const recPad = embedded ? "8px 14px" : "10px 18px";
  const recFs = embedded ? 17 : 20;
  const tagPad = embedded ? "6px 12px" : "8px 14px";
  const tagFs = embedded ? 15 : 17;

  return (
    <div
      style={{
        opacity: op,
        transform: `scale(${sc})`,
        flex: embedded ? "none" : "1 1 420px",
        maxWidth: embedded ? "none" : 560,
        width: embedded ? "100%" : undefined,
        padding: embedded ? 26 : 36,
        borderRadius: embedded ? 18 : 20,
        border: `1px solid ${LANDING.border}`,
        background: LANDING.bgCard,
        boxShadow: embedded
          ? "0 0 32px -10px rgba(59,130,246,0.25)"
          : "0 0 40px -12px rgba(59,130,246,0.2)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: 0, fontSize: symSize, fontWeight: 800, color: LANDING.text }}>{symbol}</p>
          <p style={{ margin: "6px 0 0", fontSize: nameSize, color: LANDING.dim }}>{name}</p>
        </div>
        <span
          style={{
            padding: stagePad,
            borderRadius: 999,
            fontSize: stageFs,
            fontWeight: 700,
            background: "rgba(245,158,11,0.15)",
            color: D.amber,
          }}
        >
          {stage}
        </span>
      </div>
      <div
        style={{
          marginTop: embedded ? 14 : 20,
          padding: recPad,
          borderRadius: 12,
          border: `2px solid ${recColor}`,
          color: recColor,
          fontSize: recFs,
          fontWeight: 800,
          display: "inline-block",
        }}
      >
        {rec}
      </div>
      <div style={{ marginTop: embedded ? 20 : 28 }}>
        <ScoreBar
          label="Opportunity"
          value={opp}
          color="#f59e0b"
          delay={delay + 10}
          compact={embedded}
        />
        <ScoreBar
          label="AI confidence"
          value={ai}
          color="#3b82f6"
          delay={delay + 16}
          compact={embedded}
        />
      </div>
      <div style={{ marginTop: embedded ? 18 : 24, display: "flex", flexWrap: "wrap", gap: embedded ? 8 : 10 }}>
        {tags.map((t) => (
          <span
            key={t}
            style={{
              padding: tagPad,
              borderRadius: 8,
              fontSize: tagFs,
              fontWeight: 600,
              background: "rgba(255,255,255,0.06)",
              color: LANDING.muted,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function CardsScene() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: D.mainBg,
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "72px 64px 0",
      }}
    >
      <FadeIn>
        <h2
          style={{
            margin: 0,
            marginBottom: 36,
            fontSize: 48,
            fontWeight: 800,
            color: LANDING.text,
            textAlign: "center",
          }}
        >
          Ticker cards — how each signal reads
        </h2>
      </FadeIn>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 32,
          justifyContent: "center",
          alignItems: "stretch",
        }}
      >
        <MockCard
          symbol="PLTR"
          name="Palantir Technologies"
          stage="Emerging"
          rec="Strong Buy"
          recColor={D.emerald}
          opp={78}
          ai={84}
          tags={["High velocity", "Multi-source"]}
          delay={14}
        />
        <MockCard
          symbol="ASTS"
          name="AST SpaceMobile"
          stage="Building"
          rec="Buy"
          recColor="#4ade80"
          opp={71}
          ai={76}
          tags={["Near 52W low", "Momentum"]}
          delay={32}
        />
      </div>
      <FadeIn delay={88}>
        <p
          style={{
            marginTop: 40,
            fontSize: 26,
            color: LANDING.dim,
            textAlign: "center",
            maxWidth: 1000,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.45,
          }}
        >
          Sorted by AI confidence first, then Opportunity — high confidence can mean
          the crowd already agrees; Opportunity highlights earlier setups.
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
}

function WatchlistOutroScene() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: D.mainBg,
        fontFamily: "system-ui, -apple-system, sans-serif",
        justifyContent: "center",
        alignItems: "center",
        padding: 56,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(56,189,248,0.12), transparent 50%)",
        }}
      />
      <div style={{ maxWidth: 1100, textAlign: "center", position: "relative" }}>
        <FadeIn>
          <div
            style={{
              padding: "32px 40px",
              borderRadius: 20,
              border: `1px solid ${LANDING.border}`,
              background: LANDING.bgCard,
              marginBottom: 36,
            }}
          >
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: LANDING.text }}>
              Watchlist & export
            </p>
            <p
              style={{
                margin: "16px 0 0",
                fontSize: 26,
                color: LANDING.muted,
                lineHeight: 1.45,
              }}
            >
              Star tickers to pin them on top and track across scans — export CSV
              for your broker when you&apos;re logged in.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={40}>
          <h2
            style={{
              margin: 0,
              fontSize: 64,
              fontWeight: 800,
              color: LANDING.text,
              opacity: interpolate(frame, [50, 66], [0, 1], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp",
              }),
            }}
          >
            Open the live dashboard
          </h2>
          <p
            style={{
              marginTop: 24,
              fontSize: 32,
              color: LANDING.sky,
              fontWeight: 700,
              opacity: interpolate(frame, [58, 74], [0, 1], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp",
              }),
            }}
          >
            signalscopes.com/dashboard
          </p>
        </FadeIn>
      </div>
    </AbsoluteFill>
  );
}

export function DashboardShowcase() {
  return (
    <AbsoluteFill style={{ backgroundColor: D.mainBg }}>
      <BackgroundMusic peakVolume={0.22} />
      <Sequence durationInFrames={150}>
        <HeroScene />
      </Sequence>
      <Sequence from={150} durationInFrames={240}>
        <SidebarScene />
      </Sequence>
      <Sequence from={390} durationInFrames={150}>
        <StageTabsScene />
      </Sequence>
      <Sequence from={540} durationInFrames={240}>
        <CardsScene />
      </Sequence>
      <Sequence from={780} durationInFrames={90}>
        <WatchlistOutroScene />
      </Sequence>
    </AbsoluteFill>
  );
}
