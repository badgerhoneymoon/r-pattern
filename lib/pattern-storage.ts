export interface SavedPattern {
  id: string;
  name: string;
  bpm: number;
  pattern: boolean[];  // 32 boolean values for note on/off
  durations: string[]; // 32 duration values ('16th', '8th', 'quarter')
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  description?: string;
}

export interface PatternExport {
  version: "1.0";
  patterns: SavedPattern[];
  exportedAt: string;
}

export function createPatternId(): string {
  return `pattern_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function createSavedPattern(
  name: string,
  bpm: number,
  pattern: boolean[],
  durations: string[]
): SavedPattern {
  const now = new Date().toISOString();
  return {
    id: createPatternId(),
    name,
    bpm,
    pattern,
    durations,
    createdAt: now,
    updatedAt: now,
  };
}

export function exportPatternsToJSON(patterns: SavedPattern[]): string {
  const exportData: PatternExport = {
    version: "1.0",
    patterns,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(exportData, null, 2);
}

export function importPatternsFromJSON(jsonString: string): SavedPattern[] {
  try {
    const data = JSON.parse(jsonString) as PatternExport;
    if (data.version !== "1.0") {
      throw new Error("Unsupported export version");
    }
    return data.patterns;
  } catch (error) {
    throw new Error(`Failed to import patterns: ${error instanceof Error ? error.message : "Invalid JSON"}`);
  }
}

export function downloadJSON(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}