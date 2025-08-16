"use client"

import { useRef, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3 } from "lucide-react"
import { AnalysisResult } from "./guitar-rhythm-analyzer"

interface RhythmGridProps {
  analysisResult: AnalysisResult | null
}

export function RhythmGrid({ analysisResult }: RhythmGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const gridData = useMemo(() => {
    if (!analysisResult || analysisResult.onsets.length === 0) {
      return null
    }

    const { onsets, estimatedBPM, duration } = analysisResult
    const displayDuration = Math.min(duration, 10) // Show max 10 seconds
    
    // Calculate grid parameters
    const beatsPerSecond = (estimatedBPM || 120) / 60
    const secondsPerBeat = 1 / beatsPerSecond
    
    // Generate beat markers
    const beatMarkers = []
    for (let beat = 0; beat * secondsPerBeat < displayDuration; beat++) {
      const beatTime = beat * secondsPerBeat
      const isDownbeat = beat % 4 === 0
      
      beatMarkers.push({
        time: beatTime,
        beat: beat + 1,
        isDownbeat,
        measure: Math.floor(beat / 4) + 1
      })
    }
    
    // Filter onsets to display duration
    const visibleOnsets = onsets.filter(onset => onset.time <= displayDuration)
    
    return {
      beatMarkers,
      onsets: visibleOnsets,
      duration: displayDuration,
      beatsPerSecond,
      secondsPerBeat
    }
  }, [analysisResult])

  const renderGrid = () => {
    if (!gridData || !containerRef.current) return null

    const containerWidth = containerRef.current.offsetWidth - 40 // Account for padding
    const pixelsPerSecond = containerWidth / gridData.duration

    return (
      <div className="relative min-h-[200px] bg-white rounded-lg border overflow-x-auto">
        <div className="relative h-full p-5" style={{ minWidth: `${containerWidth}px` }}>
          {/* Beat grid lines */}
          {gridData.beatMarkers.map((marker) => {
            const xPos = marker.time * pixelsPerSecond
            return (
              <div key={`beat-${marker.time}`} className="absolute top-0 h-full">
                {/* Beat line */}
                <div
                  className={`absolute top-6 h-32 ${
                    marker.isDownbeat 
                      ? 'w-0.5 bg-gray-400' 
                      : 'w-px bg-gray-300'
                  }`}
                  style={{ left: `${xPos}px` }}
                />
                
                {/* Beat number */}
                {marker.isDownbeat && (
                  <div
                    className="absolute top-0 text-xs text-gray-600 transform -translate-x-1/2"
                    style={{ left: `${xPos}px` }}
                  >
                    {marker.measure}
                  </div>
                )}
              </div>
            )
          })}
          
          {/* Note markers */}
          {gridData.onsets.map((onset, index) => {
            const xPos = onset.time * pixelsPerSecond
            return (
              <div key={`onset-${index}`} className="absolute">
                {/* Note line */}
                <div
                  className="absolute top-8 w-0.5 h-20 bg-gradient-to-b from-transparent via-blue-500 to-transparent"
                  style={{ left: `${xPos}px` }}
                />
                
                {/* Note marker */}
                <div
                  className="absolute top-16 w-3 h-3 bg-blue-500 rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 hover:bg-blue-600 transition-colors cursor-pointer"
                  style={{ left: `${xPos}px` }}
                  title={`Note ${onset.index + 1} at ${onset.time.toFixed(2)}s`}
                />
              </div>
            )
          })}
          
          {/* Time markers */}
          <div className="absolute bottom-0 left-0 right-0 h-6 border-t border-gray-200">
            {Array.from({ length: Math.ceil(gridData.duration) + 1 }, (_, i) => {
              const xPos = i * pixelsPerSecond
              return (
                <div
                  key={`time-${i}`}
                  className="absolute bottom-0 text-xs text-gray-500 transform -translate-x-1/2"
                  style={{ left: `${xPos}px` }}
                >
                  {i}s
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderStats = () => {
    if (!analysisResult || analysisResult.onsets.length === 0) return null

    const { onsets, estimatedBPM } = analysisResult
    const avgInterval = onsets.length > 1 ? 
      onsets.slice(1).reduce((sum, onset, i) => sum + (onset.time - onsets[i].time), 0) / (onsets.length - 1) : 0

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{onsets.length}</div>
          <div className="text-sm text-muted-foreground">Notes Detected</div>
        </div>
        
        {estimatedBPM && (
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{estimatedBPM}</div>
            <div className="text-sm text-muted-foreground">BPM</div>
          </div>
        )}
        
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{avgInterval.toFixed(2)}s</div>
          <div className="text-sm text-muted-foreground">Avg Interval</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">{analysisResult.duration.toFixed(1)}s</div>
          <div className="text-sm text-muted-foreground">Duration</div>
        </div>
      </div>
    )
  }

  const renderOnsetList = () => {
    if (!analysisResult || analysisResult.onsets.length === 0) return null

    return (
      <div className="mt-6">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Note Timing Details
        </h4>
        <div className="grid gap-2 max-h-32 overflow-y-auto">
          {analysisResult.onsets.slice(0, 10).map((onset) => (
            <div 
              key={onset.index} 
              className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
            >
              <Badge variant="outline">Note {onset.index + 1}</Badge>
              <span className="font-mono">{onset.time.toFixed(3)}s</span>
            </div>
          ))}
          {analysisResult.onsets.length > 10 && (
            <div className="text-center text-sm text-muted-foreground">
              ... and {analysisResult.onsets.length - 10} more notes
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Rhythmic Pattern
        </CardTitle>
        <CardDescription>
          Visual representation of detected notes on a time grid
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={containerRef}>
          {analysisResult && analysisResult.onsets.length > 0 ? (
            <>
              {renderGrid()}
              {renderStats()}
              {renderOnsetList()}
            </>
          ) : (
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Rhythm Data</h3>
              <p className="text-gray-500">
                Record and analyze your guitar playing to see the rhythmic pattern here
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}