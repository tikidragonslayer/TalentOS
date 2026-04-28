// src/app/resources/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Library, Search, ExternalLink, Loader2 } from "lucide-react";
import type { LocalResource } from "@/types";
import { useState, useMemo } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query } from "firebase/firestore";

export default function LocalResourcesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");
  const firestore = useFirestore();

  const resourcesQuery = useMemoFirebase(() => {
      if(!firestore) return null;
      return query(collection(firestore, "localResources"));
  }, [firestore]);

  const { data: resources, isLoading } = useCollection<LocalResource>(resourcesQuery);

  const filteredResources = useMemo(() => {
    if (!resources) return [];
    return resources
      .filter(resource => selectedCategory === "all" || resource.category === selectedCategory)
      .filter(resource => resource.name.toLowerCase().includes(searchTerm.toLowerCase()) || resource.description.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [resources, selectedCategory, searchTerm]);

  const categories = useMemo(() => {
      if (!resources) return ["all"];
      return ["all", ...new Set(resources.map(r => r.category))];
  }, [resources]);


  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center justify-center">
          <Library className="mr-3 h-8 w-8" /> Local Resources
        </h1>
        <p className="text-muted-foreground">
          Discover training programs, career services, and community events to support your journey.
        </p>
      </div>

      <Card className="mb-8 shadow-md">
        <CardContent className="p-4 md:p-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-grow w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Search resources..." 
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category === "all" ? "All Categories" : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && filteredResources.length === 0 && (
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle>No Resources Found</CardTitle>
            <CardDescription>
              Try adjusting your search or filter. If you know of a helpful local resource, let us know!
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredResources.map((resource) => (
          <Card key={resource.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-primary">{resource.name}</CardTitle>
              <CardDescription className="text-sm text-accent">{resource.category}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm text-foreground/80 line-clamp-4 mb-2">{resource.description}</p>
              {resource.location && <p className="text-xs text-muted-foreground">Location: {resource.location}</p>}
            </CardContent>
            <CardContent className="pt-0 border-t mt-auto">
                <Button variant="outline" size="sm" asChild className="w-full mt-4">
                  <a href={resource.url} target="_blank" rel="noopener noreferrer">
                    Visit Website <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
