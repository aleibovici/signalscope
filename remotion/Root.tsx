import type { FC } from "react";
import { Composition } from "remotion";
import { DashboardShowcase } from "./DashboardShowcase";
import {
  DASHBOARD_SHOWCASE_FRAMES,
  LANDING_WALKTHROUGH_FRAMES,
} from "./landing-theme";
import { LandingWalkthrough } from "./LandingWalkthrough";

export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="LandingWalkthrough"
        component={LandingWalkthrough}
        durationInFrames={LANDING_WALKTHROUGH_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="DashboardShowcase"
        component={DashboardShowcase}
        durationInFrames={DASHBOARD_SHOWCASE_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
