"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic, Square, Play, Trash2, Upload, FileAudio, X, AlertCircle, Volume2, VolumeX } from "lucide-react"

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
  onFileProcessed: (audioBuffer: AudioBuffer) => void
  onStatusUpdate: (message: string, type: 'recording' | 'analyzing' | 'ready') => void
  onAnalyze: () => void
  onClear: () => void
  hasAudioBuffer: boolean
  isAnalyzing: boolean
  audioContext: AudioContext | null
}

export function AudioRecorder({
  onRecordingComplete,
  onFileProcessed,
  onStatusUpdate,
  onAnalyze,
  onClear,
  hasAudioBuffer,
  isAnalyzing,
  audioContext
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [inputMode, setInputMode] = useState<'record' | 'upload'>('record')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metronomeEnabled, setMetronomeEnabled] = useState(true)
  const [metronomeBPM, setMetronomeBPM] = useState(120)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationIdRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const isRecordingRef = useRef<boolean>(false)
  const waveformHistoryRef = useRef<number[]>([])
  const recordingStartTimeRef = useRef<number>(0)
  const metronomeIntervalRef = useRef<number | null>(null)
  const metronomeAudioContextRef = useRef<AudioContext | null>(null)
  const currentBeatRef = useRef<number>(0)
  const metronomeBPMRef = useRef<number>(metronomeBPM)
  const metronomeEnabledRef = useRef<boolean>(metronomeEnabled)
  
  // Keep refs in sync with state
  useEffect(() => {
    metronomeBPMRef.current = metronomeBPM
  }, [metronomeBPM])
  
  useEffect(() => {
    metronomeEnabledRef.current = metronomeEnabled
  }, [metronomeEnabled])

  // Metronome click player - simple, no dependencies
  const playMetronomeClick = (isDownbeat: boolean) => {
    const ctx = metronomeAudioContextRef.current
    if (!ctx) return
    
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    
    oscillator.frequency.setValueAtTime(isDownbeat ? 800 : 600, ctx.currentTime)
    oscillator.type = 'square'
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.001)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.1)
  }

  // Start metronome - simplified version
  const startMetronome = useCallback(() => {
    console.log('🎵 Starting metronome', { enabled: metronomeEnabledRef.current, bpm: metronomeBPMRef.current })
    
    // Stop any existing metronome
    if (metronomeIntervalRef.current) {
      clearInterval(metronomeIntervalRef.current)
      metronomeIntervalRef.current = null
    }
    
    if (!metronomeEnabledRef.current) {
      console.log('❌ Metronome disabled')
      return
    }
    
    // Initialize audio context
    if (!metronomeAudioContextRef.current) {
      metronomeAudioContextRef.current = audioContext || new (window.AudioContext || (window as unknown as typeof AudioContext))()
    }
    
    // Reset beat counter
    currentBeatRef.current = 1
    
    // Play first beat immediately
    console.log('🎵 Playing first beat')
    playMetronomeClick(true)
    
    // Calculate interval using ref value
    const intervalMs = 60000 / metronomeBPMRef.current
    console.log('🎵 Setting interval:', intervalMs, 'ms')
    
    // Create a simple counter that doesn't depend on closures
    let beat = 1
    
    // Start the interval using window.setInterval for browser compatibility
    const intervalId = window.setInterval(() => {
      try {
        beat = (beat % 4) + 1
        currentBeatRef.current = beat
        const isDownbeat = beat === 1
        console.log(`🎵 Beat ${beat} (${isDownbeat ? 'DOWN' : 'reg'})`)
        playMetronomeClick(isDownbeat)
      } catch (error) {
        console.error('❌ Metronome tick error:', error)
      }
    }, intervalMs)
    
    metronomeIntervalRef.current = intervalId
    console.log('🎵 Interval started with ID:', intervalId)
  }, [audioContext])

  // Stop metronome - use window.clearInterval
  const stopMetronome = useCallback(() => {
    console.log('🛑 Stopping metronome, interval ID:', metronomeIntervalRef.current)
    if (metronomeIntervalRef.current !== null) {
      window.clearInterval(metronomeIntervalRef.current)
      metronomeIntervalRef.current = null
      console.log('🛑 Metronome interval cleared')
    }
    currentBeatRef.current = 0
  }, [])
  
  // Manage metronome lifecycle with effect to handle React dev mode remounts
  useEffect(() => {
    // Only run metronome when recording AND enabled
    if (isRecording && metronomeEnabled) {
      // Start if not already running
      if (metronomeIntervalRef.current === null) {
        console.log('📍 Effect starting metronome (recording:', isRecording, 'enabled:', metronomeEnabled, ')')
        startMetronome()
      }
    } else {
      // Stop if running but shouldn't be
      if (metronomeIntervalRef.current !== null) {
        console.log('📍 Effect stopping metronome (recording:', isRecording, 'enabled:', metronomeEnabled, ')')
        stopMetronome()
      }
    }
    
    // Cleanup on unmount or when deps change
    return () => {
      if (metronomeIntervalRef.current !== null) {
        console.log('📍 Effect cleanup - stopping metronome')
        stopMetronome()
      }
    }
  }, [isRecording, metronomeEnabled, startMetronome, stopMetronome])

  const drawWaveform = useCallback(() => {
    if (!canvasRef.current) return
    if (!isRecordingRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Fix DPI scaling for crisp text
    const devicePixelRatio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    
    // Set actual size in memory based on device pixel ratio
    canvas.width = rect.width * devicePixelRatio
    canvas.height = rect.height * devicePixelRatio
    
    // Scale the drawing context so everything draws at the correct size
    ctx.scale(devicePixelRatio, devicePixelRatio)
    
    // Use CSS pixels for calculations
    const displayWidth = rect.width
    const displayHeight = rect.height
    const centerY = displayHeight / 2
    
    // Get current audio data and add to history
    if (analyserRef.current && dataArrayRef.current) {
      const analyser = analyserRef.current
      const dataArray = dataArrayRef.current
      analyser.getByteTimeDomainData(dataArray)
      
      // Calculate RMS amplitude for this frame
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128 // Convert to -1 to 1 range
        sum += normalized * normalized
      }
      const rms = Math.sqrt(sum / dataArray.length)
      
      // Add to history - NO LIMIT, just keep adding
      waveformHistoryRef.current.push(rms)
    }

    // Clear canvas
    ctx.fillStyle = 'rgb(248, 250, 252)' // bg-slate-50
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    // Draw center line
    ctx.strokeStyle = 'rgb(200, 200, 200)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(displayWidth, centerY)
    ctx.stroke()

    // Draw onset detection threshold lines
    const thresholdOffset = 30
    ctx.strokeStyle = 'rgb(239, 68, 68)' // red-500
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(0, centerY - thresholdOffset)
    ctx.lineTo(displayWidth, centerY - thresholdOffset)
    ctx.moveTo(0, centerY + thresholdOffset)
    ctx.lineTo(displayWidth, centerY + thresholdOffset)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw waveform history - ACCUMULATIVE, NO SCROLLING
    if (waveformHistoryRef.current.length > 1) {
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgb(59, 130, 246)' // blue-500
      
      // Fixed pixels per sample - when we run out of space, compress
      const totalSamples = waveformHistoryRef.current.length
      const maxSamplesOnScreen = displayWidth / 2 // 2 pixels per sample
      
      let startIndex = 0
      let step = 1
      
      // If we have too many samples, skip some to fit on screen
      if (totalSamples > maxSamplesOnScreen) {
        step = Math.ceil(totalSamples / maxSamplesOnScreen)
        startIndex = totalSamples - maxSamplesOnScreen * step
      }
      
      ctx.beginPath()
      let x = 0
      
      for (let i = Math.max(0, startIndex); i < totalSamples; i += step) {
        const amplitude = waveformHistoryRef.current[i]
        const y = centerY - (amplitude * centerY * 0.8)
        
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += 2 // Fixed 2 pixels per sample
      }
      ctx.stroke()
      
      // Draw positive amplitude (mirror)
      ctx.beginPath()
      x = 0
      for (let i = Math.max(0, startIndex); i < totalSamples; i += step) {
        const amplitude = waveformHistoryRef.current[i]
        const y = centerY + (amplitude * centerY * 0.8)
        
        if (x === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += 2
      }
      ctx.stroke()
    }

    // Draw metronome beat indicators if enabled
    if (metronomeEnabledRef.current) {
      const currentTime = (Date.now() - recordingStartTimeRef.current) / 1000
      const beatInterval = 60 / metronomeBPMRef.current // seconds per beat
      const totalBeats = Math.floor(currentTime / beatInterval) + 1
      
      // Draw beat markers
      for (let beat = 0; beat < totalBeats; beat++) {
        const beatTime = beat * beatInterval
        const x = (beatTime / currentTime) * displayWidth
        
        if (x >= 0 && x <= displayWidth) {
          const isDownbeat = (beat + 1) % 4 === 1
          
          // Draw beat line
          ctx.strokeStyle = isDownbeat ? 'rgb(34, 197, 94)' : 'rgb(59, 130, 246)' // green for downbeat, blue for regular
          ctx.lineWidth = isDownbeat ? 3 : 2
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, displayHeight)
          ctx.stroke()
          
          // Draw beat number
          ctx.fillStyle = isDownbeat ? 'rgb(22, 163, 74)' : 'rgb(37, 99, 235)'
          ctx.font = 'bold 14px Arial'
          ctx.textAlign = 'center'
          const beatInMeasure = ((beat) % 4) + 1
          ctx.fillText(beatInMeasure.toString(), x, 20)
        }
      }
    }

    // Draw time grid and labels
    const currentTime = (Date.now() - recordingStartTimeRef.current) / 1000
    const timePerPixel = currentTime / (waveformHistoryRef.current.length * 2) // Approximate
    
    ctx.fillStyle = 'rgb(100, 100, 100)'
    ctx.font = '12px Arial' // Crisp font at correct DPI
    ctx.textAlign = 'left'
    
    // Draw time labels every 100 pixels
    for (let x = 100; x < displayWidth; x += 100) {
      const time = x * timePerPixel
      if (time > 0) {
        ctx.fillText(time.toFixed(1) + 's', x, displayHeight - 8)
        
        // Draw grid line
        ctx.strokeStyle = 'rgb(220, 220, 220)'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, displayHeight - 20)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Continue animation
    if (isRecordingRef.current) {
      animationIdRef.current = requestAnimationFrame(drawWaveform)
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        }
      })
      
      setStream(mediaStream)
      audioChunksRef.current = []

      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        onRecordingComplete(audioBlob)
        
        // Clean up stream
        mediaStream.getTracks().forEach(track => track.stop())
        setStream(null)
      }

      // Set up real-time audio analysis - create audio context if needed
      const context = audioContext || new (window.AudioContext || (window as unknown as typeof AudioContext))()
      if (context) {
        const source = context.createMediaStreamSource(mediaStream)
        const analyser = context.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        analyserRef.current = analyser
        
        // Set up data array for waveform
        const bufferLength = analyser.frequencyBinCount
        dataArrayRef.current = new Uint8Array(bufferLength)
        
        // Set recording state FIRST
        isRecordingRef.current = true
        recordingStartTimeRef.current = Date.now()
        waveformHistoryRef.current = [] // Clear previous history
        
        // Metronome will be started by the effect watching isRecording state
        
        // Start real-time visualization
        console.log('🎤 Starting real-time visualization')
        
        // Start animation loop immediately
        setTimeout(() => {
          console.log('🚀 Starting animation loop')
          drawWaveform()
        }, 50)
      }

      setIsRecording(true)
      mediaRecorder.start(100) // Collect data every 100ms
      onStatusUpdate('Recording... Play your guitar!', 'recording')
      
    } catch (error) {
      console.error('Error accessing microphone:', error)
      onStatusUpdate('Error accessing microphone. Please ensure you have granted microphone permissions.', 'ready')
    }
  }, [onRecordingComplete, onStatusUpdate, audioContext, drawWaveform])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      isRecordingRef.current = false
      setIsRecording(false)
      
      // Stop metronome
      stopMetronome()
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
        animationIdRef.current = null
      }
    }
  }, [stopMetronome])

  const handleRecordClick = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  // File upload functionality
  const supportedFormats = useMemo(() => ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'], [])
  const maxFileSize = 50 * 1024 * 1024 // 50MB

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File too large. Maximum size is ${maxFileSize / (1024 * 1024)}MB`
    }
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!supportedFormats.includes(fileExtension)) {
      return `Unsupported format. Supported formats: ${supportedFormats.join(', ')}`
    }
    return null
  }, [maxFileSize, supportedFormats])

  const processAudioFile = useCallback(async (file: File) => {
    // Initialize audio context if not available
    const context = audioContext || new (window.AudioContext || (window as unknown as typeof AudioContext))()
    
    if (!context) {
      setError('Audio context not available')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await context.decodeAudioData(arrayBuffer)
      
      if (audioBuffer.duration === 0) {
        throw new Error('Invalid audio file - no audio data found')
      }
      
      if (audioBuffer.duration > 300) {
        throw new Error('Audio file too long. Maximum duration is 5 minutes')
      }

      onFileProcessed(audioBuffer)
      setUploadedFile(file)
    } catch (error) {
      console.error('Error processing audio file:', error)
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Failed to process audio file. Make sure it\'s a valid audio file.')
      }
    } finally {
      setIsProcessing(false)
    }
  }, [audioContext, onFileProcessed])

  const handleFileSelect = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    await processAudioFile(file)
  }, [processAudioFile, validateFile])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleClearAll = useCallback(() => {
    setUploadedFile(null)
    setError(null)
    onClear()
  }, [onClear])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      // Only stop metronome on actual unmount
      if (metronomeIntervalRef.current !== null) {
        window.clearInterval(metronomeIntervalRef.current)
        metronomeIntervalRef.current = null
      }
    }
  }, [stream])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Audio Input
        </CardTitle>
        <CardDescription>
          Record live or upload audio files for rhythm analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setInputMode('record')}
            className={`flex items-center gap-2 px-4 py-2 font-medium border-b-2 transition-colors ${
              inputMode === 'record'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mic className="h-4 w-4" />
            Record
          </button>
          <button
            onClick={() => setInputMode('upload')}
            className={`flex items-center gap-2 px-4 py-2 font-medium border-b-2 transition-colors ${
              inputMode === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[120px]">
          {inputMode === 'record' ? (
            /* Recording Tab */
            <div className="text-center space-y-4">
              {/* Metronome Controls */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">Metronome</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                    className={`flex items-center gap-1 ${metronomeEnabled ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    {metronomeEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    {metronomeEnabled ? 'On' : 'Off'}
                  </Button>
                </div>
                
                {/* BPM Input with presets */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 min-w-[35px]">BPM:</label>
                    
                    {/* Number input */}
                    <input
                      type="number"
                      min="40"
                      max="300"
                      value={metronomeBPM}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 120
                        setMetronomeBPM(Math.min(300, Math.max(40, val)))
                      }}
                      className="w-16 px-2 py-1 text-center font-mono text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isRecording}
                    />
                    
                    {/* Decrease/Increase buttons */}
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMetronomeBPM(Math.max(40, metronomeBPM - 5))}
                        disabled={isRecording || metronomeBPM <= 40}
                        className="h-7 w-7 p-0"
                      >
                        -5
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMetronomeBPM(Math.max(40, metronomeBPM - 1))}
                        disabled={isRecording || metronomeBPM <= 40}
                        className="h-7 w-7 p-0"
                      >
                        -
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMetronomeBPM(Math.min(300, metronomeBPM + 1))}
                        disabled={isRecording || metronomeBPM >= 300}
                        className="h-7 w-7 p-0"
                      >
                        +
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMetronomeBPM(Math.min(300, metronomeBPM + 5))}
                        disabled={isRecording || metronomeBPM >= 300}
                        className="h-7 w-7 p-0"
                      >
                        +5
                      </Button>
                    </div>
                    
                    {/* Slider */}
                    <input
                      type="range"
                      min="40"
                      max="300"
                      value={metronomeBPM}
                      onChange={(e) => setMetronomeBPM(Number(e.target.value))}
                      className="flex-1"
                      disabled={isRecording}
                    />
                  </div>
                  
                  {/* Preset buttons */}
                  <div className="flex gap-1 flex-wrap">
                    <span className="text-xs text-gray-500">Presets:</span>
                    {[60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 180].map(bpm => (
                      <Button
                        key={bpm}
                        variant={metronomeBPM === bpm ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMetronomeBPM(bpm)}
                        disabled={isRecording}
                        className="h-6 px-2 text-xs"
                      >
                        {bpm}
                      </Button>
                    ))}
                  </div>
                  
                  {/* Tempo marking */}
                  <div className="text-xs text-gray-500 text-center">
                    {metronomeBPM < 60 && "Grave (very slow)"}
                    {metronomeBPM >= 60 && metronomeBPM < 66 && "Largo (slow)"}
                    {metronomeBPM >= 66 && metronomeBPM < 76 && "Adagio (slow)"}
                    {metronomeBPM >= 76 && metronomeBPM < 108 && "Andante (walking pace)"}
                    {metronomeBPM >= 108 && metronomeBPM < 120 && "Moderato (moderate)"}
                    {metronomeBPM >= 120 && metronomeBPM < 156 && "Allegro (fast)"}
                    {metronomeBPM >= 156 && metronomeBPM < 200 && "Vivace (lively)"}
                    {metronomeBPM >= 200 && "Presto (very fast)"}
                    {metronomeEnabled && ' • 🟢 Downbeat • 🔵 Regular beats'}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleRecordClick}
                size="lg"
                className={`flex items-center gap-2 min-w-[160px] ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
                disabled={isAnalyzing}
              >
                {isRecording ? (
                  <>
                    <Square className="h-5 w-5" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    Start Recording
                  </>
                )}
              </Button>

              {isRecording && (
                <div className="mt-4">
                  <div className="inline-flex items-center gap-2 text-red-600 mb-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">Recording in progress...</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Play your guitar riff or rhythm pattern
                  </p>
                  
                  {/* Real-time waveform */}
                  <div className="bg-slate-50 border rounded-lg p-3">
                    <div className="text-xs text-slate-600 mb-2">
                      Live Waveform {metronomeEnabled ? '(🟢 Downbeats • 🔵 Regular beats • Red lines = onset detection)' : '(Red lines = onset detection threshold)'}
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={120}
                      className="w-full h-24 border border-slate-200 rounded bg-red-100"
                      style={{ minWidth: '400px', minHeight: '120px' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Upload Tab */
            <div>
              {!uploadedFile ? (
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragging
                      ? 'border-blue-400 bg-blue-100'
                      : 'border-blue-300 bg-blue-50 hover:border-blue-400 hover:bg-blue-100'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <input
                    type="file"
                    accept={supportedFormats.join(',')}
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isProcessing}
                  />
                  
                  <div className="flex flex-col items-center gap-3">
                    <FileAudio className={`h-8 w-8 ${isProcessing ? 'text-blue-400' : 'text-blue-600'}`} />
                    
                    {isProcessing ? (
                      <div className="text-blue-600">
                        <div className="font-medium">Processing audio file...</div>
                      </div>
                    ) : (
                      <>
                        <div className="text-blue-600">
                          <div className="font-medium">Drop audio file or click to browse</div>
                          <div className="text-xs text-blue-500 mt-1">
                            {supportedFormats.join(', ')} (max {maxFileSize / (1024 * 1024)}MB)
                          </div>
                        </div>
                        
                        <Button variant="outline" size="sm">
                          Browse Files
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-blue-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileAudio className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="font-medium text-blue-800 text-sm">{uploadedFile.name}</div>
                        <div className="text-xs text-blue-600">
                          {(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadedFile(null)}
                      className="text-blue-600 hover:text-blue-800 h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons - Only show when we have audio */}
        {hasAudioBuffer && (
          <div className="flex gap-3 justify-center flex-wrap mt-8 pt-6 border-t">
            <Button
              onClick={onAnalyze}
              disabled={!hasAudioBuffer || isAnalyzing}
              size="lg"
              className="flex items-center gap-2 min-w-[160px] bg-green-500 hover:bg-green-600"
            >
              <Play className="h-5 w-5" />
              {isAnalyzing ? 'Analyzing...' : 'Analyze Rhythm'}
            </Button>

            <Button
              onClick={handleClearAll}
              variant="outline"
              size="lg"
              className="flex items-center gap-2"
              disabled={isRecording || isAnalyzing}
            >
              <Trash2 className="h-5 w-5" />
              Clear
            </Button>
          </div>
        )}
        
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs text-blue-800">
            <strong>💡 Tip:</strong> Works with any rhythmic audio - guitar, drums, percussion, beatboxing, clapping!
          </div>
        </div>
      </CardContent>
    </Card>
  )
}