import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { SavedPattern, PatternExport } from '@/lib/pattern-storage';

const PATTERNS_FILE = path.join(process.cwd(), 'data', 'patterns.json');
const PATTERNS_DIR = path.join(process.cwd(), 'data');

async function ensureDataDirectory() {
  try {
    await fs.access(PATTERNS_DIR);
  } catch {
    await fs.mkdir(PATTERNS_DIR, { recursive: true });
  }
}

async function readPatterns(): Promise<SavedPattern[]> {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(PATTERNS_FILE, 'utf-8');
    const parsed = JSON.parse(data) as PatternExport;
    return parsed.patterns;
  } catch {
    // File doesn't exist or is invalid, return empty array
    return [];
  }
}

async function writePatterns(patterns: SavedPattern[]): Promise<void> {
  await ensureDataDirectory();
  const exportData: PatternExport = {
    version: "1.0",
    patterns,
    exportedAt: new Date().toISOString(),
  };
  // Use compact JSON formatting
  await fs.writeFile(PATTERNS_FILE, JSON.stringify(exportData));
}

export async function GET() {
  try {
    const patterns = await readPatterns();
    return NextResponse.json({ patterns });
  } catch {
    return NextResponse.json(
      { error: 'Failed to read patterns' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pattern } = await request.json();
    const patterns = await readPatterns();
    patterns.push(pattern);
    await writePatterns(patterns);
    return NextResponse.json({ success: true, patterns });
  } catch {
    return NextResponse.json(
      { error: 'Failed to save pattern' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { pattern, patterns } = await request.json();
    
    if (pattern) {
      // Update a single pattern
      const allPatterns = await readPatterns();
      const index = allPatterns.findIndex(p => p.id === pattern.id);
      if (index !== -1) {
        allPatterns[index] = pattern;
        await writePatterns(allPatterns);
        return NextResponse.json({ success: true, patterns: allPatterns });
      } else {
        return NextResponse.json(
          { error: 'Pattern not found' },
          { status: 404 }
        );
      }
    } else if (patterns) {
      // Update all patterns
      await writePatterns(patterns);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to update patterns' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    const patterns = await readPatterns();
    const filtered = patterns.filter(p => p.id !== id);
    await writePatterns(filtered);
    return NextResponse.json({ success: true, patterns: filtered });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete pattern' },
      { status: 500 }
    );
  }
}