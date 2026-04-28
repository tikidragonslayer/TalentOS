"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useUser } from "@/contexts/user-context";
import { BIG_FIVE_QUESTIONS, getBigFiveTraits, type BigFiveResult } from "@/services/big-five";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Brain, CheckCircle2, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LIKERT_OPTIONS = [
  { value: "1", label: "Strongly Disagree" },
  { value: "2", label: "Disagree" },
  { value: "3", label: "Neutral" },
  { value: "4", label: "Agree" },
  { value: "5", label: "Strongly Agree" },
];

const TRAIT_DESCRIPTIONS: Record<string, { label: string; high: string; low: string; color: string }> = {
  openness: {
    label: "Openness to Experience",
    high: "Creative, curious, embraces novelty and abstract thinking. Thrives in innovative, fast-paced environments.",
    low: "Practical, conventional, prefers structure and proven methods. Excels in detail-oriented, process-driven roles.",
    color: "bg-violet-500",
  },
  conscientiousness: {
    label: "Conscientiousness",
    high: "Organized, disciplined, goal-driven. Excellent at project management, deadlines, and quality standards.",
    low: "Flexible, spontaneous, adaptable. Strong at handling ambiguity and pivoting quickly.",
    color: "bg-blue-500",
  },
  extraversion: {
    label: "Extraversion",
    high: "Energized by collaboration, outgoing, assertive. Natural leader in client-facing and team-based roles.",
    low: "Focused, reflective, independent. Excels in analytical, research, and deep-work roles.",
    color: "bg-amber-500",
  },
  agreeableness: {
    label: "Agreeableness",
    high: "Cooperative, empathetic, team-oriented. Great at building consensus and maintaining relationships.",
    low: "Direct, competitive, challenging. Strong at negotiation, critical analysis, and driving accountability.",
    color: "bg-emerald-500",
  },
  neuroticism: {
    label: "Emotional Stability",
    high: "Sensitive to stress, detail-aware, risk-conscious. Strong at identifying potential problems early.",
    low: "Calm under pressure, resilient, steady. Thrives in high-stakes, fast-paced environments.",
    color: "bg-rose-500",
  },
};

export default function BigFiveTestPage() {
  const router = useRouter();
  const { authUser } = useUser();
  const { toast } = useToast();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<BigFiveResult | null>(null);
  const [saving, setSaving] = useState(false);
  const firestore = useFirestore();

  const total = BIG_FIVE_QUESTIONS.length;
  const progress = ((Object.keys(answers).length) / total) * 100;
  const question = BIG_FIVE_QUESTIONS[currentQuestion];
  const currentTraitQuestions = BIG_FIVE_QUESTIONS.filter(q => q.trait === question?.trait);
  const traitIndex = currentTraitQuestions.findIndex(q => q.id === question?.id);

  const handleAnswer = (value: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion]: value }));
  };

  const canGoNext = answers[currentQuestion] !== undefined;

  const handleNext = () => {
    if (currentQuestion < total - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!authUser) return;
    setSaving(true);
    try {
      const answersArray = Array.from({ length: total }, (_, i) => answers[i] || "3");
      const bigFive = await getBigFiveTraits(answersArray);
      setResult(bigFive);

      // Save to Firestore
      if (!firestore) throw new Error("Firestore not ready");
      const userRef = doc(firestore, "users", authUser.id);
      await updateDoc(userRef, { bigFive });
      toast({ title: "Big Five results saved!", description: "Your personality profile has been updated." });
    } catch (err) {
      toast({ title: "Error saving results", description: "Please try again.", variant: "destructive" });
    }
    setSaving(false);
  };

  // Results view
  if (result) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Your Big Five Personality Profile</CardTitle>
            <CardDescription>
              These results help match you with roles and teams that align with your natural strengths.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(TRAIT_DESCRIPTIONS).map(([key, trait]) => {
              const score = result[key as keyof BigFiveResult];
              const percentage = Math.round(score * 100);
              const isHigh = score >= 0.6;

              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{trait.label}</span>
                    <span className="text-sm font-mono font-bold">{percentage}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-1000", trait.color)}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isHigh ? trait.high : trait.low}
                  </p>
                </div>
              );
            })}

            <div className="pt-6 flex gap-3">
              <Button variant="outline" onClick={() => { setResult(null); setCurrentQuestion(0); setAnswers({}); }}>
                Retake Test
              </Button>
              <Button onClick={() => router.push("/candidate/profile")} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Back to Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Test view
  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/candidate/profile")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Profile
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Big Five Personality Assessment</CardTitle>
              <CardDescription>25 questions • ~5 minutes</CardDescription>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Question {currentQuestion + 1} of {total} — {TRAIT_DESCRIPTIONS[question?.trait]?.label}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/30 p-6 rounded-lg border">
            <p className="text-lg font-medium leading-relaxed">{question?.text}</p>
          </div>

          <RadioGroup
            value={answers[currentQuestion] || ""}
            onValueChange={handleAnswer}
            className="space-y-3"
          >
            {LIKERT_OPTIONS.map((option) => (
              <div key={option.value} className={cn(
                "flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                answers[currentQuestion] === option.value ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
              )}>
                <RadioGroupItem value={option.value} id={`q${currentQuestion}-${option.value}`} />
                <Label htmlFor={`q${currentQuestion}-${option.value}`} className="flex-1 cursor-pointer font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handlePrev} disabled={currentQuestion === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            {currentQuestion < total - 1 ? (
              <Button onClick={handleNext} disabled={!canGoNext}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canGoNext || saving} className="bg-primary">
                {saving ? "Saving..." : "See My Results"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
