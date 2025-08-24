"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  SavedPattern,
  createSavedPattern,
} from "@/lib/pattern-storage";
import { Save, RefreshCw, Trash2, FileJson, Grid3X3, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

interface SavedPatternsManagerProps {
  currentPattern: boolean[];
  currentDurations: string[];
  currentBPM: number;
  onLoadPattern: (pattern: SavedPattern) => void;
  currentPatternId?: string | null;
  onPatternOverwritten?: () => void;
}

export function SavedPatternsManager({
  currentPattern,
  currentDurations,
  currentBPM,
  onLoadPattern,
  currentPatternId,
  onPatternOverwritten,
}: SavedPatternsManagerProps) {
  const [patterns, setPatterns] = useState<SavedPattern[]>([]);
  const [patternName, setPatternName] = useState("");
  const [patternDescription, setPatternDescription] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOverwriting, setIsOverwriting] = useState<string | null>(null);

  // Load patterns on mount
  useEffect(() => {
    loadPatterns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPatterns = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/patterns');
      const data = await response.json();
      if (data.patterns) {
        setPatterns(data.patterns);
      }
    } catch {
      toast.error("Failed to load patterns");
    } finally {
      setIsLoading(false);
    }
  };

  const savePattern = async () => {
    if (!patternName.trim()) {
      toast.error("Please enter a pattern name");
      return;
    }

    const newPattern = createSavedPattern(patternName, currentBPM, currentPattern, currentDurations);
    if (patternDescription.trim()) {
      newPattern.description = patternDescription;
    }

    try {
      const response = await fetch('/api/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: newPattern }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setPatterns(data.patterns);
        setPatternName("");
        setPatternDescription("");
        setIsDialogOpen(false);
        
        toast.success(`"${newPattern.name}" has been saved successfully`);
      } else {
        throw new Error('Failed to save pattern');
      }
    } catch {
      toast.error("Failed to save pattern to file");
    }
  };

  const overwritePattern = async (id: string) => {
    const existingPattern = patterns.find((p) => p.id === id);
    if (!existingPattern) return;

    setIsOverwriting(id);

    const updatedPattern = {
      ...existingPattern,
      pattern: currentPattern,
      durations: currentDurations,
      bpm: currentBPM,
      updatedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/patterns', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: updatedPattern }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setPatterns(data.patterns);
        onPatternOverwritten?.();
        toast.success(`"${existingPattern.name}" has been updated`);
      } else {
        throw new Error('Failed to overwrite pattern');
      }
    } catch {
      toast.error("Failed to overwrite pattern");
    } finally {
      setIsOverwriting(null);
    }
  };

  const deletePattern = async (id: string) => {
    const pattern = patterns.find((p) => p.id === id);
    
    try {
      const response = await fetch('/api/patterns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setPatterns(data.patterns);
        toast.success(`"${pattern?.name}" has been deleted`);
      } else {
        throw new Error('Failed to delete pattern');
      }
    } catch {
      toast.error("Failed to delete pattern from file");
    }
  };


  const formatPattern = (pattern: boolean[]) => {
    const totalBeats = pattern.length;
    const activeBeats = pattern.filter(Boolean).length;
    return `${activeBeats}/${totalBeats} beats`;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Save className="mr-2 h-4 w-4" />
              Save Current Pattern
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Pattern</DialogTitle>
              <DialogDescription>
                Save your current 2-bar pattern for later use
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="pattern-name">Pattern Name</Label>
                <Input
                  id="pattern-name"
                  value={patternName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatternName(e.target.value)}
                  placeholder="e.g., Rock Beat 1"
                />
              </div>
              <div>
                <Label htmlFor="pattern-description">Description (optional)</Label>
                <Textarea
                  id="pattern-description"
                  value={patternDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPatternDescription(e.target.value)}
                  placeholder="Describe your pattern..."
                  rows={3}
                />
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>BPM: {currentBPM}</span>
                <span>{formatPattern(currentPattern)}</span>
              </div>
              <Button onClick={savePattern} className="w-full">
                Save Pattern
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button onClick={loadPatterns} variant="outline" disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {patterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saved Patterns</CardTitle>
            <CardDescription>
              {patterns.length} pattern{patterns.length !== 1 ? "s" : ""} saved
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {patterns.map((pattern) => (
                  <Card key={pattern.id} className="p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{pattern.name}</h4>
                          <Badge variant="secondary">{pattern.bpm} BPM</Badge>
                          <Badge variant="outline">
                            <Grid3X3 className="mr-1 h-3 w-3" />
                            {formatPattern(pattern.pattern)}
                          </Badge>
                        </div>
                        {pattern.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {pattern.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(pattern.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => onLoadPattern(pattern)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Load
                        </Button>
                        {currentPatternId === pattern.id && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => overwritePattern(pattern.id)}
                            disabled={isOverwriting === pattern.id}
                          >
                            {isOverwriting === pattern.id ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3 mr-1" />
                            )}
                            Overwrite
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deletePattern(pattern.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {patterns.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <FileJson className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-center">
              No saved patterns yet.<br />
              Create and save your first pattern!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}