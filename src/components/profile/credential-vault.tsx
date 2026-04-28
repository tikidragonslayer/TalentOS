"use client";

import React, { useState } from 'react';
import { GlassCard, GlassHeader, GlassContent, GlassFooter } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Lock, UploadCloud, Loader2, Link as LinkIcon, Plus, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Credential {
    id: string;
    title: string;
    issuer: string;
    date: string;
    status: 'verified' | 'pending' | 'rejected';
    type: 'degree' | 'certification' | 'license';
}

export function CredentialVault() {
    const [credentials, setCredentials] = useState<Credential[]>([
        {
            id: '1',
            title: 'B.S. Computer Science',
            issuer: 'Stanford University',
            date: '2022',
            status: 'verified',
            type: 'degree',
        },
        {
            id: '2',
            title: 'AWS Certified Solutions Architect',
            issuer: 'Amazon Web Services',
            date: '2023',
            status: 'verified',
            type: 'certification',
        }
    ]);

    const [isVerifying, setIsVerifying] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);

    // Simulation State
    const handleSimulatedVerify = () => {
        setIsVerifying(true);
        // Trillion Dollar Simulation
        setTimeout(() => {
            setCredentials(prev => [
                ...prev,
                {
                    id: Math.random().toString(),
                    title: 'Google Cloud Professional', // Hardcoded demo
                    issuer: 'Google Cloud',
                    date: '2024',
                    status: 'verified',
                    type: 'certification'
                }
            ]);
            setIsVerifying(false);
            setShowAddForm(false);
        }, 2500); // 2.5s simulated verification
    };

    return (
        <GlassCard variant="neon" className="relative overflow-hidden min-h-[400px]">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck className="w-32 h-32 text-primary" />
            </div>

            <GlassHeader className="flex justify-between items-center z-10 relative">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full border border-primary/20">
                        <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Cosmic Credential Vault
                        </h2>
                        <p className="text-xs text-gray-400 font-mono">Blockchain-Anchored Verification Layer</p>
                    </div>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 px-3 py-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    SECURE
                </Badge>
            </GlassHeader>

            <GlassContent className="space-y-6 z-10 relative">
                <div className="grid gap-4">
                    <AnimatePresence>
                        {credentials.map((cred) => (
                            <motion.div
                                key={cred.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 transition-all duration-300 rounded-lg p-4"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-4">
                                        <div className="mt-1">
                                            {cred.type === 'degree' ? (
                                                <div className="h-8 w-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-300 border border-blue-500/30">
                                                    <span className="text-xs font-bold">EDU</span>
                                                </div>
                                            ) : (
                                                <div className="h-8 w-8 rounded bg-purple-500/20 flex items-center justify-center text-purple-300 border border-purple-500/30">
                                                    <span className="text-xs font-bold">CERT</span>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-white font-medium group-hover:text-primary transition-colors">{cred.title}</h3>
                                            <p className="text-sm text-gray-400">{cred.issuer} • Issued {cred.date}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-0">
                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                            Verified
                                        </Badge>
                                    </div>
                                </div>
                                {/* Micro-interaction: Hash reveal on hover */}
                                <div className="absolute bottom-2 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                    <p className="text-[10px] font-mono text-primary/60 flex items-center gap-1">
                                        <LinkIcon className="w-3 h-3" />
                                        Block: #892...3F2
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {isVerifying && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-8 bg-white/5 rounded-lg border border-primary/20 border-dashed"
                    >
                        <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                        <p className="text-sm text-white font-medium">Validating with Issuer...</p>
                        <p className="text-xs text-gray-500 font-mono mt-1">Checking secure ledger...</p>
                    </motion.div>
                )}

                {!isVerifying && !showAddForm && (
                    <Button
                        onClick={() => setShowAddForm(true)}
                        variant="ghost"
                        className="w-full border border-dashed border-white/10 hover:border-primary/40 hover:bg-primary/5 text-gray-400 hover:text-primary h-14"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Credential
                    </Button>
                )}

                {showAddForm && !isVerifying && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-black/40 border border-white/10 rounded-lg p-4 space-y-4"
                    >
                        <div className="space-y-2">
                            <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Credential ID / URL</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    defaultValue="https://www.credly.com/badges/demo-id"
                                    className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 font-mono"
                                />
                                <Button onClick={handleSimulatedVerify} className="bg-primary text-black hover:bg-primary/90 font-bold">
                                    <UploadCloud className="w-4 h-4 mr-2" />
                                    Verify
                                </Button>
                            </div>
                            <p className="textxs text-gray-500">Supports Credly, Accredible, and major University data links.</p>
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 w-full" onClick={() => setShowAddForm(false)}>Cancel</Button>
                    </motion.div>
                )}

            </GlassContent>
        </GlassCard>
    );
}
