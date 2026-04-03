import { Html5Audio, interpolate, staticFile, useVideoConfig } from "remotion";

export function BackgroundMusic({ peakVolume = 0.26 }: { peakVolume?: number }) {
  const { durationInFrames, fps } = useVideoConfig();
  const fadeInEnd = Math.round(fps * 0.65);
  const fadeOutStart = durationInFrames - Math.round(fps * 0.9);

  return (
    <Html5Audio
      src={staticFile("remotion/landing-bg.mp3")}
      volume={(f) => {
        const fadeIn = interpolate(f, [0, fadeInEnd], [0, 1], {
          extrapolateRight: "clamp",
        });
        const fadeOut = interpolate(
          f,
          [fadeOutStart, durationInFrames],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return peakVolume * fadeIn * fadeOut;
      }}
      loop
      showInTimeline={false}
    />
  );
}
