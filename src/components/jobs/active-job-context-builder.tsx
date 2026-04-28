"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Bot, Sparkles, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractJobContextAction, type JobContextResult } from '@/app/actions/job-context-actions';
import { getAuth } from 'firebase/auth';

interface Message {
    id: string;
    role: 'ai' | 'user';
    content: string;
    timestamp: Date;
}

interface ActiveJobContextBuilderProps {
    onContextExtracted: (result: JobContextResult) => void;
}

export function ActiveJobContextBuilder({ onContextExtracted }: ActiveJobContextBuilderProps) {
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'ai',
            content: `Hi! I'm your Job Context Agent. \n\nInstead of just a job description, I want to understand the **DNA** of this role. \n\nTell me: specifically what is the *single most difficult technical challenge* this person will face in their first 90 days?`,
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsThinking(true);

        // Simple mock conversation flow
        const userCount = messages.filter(m => m.role === 'user').length + 1;

        if (userCount >= 2) {
            // Trigger extraction
            const transcript = [...messages, userMsg].map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
            setIsLoading(true);

            try {
                const firebaseAuth = getAuth();
                const idToken = await firebaseAuth.currentUser?.getIdToken();
                if (!idToken) {
                    toast({ title: "Authentication Error", description: "Please sign in again.", variant: "destructive" });
                    setIsLoading(false);
                    setIsThinking(false);
                    return;
                }
                const result = await extractJobContextAction(idToken, transcript);
                if (result.success && result.data) {
                    setIsComplete(true);
                    setMessages(prev => [...prev, {
                        id: 'final',
                        role: 'ai',
                        content: `**Analysis Complete.**\n\nI've extracted the Job DNA. I'm updating your job description with these hidden requirements and culture notes now.`,
                        timestamp: new Date()
                    }]);
                    onContextExtracted(result.data);
                } else {
                    toast({ title: "Analysis Failed", description: result.error || "Unknown error", variant: "destructive" });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
                setIsThinking(false);
            }

        } else {
            // Next question
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'ai',
                    content: `Got it. And regarding the team culture—if you had to describe the "vibe" in one sentence (e.g., "Chaos but shipping," "Academic and slow," "Kindly mentorship"), what would it be?`,
                    timestamp: new Date()
                }]);
                setIsThinking(false);
            }, 1000);
        }
    };

    return (
        <Card className="w-full border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-inner">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Bot className="h-5 w-5 text-primary" />
                    AI Job Context Builder
                </CardTitle>
                <CardDescription>
                    Chat with our agent to extract "Job DNA" and hidden requirements.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="h-[300px] relative">
                    <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
                        <div className="space-y-4">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-xl text-sm ${msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground rounded-br-none'
                                            : 'bg-muted border rounded-bl-none'
                                        }`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                            {isThinking && (
                                <div className="flex justify-start">
                                    <div className="bg-muted border p-3 rounded-xl rounded-bl-none flex items-center gap-2 text-sm text-muted-foreground">
                                        <Sparkles className="h-3 w-3 animate-pulse" />
                                        Thinking...
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </CardContent>
            <CardFooter className="p-3 bg-muted/20 border-t">
                {isComplete ? (
                    <div className="w-full text-center text-green-600 flex items-center justify-center gap-2 font-medium">
                        <CheckCircle2 className="h-5 w-5" />
                        Job DNA Extracted & Applied
                    </div>
                ) : (
                    <div className="flex w-full gap-2">
                        <Input
                            placeholder="Type your answer..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            disabled={isThinking || isLoading}
                            className="bg-background"
                        />
                        <Button onClick={handleSend} disabled={isThinking || isLoading || !input.trim()} size="icon">
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </CardFooter>
        </Card>
    );
}
