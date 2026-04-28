"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useUser } from "@/contexts/user-context";
import { MBTI_QUESTIONS, getMbtiType } from "@/services/mbti";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const MBTI_TYPE_INFO: Record<string, { title: string; description: string; strengths: string[] }> = {
  ISTJ: { title: "The Inspector", description: "Reliable, methodical, and thorough. You bring order and consistency to any team.", strengths: ["Attention to detail", "Dependability", "Systematic thinking", "Quality assurance"] },
  ISFJ: { title: "The Protector", description: "Warm, dedicated, and observant. You create supportive environments where people thrive.", strengths: ["Team support", "Reliability", "Practical care", "Process improvement"] },
  INFJ: { title: "The Counselor", description: "Insightful, principled, and compassionate. You see potential in people and systems.", strengths: ["Strategic vision", "Empathy", "Written communication", "Mentoring"] },
  INTJ: { title: "The Mastermind", description: "Strategic, determined, and independent. You architect complex solutions.", strengths: ["Long-term planning", "Systems thinking", "Innovation", "Critical analysis"] },
  ISTP: { title: "The Craftsperson", description: "Analytical, adaptable, and hands-on. You excel at troubleshooting and optimization.", strengths: ["Problem-solving", "Technical skill", "Crisis management", "Efficiency"] },
  ISFP: { title: "The Composer", description: "Gentle, sensitive, and action-oriented. You bring aesthetic sensibility and values-driven work.", strengths: ["Adaptability", "Creative expression", "Authenticity", "Collaboration"] },
  INFP: { title: "The Healer", description: "Idealistic, empathetic, and creative. You champion causes and inspire through authenticity.", strengths: ["Creative writing", "Mediation", "Vision casting", "Cultural awareness"] },
  INTP: { title: "The Architect", description: "Logical, innovative, and intellectually curious. You deconstruct and rebuild systems.", strengths: ["Analytical thinking", "Innovation", "Complex problem-solving", "Research"] },
  ESTP: { title: "The Dynamo", description: "Energetic, pragmatic, and bold. You drive action and deliver results fast.", strengths: ["Negotiation", "Quick decisions", "Risk management", "Sales"] },
  ESFP: { title: "The Performer", description: "Spontaneous, energetic, and fun-loving. You create engaging experiences.", strengths: ["Presentation", "Client relations", "Team morale", "Event management"] },
  ENFP: { title: "The Champion", description: "Enthusiastic, creative, and people-oriented. You see possibilities everywhere.", strengths: ["Brainstorming", "Networking", "Change management", "Inspiration"] },
  ENTP: { title: "The Visionary", description: "Quick-witted, strategic, and entrepreneurial. You challenge the status quo.", strengths: ["Debate & persuasion", "Strategic innovation", "Startup thinking", "Cross-domain insight"] },
  ESTJ: { title: "The Supervisor", description: "Organized, logical, and assertive. You build efficient structures and hold standards.", strengths: ["Operations management", "Process design", "Accountability", "Leadership"] },
  ESFJ: { title: "The Provider", description: "Caring, social, and conscientious. You build cohesive teams and nurture culture.", strengths: ["Team building", "Customer service", "Community management", "HR & onboarding"] },
  ENFJ: { title: "The Teacher", description: "Charismatic, empathetic, and organized. You develop people and drive consensus.", strengths: ["Coaching", "Public speaking", "Conflict resolution", "Organizational development"] },
  ENTJ: { title: "The Commander", description: "Bold, imaginative, and strong-willed. You lead with vision and decisiveness.", strengths: ["Executive leadership", "Strategic planning", "Delegation", "Scaling operations"] },
};

export default function MbtiTestPage() {
  const router = useRouter();
  const { authUser } = useUser();
  const { toast } = useToast();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [resultType, setResultType] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firestore = useFirestore();

  const total = MBTI_QUESTIONS.length;
  const progress = ((Object.keys(answers).length) / total) * 100;
  const question = MBTI_QUESTIONS[currentQuestion];

  const handleAnswer = (value: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion]: value }));
    // Auto-advance after selection
    if (currentQuestion < total - 1) {
      setTimeout(() => setCurrentQuestion(prev => prev + 1), 300);
    }
  };

  const handlePrev = () => {
    if (currentQuestion > 0) setCurrentQuestion(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!authUser) return;
    setSaving(true);
    try {
      const answersArray = Array.from({ length: total }, (_, i) => answers[i] || "A");
      const mbti = await getMbtiType(answersArray);
      setResultType(mbti.personalityType);

      if (!firestore) throw new Error("Firestore not ready");
      const userRef = doc(firestore, "users", authUser.id);
      await updateDoc(userRef, { mbti });
      toast({ title: "MBTI results saved!", description: `Your type is ${mbti.personalityType}.` });
    } catch (err) {
      toast({ title: "Error saving results", description: "Please try again.", variant: "destructive" });
    }
    setSaving(false);
  };

  // Results view
  if (resultType) {
    const info = MBTI_TYPE_INFO[resultType] || { title: "Your Type", description: "A unique combination of traits.", strengths: [] };

    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <span className="text-3xl font-bold font-mono text-primary">{resultType}</span>
            </div>
            <CardTitle className="text-2xl">{info.title}</CardTitle>
            <CardDescription className="text-base mt-2">{info.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Workplace Strengths</h3>
              <div className="grid grid-cols-2 gap-2">
                {info.strengths.map((s) => (
                  <div key={s} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> How This Helps Your Match
              </h3>
              <p className="text-sm text-muted-foreground">
                Your MBTI type is factored into TalentOS culture-fit scoring. Teams with complementary types
                tend to perform better — your {resultType} profile will be matched against team composition
                to find environments where you&apos;ll naturally excel.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => { setResultType(null); setCurrentQuestion(0); setAnswers({}); }}>
                Retake Test
              </Button>
              <Button onClick={() => router.push("/candidate/big-five-test")} variant="outline">
                Take Big Five Test
              </Button>
              <Button onClick={() => router.push("/candidate/profile")} className="flex-1">
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
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>MBTI Personality Assessment</CardTitle>
              <CardDescription>20 questions • ~4 minutes</CardDescription>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Question {currentQuestion + 1} of {total}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/30 p-6 rounded-lg border">
            <p className="text-lg font-medium leading-relaxed">{question?.text}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleAnswer("A")}
              className={cn(
                "w-full text-left p-4 rounded-lg border transition-all",
                answers[currentQuestion] === "A"
                  ? "bg-primary/10 border-primary shadow-sm"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-start gap-3">
                <span className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-full text-sm font-bold shrink-0",
                  answers[currentQuestion] === "A" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>A</span>
                <span className="text-sm leading-relaxed">{question?.optionA}</span>
              </div>
            </button>

            <button
              onClick={() => handleAnswer("B")}
              className={cn(
                "w-full text-left p-4 rounded-lg border transition-all",
                answers[currentQuestion] === "B"
                  ? "bg-primary/10 border-primary shadow-sm"
                  : "hover:bg-muted/50"
              )}
            >
              <div className="flex items-start gap-3">
                <span className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-full text-sm font-bold shrink-0",
                  answers[currentQuestion] === "B" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>B</span>
                <span className="text-sm leading-relaxed">{question?.optionB}</span>
              </div>
            </button>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handlePrev} disabled={currentQuestion === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            {currentQuestion < total - 1 ? (
              <Button onClick={() => setCurrentQuestion(prev => prev + 1)} disabled={!answers[currentQuestion]}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!answers[currentQuestion] || saving} className="bg-primary">
                {saving ? "Calculating..." : "See My Type"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
