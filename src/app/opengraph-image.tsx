import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 86400; // cache for 24 hours

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Decorative blob — top left */}
        <div
          style={{
            position: "absolute",
            top: -100,
            left: -100,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "rgba(96, 165, 250, 0.18)",
          }}
        />
        {/* Decorative blob — bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: -130,
            right: -130,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "rgba(99, 102, 241, 0.13)",
          }}
        />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: 20 }}>
          <span
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: "white",
              letterSpacing: "-3px",
              lineHeight: 1,
            }}
          >
            Signal
          </span>
          <span
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: "#93c5fd",
              letterSpacing: "-3px",
              lineHeight: 1,
            }}
          >
            Scope
          </span>
        </div>

        {/* Primary tagline */}
        <p
          style={{
            fontSize: 30,
            color: "rgba(219, 234, 254, 0.92)",
            textAlign: "center",
            maxWidth: 740,
            lineHeight: 1.4,
            margin: "0 0 12px",
          }}
        >
          Stock breakout signal detection
        </p>

        {/* Secondary tagline */}
        <p
          style={{
            fontSize: 20,
            color: "rgba(147, 197, 253, 0.8)",
            textAlign: "center",
            maxWidth: 660,
            margin: 0,
          }}
        >
          AI-scored signals · Cross-scan trending · ML backtesting · Reddit, X, SEC &amp; volume
        </p>

        {/* Stats pill */}
        <div
          style={{
            display: "flex",
            gap: 52,
            marginTop: 52,
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: 16,
            padding: "22px 52px",
            border: "1px solid rgba(255, 255, 255, 0.13)",
          }}
        >
          {[
            ["7", "Signal sources"],
            ["11", "P&D flags"],
            ["4", "Signal stages"],
          ].map(([num, label]) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 38, fontWeight: 700, color: "white", lineHeight: 1 }}>
                {num}
              </span>
              <span style={{ fontSize: 14, color: "#93c5fd" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Domain badge */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            right: 52,
            fontSize: 16,
            color: "rgba(147, 197, 253, 0.6)",
            letterSpacing: "0.5px",
          }}
        >
          localhost:3000
        </div>
      </div>
    ),
    { ...size }
  );
}
