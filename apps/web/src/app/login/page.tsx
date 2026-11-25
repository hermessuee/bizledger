'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  ShieldAlert,
  Play,
  X,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Pure full-screen video state
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if intro has already been shown in this session
    const hasSeenIntro = sessionStorage.getItem('hermes_intro_seen');
    if (!hasSeenIntro) {
      setShowVideo(true);
    }
  }, []);

  // Attempt to play pure full-screen video with sound on mount
  useEffect(() => {
    if (showVideo && videoRef.current) {
      videoRef.current.muted = false;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If browser policy restricts unmuted autoplay, start muted
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [showVideo]);

  const handleVideoClose = () => {
    sessionStorage.setItem('hermes_intro_seen', 'true');
    setShowVideo(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleReplayVideo = () => {
    setShowVideo(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = false;
      const p = videoRef.current.play();
      if (p !== undefined) {
        p.catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  };

  const handleAdminPortalClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (user && (user.role === 'super_admin' || user.username === 'anoopsue')) {
      router.push('/super-admin');
      return;
    }
    setIsAdminMode(true);
    setUsernameOrEmail('anoopsue');
    setError(null);
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(usernameOrEmail, password);
      if (
        usernameOrEmail.toLowerCase().includes('anoopsue') ||
        usernameOrEmail.toLowerCase().includes('superadmin')
      ) {
        router.push('/super-admin');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#071322] text-slate-100 relative overflow-x-hidden select-none">
      {/* Background ambient lighting matching Hermes Navy & Gold palette */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] max-w-full h-[500px] bg-gradient-to-b from-amber-500/10 via-blue-900/15 to-transparent blur-3xl pointer-events-none -z-0" />
      <div className="absolute -bottom-24 -right-24 w-[600px] max-w-full h-[600px] bg-blue-950/25 blur-3xl pointer-events-none -z-0" />
      <div className="absolute -top-24 -left-24 w-[500px] max-w-full h-[500px] bg-amber-600/5 blur-3xl pointer-events-none -z-0" />

      {/* PURE ADAPTIVE FULL-SCREEN STARTUP INTRO VIDEO (NO CONTROLS, NO BUTTONS, NO BARS) */}
      {showVideo && (
        <div
          className="fixed inset-0 z-50 w-full h-full bg-black overflow-hidden flex items-center justify-center cursor-pointer select-none"
          onClick={handleVideoClose}
        >
          {/* Full-screen video scaled with object-cover to seamlessly fill 100% of any screen */}
          <video
            ref={videoRef}
            src={`${basePath}/intro.mp4`}
            autoPlay
            playsInline
            onEnded={handleVideoClose}
            className="w-full h-full object-cover bg-black"
          />
        </div>
      )}

      {/* Main Login Card Section - Fully Mobile Responsive */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-8 sm:py-12 w-full">
        <div className="w-full max-w-sm sm:max-w-md mx-auto">
          {/* Logo & Brand Header */}
          <div className="text-center mb-5 sm:mb-6">
            <div className="inline-block p-2 sm:p-2.5 rounded-2xl bg-white shadow-2xl shadow-amber-500/10 border-2 border-amber-500/30 mb-2.5 sm:mb-3 hover:scale-105 transition-transform duration-300">
              <img
                src={`${basePath}/hermes-logo.jpg`}
                alt="Hermes Logo"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Hermes <span className="text-amber-400">ERP</span>
            </h1>
            <p className="mt-1 text-[11px] sm:text-xs text-slate-400 tracking-wide font-normal px-2">
              Enterprise Distribution, GST Accounting
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-[#0b1c31]/90 backdrop-blur-xl py-6 px-5 sm:py-8 sm:px-8 shadow-2xl rounded-2xl border border-amber-500/20 shadow-black/80">
            {/* Admin Portal Mode Indicator Banner */}
            {isAdminMode && (
              <div className="mb-4 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="font-semibold">Platform Admin Portal Mode</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminMode(false);
                    setUsernameOrEmail('');
                  }}
                  className="text-amber-400 hover:text-white ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-start space-x-2.5">
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Username / Email */}
              <div>
                <label className="block text-[11px] font-semibold text-amber-300/90 uppercase tracking-wider mb-1.5">
                  Username or Business Email
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder=""
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#06101d] border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold text-amber-300/90 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-10 py-2.5 bg-[#06101d] border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-amber-300 transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex justify-center items-center py-2.5 px-4 rounded-lg shadow-lg shadow-amber-500/15 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:via-yellow-300 hover:to-amber-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400 transition transform active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Sign In to Hermes ERP</span>
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Actions & Navigation Links */}
            <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-slate-800/80 space-y-3 text-xs text-center">
              <div>
                <span className="text-slate-400">New Distribution Firm? </span>
                <Link
                  href="/register"
                  className="font-semibold text-amber-400 hover:text-amber-300 hover:underline transition"
                >
                  Register Business Here →
                </Link>
              </div>

              {/* Admin Portal Button */}
              <div className="pt-1.5">
                <button
                  type="button"
                  onClick={handleAdminPortalClick}
                  className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border border-amber-500/30 bg-slate-950/60 hover:bg-amber-500/15 text-amber-300 hover:text-amber-200 transition font-medium"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Admin Portal</span>
                </button>
              </div>

              {/* Discreet Replay Intro Video Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleReplayVideo}
                  className="inline-flex items-center space-x-1.5 text-[11px] text-slate-400 hover:text-amber-300 transition"
                >
                  <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>Play Intro Video (Full Screen)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Corporate Three-Part Footer - Fully Mobile Responsive */}
      <footer className="relative z-10 w-full py-3 sm:py-3.5 px-4 sm:px-6 border-t border-slate-800/80 bg-[#050e18]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] sm:text-xs text-slate-400 gap-2 sm:gap-0 text-center sm:text-left">
          {/* Left Bottom: Version */}
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono text-slate-400">Version 1.0.4 • Hermes ERP</span>
          </div>

          {/* Central Bottom: Copyright & Author */}
          <div className="font-medium text-slate-300">
            © {new Date().getFullYear()} • Powered by <span className="text-amber-400 font-semibold">@anoopsue</span>
          </div>

          {/* Right Bottom: Contact Email */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">Contact:</span>
            <a
              href="mailto:hermes.suee@gmail.com"
              className="text-amber-400 hover:text-amber-300 hover:underline font-mono"
            >
              hermes.suee@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
