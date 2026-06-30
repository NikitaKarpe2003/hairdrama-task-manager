"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      localStorage.setItem("token", token);
      router.push("/dashboard");
    } else {
      router.push("/?error=login_failed");
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Logging you in...</p>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}