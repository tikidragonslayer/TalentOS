"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { verifyCandidateSkillsAction, generateFollowupAction } from '@/app/actions/interview-actions';
import { useWatchdog } from '@/components/security/recaptcha-provider';
import { startProctoring, stopProctoring } from '@/lib/proctoring';
import type { ProctoringSession } from '@/lib/proctoring';
import { getAuth } from 'firebase/auth';

const MIN_USER_MESSAGES = 5;

interface Message {
    id: string;
    role: 'ai' | 'user';
    content: string;
    timestamp: Date;
}

interface BehavioralMetrics {
    typingVariability: number;
    pasteCount: number;
    focusSwitches: number;
    averageResponseTime: number;
    recaptchaScore?: number;
}

export function ActiveSkillVerifier({ targetSkill }: { targetSkill: string }) {
    const { authUser, profile } = useUser();
    const { toast } = useToast();
    const { score: watchdogScore } = useWatchdog();
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'ai', content: `Hello! I'm here to verify your expertise in ${targetSkill}. This will be a short 5-question interview. Let's start — tell me about your experience with ${targetSkill} and what draws you to it.`, timestamp: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    // --- Behavioral Metrics State ---
    const [pasteCount, setPasteCount] = useState(0);
    const [focusSwitches, setFocusSwitches] = useState(0);
    const [keystrokeTimes, setKeystrokeTimes] = useState<number[]>([]);
    const [lastKeystrokeTime, setLastKeystrokeTime] = useState(0);
    const [honeypotValue, setHoneypotValue] = useState(''); // Trap for bots

    // Per-message metrics for averaging across all exchanges
    const [allTypingVariabilities, setAllTypingVariabilities] = useState<number[]>([]);
    const [responseTimes, setResponseTimes] = useState<number[]>([]);
    const [lastAiMessageTime, setLastAiMessageTime] = useState<number>(Date.now());

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const proctoringRef = useRef<ProctoringSession | null>(null);

    // Count user messages already in state (before adding the current one)
    const userMessageCount = messages.filter(m => m.role === 'user').length;

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, [messages]);

    // Start proctoring session on mount
    useEffect(() => {
        const rcScore = watchdogScore > 0 ? watchdogScore / 100 : 0;
        proctoringRef.current = startProctoring(rcScore);
        return () => {
            if (proctoringRef.current) {
                stopProctoring(proctoringRef.current);
                proctoringRef.current = null;
            }
        };
    }, [watchdogScore]);

    // Track Focus Switches
    useEffect(() => {
        const handleBlur = () => setFocusSwitches(prev => prev + 1);
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, []);

    // Track when AI messages arrive (for response time calculation)
    useEffect(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === 'ai') {
            setLastAiMessageTime(Date.now());
        }
    }, [messages]);

    const calculateTypingVariability = () => {
        if (keystrokeTimes.length < 2) return 0;
        const intervals = [];
        for (let i = 1; i < keystrokeTimes.length; i++) {
            intervals.push(keystrokeTimes[i] - keystrokeTimes[i - 1]);
        }
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
        return Math.sqrt(variance);
    };

    const handleKeyDown = () => {
        const now = Date.now();
        if (lastKeystrokeTime > 0) {
            setKeystrokeTimes(prev => [...prev, now]);
        }
        setLastKeystrokeTime(now);
    };

    const handlePaste = () => {
        setPasteCount(prev => prev + 1);
        toast({
            title: "Paste Detected",
            description: "Please type your answers manually for skill verification.",
            variant: "destructive"
        });
    };

    const getIdToken = async (): Promise<string | null> => {
        if (!authUser) {
            toast({ title: "Error", description: "You must be logged in to verify skills.", variant: "destructive" });
            return null;
        }
        const firebaseAuth = getAuth();
        const idToken = await firebaseAuth.currentUser?.getIdToken();
        if (!idToken) {
            toast({ title: "Auth error", variant: "destructive" });
            return null;
        }
        return idToken;
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput('');
        setIsLoading(true);

        // Record response time for this exchange
        const responseTime = Date.now() - lastAiMessageTime;
        setResponseTimes(prev => [...prev, responseTime]);

        // Record typing variability for this message and reset keystroke buffer
        const currentVariability = calculateTypingVariability();
        if (currentVariability > 0) {
            setAllTypingVariabilities(prev => [...prev, currentVariability]);
        }
        setKeystrokeTimes([]);
        setLastKeystrokeTime(0);

        // Count user messages INCLUDING this one
        const totalUserMessages = updatedMessages.filter(m => m.role === 'user').length;

        if (totalUserMessages >= MIN_USER_MESSAGES) {
            // FINISH INTERVIEW — aggregate metrics across all exchanges
            const avgTypingVariability = allTypingVariabilities.length > 0
                ? [...allTypingVariabilities, currentVariability].reduce((a, b) => a + b, 0) / ([...allTypingVariabilities, currentVariability].length)
                : currentVariability;

            const allResponseTimes = [...responseTimes, responseTime];
            const avgResponseTime = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;

            const metrics: BehavioralMetrics = {
                typingVariability: avgTypingVariability,
                pasteCount,
                focusSwitches,
                averageResponseTime: avgResponseTime,
                recaptchaScore: watchdogScore > 0 ? watchdogScore / 100 : undefined,
            };

            // Stop proctoring and build report
            let proctoringReport = null;
            if (proctoringRef.current) {
                const report = stopProctoring(proctoringRef.current);
                proctoringReport = {
                    score: report.score,
                    verdict: report.verdict,
                    flags: report.flags,
                    breakdown: report.breakdown,
                };
                proctoringRef.current = null;
            }

            const transcript = updatedMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

            try {
                const idToken = await getIdToken();
                if (!idToken) { setIsLoading(false); return; }

                const result = await verifyCandidateSkillsAction(idToken, {
                    candidateProfile: JSON.stringify(profile),
                    targetJobRole: targetSkill,
                    interviewTranscript: transcript,
                    behavioralMetrics: metrics,
                    honeypotInput: honeypotValue,
                    proctoringReport,
                });

                if (result.success) {
                    setIsComplete(true);
                    const proctoringLine = proctoringReport
                        ? `\nProctoring Confidence: ${proctoringReport.score}/100 (${proctoringReport.verdict})`
                        : '';
                    setMessages(prev => [...prev, {
                        id: 'final',
                        role: 'ai',
                        content: `**Verification Complete.**\n\nSkill Score: ${result.data?.knowledgeScore}/100\nHumanity Score: ${result.data?.humanityScore}/100${proctoringLine}\n\n${result.data?.scoreJustification}`,
                        timestamp: new Date()
                    }]);
                } else {
                    setMessages(prev => [...prev, {
                        id: 'error', role: 'ai', content: "An error occurred during verification. Please try again.", timestamp: new Date()
                    }]);
                }

            } catch (error) {
                console.error("Verification Error", error);
                setMessages(prev => [...prev, {
                    id: 'error', role: 'ai', content: "An unexpected error occurred. Please try again.", timestamp: new Date()
                }]);
            } finally {
                setIsLoading(false);
            }

        } else {
            // CONTINUE INTERVIEW — generate AI follow-up question
            const transcript = updatedMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
            const nextQuestionNumber = totalUserMessages + 1; // The question number we're generating

            try {
                const idToken = await getIdToken();
                if (!idToken) { setIsLoading(false); return; }

                const result = await generateFollowupAction(idToken, {
                    targetSkill,
                    transcript,
                    questionNumber: nextQuestionNumber,
                });

                if (result.success && result.data) {
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'ai',
                        content: result.data!.followUpQuestion,
                        timestamp: new Date()
                    }]);
                } else {
                    // Fallback to a generic follow-up if AI call fails
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'ai',
                        content: `Can you describe a specific challenge you faced when working with ${targetSkill} and how you resolved it?`,
                        timestamp: new Date()
                    }]);
                }
            } catch (error) {
                console.error("Follow-up generation error", error);
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'ai',
                    content: `Tell me more about how you've applied ${targetSkill} in a real project. What trade-offs did you encounter?`,
                    timestamp: new Date()
                }]);
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col shadow-2xl border-primary/20 bg-background/95 backdrop-blur">
            <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Skill Verification: {targetSkill}
                </CardTitle>
                {!isComplete && (
                    <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Question {Math.min(userMessageCount + 1, MIN_USER_MESSAGES)} of {MIN_USER_MESSAGES}</span>
                            <span>{Math.round((userMessageCount / MIN_USER_MESSAGES) * 100)}% complete</span>
                        </div>
                        <Progress value={(userMessageCount / MIN_USER_MESSAGES) * 100} className="h-1.5" />
                    </div>
                )}
            </CardHeader>
            <CardContent className="flex-grow p-0 overflow-hidden relative">
                {/* Honeypot for Bots */}
                <input
                    type="text"
                    name="website_url_hp"
                    className="absolute opacity-0 pointer-events-none h-0 w-0"
                    tabIndex={-1}
                    autoComplete="off"
                    onChange={(e) => setHoneypotValue(e.target.value)}
                />

                <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
                    <div className="space-y-4">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted border'}`}>
                                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                                    <span className="text-[10px] opacity-70 block mt-1 text-right">
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-muted border p-3 rounded-lg flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm">{userMessageCount >= MIN_USER_MESSAGES ? 'Evaluating your responses...' : 'Thinking...'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Live Metrics Feedback (Optional - Debugging) */}
                <div className="absolute top-2 right-2 text-[10px] text-muted-foreground opacity-30 pointer-events-none">
                    Paste: {pasteCount} | Focus: {focusSwitches} | Var: {Math.round(calculateTypingVariability())}ms | Mouse: {proctoringRef.current?.mouseMovements ?? 0}
                </div>
            </CardContent>
            <CardFooter className="p-4 bg-muted/30 border-t">
                <div className="flex w-full gap-2 items-center">
                    {isComplete ? (
                        <Button className="w-full" onClick={() => window.location.href = '/candidate/profile'}>
                            View Verification on Profile
                        </Button>
                    ) : (
                        <>
                            <Input
                                placeholder="Type your answer naturally..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    handleKeyDown();
                                    if (e.key === 'Enter' && !e.shiftKey) handleSend();
                                }}
                                onPaste={handlePaste}
                                disabled={isLoading}
                                className="bg-background"
                                autoComplete="off"
                            />
                            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
}
