"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/dashboard");
    } else {
      setLoading(false);
    }
  }, [router]);

  const handleGoogleLogin = () => {
    // Redirect to Flask backend's Google OAuth route
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-2xl shadow-md text-center max-w-sm w-full">
        <h1 className="text-2xl font-bold mb-2 text-gray-800">
          Hairdrama Tasks
        </h1>
        <p className="text-gray-500 mb-8">
          Sign in to manage your tasks
        </p>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-3 px-4 hover:bg-gray-50 transition"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M43.6 20.5h-1.9V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.1-5.1C33.5 6.2 29 4.4 24 4.4 12.9 4.4 4 13.3 4 24.4s8.9 20 20 20c11.5 0 19.1-8.1 19.1-19.5 0-1.3-.1-2.3-.5-3.4z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l5.9 4.3C13.7 15.5 18.5 12.4 24 12.4c3.1 0 5.9 1.2 8 3.1l5.1-5.1C33.5 6.2 29 4.4 24 4.4c-7.9 0-14.6 4.5-17.7 11.1z"
            />
            <path
              fill="#4CAF50"
              d="M24 44.4c5.1 0 9.7-1.9 13-5.1l-6-5c-1.9 1.3-4.4 2.1-7 2.1-5.3 0-9.7-3.3-11.3-7.8l-6 4.7C9.4 39.9 16.1 44.4 24 44.4z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5h-1.9V20.4H24v7.2h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6 5c-.4.4 6.5-4.8 6.5-13.8 0-1.3-.1-2.3-.5-3.4z"
            />
          </svg>
          <span className="text-gray-700 font-medium">
            Continue with Google
          </span>
        </button>
      </div>
    </div>
  );
}