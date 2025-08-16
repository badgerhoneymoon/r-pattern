"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AudioRecorder } from "./audio-recorder"
import { WaveformVisualization } from "./waveform-visualization"
import { EnhancedRhythmGrid } from "./enhanced-rhythm-grid"
import { SensitivityControl } from "./sensitivity-control"
import { MockDataGenerator } from "./mock-data-generator"

export interface OnsetData {
  time: number
  index: number
}

export interface AnalysisResult {
  onsets: OnsetData[]
  estimatedBPM: number | null
  duration: number
}

export function GuitarRhythmAnalyzer() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [sensitivity, setSensitivity] = useState(50)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [status, setStatus] = useState<{message: string; type: 'recording' | 'analyzing' | 'ready'} | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as typeof AudioContext))()
    }
    return audioContextRef.current
  }, [])

  const handleRecordingComplete = useCallback(async (audioBlob: Blob) => {
    try {
      const audioContext = initAudioContext()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const buffer = await audioContext.decodeAudioData(arrayBuffer)
      
      setAudioBuffer(buffer)
      setStatus({ message: 'Recording complete! Click "Analyze Rhythm" to see the pattern.', type: 'ready' })
    } catch (error) {
      console.error('Error processing audio:', error)
      setStatus({ message: 'Error processing audio recording.', type: 'ready' })
    }
  }, [initAudioContext])

  const handleFileUploaded = useCallback(async (buffer: AudioBuffer) => {
    // Ensure audio context is initialized
    initAudioContext()
    setAudioBuffer(buffer)
    setStatus({ message: 'Audio file uploaded! Click "Analyze Rhythm" to see the pattern.', type: 'ready' })
  }, [initAudioContext])

  const detectOnsets = useCallback((buffer: AudioBuffer): OnsetData[] => {
    const data = buffer.getChannelData(0)
    const sampleRate = buffer.sampleRate
    const windowSize = 2048
    const hopSize = 512
    const sensitivityFactor = (100 - sensitivity) / 100
    
    const onsets: OnsetData[] = []
    let previousEnergy = 0
    let onsetIndex = 0
    
    for (let i = 0; i < data.length - windowSize; i += hopSize) {
      let energy = 0
      
      // Calculate energy in this window
      for (let j = 0; j < windowSize; j++) {
        energy += Math.abs(data[i + j])
      }
      
      energy /= windowSize
      
      // Detect sudden increase in energy
      if (energy > previousEnergy * (1 + sensitivityFactor) && energy > 0.01) {
        const timeInSeconds = i / sampleRate
        
        // Avoid detecting multiple onsets too close together
        if (onsets.length === 0 || timeInSeconds - onsets[onsets.length - 1].time > 0.05) {
          onsets.push({
            time: timeInSeconds,
            index: onsetIndex++
          })
        }
      }
      
      previousEnergy = energy * 0.9 + previousEnergy * 0.1 // Smooth the energy
    }
    
    return onsets
  }, [sensitivity])

  const estimateTempo = useCallback((onsets: OnsetData[]): number | null => {
    if (onsets.length < 2) return null
    
    const intervals = []
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i].time - onsets[i - 1].time)
    }
    
    // Find the most common interval
    intervals.sort((a, b) => a - b)
    const medianInterval = intervals[Math.floor(intervals.length / 2)]
    
    // Convert to BPM
    const bpm = Math.round(60 / medianInterval)
    
    // Sanity check - if BPM is unrealistic, try doubling or halving
    if (bpm < 40) return bpm * 2
    if (bpm > 200) return Math.round(bpm / 2)
    
    return bpm
  }, [])

  const analyzeRhythm = useCallback(async () => {
    if (!audioBuffer) return

    setIsAnalyzing(true)
    setStatus({ message: 'Analyzing rhythm pattern...', type: 'analyzing' })

    try {
      const onsets = detectOnsets(audioBuffer)
      const estimatedBPM = estimateTempo(onsets)
      
      const result: AnalysisResult = {
        onsets,
        estimatedBPM,
        duration: audioBuffer.duration
      }
      
      setAnalysisResult(result)
      
      if (onsets.length === 0) {
        setStatus({ message: 'No notes detected. Try adjusting the sensitivity and recording again.', type: 'ready' })
      } else {
        const message = `Detected ${onsets.length} notes.${estimatedBPM ? ` Estimated tempo: ${estimatedBPM} BPM` : ''}`
        setStatus({ message, type: 'ready' })
      }
    } catch (error) {
      console.error('Error analyzing rhythm:', error)
      setStatus({ message: 'Error analyzing rhythm pattern.', type: 'ready' })
    } finally {
      setIsAnalyzing(false)
    }
  }, [audioBuffer, detectOnsets, estimateTempo])

  const handleClear = useCallback(() => {
    setAudioBuffer(null)
    setAnalysisResult(null)
    setStatus(null)
  }, [])

  const handleStatusUpdate = useCallback((message: string, type: 'recording' | 'analyzing' | 'ready') => {
    setStatus({ message, type })
  }, [])

  const handleMockDataGenerated = useCallback((mockAudioBuffer: AudioBuffer, mockAnalysisResult: AnalysisResult) => {
    setAudioBuffer(mockAudioBuffer)
    setAnalysisResult(mockAnalysisResult)
    setStatus({ message: `Mock data loaded: ${mockAnalysisResult.onsets.length} notes at ${mockAnalysisResult.estimatedBPM} BPM`, type: 'ready' })
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">🎸 Guitar Rhythm Analyzer</CardTitle>
          <CardDescription>
            Record your playing and visualize the rhythmic pattern
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            onFileProcessed={handleFileUploaded}
            onStatusUpdate={handleStatusUpdate}
            onAnalyze={analyzeRhythm}
            onClear={handleClear}
            hasAudioBuffer={!!audioBuffer}
            isAnalyzing={isAnalyzing}
            audioContext={audioContextRef.current}
          />

          {!analysisResult && (
            <>
              <SensitivityControl
                value={sensitivity}
                onChange={setSensitivity}
              />

              <MockDataGenerator onMockDataGenerated={handleMockDataGenerated} />
            </>
          )}

          {status && (
            <Card className={`border-l-4 ${
              status.type === 'recording' ? 'border-red-500 bg-red-50' :
              status.type === 'analyzing' ? 'border-blue-500 bg-blue-50' :
              'border-green-500 bg-green-50'
            }`}>
              <CardContent className="pt-4">
                <p className="text-center font-medium">{status.message}</p>
              </CardContent>
            </Card>
          )}

          <EnhancedRhythmGrid 
            analysisResult={analysisResult}
          />

          <WaveformVisualization 
            audioBuffer={audioBuffer}
            audioContext={audioContextRef.current}
          />
        </CardContent>
      </Card>
    </div>
  )
}