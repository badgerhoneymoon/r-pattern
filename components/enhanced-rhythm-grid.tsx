"use client"

import { useRef, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, Music } from "lucide-react"
import { AnalysisResult } from "./guitar-rhythm-analyzer"

interface EnhancedRhythmGridProps {
  analysisResult: AnalysisResult | null
}

type SubdivisionLevel = '16th' | '8th' | 'quarter' | 'half'

interface GridLine {
  time: number
  type: 'measure' | 'beat' | 'eighth' | 'sixteenth'
  subdivision: number // Which subdivision within the beat (0, 1, 2, 3 for 16ths)
  beat: number // Which beat (1, 2, 3, 4)
  measure: number // Which measure
}

export function EnhancedRhythmGrid({ analysisResult }: EnhancedRhythmGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedSubdivision, setSelectedSubdivision] = useState<SubdivisionLevel>('16th')

  const gridData = useMemo(() => {
    if (!analysisResult || analysisResult.onsets.length === 0) {
      return null
    }

    const { onsets, estimatedBPM, duration } = analysisResult
    const displayDuration = Math.min(duration, 8) // Show max 8 seconds for better detail
    
    // Calculate timing
    const beatsPerSecond = (estimatedBPM || 120) / 60
    const secondsPerBeat = 1 / beatsPerSecond
    const secondsPerSixteenth = secondsPerBeat / 4
    
    // Generate all grid lines
    const gridLines: GridLine[] = []
    
    // Calculate how many measures to show
    const totalBeats = Math.ceil(displayDuration * beatsPerSecond)
    const totalMeasures = Math.ceil(totalBeats / 4)
    
    for (let measure = 0; measure < totalMeasures; measure++) {
      for (let beat = 0; beat < 4; beat++) { // 4/4 time signature
        for (let sixteenth = 0; sixteenth < 4; sixteenth++) {
          const time = (measure * 4 + beat) * secondsPerBeat + sixteenth * secondsPerSixteenth
          
          if (time >= displayDuration) break
          
          let type: GridLine['type']
          if (sixteenth === 0 && beat === 0) {
            type = 'measure'
          } else if (sixteenth === 0) {
            type = 'beat'
          } else if (sixteenth === 2) {
            type = 'eighth'
          } else {
            type = 'sixteenth'
          }
          
          gridLines.push({
            time,
            type,
            subdivision: sixteenth,
            beat: beat + 1,
            measure: measure + 1
          })
        }
      }
    }
    
    // Filter onsets to display duration
    const visibleOnsets = onsets.filter(onset => onset.time <= displayDuration)
    
    // Analyze timing - check if notes are on 16th grid or triplets
    const analyzedOnsets = visibleOnsets.map(onset => {
      // Check 16th note grid alignment
      const nearestSixteenth = Math.round(onset.time / secondsPerSixteenth) * secondsPerSixteenth
      const sixteenthDeviation = Math.abs(onset.time - nearestSixteenth)
      
      // Check triplet alignment (3 notes per beat)
      const secondsPerTriplet = secondsPerBeat / 3
      const nearestTriplet = Math.round(onset.time / secondsPerTriplet) * secondsPerTriplet
      const tripletDeviation = Math.abs(onset.time - nearestTriplet)
      
      // Threshold for "on beat" (20ms tolerance)
      const tolerance = 0.02
      
      const isOnSixteenth = sixteenthDeviation < tolerance
      const isOnTriplet = tripletDeviation < tolerance
      
      return {
        ...onset,
        isOnBeat: isOnSixteenth || isOnTriplet,
        isOnSixteenth,
        isOnTriplet,
        sixteenthDeviation,
        tripletDeviation,
        bestAlignment: sixteenthDeviation < tripletDeviation ? 'sixteenth' : 'triplet'
      }
    })
    
    return {
      gridLines,
      onsets: analyzedOnsets,
      duration: displayDuration,
      beatsPerSecond,
      secondsPerBeat,
      secondsPerSixteenth,
      totalMeasures
    }
  }, [analysisResult])

  const getSubdivisionLines = (subdivision: SubdivisionLevel) => {
    if (!gridData) return []
    
    switch (subdivision) {
      case '16th':
        return gridData.gridLines
      case '8th':
        return gridData.gridLines.filter(line => 
          line.type === 'measure' || line.type === 'beat' || line.type === 'eighth'
        )
      case 'quarter':
        return gridData.gridLines.filter(line => 
          line.type === 'measure' || line.type === 'beat'
        )
      case 'half':
        return gridData.gridLines.filter(line => 
          line.type === 'measure' || (line.type === 'beat' && (line.beat === 1 || line.beat === 3))
        )
      default:
        return gridData.gridLines
    }
  }

  const renderGrid = () => {
    if (!gridData || !containerRef.current) return null

    const containerWidth = containerRef.current.offsetWidth - 80 // Account for padding and labels
    const pixelsPerSecond = containerWidth / gridData.duration
    const lines = getSubdivisionLines(selectedSubdivision)

    return (
      <div className="relative min-h-[300px] bg-white rounded-lg border overflow-x-auto">
        <div className="relative h-full" style={{ minWidth: `${containerWidth + 80}px` }}>
          
          {/* Measure numbers at top */}
          <div className="absolute top-0 left-0 right-0 h-8 bg-gray-50 border-b flex items-center">
            {Array.from({ length: gridData.totalMeasures }, (_, i) => {
              const measureTime = i * 4 * gridData.secondsPerBeat
              const xPos = measureTime * pixelsPerSecond + 40
              return (
                <div
                  key={`measure-label-${i}`}
                  className="absolute text-sm font-bold text-gray-700"
                  style={{ left: `${xPos}px` }}
                >
                  {i + 1}
                </div>
              )
            })}
          </div>

          {/* Subdivision labels */}
          <div className="absolute top-8 left-0 right-0 h-6 bg-gray-25 border-b flex items-center">
            {lines.map((line, index) => {
              const xPos = line.time * pixelsPerSecond + 40
              let label = ''
              
              if (selectedSubdivision === '16th') {
                // 16th note labels: 1, 1e, 1+, 1a, 2, 2e, 2+, 2a, etc.
                const subdivisionNames = ['', 'e', '+', 'a']
                if (line.type === 'measure' || line.type === 'beat') {
                  label = line.beat.toString()
                } else if (line.type === 'eighth') {
                  label = line.beat + '+'
                } else if (line.type === 'sixteenth') {
                  label = line.beat + subdivisionNames[line.subdivision]
                }
              } else if (selectedSubdivision === '8th') {
                // 8th note labels: 1, 1+, 2, 2+, etc.
                if (line.type === 'measure' || line.type === 'beat') {
                  label = line.beat.toString()
                } else if (line.type === 'eighth') {
                  label = line.beat + '+'
                }
              } else if (selectedSubdivision === 'quarter') {
                // Quarter note labels: 1, 2, 3, 4
                if (line.type === 'measure' || line.type === 'beat') {
                  label = line.beat.toString()
                }
              } else if (selectedSubdivision === 'half') {
                // Half note labels: 1, 3 (strong beats)
                if ((line.type === 'measure' || line.type === 'beat') && (line.beat === 1 || line.beat === 3)) {
                  label = line.beat.toString()
                }
              }
              
              // Check if there's a note near this subdivision
              const hasNoteNear = gridData.onsets.some(onset => {
                const onsetPos = onset.time * pixelsPerSecond + 40
                return Math.abs(onsetPos - xPos) < 8 // Within 8 pixels
              })
              
              return label ? (
                <div
                  key={`subdivision-label-${index}`}
                  className={`absolute text-xs transform -translate-x-1/2 ${
                    hasNoteNear 
                      ? 'text-green-700 font-bold bg-green-100 px-2 py-1 rounded border-2 border-green-400 shadow-lg' 
                      : line.type === 'measure' || line.type === 'beat' 
                        ? 'text-gray-800 font-semibold' 
                        : 'text-gray-500'
                  }`}
                  style={{ left: `${xPos}px` }}
                >
                  {label}
                </div>
              ) : null
            })}
          </div>

          {/* Grid lines */}
          {lines.map((line, index) => {
            const xPos = line.time * pixelsPerSecond + 40
            
            const lineStyle = "absolute top-14 h-44"
            let lineWidth = "w-px"
            let lineColor = "bg-gray-200"
            
            switch (line.type) {
              case 'measure':
                lineWidth = "w-1"
                lineColor = "bg-gray-800"
                break
              case 'beat':
                lineWidth = "w-0.5"
                lineColor = "bg-gray-600"
                break
              case 'eighth':
                lineColor = "bg-gray-400"
                break
              case 'sixteenth':
                lineColor = "bg-gray-300"
                break
            }
            
            return (
              <div
                key={`grid-line-${index}`}
                className={`${lineStyle} ${lineWidth} ${lineColor}`}
                style={{ left: `${xPos}px` }}
              />
            )
          })}
          
          
          {/* Note markers */}
          {gridData.onsets.map((onset, index) => {
            const xPos = onset.time * pixelsPerSecond + 40
            
            // Determine colors based on timing analysis
            const isOffBeat = !onset.isOnBeat
            const isOnTriplet = onset.isOnTriplet && !onset.isOnSixteenth
            
            let lineColors, markerColors, labelColor
            if (isOffBeat) {
              // Red for off-beat notes
              lineColors = "from-red-400 via-red-500 to-red-400"
              markerColors = "from-red-400 to-red-600"
              labelColor = "text-red-700"
            } else if (isOnTriplet) {
              // Blue for triplet notes
              lineColors = "from-blue-400 via-blue-500 to-blue-400"
              markerColors = "from-blue-400 to-blue-600"
              labelColor = "text-blue-700"
            } else {
              // Green for on-beat 16th notes
              lineColors = "from-green-400 via-green-500 to-green-400"
              markerColors = "from-green-400 to-green-600"
              labelColor = "text-green-700"
            }
            
            // Calculate musical weight/strength of this position
            const getMusicalWeight = () => {
              if (isOffBeat) return 20 // Short for off-beat notes
              
              // Find the closest grid position to determine musical strength
              const nearestSixteenth = Math.round(onset.time / gridData.secondsPerSixteenth) * gridData.secondsPerSixteenth
              const beatTime = Math.floor(nearestSixteenth / gridData.secondsPerBeat) * gridData.secondsPerBeat
              const offsetInBeat = nearestSixteenth - beatTime
              const sixteenthPosition = Math.round(offsetInBeat / gridData.secondsPerSixteenth)
              
              // Musical hierarchy based on subdivision strength
              switch (sixteenthPosition % 4) {
                case 0: return 50 // Quarter notes (1, 2, 3, 4) - strongest
                case 2: return 40 // 8th note "+" positions (1+, 2+, 3+, 4+) - medium
                case 1: return 30 // "e" positions (1e, 2e, 3e, 4e) - weaker
                case 3: return 25 // "a" positions (1a, 2a, 3a, 4a) - weakest
                default: return 30
              }
            }
            
            const lineHeight = getMusicalWeight()
            
            return (
              <div key={`onset-${index}`} className="absolute">
                {/* Note line - height based on musical weight */}
                <div
                  className={`absolute top-36 w-2 bg-gradient-to-b ${lineColors} shadow-xl rounded-full transform -translate-x-1/2 -translate-y-1/2`}
                  style={{ 
                    left: `${xPos}px`,
                    height: `${lineHeight}px`
                  }}
                />
                
                {/* Note marker - color coded */}
                <div
                  className={`absolute top-36 w-5 h-5 bg-gradient-to-br ${markerColors} rounded-full shadow-xl transform -translate-x-1/2 -translate-y-1/2 cursor-pointer border-2 border-white`}
                  style={{ left: `${xPos}px` }}
                  title={`Note ${onset.index + 1} at ${onset.time.toFixed(3)}s\n${
                    isOffBeat 
                      ? `Off-beat! Deviation: ${Math.min(onset.sixteenthDeviation, onset.tripletDeviation) * 1000}ms` 
                      : isOnTriplet 
                        ? `On triplet (${onset.tripletDeviation * 1000}ms deviation)` 
                        : `On 16th grid (${onset.sixteenthDeviation * 1000}ms deviation)`
                  }`}
                />
                
                {/* Timing indicator label */}
                <div
                  className={`absolute top-48 text-xs font-bold ${labelColor} bg-white px-1 rounded border shadow-sm transform -translate-x-1/2`}
                  style={{ left: `${xPos}px` }}
                >
                  {isOffBeat ? '⚠️' : isOnTriplet ? '3' : '✓'}
                </div>
              </div>
            )
          })}
          
          {/* Time markers at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-6 border-t bg-gray-50 flex items-center">
            {Array.from({ length: Math.ceil(gridData.duration) + 1 }, (_, i) => {
              const xPos = i * pixelsPerSecond + 40
              return (
                <div
                  key={`time-${i}`}
                  className="absolute bottom-0 text-xs text-gray-500"
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

  const renderControls = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="flex gap-1">
        {(['16th', '8th', 'quarter', 'half'] as SubdivisionLevel[]).map((level) => (
          <Button
            key={level}
            variant={selectedSubdivision === level ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSubdivision(level)}
          >
            {level}
          </Button>
        ))}
      </div>
    </div>
  )

  const renderStats = () => {
    if (!analysisResult || analysisResult.onsets.length === 0 || !gridData) return null

    const onBeatNotes = gridData.onsets.filter(onset => onset.isOnBeat).length
    const tripletNotes = gridData.onsets.filter(onset => onset.isOnTriplet && !onset.isOnSixteenth).length
    const offBeatNotes = gridData.onsets.filter(onset => !onset.isOnBeat).length
    const timingAccuracy = (onBeatNotes / gridData.onsets.length) * 100

    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{analysisResult.onsets.length}</div>
          <div className="text-sm text-muted-foreground">Total Notes</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{timingAccuracy.toFixed(0)}%</div>
          <div className="text-sm text-muted-foreground">On Beat</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{tripletNotes}</div>
          <div className="text-sm text-muted-foreground">Triplets</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{offBeatNotes}</div>
          <div className="text-sm text-muted-foreground">Off Beat</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{analysisResult.estimatedBPM}</div>
          <div className="text-sm text-muted-foreground">BPM</div>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Enhanced Rhythm Grid
        </CardTitle>
        <CardDescription>
          Detailed musical subdivision grid with quantization analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={containerRef}>
          {analysisResult && analysisResult.onsets.length > 0 ? (
            <>
              {renderControls()}
              {renderGrid()}
              {renderStats()}
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <Music className="h-4 w-4" />
                  Grid Legend
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
                  <div>• <strong>Thick black lines:</strong> Measure boundaries</div>
                  <div>• <strong>Medium gray lines:</strong> Beat boundaries (1, 2, 3, 4)</div>
                  <div>• <strong>Thin gray lines:</strong> 8th note subdivisions</div>
                  <div>• <strong>Light gray lines:</strong> 16th note subdivisions</div>
                  <div>• <strong>🟢 Green markers (✓):</strong> Notes on 16th grid</div>
                  <div>• <strong>🔵 Blue markers (3):</strong> Notes on triplet grid</div>
                  <div>• <strong>🔴 Red markers (⚠️):</strong> Off-beat notes</div>
                  <div>• <strong>Line height:</strong> Shows musical strength (quarter=tallest, 16th=shortest)</div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Rhythm Data</h3>
              <p className="text-gray-500">
                Record and analyze your guitar playing to see the detailed rhythm grid
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}