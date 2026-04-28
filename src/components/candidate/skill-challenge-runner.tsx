"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Timer, CheckCircle2, XCircle, Trophy, ArrowRight } from "lucide-react";
import type { SkillChallenge, ChallengeResult } from "@/lib/skill-challenges";
import { scoreChallengeAnswers } from "@/lib/skill-challenges";

interface SkillChallengeRunnerProps {
  challenge: SkillChallenge;
  onComplete: (result: ChallengeResult) => void;
  onCancel: () => void;
}

export function SkillChallengeRunner({ challenge, onComplete, onCancel }: SkillChallengeRunnerProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(challenge.questions.length).fill(""));
  const [timeRemaining, setTimeRemaining] = useState(challenge.timeLimit);
  const [isFinished, setIsFinished] = useState(false);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const startTime = useState(() => Date.now())[0];

  const finishChallenge = useCallback(() => {
    if (isFinished) return;
    setIsFinished(true);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const scored = scoreChallengeAnswers(challenge, answers);
    scored.timeSpentSeconds = elapsed;
    setResult(scored);
  }, [isFinished, startTime, challenge, answers]);

  // Timer countdown
  useEffect(() => {
    if (isFinished) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          finishChallenge();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isFinished, finishChallenge]);

  const handleAnswer = (value: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = value;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < challenge.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      finishChallenge();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = ((currentQuestion + (answers[currentQuestion] ? 1 : 0)) / challenge.questions.length) * 100;

  // Results screen
  if (isFinished && result) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <Trophy className={`h-12 w-12 mx-auto mb-2 ${result.score >= 70 ? "text-yellow-500" : result.score >= 40 ? "text-blue-500" : "text-muted-foreground"}`} />
          <CardTitle className="text-2xl">Challenge Complete</CardTitle>
          <CardDescription>
            {challenge.skill} ({challenge.difficulty}) - {formatTime(result.timeSpentSeconds)} elapsed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{result.score}/100</div>
            <Badge variant={result.score >= 70 ? "default" : result.score >= 40 ? "secondary" : "outline"}>
              {result.score >= 70 ? "Strong" : result.score >= 40 ? "Developing" : "Needs Improvement"}
            </Badge>
          </div>

          <div className="space-y-3">
            {result.answers.map((a, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                {a.correct ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="font-medium">Q{idx + 1}:</span>{" "}
                  {a.correct ? "Correct" : "Incorrect"} ({a.points} pts)
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Back to Challenges
            </Button>
            <Button onClick={() => onComplete(result)} className="flex-1">
              Save to Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Question screen
  const q = challenge.questions[currentQuestion];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Timer & progress bar */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="gap-1">
          <Timer className="h-3 w-3" />
          {formatTime(timeRemaining)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Question {currentQuestion + 1} of {challenge.questions.length}
        </span>
      </div>
      <Progress value={progressPercent} className="h-2" />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-relaxed whitespace-pre-wrap">{q.prompt}</CardTitle>
        </CardHeader>
        <CardContent>
          {q.options && q.options.length > 0 ? (
            <RadioGroup value={answers[currentQuestion]} onValueChange={handleAnswer} className="space-y-3">
              {q.options.map((option, idx) => (
                <div key={idx} className="flex items-start space-x-3 p-3 rounded-md border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value={option} id={`option-${idx}`} className="mt-0.5" />
                  <Label htmlFor={`option-${idx}`} className="cursor-pointer flex-1 leading-relaxed">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <textarea
              className="w-full min-h-[120px] p-3 border rounded-md resize-y"
              placeholder="Type your answer..."
              value={answers[currentQuestion]}
              onChange={(e) => handleAnswer(e.target.value)}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleNext} disabled={!answers[currentQuestion]}>
          {currentQuestion < challenge.questions.length - 1 ? (
            <>Next <ArrowRight className="h-4 w-4 ml-1" /></>
          ) : (
            "Submit"
          )}
        </Button>
      </div>
    </div>
  );
}
