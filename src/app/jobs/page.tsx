
// src/app/jobs/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Search, MapPin, ExternalLink, Loader2 } from "lucide-react";
import type { JobPosting } from "@/types";
import { useState, useMemo } from "react";
import { useUser } from "@/contexts/user-context";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Label } from "@/components/ui/label";

export default function PublicJobsPage() {
  const { setRole } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");

  // Fetch only open jobs
  const jobsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "jobListings"), where("status", "==", "open"));
  }, [firestore]);

  const { data: jobs, isLoading } = useCollection<JobPosting>(jobsQuery);

  const filteredAndSortedJobs = useMemo(() => {
    if (!jobs) return [];

    let filtered = jobs.filter((job: JobPosting) =>
      job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.anonymizedDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.requirements?.some((r: string) => r.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (sortOrder === "newest") {
      filtered.sort((a: JobPosting, b: JobPosting) => new Date(b.postedAt || b.jobPostedDate!).getTime() - new Date(a.postedAt || a.jobPostedDate!).getTime());
    } else if (sortOrder === "oldest") {
      filtered.sort((a: JobPosting, b: JobPosting) => new Date(a.postedAt || a.jobPostedDate!).getTime() - new Date(b.postedAt || b.jobPostedDate!).getTime());
    }

    return filtered;
  }, [jobs, searchTerm, sortOrder]);

  const handleApply = () => {
    setRole('candidate');
    // The user context and app shell will handle redirection logic
  }

  const getDisplayLocation = (location: string) => {
    if (!location) return "Not Specified";
    if (location.toLowerCase().includes('remote')) {
      return location;
    }
    // For non-remote jobs, return a generic location.
    const parts = location.split(',');
    const state = parts.length > 1 ? parts[parts.length - 1].trim() : 'ST';
    return `Metro Area, ${state}`;
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto py-8">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-bold text-primary flex items-center justify-center">
            <Briefcase className="mr-3 h-10 w-10" /> Public Job Board
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            These are real, strategic opportunities from companies hiring in stealth mode. Explore what's possible.
          </p>
        </header>

        <Card className="mb-8 shadow-md sticky top-4 z-10 backdrop-blur-sm bg-background/80">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-grow w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by title, skill, or keyword..."
                className="pl-10 w-full h-12 text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-auto flex items-center gap-4">
              <Label htmlFor="sort-order" className="text-sm font-medium whitespace-nowrap">Sort by:</Label>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger id="sort-order" className="w-full md:w-[180px] h-12">
                  <SelectValue placeholder="Sort order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Loading active opportunities...</p>
          </div>
        ) : filteredAndSortedJobs.length === 0 ? (
          <Card className="text-center py-16">
            <CardHeader>
              <CardTitle>No Opportunities Match Your Search</CardTitle>
              <CardDescription>
                Try broadening your search terms. New stealth jobs are posted regularly.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredAndSortedJobs.map((job) => (
              <Card key={job.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className="flex flex-col md:flex-row justify-between md:items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-2xl font-semibold text-primary">{job.title}</CardTitle>
                        {job.bonusAmount && job.bonusAmount > 0 && (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                            ${job.bonusAmount.toLocaleString()} Sign-On Bonus
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <MapPin className="h-4 w-4 mr-1.5" />
                        {getDisplayLocation(job.location!)}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-sm py-1 px-3">
                      Posted on {new Date(job.postedAt || job.jobPostedDate!).toLocaleDateString()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/80 mb-4">{job.anonymizedDescription}</p>
                  <div className="flex flex-wrap gap-2">
                    {job.requirements?.map(req => (
                      <Badge key={req} variant="outline">{req}</Badge>
                    ))}
                    {job.skills?.map(skill => (
                      <Badge key={skill} variant="outline" className="border-primary/20 bg-primary/5">{skill}</Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="bg-secondary/50 p-4 flex justify-between items-center">
                  <p className="text-sm text-secondary-foreground font-medium">Interested in opportunities like this?</p>
                  <Button onClick={handleApply}>
                    Sign Up & See Matches <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
