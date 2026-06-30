"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      // Save token to browser storage
      localStorage.setItem("token", token);
      // Redirect to dashboard
      router.push("/dashboard");
    } else {
      // No token means something went wrong
      router.push("/?error=login_failed");
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Logging you in...</p>
    </div>
  );
}