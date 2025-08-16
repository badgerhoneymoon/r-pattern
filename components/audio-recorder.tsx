"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic, Square, Play, Trash2, Upload, FileAudio, X, AlertCircle } from "lucide-react"

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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationIdRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)

  const drawWaveform = useCallback(() => {
    console.log('🔥 drawWaveform called', { 
      hasCanvas: !!canvasRef.current, 
      isRecording,
      canvasSize: canvasRef.current ? `${canvasRef.current.width}x${canvasRef.current.height}` : 'no canvas'
    })
    
    if (!canvasRef.current) {
      console.error('❌ NO CANVAS REF!')
      return
    }
    
    if (!isRecording) {
      console.log('⏸️ Not recording, stopping draw')
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      console.log('❌ No canvas context')
      return
    }

    console.log('🎨 Drawing waveform...', { 
      hasAnalyser: !!analyserRef.current, 
      hasDataArray: !!dataArrayRef.current,
      canvasSize: `${canvas.width}x${canvas.height}`
    })

    // Clear canvas - this should ALWAYS happen
    ctx.fillStyle = 'rgb(248, 250, 252)' // bg-slate-50
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw center line for reference (silence baseline)
    const centerY = canvas.height / 2
    ctx.strokeStyle = 'rgb(200, 200, 200)' // gray baseline
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(canvas.width, centerY)
    ctx.stroke()

    // If we have audio data, draw it
    if (analyserRef.current && dataArrayRef.current) {
      const analyser = analyserRef.current
      const dataArray = dataArrayRef.current
      
      // Get current audio data
      analyser.getByteTimeDomainData(dataArray)

      // Draw waveform
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgb(59, 130, 246)' // blue-500
      ctx.beginPath()

      const sliceWidth = canvas.width / dataArray.length
      let x = 0

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0  // Convert to 0-2 range
        const y = v * canvas.height / 2 // Scale to canvas height

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }

        x += sliceWidth
      }

      ctx.stroke()
      
      // Log some sample data for debugging
      if (Math.random() < 0.1) { // Log occasionally
        console.log('📊 Audio data sample:', {
          firstFew: Array.from(dataArray.slice(0, 5)),
          average: dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        })
      }
    } else {
      // No audio data yet, draw test pattern
      ctx.strokeStyle = 'rgb(255, 165, 0)' // orange test line
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, centerY)
      ctx.lineTo(canvas.width, centerY + 20 * Math.sin(Date.now() / 200))
      ctx.stroke()
      console.log('🔶 Drawing test pattern (no audio data yet)')
    }

    // Draw onset detection threshold lines
    const thresholdOffset = 30
    ctx.strokeStyle = 'rgb(239, 68, 68)' // red-500
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(0, centerY - thresholdOffset)
    ctx.lineTo(canvas.width, centerY - thresholdOffset)
    ctx.moveTo(0, centerY + thresholdOffset)
    ctx.lineTo(canvas.width, centerY + thresholdOffset)
    ctx.stroke()
    ctx.setLineDash([])

    // Continue animation
    if (isRecording) {
      animationIdRef.current = requestAnimationFrame(drawWaveform)
    }
  }, [isRecording])

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
        
        // Start real-time visualization
        console.log('🎤 Starting real-time visualization')
        // Force immediate test draw\n        setTimeout(() => {\n          console.log('⚡ FORCING TEST DRAW')\n          if (canvasRef.current) {\n            const canvas = canvasRef.current\n            const ctx = canvas.getContext('2d')\n            if (ctx) {\n              ctx.fillStyle = 'red'\n              ctx.fillRect(0, 0, canvas.width, canvas.height)\n              ctx.fillStyle = 'white'\n              ctx.font = '20px Arial'\n              ctx.fillText('TEST DRAW WORKS!', 50, 60)\n              console.log('✅ TEST DRAW COMPLETED')\n            } else {\n              console.error('❌ NO CANVAS CONTEXT')\n            }\n          } else {\n            console.error('❌ NO CANVAS REF IN TIMEOUT')\n          }\n        }, 100)\n        \n        drawWaveform()
      }

      mediaRecorder.start(100) // Collect data every 100ms
      setIsRecording(true)
      onStatusUpdate('Recording... Play your guitar!', 'recording')
      
    } catch (error) {
      console.error('Error accessing microphone:', error)
      onStatusUpdate('Error accessing microphone. Please ensure you have granted microphone permissions.', 'ready')
    }
  }, [onRecordingComplete, onStatusUpdate, audioContext, drawWaveform])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
        animationIdRef.current = null
      }
    }
  }, [])

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
            <div className="text-center">
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
                    <div className="text-xs text-slate-600 mb-2">Live Waveform (Red lines = onset detection threshold)</div>
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