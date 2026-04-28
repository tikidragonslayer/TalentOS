"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/user-context";
import { useToast } from "@/hooks/use-toast";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { useFirestore } from "@/contexts/user-context";
import { SKILL_CHALLENGES, getAvailableChallengeSkills } from "@/lib/skill-challenges";
import { SkillChallengeRunner } from "@/components/candidate/skill-challenge-runner";
import { Trophy, Clock, Zap, CheckCircle2 } from "lucide-react";
import type { SkillChallenge, ChallengeResult } from "@/lib/skill-challenges";
import type { UserProfile } from "@/types";

export default function SkillChallengesPage() {
  const { authUser, profile } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeChallenge, setActiveChallenge] = useState<SkillChallenge | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const userProfile = profile as UserProfile | null;
  const completedChallenges = userProfile?.challengeResults ?? [];

  const getCompletedResult = (challengeId: string) => {
    return completedChallenges.find(c => c.challengeId === challengeId);
  };

  const handleComplete = async (result: ChallengeResult) => {
    if (!authUser || !firestore) return;
    setIsSaving(true);
    try {
      const userRef = doc(firestore, "candidates", authUser.id);
      await updateDoc(userRef, {
        challengeResults: arrayUnion({
          challengeId: result.challengeId,
          skill: result.skill,
          difficulty: result.difficulty,
          score: result.score,
          completedAt: result.completedAt,
          timeSpentSeconds: result.timeSpentSeconds,
        }),
      });
      toast({
        title: "Challenge Saved",
        description: `Your ${result.skill} score of ${result.score}/100 has been added to your profile.`,
      });
      setActiveChallenge(null);
    } catch (error) {
      console.error("Failed to save challenge result:", error);
      toast({
        title: "Save Failed",
        description: "Could not save your challenge result. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (activeChallenge) {
    return (
      <div className="container mx-auto py-12 px-4">
        <SkillChallengeRunner
          challenge={activeChallenge}
          onComplete={handleComplete}
          onCancel={() => setActiveChallenge(null)}
        />
      </div>
    );
  }

  const availableSkills = getAvailableChallengeSkills();

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary">Skill Challenges</h1>
        <p className="text-muted-foreground mt-2">
          Prove your expertise with timed assessments. Scores are added to your profile and improve your match quality.
        </p>
      </div>

      {/* Completed challenges summary */}
      {completedChallenges.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Your Challenge Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {completedChallenges.map((cr, idx) => (
                <Badge key={idx} variant="secondary" className="px-3 py-1.5 text-sm gap-1.5">
                  <CheckCircle2 className="h-3 w-3" />
                  {cr.skill}: {cr.score}/100
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available challenges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SKILL_CHALLENGES.map((challenge) => {
          const completed = getCompletedResult(challenge.id);
          return (
            <Card key={challenge.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{challenge.skill}</CardTitle>
                  <Badge variant="outline">{challenge.difficulty}</Badge>
                </div>
                <CardDescription className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {challenge.questions.length} questions
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.floor(challenge.timeLimit / 60)} min
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {completed ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Previous Score</span>
                      <span className="text-lg font-bold">{completed.score}/100</span>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveChallenge(challenge)}
                    >
                      Retake Challenge
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => setActiveChallenge(challenge)}
                  >
                    Start Challenge
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
