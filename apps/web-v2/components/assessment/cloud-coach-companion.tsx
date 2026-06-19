import Image from "next/image";
import styles from "./cloud-coach-companion.module.css";

/**
 * Cloud Coach companion (ParentAssessment.dc.html) — the encouraging mascot +
 * speech bubble that sits in the assessment's sticky right column, replacing a
 * plain reassurance card with the design's warm guide. `say` is the per-step
 * line (localized by the caller). Uses the shared, transparent Cloud Coach
 * asset; motion is reduce-motion gated.
 */
export function CloudCoachCompanion({ say }: { say: string }) {
  return (
    <div className="flex flex-col items-center pt-1">
      <div className="relative w-[300px] max-w-full">
        <p className={`${styles.bubble} px-5 py-4 text-[15px] font-semibold leading-relaxed`}>
          {say}
        </p>
        <Image
          src="/images/mascots/mascot-coach.png"
          alt=""
          width={150}
          height={150}
          className={`${styles.mascot} mx-auto -mt-1.5 block h-auto w-[150px]`}
        />
      </div>
    </div>
  );
}

CloudCoachCompanion.displayName = "Assessment/CloudCoachCompanion";
