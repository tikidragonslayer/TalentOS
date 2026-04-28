'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Briefcase, Zap, ShieldCheck } from "lucide-react";
import type { JobPostingSnapshot } from "@/types";

interface JobDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: () => void;
    jobSnapshot: JobPostingSnapshot;
}

export function JobDetailsModal({ isOpen, onClose, onConnect, jobSnapshot }: JobDetailsModalProps) {
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-background/95 backdrop-blur border-primary/20 text-foreground">
                <DialogHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-bold text-primary mb-1">{jobSnapshot.title}</DialogTitle>
                            <DialogDescription className="text-muted-foreground flex items-center gap-2">
                                <Briefcase className="h-4 w-4" />
                                {jobSnapshot.anonymizedCompanyName || "Confidential Company"}
                            </DialogDescription>
                        </div>
                        {jobSnapshot.maxSalary && (
                            <Badge variant="outline" className="text-green-500 border-green-500/50">
                                {jobSnapshot.minSalary ? `$${jobSnapshot.minSalary.toLocaleString()} - ` : ''}
                                ${jobSnapshot.maxSalary.toLocaleString()}
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-6">
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-primary" />
                                {jobSnapshot.location}
                            </div>
                            <div className="flex items-center gap-1">
                                <Zap className="h-4 w-4 text-primary" />
                                {jobSnapshot.hiringMode ? jobSnapshot.hiringMode.charAt(0).toUpperCase() + jobSnapshot.hiringMode.slice(1) : 'Location-based'}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-primary" /> Role Overview
                            </h4>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                {jobSnapshot.anonymizedDescription}
                            </p>
                        </div>

                        {jobSnapshot.idealCandidateMbti && (
                            <div className="space-y-2">
                                <h4 className="font-semibold text-foreground">Ideal Archetype</h4>
                                <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                    {jobSnapshot.idealCandidateMbti}
                                </Badge>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
                        Close
                    </Button>
                    <Button onClick={onConnect} className="w-full sm:w-auto bg-primary text-black hover:bg-primary/90 font-bold">
                        Request Handshake
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
