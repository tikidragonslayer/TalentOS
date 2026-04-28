"use client";

import { useState, useMemo } from "react";
import { ActiveSkillVerifier } from "@/components/candidate/active-skill-verifier";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWatchdog } from "@/components/security/recaptcha-provider";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/user-context";
import { SKILL_TAXONOMY, canonicalSkillName, findClosestSkill } from "@/lib/skill-taxonomy";
import { Loader2, ShieldCheck, RefreshCw, Clock, CheckCircle2 } from "lucide-react";
import type { UserProfile } from "@/types";

const RE_VERIFY_COOLDOWN_DAYS = 30;

function getVerifiedSkillStatus(verifiedSkills: UserProfile["verifiedSkills"], skillName: string) {
  if (!verifiedSkills?.length) return null;
  const match = verifiedSkills.find(
    vs => vs.skill.toLowerCase() === skillName.toLowerCase()
  );
  if (!match) return null;

  const verifiedDate = new Date(match.verificationDate);
  const daysSince = Math.floor((Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));
  const canReVerify = daysSince >= RE_VERIFY_COOLDOWN_DAYS;
  const reVerifyDate = new Date(verifiedDate.getTime() + RE_VERIFY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  return { ...match, daysSince, canReVerify, reVerifyDate };
}

export default function VerifySkillsPage() {
  const { profile } = useUser();
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [customSkill, setCustomSkill] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const { verifyHumanity } = useWatchdog();
  const { toast } = useToast();

  const verifiedSkills = (profile as UserProfile)?.verifiedSkills ?? [];

  // Filter taxonomy by search query
  const filteredTaxonomy = useMemo(() => {
    if (!filterQuery.trim()) return SKILL_TAXONOMY;
    const q = filterQuery.toLowerCase();
    const filtered: Record<string, string[]> = {};
    for (const [category, skills] of Object.entries(SKILL_TAXONOMY)) {
      const matched = skills.filter(s => s.toLowerCase().includes(q));
      if (matched.length > 0) filtered[category] = matched;
    }
    return filtered;
  }, [filterQuery]);

  const startVerification = async (skill: string) => {
    if (!skill.trim()) return;

    // Validate against taxonomy
    const canonical = canonicalSkillName(skill);
    if (!canonical) {
      const closest = findClosestSkill(skill);
      if (closest) {
        setSuggestion(closest);
        setValidationError(`"${skill}" is not a recognized skill.`);
      } else {
        setValidationError(`"${skill}" is not a recognized skill. Please choose from the list below.`);
        setSuggestion(null);
      }
      return;
    }

    // Check cooldown
    const status = getVerifiedSkillStatus(verifiedSkills, canonical);
    if (status && !status.canReVerify) {
      const dateStr = status.reVerifyDate.toLocaleDateString();
      setValidationError(
        `You've already verified "${canonical}" recently (score: ${status.score}/100). You can re-verify after ${dateStr}.`
      );
      setSuggestion(null);
      return;
    }

    setValidationError(null);
    setSuggestion(null);
    setIsVerifying(true);

    try {
      const token = await verifyHumanity('skill_verification');
      if (!token) {
        toast({
          title: "Verification Failed",
          description: "We couldn't verify you're human. Please try again or check your connection.",
          variant: "destructive",
        });
        setIsVerifying(false);
        return;
      }
      setSelectedSkill(canonical);
    } catch (error) {
      console.error("reCAPTCHA verification error:", error);
      toast({
        title: "Verification Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary">Live Skill Verification</h1>
        <p className="text-muted-foreground mt-2">
          Prove your expertise and humanity in a real-time AI interview.
        </p>
      </div>

      {!selectedSkill ? (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Already-verified skills */}
          {verifiedSkills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  Your Verified Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {verifiedSkills.map((vs) => {
                    const status = getVerifiedSkillStatus(verifiedSkills, vs.skill)!;
                    return (
                      <Badge
                        key={vs.skill + vs.verificationDate}
                        variant={status.canReVerify ? "outline" : "secondary"}
                        className={`px-3 py-1.5 text-sm gap-1.5 ${
                          status.canReVerify
                            ? "cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            : "opacity-60 cursor-not-allowed"
                        } ${isVerifying ? "pointer-events-none opacity-50" : ""}`}
                        onClick={() => status.canReVerify && startVerification(vs.skill)}
                      >
                        {status.canReVerify ? (
                          <RefreshCw className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {vs.skill} ({vs.score}/100)
                        {status.canReVerify && (
                          <span className="text-[10px] ml-1 opacity-70">Re-verify</span>
                        )}
                        {!status.canReVerify && (
                          <span className="text-[10px] ml-1 opacity-70">
                            <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                            {status.reVerifyDate.toLocaleDateString()}
                          </span>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skill selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select a Skill to Verify</CardTitle>
              <CardDescription>
                Choose a skill from the categories below. This will start a 5-minute interactive session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search / custom input */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search or type a skill name..."
                    value={customSkill}
                    onChange={(e) => {
                      setCustomSkill(e.target.value);
                      setFilterQuery(e.target.value);
                      setValidationError(null);
                      setSuggestion(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") startVerification(customSkill);
                    }}
                  />
                  <Button onClick={() => startVerification(customSkill)} disabled={!customSkill.trim() || isVerifying}>
                    {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start"}
                  </Button>
                </div>
                {validationError && (
                  <p className="text-sm text-destructive">{validationError}</p>
                )}
                {suggestion && (
                  <Button
                    variant="link"
                    className="text-sm p-0 h-auto"
                    onClick={() => {
                      setCustomSkill(suggestion);
                      setFilterQuery(suggestion);
                      setSuggestion(null);
                      setValidationError(null);
                      startVerification(suggestion);
                    }}
                  >
                    Did you mean &quot;{suggestion}&quot;?
                  </Button>
                )}
              </div>

              {isVerifying && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying humanity...
                </div>
              )}

              {/* Taxonomy grid */}
              <div className="space-y-4">
                {Object.entries(filteredTaxonomy).map(([category, skills]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">{category}</h3>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill) => {
                        const status = getVerifiedSkillStatus(verifiedSkills, skill);
                        const isRecentlyVerified = status && !status.canReVerify;

                        return (
                          <Badge
                            key={skill}
                            variant="outline"
                            className={`px-3 py-1 text-sm transition-colors ${
                              isRecentlyVerified
                                ? "opacity-50 cursor-not-allowed bg-muted"
                                : "cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            } ${isVerifying ? "pointer-events-none opacity-50" : ""}`}
                            onClick={() => !isRecentlyVerified && startVerification(skill)}
                          >
                            {status && !status.canReVerify && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {status?.canReVerify && <RefreshCw className="h-3 w-3 mr-1" />}
                            {skill}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {Object.keys(filteredTaxonomy).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No matching skills found. Try a different search term.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Button variant="ghost" onClick={() => setSelectedSkill(null)} className="mb-4">
            &larr; Back to Selection
          </Button>
          <ActiveSkillVerifier targetSkill={selectedSkill} />
        </div>
      )}
    </div>
  );
}
