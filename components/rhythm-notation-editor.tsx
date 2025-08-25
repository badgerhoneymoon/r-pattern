"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Pause, RotateCcw, Music, Home, Copy, Repeat, GripVertical } from "lucide-react"
import Link from "next/link"
import { SavedPatternsManager } from "@/components/saved-patterns-manager"
import { SavedPattern } from "@/lib/pattern-storage"


type NoteDuration = '16th' | '8th' | 'quarter'

export function RhythmNotationEditor() {
  const [bpm, setBpm] = useState(120)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(-1)
  const [pattern, setPattern] = useState<boolean[]>(new Array(64).fill(false))
  const [noteTypes, setNoteTypes] = useState<NoteDuration[]>(new Array(64).fill('16th'))
  const [fourBarMode, setFourBarMode] = useState(false)
  const [draggedBar, setDraggedBar] = useState<number | null>(null)
  const [currentPatternId, setCurrentPatternId] = useState<string | null>(null)
  const [currentPatternName, setCurrentPatternName] = useState<string | null>(null)
  const [originalPatternName, setOriginalPatternName] = useState<string | null>(null)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentIndexRef = useRef(0)
  const clapBufferRef = useRef<AudioBuffer | null>(null)

  // Initialize audio context and load clap sound
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      
      // Load the clap sound
      fetch('/hn_clap_aight.wav')
        .then(response => response.arrayBuffer())
        .then(data => audioContextRef.current!.decodeAudioData(data))
        .then(buffer => {
          clapBufferRef.current = buffer
        })
        .catch(error => console.error('Error loading clap sound:', error))
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
    
    // Mark pattern as modified when making changes
    if (originalPatternName) {
      setCurrentPatternName(`${originalPatternName} (modified)`)
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
        const totalCells = fourBarMode ? 64 : 32
        for (let i = 1; i < span; i++) {
          if (index + i < totalCells) {
            newPattern[index + i] = false
          }
        }
        return newPattern
      })
    }
    
    // Mark pattern as modified when making changes
    if (originalPatternName) {
      setCurrentPatternName(`${originalPatternName} (modified)`)
    }
  }

  const clearPattern = () => {
    const size = fourBarMode ? 64 : 32
    setPattern(new Array(size).fill(false))
    setNoteTypes(new Array(size).fill('16th'))
    setCurrentPatternId(null)
    setCurrentPatternName(null)
    setOriginalPatternName(null)
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

  const copyBar = (fromBar: number, toBar: number) => {
    const fromStart = fromBar * 16
    const toStart = toBar * 16
    
    setPattern(prev => {
      const newPattern = [...prev]
      for (let i = 0; i < 16; i++) {
        newPattern[toStart + i] = newPattern[fromStart + i]
      }
      return newPattern
    })
    
    setNoteTypes(prev => {
      const newTypes = [...prev]
      for (let i = 0; i < 16; i++) {
        newTypes[toStart + i] = newTypes[fromStart + i]
      }
      return newTypes
    })
  }

  const handleBarDragStart = (barIndex: number) => {
    setDraggedBar(barIndex)
  }

  const handleBarDragEnd = () => {
    setDraggedBar(null)
  }

  const handleBarDrop = (targetBar: number) => {
    if (draggedBar !== null && draggedBar !== targetBar) {
      copyBar(draggedBar, targetBar)
    }
    setDraggedBar(null)
  }

  // Load a saved pattern
  const loadPattern = (savedPattern: SavedPattern) => {
    setPattern(savedPattern.pattern)
    setNoteTypes(savedPattern.durations as NoteDuration[])
    setBpm(savedPattern.bpm)
    setCurrentPatternId(savedPattern.id)
    setCurrentPatternName(savedPattern.name)
    setOriginalPatternName(savedPattern.name)
    
    // Auto-switch to 4-bar mode if pattern has more than 32 cells
    if (savedPattern.pattern.length > 32) {
      setFourBarMode(true)
    } else {
      setFourBarMode(false)
    }
    
    stopPlayback()
    
    // Smooth scroll to top
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
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
    if (!audioContextRef.current || !clapBufferRef.current) return

    const source = audioContextRef.current.createBufferSource()
    const gainNode = audioContextRef.current.createGain()
    
    source.buffer = clapBufferRef.current
    source.connect(gainNode)
    gainNode.connect(audioContextRef.current.destination)
    
    gainNode.gain.value = 0.5
    
    source.start()
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
      
      const totalCells = fourBarMode ? 64 : 32
      currentIndexRef.current = (currentIndexRef.current + 1) % totalCells
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
    if (fourBarMode) {
      // Render 4 bars as 2 rows of 2 bars each
      const rows = []
      for (let row = 0; row < 2; row++) {
        const cells = []
        let skipNext = 0
        const startIndex = row * 32
        
        for (let i = 0; i < 32; i++) {
          const index = startIndex + i
          
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
          const isBarStart = index % 16 === 0
          
          const noteType = noteTypes[index]
          const noteColor = noteType === 'quarter' ? 'bg-red-500' : noteType === '8th' ? 'bg-green-500' : 'bg-blue-500'
          const noteSize = noteType === 'quarter' ? 'w-4 h-4' : noteType === '8th' ? 'w-3 h-3' : 'w-2 h-2'
          
          let cellSpan = 1
          if (noteType === '8th') {
            cellSpan = 2
            skipNext = 1
          } else if (noteType === 'quarter') {
            cellSpan = 4
            skipNext = 3
          }
          
          const baseCellWidth = 30
          const cellWidth = cellSpan * baseCellWidth
          
          cells.push(
            <div key={index} className="relative group">
              {isActive ? (
                <div
                  className={`
                    relative h-20 border transition-all duration-100 flex-shrink-0 overflow-hidden
                    ${isBarStart && (bar === 1 || bar === 3) ? 'border-l-4 border-l-purple-500 ml-1' : ''}
                    ${isDownbeat && !(isBarStart && (bar === 1 || bar === 3)) ? 'border-l-4 border-l-red-500' : ''}
                    ${isDownbeat && isBarStart && (bar === 0 || bar === 2) ? 'border-l-4 border-l-red-500' : ''}
                    ${isBeat && !isDownbeat ? 'border-l-2 border-l-gray-400' : 'border-l border-gray-300'}
                    ${noteColor}
                    ${isCurrentlyPlaying ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}
                    border-gray-300
                  `}
                  style={{ width: `${cellWidth}px` }}
                >
                  <button
                    onClick={() => {
                      const nextType = noteType === '16th' ? '8th' : noteType === '8th' ? 'quarter' : '16th'
                      changeNoteType(index, nextType)
                    }}
                    className="absolute top-0 left-0 right-0 h-1/2 hover:bg-black hover:bg-opacity-10 z-10"
                    title={`Click to change duration (currently ${noteType})`}
                  />
                  
                  <button
                    onClick={() => toggleNote(index)}
                    className="absolute bottom-0 left-0 right-0 h-1/2 hover:bg-black hover:bg-opacity-10 z-10"
                    title="Click to remove note"
                  />
                  
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className={`${noteSize} bg-white rounded-full shadow-sm`} />
                  </div>
                  
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-white bg-opacity-20 pointer-events-none" />
                </div>
              ) : (
                <button
                  onClick={() => toggleNote(index)}
                  className={`
                    relative h-20 border transition-all duration-100 flex-shrink-0
                    ${isBarStart && (bar === 1 || bar === 3) ? 'border-l-4 border-l-purple-500 ml-1' : ''}
                    ${isDownbeat && !(isBarStart && (bar === 1 || bar === 3)) ? 'border-l-4 border-l-red-500' : ''}
                    ${isDownbeat && isBarStart && (bar === 0 || bar === 2) ? 'border-l-4 border-l-red-500' : ''}
                    ${isBeat && !isDownbeat ? 'border-l-2 border-l-gray-400' : 'border-l border-gray-300'}
                    bg-white hover:bg-gray-100
                    ${isCurrentlyPlaying ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}
                    border-gray-300
                  `}
                  style={{ width: `${cellWidth}px` }}
                  title={`Bar ${bar + 1}, Beat ${beatInBar + 1}, 16th ${sixteenth + 1}\nClick to add note`}
                />
              )}
              
            </div>
          )
        }
        
        rows.push(
          <div key={row}>
            <div className="flex justify-center p-2">
              <div className="flex">
                {cells}
              </div>
            </div>
            {/* 16th note indicators for this row */}
            <div className="flex justify-center pb-2">
              <div className="flex px-2">
                {(() => {
                  const indicators = []
                  let skipNext = 0
                  
                  for (let i = 0; i < 32; i++) {
                    const index = startIndex + i
                    
                    if (skipNext > 0) {
                      skipNext--
                      continue
                    }
                    
                    const noteType = noteTypes[index]
                    const sixteenth = index % 4
                    
                    let cellSpan = 1
                    let label = ""
                    
                    const beatNumber = Math.floor((index % 16) / 4) + 1
                    
                    if (noteType === '16th') {
                      cellSpan = 1
                      label = sixteenth === 0 ? beatNumber.toString() : sixteenth === 1 ? "e" : sixteenth === 2 ? "&" : "a"
                    } else if (noteType === '8th') {
                      cellSpan = 2
                      skipNext = 1
                      label = sixteenth === 0 ? beatNumber.toString() : sixteenth === 2 ? "&" : (sixteenth === 1 ? "e" : "a")
                    } else if (noteType === 'quarter') {
                      cellSpan = 4
                      skipNext = 3
                      label = beatNumber.toString()
                    }
                    
                    const cellWidth = cellSpan * 30
                    
                    indicators.push(
                      <div 
                        key={index} 
                        className={`text-xs text-gray-500 ${noteType === '16th' ? 'text-center' : 'text-left pl-1'} ${['1', '2', '3', '4'].includes(label) ? 'font-bold' : ''}`} 
                        style={{ width: `${cellWidth}px` }}
                      >
                        {label}
                      </div>
                    )
                  }
                  
                  return indicators
                })()}
              </div>
            </div>
          </div>
        )
      }
      
      return rows
    } else {
      // Original 2-bar rendering
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
      const isBarStart = index % 16 === 0
      
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
                ${isBarStart && bar > 0 ? 'border-l-4 border-l-purple-500 ml-1' : ''}
                ${isDownbeat && !isBarStart ? 'border-l-4 border-l-red-500' : ''}
                ${isDownbeat && isBarStart && bar === 0 ? 'border-l-4 border-l-red-500' : ''}
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
                ${isBarStart && bar > 0 ? 'border-l-4 border-l-purple-500 ml-1' : ''}
                ${isDownbeat && !isBarStart ? 'border-l-4 border-l-red-500' : ''}
                ${isDownbeat && isBarStart && bar === 0 ? 'border-l-4 border-l-red-500' : ''}
                ${isBeat && !isDownbeat ? 'border-l-2 border-l-gray-400' : 'border-l border-gray-300'}
                bg-white hover:bg-gray-100
                ${isCurrentlyPlaying ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}
                border-gray-300
              `}
              style={{ width: `${cellWidth}px` }}
              title={`Bar ${bar + 1}, Beat ${beatInBar + 1}, 16th ${sixteenth + 1}\nClick to add note`}
            />
          )}
          
        </div>
      )
    }
    
    return cells
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Grid{currentPatternName ? ` - ${currentPatternName}` : ''}
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
            <Button
              onClick={() => setFourBarMode(!fourBarMode)}
              size="sm"
              variant={fourBarMode ? "default" : "outline"}
              className="ml-auto"
            >
              <Repeat className="h-4 w-4 mr-2" />
              {fourBarMode ? '4 Bars' : '2 Bars'}
            </Button>
          </CardTitle>
          <CardDescription>
            Click on the grid to place notes. Create {fourBarMode ? '4 bars' : '2 bars'} of 4/4 rhythmic patterns for bass grooves.
          </CardDescription>
        </CardHeader>
        <CardContent>

          {/* Bar labels with drag handles */}
          {(fourBarMode || true) && (
            <div className="flex justify-center mb-2">
              <div className="flex gap-1">
                {Array.from({ length: fourBarMode ? 4 : 2 }, (_, barIndex) => (
                  <div
                    key={barIndex}
                    draggable
                    onDragStart={() => handleBarDragStart(barIndex)}
                    onDragEnd={handleBarDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleBarDrop(barIndex)}
                    className={`
                      px-3 py-1 rounded-t-lg cursor-move transition-all
                      ${draggedBar === barIndex ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}
                    `}
                    style={{ width: fourBarMode ? '120px' : '240px' }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <GripVertical className="h-3 w-3" />
                      <span className="text-sm font-medium">Bar {barIndex + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid - full width with better styling */}
          <div className="border-2 border-gray-400 rounded-lg shadow-sm bg-white">
            {fourBarMode ? (
              <div>
                {renderGrid()}
              </div>
            ) : (
              <div className="flex justify-center p-2">
                <div className="flex">
                  {renderGrid()}
                </div>
              </div>
            )}
          </div>

          {/* 16th note indicators - matching the rendered grid */}
          {!fourBarMode && (
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
                  
                  const beatNumber = Math.floor((index % 16) / 4) + 1 // 1, 2, 3, 4
                  
                  if (noteType === '16th') {
                    cellSpan = 1
                    label = sixteenth === 0 ? beatNumber.toString() : sixteenth === 1 ? "e" : sixteenth === 2 ? "&" : "a"
                  } else if (noteType === '8th') {
                    cellSpan = 2
                    skipNext = 1
                    // For 8th notes, show the starting subdivision
                    label = sixteenth === 0 ? beatNumber.toString() : sixteenth === 2 ? "&" : (sixteenth === 1 ? "e" : "a")
                  } else if (noteType === 'quarter') {
                    cellSpan = 4
                    skipNext = 3
                    // For quarter notes, only show beat numbers
                    label = beatNumber.toString()
                  }
                  
                  const cellWidth = cellSpan * 30
                  
                  indicators.push(
                    <div 
                      key={index} 
                      className={`text-xs text-gray-500 ${noteType === '16th' ? 'text-center' : 'text-left pl-1'} ${['1', '2', '3', '4'].includes(label) ? 'font-bold' : ''}`} 
                      style={{ width: `${cellWidth}px` }}
                    >
                      {label}
                    </div>
                  )
                }
                
                return indicators
              })()}
            </div>
          </div>
          )}

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
              
              {!fourBarMode && (
                <Button
                  onClick={copyFirstBarToSecond}
                  size="lg"
                  variant="outline"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Bar 1→2
                </Button>
              )}
              
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
              

            </div>
          </div>

        </CardContent>
      </Card>

      {/* Save/Load Pattern Manager */}
      <div className="mt-6">
        <SavedPatternsManager
          currentPattern={pattern}
          currentDurations={noteTypes}
          currentBPM={bpm}
          onLoadPattern={loadPattern}
          currentPatternId={currentPatternId}
          onPatternOverwritten={(originalName) => {
            // Restore the original pattern name after overwriting
            setCurrentPatternName(originalName)
          }}
        />
      </div>
    </div>
  )
}