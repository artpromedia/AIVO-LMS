"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import Image from "next/image";

const ROLE_DASHBOARDS: Record<string, string> = {
  PARENT: "/dashboard/parent",
  LEARNER: "/dashboard/learner",
  TEACHER: "/dashboard/teacher",
  CAREGIVER: "/dashboard/caregiver",
  THERAPIST: "/dashboard/therapist",
  PLATFORM_ADMIN: "/dashboard/admin",
  DISTRICT_ADMIN: "/dashboard/district",
  SALES: "/dashboard/internal/sales",
  MARKETING: "/dashboard/internal/marketing",
  CUSTOMER_CARE: "/dashboard/internal/customer-care",
  SUPPORT: "/dashboard/internal/support",
  FINANCE: "/dashboard/internal/finance",
  DEVOPS: "/dashboard/internal/devops",
};

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    if (!loading && !redirected.current) {
      redirected.current = true;
      if (user) {
        router.replace(ROLE_DASHBOARDS[user.role] || "/dashboard/parent");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-cyan-50">
      <div>
        <Image
          src="/images/aivo-logo-purple.png"
          alt="AIVO"
          width={200}
          height={60}
          priority
          style={{ width: "auto", height: "auto" }}
        />
      </div>
    </div>
  );
}
