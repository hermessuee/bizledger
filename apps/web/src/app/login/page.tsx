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
  Volume2,
  VolumeX,
  X,
  Building2,
  Mail,
  CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Video intro state
  const [showVideo, setShowVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Check if intro has already been shown in this session
    const hasSeenIntro = sessionStorage.getItem('hermes_intro_seen');
    if (!hasSeenIntro) {
      setShowVideo(true);
    }
  }, []);

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
      videoRef.current.play().catch(() => {});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(usernameOrEmail, password);
      // If superadmin logged in, redirect directly to super-admin portal
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
    <div className="min-h-screen flex flex-col justify-between bg-[#071322] text-slate-100 relative overflow-hidden select-none">
      {/* Background ambient lighting matching Hermes Navy & Gold palette */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-amber-500/10 via-blue-900/15 to-transparent blur-3xl pointer-events-none -z-0" />
      <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-blue-950/20 blur-3xl pointer-events-none -z-0" />

      {/* Startup Video Intro Modal Overlay */}
      {showVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl transition-all duration-500 p-4 sm:p-6 animate-fade-in">
          <div className="relative w-full max-w-4xl bg-slate-950 border border-amber-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-black/90">
            {/* Top Bar inside Video Player */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-amber-500/20">
              <div className="flex items-center space-x-2.5">
                <img
                  src={`${basePath}/hermes-logo.jpg`}
                  alt="Hermes"
                  className="w-7 h-7 rounded object-contain bg-white p-0.5"
                />
                <span className="font-semibold text-xs tracking-wider text-amber-300 uppercase">
                  Hermes ERP • Executive Overview
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 text-slate-400 hover:text-amber-300 rounded-lg hover:bg-white/5 transition"
                  title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                </button>
                <button
                  type="button"
                  onClick={handleVideoClose}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold rounded-lg transition"
                >
                  <span>Skip Intro</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>
            </div>

            {/* Video Player */}
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <video
                ref={videoRef}
                src={`${basePath}/intro.mp4`}
                autoPlay
                muted={isMuted}
                playsInline
                controls
                onEnded={handleVideoClose}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Video Footer Info */}
            <div className="px-5 py-2.5 bg-slate-900/80 text-center text-[11px] text-slate-400 border-t border-slate-800">
              Hermes Enterprise Distribution & Accounting Platform • Powered by @anoopsue
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-slate-800/60 bg-[#071322]/80 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <img
            src={`${basePath}/hermes-logo.jpg`}
            alt="Hermes Logo"
            className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 shadow-md shadow-amber-500/10 border border-amber-500/30"
          />
          <div>
            <span className="font-bold text-base tracking-wide text-white">Hermes ERP</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] text-amber-400/90 font-mono tracking-wider uppercase border border-amber-500/20 px-1.5 py-0.5 rounded bg-amber-500/5">
              Corporate Edition
            </span>
          </div>
        </div>

        {/* Header Right Actions: Watch Intro & Admin Portal Button */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleReplayVideo}
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-amber-300 text-xs font-medium transition"
          >
            <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Watch Intro</span>
          </button>

          <Link
            href="/super-admin"
            className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-yellow-500/10 hover:from-amber-500/25 hover:to-yellow-500/20 text-amber-300 hover:text-amber-200 text-xs font-semibold tracking-wide backdrop-blur transition shadow-sm shadow-amber-500/10"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Admin Portal</span>
          </Link>
        </div>
      </header>

      {/* Main Login Card Section */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-md">
          {/* Logo & Brand Header */}
          <div className="text-center mb-6">
            <div className="inline-block p-2 rounded-2xl bg-white shadow-2xl shadow-amber-500/10 border-2 border-amber-500/30 mb-3 hover:scale-105 transition-transform duration-300">
              <img
                src={`${basePath}/hermes-logo.jpg`}
                alt="Hermes Logo"
                className="w-20 h-20 object-contain"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Hermes <span className="text-amber-400">ERP</span>
            </h1>
            <p className="mt-1 text-xs text-slate-400 tracking-wide font-normal">
              Enterprise Distribution, GST Accounting & Cheque Governance
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-[#0b1c31]/90 backdrop-blur-xl py-8 px-6 sm:px-8 shadow-2xl rounded-2xl border border-amber-500/20 shadow-black/80">
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
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="e.g. admin or anoopsue"
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
            <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-3 text-xs text-center">
              <div>
                <span className="text-slate-400">New Distribution Firm? </span>
                <Link
                  href="/register"
                  className="font-semibold text-amber-400 hover:text-amber-300 hover:underline transition"
                >
                  Register Business Here →
                </Link>
              </div>

              {/* Dedicated Admin Portal Button inside card */}
              <div className="pt-2">
                <Link
                  href="/super-admin"
                  className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border border-amber-500/30 bg-slate-950/60 hover:bg-amber-500/10 text-amber-300 hover:text-amber-200 transition font-medium"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Platform Super-Admin Portal Access</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Corporate Three-Part Footer */}
      <footer className="relative z-10 w-full py-3.5 px-6 border-t border-slate-800/80 bg-[#050e18]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2 sm:gap-0">
          {/* Left Bottom: Version */}
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono text-slate-400">Version 1.0.4 • Hermes ERP</span>
          </div>

          {/* Central Bottom: Copyright & Author */}
          <div className="text-center font-medium text-slate-300">
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
