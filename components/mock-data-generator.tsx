"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TestTube, Music } from "lucide-react"
import { OnsetData, AnalysisResult } from "./guitar-rhythm-analyzer"

interface MockDataGeneratorProps {
  onMockDataGenerated: (audioBuffer: AudioBuffer, analysisResult: AnalysisResult) => void
}

export function MockDataGenerator({ onMockDataGenerated }: MockDataGeneratorProps) {
  const mockPatterns = [
    {
      name: "Basic Rock Beat",
      description: "Simple 4/4 rock pattern",
      bpm: 120,
      pattern: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], // 8th notes for 1 measure
      style: "rock"
    },
    {
      name: "Funk Rhythm",
      description: "Syncopated funk groove",
      bpm: 110,
      pattern: [0, 0.25, 0.75, 1, 1.25, 1.75, 2, 2.25, 2.75, 3, 3.25, 3.75], // 16th note funk
      style: "funk"
    },
    {
      name: "Fast Metal",
      description: "Aggressive palm-muted pattern",
      bpm: 160,
      pattern: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75],
      style: "metal"
    },
    {
      name: "Slow Blues",
      description: "Relaxed blues shuffle",
      bpm: 80,
      pattern: [0, 0.67, 1.33, 2, 2.67, 3.33], // Triplet feel
      style: "blues"
    },
    {
      name: "Latin Pattern",
      description: "Bossa nova inspired",
      bpm: 130,
      pattern: [0, 0.5, 1, 1.25, 1.75, 2, 2.5, 3, 3.25, 3.75],
      style: "latin"
    },
    {
      name: "Irregular Timing",
      description: "Complex polyrhythmic pattern",
      bpm: 140,
      pattern: [0, 0.4, 0.9, 1.3, 1.8, 2.2, 2.7, 3.1, 3.6], // Irregular spacing
      style: "progressive"
    }
  ]

  const generateMockAudioBuffer = (pattern: number[], bpm: number): AudioBuffer => {
    const audioContext = new (window.AudioContext || (window as unknown as typeof AudioContext))()
    const sampleRate = 44100
    const duration = 4 // 4 seconds for one measure
    const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate)
    const channelData = buffer.getChannelData(0)

    // Generate simple waveform with note attacks at specified times
    const beatsPerSecond = bpm / 60
    const secondsPerBeat = 1 / beatsPerSecond
    
    pattern.forEach(beatTime => {
      const timeInSeconds = beatTime * secondsPerBeat
      const sampleIndex = Math.floor(timeInSeconds * sampleRate)
      
      // Create a short "attack" sound - sharp rise and decay
      for (let i = 0; i < 2000; i++) { // ~45ms attack
        if (sampleIndex + i < channelData.length) {
          const t = i / 2000
          const envelope = Math.exp(-t * 5) // Exponential decay
          const frequency = 220 // A3 note
          const sample = Math.sin(2 * Math.PI * frequency * (sampleIndex + i) / sampleRate) * envelope * 0.3
          channelData[sampleIndex + i] = sample
        }
      }
    })

    return buffer
  }

  const generateAnalysisResult = (pattern: number[], bpm: number): AnalysisResult => {
    const beatsPerSecond = bpm / 60
    const secondsPerBeat = 1 / beatsPerSecond
    
    const onsets: OnsetData[] = pattern.map((beatTime, index) => ({
      time: beatTime * secondsPerBeat,
      index
    }))

    return {
      onsets,
      estimatedBPM: bpm,
      duration: 4
    }
  }

  const handlePatternClick = (patternData: typeof mockPatterns[0]) => {
    try {
      const mockAudioBuffer = generateMockAudioBuffer(patternData.pattern, patternData.bpm)
      const analysisResult = generateAnalysisResult(patternData.pattern, patternData.bpm)
      onMockDataGenerated(mockAudioBuffer, analysisResult)
    } catch (error) {
      console.error('Error generating mock data:', error)
    }
  }

  const getStyleColor = (style: string) => {
    const colors: Record<string, string> = {
      rock: "bg-red-100 text-red-800",
      funk: "bg-purple-100 text-purple-800",
      metal: "bg-gray-100 text-gray-800",
      blues: "bg-blue-100 text-blue-800",
      latin: "bg-yellow-100 text-yellow-800",
      progressive: "bg-green-100 text-green-800"
    }
    return colors[style] || "bg-gray-100 text-gray-800"
  }

  return (
    <Card className="border-dashed border-2 border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <TestTube className="h-5 w-5" />
          Test with Mock Data
        </CardTitle>
        <CardDescription className="text-orange-700">
          Try different rhythm patterns without recording audio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {mockPatterns.map((pattern, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-auto p-4 flex flex-col items-start gap-2"
              onClick={() => handlePatternClick(pattern)}
            >
              <div className="flex items-center gap-2 w-full">
                <Music className="h-4 w-4" />
                <span className="font-medium text-left">{pattern.name}</span>
              </div>
              
              <div className="text-xs text-muted-foreground text-left">
                {pattern.description}
              </div>
              
              <div className="flex items-center gap-2 w-full">
                <Badge variant="secondary" className="text-xs">
                  {pattern.bpm} BPM
                </Badge>
                <Badge className={`text-xs ${getStyleColor(pattern.style)}`}>
                  {pattern.style}
                </Badge>
              </div>
              
              <div className="text-xs text-muted-foreground">
                {pattern.pattern.length} notes
              </div>
            </Button>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-orange-100 border border-orange-200 rounded-lg">
          <div className="text-sm text-orange-800">
            <strong>💡 Testing Tip:</strong> Click any pattern above to instantly see how the rhythm analysis works. 
            Perfect for testing the interface before recording real guitar audio!
          </div>
        </div>
      </CardContent>
    </Card>
  )
}