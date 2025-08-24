"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, Music, Home, Copy } from "lucide-react"
import Link from "next/link"


type NoteDuration = '16th' | '8th' | 'quarter'

export function RhythmNotationEditor() {
  const [bpm, setBpm] = useState(120)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(-1)
  const [pattern, setPattern] = useState<boolean[]>(new Array(32).fill(false))
  const [noteTypes, setNoteTypes] = useState<NoteDuration[]>(new Array(32).fill('16th'))
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentIndexRef = useRef(0)

  // Initialize audio context
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const toggleNote = (index: number) => {
    setPattern(prev => {
      const newPattern = [...prev]
      newPattern[index] = !newPattern[index]
      return newPattern
    })
    
    // When removing a note, reset its duration to 16th for next time
    if (pattern[index] === true) { // If we're turning OFF a note
      setNoteTypes(prev => {
        const newTypes = [...prev]
        newTypes[index] = '16th'
        return newTypes
      })
    }
  }

  const changeNoteType = (index: number, newType: NoteDuration) => {
    setNoteTypes(prev => {
      const newTypes = [...prev]
      newTypes[index] = newType
      return newTypes
    })
    
    // Clear patterns in cells that will be occupied by longer notes
    if (newType === '8th' || newType === 'quarter') {
      setPattern(prev => {
        const newPattern = [...prev]
        const span = newType === 'quarter' ? 4 : 2
        for (let i = 1; i < span; i++) {
          if (index + i < 32) {
            newPattern[index + i] = false
          }
        }
        return newPattern
      })
    }
  }

  const clearPattern = () => {
    setPattern(new Array(32).fill(false))
    setNoteTypes(new Array(32).fill('16th'))
    stopPlayback()
  }

  const copyFirstBarToSecond = () => {
    setPattern(prev => {
      const newPattern = [...prev]
      // Copy notes from positions 0-15 to positions 16-31
      for (let i = 0; i < 16; i++) {
        newPattern[i + 16] = newPattern[i]
      }
      return newPattern
    })
    
    setNoteTypes(prev => {
      const newTypes = [...prev]
      // Copy note types from positions 0-15 to positions 16-31
      for (let i = 0; i < 16; i++) {
        newTypes[i + 16] = newTypes[i]
      }
      return newTypes
    })
  }

  const playMetronomeClick = (isDownbeat: boolean = false) => {
    if (!audioContextRef.current) return

    const osc = audioContextRef.current.createOscillator()
    const gainNode = audioContextRef.current.createGain()
    
    osc.connect(gainNode)
    gainNode.connect(audioContextRef.current.destination)
    
    osc.frequency.value = isDownbeat ? 1000 : 600
    gainNode.gain.value = 0.2
    
    osc.start()
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.08)
    osc.stop(audioContextRef.current.currentTime + 0.08)
  }

  const playPatternNote = () => {
    if (!audioContextRef.current) return

    const osc = audioContextRef.current.createOscillator()
    const gainNode = audioContextRef.current.createGain()
    
    osc.connect(gainNode)
    gainNode.connect(audioContextRef.current.destination)
    
    osc.frequency.value = 400
    osc.type = 'sawtooth'
    gainNode.gain.value = 0.15
    
    osc.start()
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.12)
    osc.stop(audioContextRef.current.currentTime + 0.12)
  }

  const startPlayback = () => {
    if (!audioContextRef.current) return

    setIsPlaying(true)
    currentIndexRef.current = 0
    
    const sixteenthNoteDuration = (60 / bpm) / 4 * 1000 // 16th note duration in ms
    
    intervalRef.current = setInterval(() => {
      const index = currentIndexRef.current
      setCurrentPosition(index)
      
      const beatInBar = Math.floor((index % 16) / 4)
      const sixteenth = index % 4
      const isDownbeat = beatInBar === 0 && sixteenth === 0
      const isBeat = sixteenth === 0
      
      // Always play metronome click on beats
      if (isBeat) {
        playMetronomeClick(isDownbeat)
      }
      
      // Play pattern note if active
      if (pattern[index]) {
        playPatternNote()
      }
      
      currentIndexRef.current = (currentIndexRef.current + 1) % 32
    }, sixteenthNoteDuration)
  }

  const stopPlayback = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPlaying(false)
    setCurrentPosition(-1)
    currentIndexRef.current = 0
  }

  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback()
    } else {
      startPlayback()
    }
  }

  const renderGrid = () => {
    const cells = []
    let skipNext = 0
    
    for (let index = 0; index < 32; index++) {
      if (skipNext > 0) {
        skipNext--
        continue
      }
      
      const isActive = pattern[index]
      const bar = Math.floor(index / 16)
      const beatInBar = Math.floor((index % 16) / 4)
      const sixteenth = index % 4
      const isDownbeat = beatInBar === 0 && sixteenth === 0
      const isBeat = sixteenth === 0
      const isCurrentlyPlaying = index === currentPosition
      
      const noteType = noteTypes[index]
      const noteColor = noteType === 'quarter' ? 'bg-red-500' : noteType === '8th' ? 'bg-green-500' : 'bg-blue-500'
      const noteSize = noteType === 'quarter' ? 'w-4 h-4' : noteType === '8th' ? 'w-3 h-3' : 'w-2 h-2'
      
      // Determine how many cells this note spans
      let cellSpan = 1
      if (noteType === '8th') {
        cellSpan = 2
        skipNext = 1
      } else if (noteType === 'quarter') {
        cellSpan = 4
        skipNext = 3
      }
      
      // Calculate cell width to fit in container nicely 
      const baseCellWidth = 30 // Back to 30px per cell
      const cellWidth = cellSpan * baseCellWidth
      
      cells.push(
        <div key={index} className="relative group">
          {isActive ? (
            // When note exists, split into upper/lower halves
            <div
              className={`
                relative h-20 border transition-all duration-100 flex-shrink-0 overflow-hidden
                ${isDownbeat ? 'border-l-4 border-l-red-500' : ''}
                ${isBeat && !isDownbeat ? 'border-l-2 border-l-gray-400' : 'border-l border-gray-300'}
                ${noteColor}
                ${isCurrentlyPlaying ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}
                border-gray-300
              `}
              style={{ width: `${cellWidth}px` }}
            >
              {/* Upper half - change duration */}
              <button
                onClick={() => {
                  const nextType = noteType === '16th' ? '8th' : noteType === '8th' ? 'quarter' : '16th'
                  changeNoteType(index, nextType)
                }}
                className="absolute top-0 left-0 right-0 h-1/2 hover:bg-black hover:bg-opacity-10 z-10"
                title={`Click to change duration (currently ${noteType})`}
              />
              
              {/* Lower half - toggle on/off */}
              <button
                onClick={() => toggleNote(index)}
                className="absolute bottom-0 left-0 right-0 h-1/2 hover:bg-black hover:bg-opacity-10 z-10"
                title="Click to remove note"
              />
              
              {/* Note visual */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`${noteSize} bg-white rounded-full shadow-sm`} />
              </div>
              
              {/* Visual separator line */}
              <div className="absolute left-0 right-0 top-1/2 h-px bg-white bg-opacity-20 pointer-events-none" />
            </div>
          ) : (
            // When empty, whole cell is clickable
            <button
              onClick={() => toggleNote(index)}
              className={`
                relative h-20 border transition-all duration-100 flex-shrink-0
                ${isDownbeat ? 'border-l-4 border-l-red-500' : ''}
                ${isBeat && !isDownbeat ? 'border-l-2 border-l-gray-400' : 'border-l border-gray-300'}
                bg-white hover:bg-gray-100
                ${isCurrentlyPlaying ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}
                border-gray-300
              `}
              style={{ width: `${cellWidth}px` }}
              title={`Bar ${bar + 1}, Beat ${beatInBar + 1}, 16th ${sixteenth + 1}\nClick to add note`}
            />
          )}
          
          {/* Note type indicator */}
          {isActive && (
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-xs font-bold text-gray-600 pointer-events-none">
              {noteType === 'quarter' ? '♩' : noteType === '8th' ? '♪' : '♬'}
            </div>
          )}
        </div>
      )
    }
    
    return cells
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Grid
        </h1>
        <Link href="/">
          <Button variant="outline" size="sm">
            <Home className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            16th Note Pattern Grid
          </CardTitle>
          <CardDescription>
            Click on the grid to place notes. Create 2 bars of 4/4 rhythmic patterns for bass grooves.
          </CardDescription>
        </CardHeader>
        <CardContent>

          {/* Grid - full width with better styling */}
          <div className="border-2 border-gray-400 rounded-lg shadow-sm bg-white">
            <div className="flex justify-center p-2">
              <div className="flex">
                {renderGrid()}
              </div>
            </div>
          </div>

          {/* 16th note indicators - matching the rendered grid */}
          <div className="mt-2 flex justify-center">
            <div className="flex px-2">
              {(() => {
                const indicators = []
                let skipNext = 0
                
                for (let index = 0; index < 32; index++) {
                  if (skipNext > 0) {
                    skipNext--
                    continue
                  }
                  
                  const noteType = noteTypes[index]
                  const sixteenth = index % 4
                  
                  let cellSpan = 1
                  let label = ""
                  
                  if (noteType === '16th') {
                    cellSpan = 1
                    label = sixteenth === 0 ? "1" : sixteenth === 1 ? "e" : sixteenth === 2 ? "&" : "a"
                  } else if (noteType === '8th') {
                    cellSpan = 2
                    skipNext = 1
                    // For 8th notes, show the starting subdivision
                    label = sixteenth === 0 ? "1" : sixteenth === 2 ? "&" : (sixteenth === 1 ? "e" : "a")
                  } else if (noteType === 'quarter') {
                    cellSpan = 4
                    skipNext = 3
                    // For quarter notes, only show beat numbers
                    label = (Math.floor((index % 16) / 4) + 1).toString()
                  }
                  
                  const cellWidth = cellSpan * 30
                  
                  indicators.push(
                    <div key={index} className="text-center text-xs text-gray-500" style={{ width: `${cellWidth}px` }}>
                      {label}
                    </div>
                  )
                }
                
                return indicators
              })()}
            </div>
          </div>


          {/* BPM Controls - Exact copy from AudioRecorder */}
          <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-medium text-gray-800">Metronome</span>
              </div>
            </div>
            
            {/* BPM Display and Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-1">
                {/* -5 button */}
                <button
                  onClick={() => setBpm(Math.max(40, bpm - 5))}
                  disabled={bpm <= 40}
                  className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium text-gray-600"
                >
                  -5
                </button>
                
                {/* Fine tune buttons */}
                <button
                  onClick={() => setBpm(Math.max(40, bpm - 1))}
                  disabled={bpm <= 40}
                  className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                
                {/* BPM Display */}
                <div className="text-center px-2">
                  <div className="text-4xl font-bold text-gray-900 tabular-nums min-w-[100px]">
                    {bpm}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">BPM</div>
                </div>
                
                <button
                  onClick={() => setBpm(Math.min(300, bpm + 1))}
                  disabled={bpm >= 300}
                  className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                
                {/* +5 button */}
                <button
                  onClick={() => setBpm(Math.min(300, bpm + 5))}
                  disabled={bpm >= 300}
                  className="h-8 w-8 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium text-gray-600"
                >
                  +5
                </button>
              </div>
              
              {/* Slider */}
              <div className="px-2">
                <input
                  type="range"
                  min="40"
                  max="300"
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  style={{
                    background: `linear-gradient(to right, rgb(59, 130, 246) 0%, rgb(59, 130, 246) ${((bpm - 40) / 260) * 100}%, rgb(229, 231, 235) ${((bpm - 40) / 260) * 100}%, rgb(229, 231, 235) 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>40</span>
                  <span>300</span>
                </div>
              </div>
              
              {/* Quick presets */}
              <div className="grid grid-cols-7 gap-2">
                {[60, 70, 80, 90, 100, 110, 120].map(bpmPreset => (
                  <button
                    key={bpmPreset}
                    onClick={() => setBpm(bpmPreset)}
                    className={`py-2 rounded-lg text-sm font-medium transition-all ${
                      bpm === bpmPreset 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {bpmPreset}
                  </button>
                ))}
              </div>
              
              {/* Tempo description */}
              <div className="text-center py-2 px-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700">
                  {bpm < 60 && "Grave"}
                  {bpm >= 60 && bpm < 76 && "Adagio"}
                  {bpm >= 76 && bpm < 108 && "Andante"}
                  {bpm >= 108 && bpm < 120 && "Moderato"}
                  {bpm >= 120 && bpm < 156 && "Allegro"}
                  {bpm >= 156 && bpm < 200 && "Vivace"}
                  {bpm >= 200 && "Presto"}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  🟢 Beat 1 (downbeat) • 🔵 Beats 2-4
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 space-y-6">
            <div className="flex gap-3">
              <Button
                onClick={togglePlayback}
                size="lg"
                className="flex-1"
                variant={isPlaying ? "destructive" : "default"}
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Play Pattern
                  </>
                )}
              </Button>
              
              <Button
                onClick={copyFirstBarToSecond}
                size="lg"
                variant="outline"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Bar 1→2
              </Button>
              
              <Button
                onClick={clearPattern}
                size="lg"
                variant="outline"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>

          {/* Pattern Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Active Notes:</span> {pattern.filter(Boolean).length} / 32
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}