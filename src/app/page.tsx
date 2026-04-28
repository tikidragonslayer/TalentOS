"use client";

import { VideoFacade } from "@/components/VideoFacade";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassHeader, GlassContent, GlassFooter } from "@/components/ui/glass-card";
import { TalentOSLogo } from "@/components/icons";
import { Briefcase, Users, Zap, ShieldCheck, Target, EyeOff, Gem, Recycle, Handshake, Share2 } from "lucide-react";
import { useUser } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function HomePage() {
  const { authUser, role, isLoading } = useUser();
  const router = useRouter();
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && authUser && role) {
      router.push("/dashboard");
    }
  }, [authUser, role, isLoading, router]);

  useEffect(() => {
    const hasAgreed = sessionStorage.getItem("tos-terms-agreed");
    if (!hasAgreed) {
      setTermsOpen(true);
    }
  }, []);

  const handleRoleSelect = (selectedRole: "candidate" | "employer") => {
    router.push(`/login?role=${selectedRole}`);
  };

  const handleAgreeToTerms = () => {
    sessionStorage.setItem("tos-terms-agreed", "true");
    setTermsOpen(false);
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-background text-primary animate-pulse"><p>Initializing Cosmic Connection...</p></div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-[#050505] flex flex-col items-center p-4 overflow-x-hidden">
      {/* YouTube Shorts Banner */}
      <div className="flex justify-center my-6 mx-auto" style={{maxWidth: "360px"}}>
        <VideoFacade videoId="CRTr4k6JKw8" title="The Anonymous Meritocracy | AI Validates Your Skills" />
      </div>
      <AlertDialog open={termsOpen}>
        <AlertDialogContent className="glass-panel border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-emerald-400">Terms of Use & Anonymity Protocol</AlertDialogTitle>
            <div className="text-gray-300 max-h-[60vh] overflow-y-auto pr-4 text-left text-xs space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <p className="font-bold mb-2">Last Updated: {new Date().toLocaleDateString()}</p>
              <p>Welcome to TalentOS. By entering, you agree to our strict Anonymity Protocols and Terms.</p>
              <p><strong className="text-white">1. Identity Protection.</strong> We use military-grade anonymity. Your identity is hidden until YOU explicitly reveal it during a confirmed match interaction. We do not sell data.</p>
              <p><strong className="text-white">2. Artificial Intelligence.</strong> You interact with AI agents for skill verification. You agree that these agents measure your aptitude and behavioral "Humanity Score" to prevent botting.</p>
              <p><strong className="text-white">3. Liability & Risk.</strong> While we protect your data, no system is impenetrable. You use this service at your own risk.</p>
              <p><strong className="text-white">4. Binding Arbitration.</strong> Disputes are resolved via binding arbitration. No class actions.</p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleAgreeToTerms} className="bg-primary hover:bg-primary/80 text-black font-bold w-full sm:w-auto transition-all shadow-[0_0_15px_rgba(45,212,191,0.3)] hover:shadow-[0_0_25px_rgba(45,212,191,0.5)]">Accept Protocol & Enter</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="container mx-auto relative z-10">
        <header className="py-20 md:py-32 text-center relative">
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full -z-10 disabled:hidden" />

          <div className="mx-auto mb-8 inline-block animate-float">
            <TalentOSLogo className="h-24 w-24 md:h-32 md:w-32 text-primary drop-shadow-[0_0_25px_rgba(45,212,191,0.5)]" />
          </div>

          <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-8 text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/50">
            Hiring, Solved. <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-teal-200 to-emerald-400">By Intelligence.</span>
          </h1>

          <p className="mt-8 text-xl md:text-2xl leading-relaxed text-gray-400 max-w-3xl mx-auto font-light">
            The world's first <span className="text-white font-medium">Anonymous Meritocracy</span>. <br />
            AI validates your skills. Builders discover your talent.
            <span className="block mt-2 text-primary/80">Zero Bias. Zero Time Wasted.</span>
          </p>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button
              onClick={() => handleRoleSelect('candidate')}
              size="lg"
              className="bg-primary text-black font-bold text-lg px-10 py-8 rounded-2xl shadow-[0_0_20px_rgba(45,212,191,0.4)] hover:shadow-[0_0_30px_rgba(45,212,191,0.6)] hover:scale-105 transition-all duration-300"
            >
              I am Talent
            </Button>
            <Button
              onClick={() => handleRoleSelect('employer')}
              size="lg"
              variant="outline"
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 backdrop-blur-md text-lg px-10 py-8 rounded-2xl hover:border-white/30 transition-all duration-300"
            >
              I am a Builder
            </Button>
          </div>
        </header>

        <main className="space-y-24 pb-20">
          <div className="text-center">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-6">The Efficiency Engine</h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Stop reading resumes. Stop writing cover letters. Let the Intelligence Engine do the work.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 px-4 md:px-0">
            {/* CARD FOR BUILDERS */}
            <GlassCard variant="neon" className="group">
              <GlassHeader>
                <div className="flex items-center gap-4 text-2xl md:text-3xl font-bold text-white group-hover:text-primary transition-colors">
                  <Briefcase className="h-10 w-10 text-primary" />
                  Builders
                </div>
              </GlassHeader>
              <GlassContent className="space-y-6">
                <p className="text-lg text-gray-300">Upload your raw job description. <span className="text-white font-semibold">We handle the rest.</span></p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                    <ShieldCheck className="text-primary h-6 w-6 mt-0.5 shrink-0" />
                    <span className="text-gray-300"><strong className="text-white block mb-1">Instant Verification</strong> You only see candidates who have ALREADY passed our AI Skill & Humanity checks.</span>
                  </li>
                  <li className="flex items-start gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                    <Recycle className="text-primary h-6 w-6 mt-0.5 shrink-0" />
                    <span className="text-gray-300"><strong className="text-white block mb-1">Psychometric Architecture</strong> We match for culture fit and cognitive style, not just keywords.</span>
                  </li>
                  <li className="flex items-start gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                    <Target className="text-primary h-6 w-6 mt-0.5 shrink-0" />
                    <span className="text-gray-300"><strong className="text-white block mb-1">Time Saved: Massive</strong> Skip the first 3 rounds of interviews. We deliver finalists.</span>
                  </li>
                </ul>
              </GlassContent>
              <GlassFooter>
                <Button onClick={() => handleRoleSelect('employer')} className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-6 rounded-xl border border-white/5 backdrop-blur-sm transition-all">
                  Deploy Capital & Build
                </Button>
              </GlassFooter>
            </GlassCard>

            {/* CARD FOR TALENT */}
            <GlassCard variant="default" className="group">
              <GlassHeader>
                <div className="flex items-center gap-4 text-2xl md:text-3xl font-bold text-white group-hover:text-primary transition-colors">
                  <Users className="h-10 w-10 text-primary" />
                  Talent
                </div>
              </GlassHeader>
              <GlassContent className="space-y-6">
                <p className="text-lg text-gray-300">One test. <span className="text-white font-semibold">Infinite opportunities.</span></p>
                <ul className="space-y-4 text-sm text-gray-400">
                  <li className="flex items-start gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                    <Zap className="text-primary h-6 w-6 mt-0.5 shrink-0" />
                    <span className="text-gray-300"><strong className="text-white block mb-1">Prove It Once</strong> Take our AI Skill & Humanity verification. That score is your universal passport.</span>
                  </li>
                  <li className="flex items-start gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                    <EyeOff className="text-primary h-6 w-6 mt-0.5 shrink-0" />
                    <span className="text-gray-300"><strong className="text-white block mb-1">Total Anonymity</strong> Your identity is a vault. Only YOU hold the key to reveal it to interested builders.</span>
                  </li>
                  <li className="flex items-start gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
                    <Gem className="text-primary h-6 w-6 mt-0.5 shrink-0" />
                    <span className="text-gray-300"><strong className="text-white block mb-1">Meritocratic Pay</strong> High scores command high signing bonuses. Excellence is monetized here.</span>
                  </li>
                </ul>
              </GlassContent>
              <GlassFooter>
                <Button onClick={() => handleRoleSelect('candidate')} className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-6 rounded-xl border border-white/5 backdrop-blur-sm transition-all">
                  Verify & Enter Market
                </Button>
              </GlassFooter>
            </GlassCard>
          </div>

          <div className="text-center py-24 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-primary/10 blur-[100px] rounded-full -z-10" />
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">The Future is Efficient</h2>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
              <GlassCard variant="ghost" className="p-6 text-center hover:bg-white/5 transition-colors">
                <Share2 className="h-12 w-12 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-bold text-white mb-3">Referral Network</h3>
                <p className="text-sm text-gray-400 leading-relaxed">Refer excellence. Earn credits. We reward the nodes that strengthen the network.</p>
              </GlassCard>

              <GlassCard variant="neon" className="p-8 text-center scale-105 z-10 shadow-2xl shadow-primary/10">
                <Gem className="h-14 w-14 text-white mx-auto mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                <h3 className="text-2xl font-bold text-white mb-3">Sign-On Commitment</h3>
                <p className="text-sm text-gray-300 leading-relaxed">Builders commit a signing bonus to post jobs. Talent claims it upon hiring. Skin in the game on both sides.</p>
              </GlassCard>

              <GlassCard variant="ghost" className="p-6 text-center hover:bg-white/5 transition-colors">
                <Handshake className="h-12 w-12 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-bold text-white mb-3">Instant Trust</h3>
                <p className="text-sm text-gray-400 leading-relaxed">Our AI verifies humanity and skill instantly. No more bots. No more catfishing. Just raw talent.</p>
              </GlassCard>
            </div>
          </div>
        </main>

        <footer className="py-8 text-center text-sm text-gray-600 border-t border-white/5">
          <p>&copy; {new Date().getFullYear()} TalentOS (self-hosted). All rights reserved.</p>
          <div className="mt-3 space-x-4 text-xs">
            <a href="/privacy.html" className="hover:text-teal-400 transition-colors">Privacy Policy</a>
            <a href="/terms.html" className="hover:text-teal-400 transition-colors">Terms of Service</a>
          </div>
          <p className="mt-2 text-xs opacity-50">Privacy. Strategy. Talent.</p>
        </footer>
      </div>
    </div>
  );
}