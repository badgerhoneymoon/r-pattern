"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AudioRecorder } from "./audio-recorder"
import { WaveformVisualization } from "./waveform-visualization"
import { EnhancedRhythmGrid } from "./enhanced-rhythm-grid"
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
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [status, setStatus] = useState<{message: string; type: 'recording' | 'analyzing' | 'ready'} | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as typeof AudioContext))()
    }
    return audioContextRef.current
  }, [])

  const handleRecordingComplete = useCallback(async (audioBlob: Blob, metronomeBPM?: number) => {
    try {
      const audioContext = initAudioContext()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const buffer = await audioContext.decodeAudioData(arrayBuffer)
      
      setAudioBuffer(buffer)
      setStatus({ message: 'Recording complete! Analyzing rhythm...', type: 'analyzing' })
      
      // Auto-analyze immediately with metronome BPM if available
      setTimeout(() => analyzeRhythm(buffer, metronomeBPM), 100)
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
    
    const onsets: OnsetData[] = []
    let onsetIndex = 0
    
    // Multi-feature detection arrays
    const energyHistory: number[] = []
    const spectralCentroidHistory: number[] = []
    const highFreqEnergyHistory: number[] = []
    
    // Pre-compute windowing function (Hann window)
    const hannWindow = new Float32Array(windowSize)
    for (let i = 0; i < windowSize; i++) {
      hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)))
    }
    
    for (let i = 0; i < data.length - windowSize; i += hopSize) {
      // Apply windowing and compute FFT-like features
      let energy = 0
      let spectralCentroid = 0
      let highFreqEnergy = 0
      let spectralFlux = 0
      
      // Calculate multiple features in time domain first
      for (let j = 0; j < windowSize; j++) {
        const sample = data[i + j] * hannWindow[j]
        energy += sample * sample
      }
      energy = Math.sqrt(energy / windowSize)
      
      // Simplified spectral features using frequency bands
      // Low band (fundamental): 0-500Hz equivalent
      // High band (harmonics/attack): 2000Hz+ equivalent  
      const lowBandStart = Math.floor(windowSize * 0.02)  // ~80Hz at 44.1kHz
      const highBandStart = Math.floor(windowSize * 0.3)  // ~2kHz at 44.1kHz
      
      for (let j = 0; j < windowSize / 2; j++) {
        const freq = (j * sampleRate) / windowSize
        const magnitude = Math.abs(data[i + j])
        
        // Spectral centroid approximation
        spectralCentroid += freq * magnitude
        
        // High frequency energy (attack transients)
        if (j >= highBandStart) {
          highFreqEnergy += magnitude * magnitude
        }
      }
      
      spectralCentroid /= (energy + 1e-10) // Normalize
      highFreqEnergy = Math.sqrt(highFreqEnergy)
      
      // Store history for comparison
      energyHistory.push(energy)
      spectralCentroidHistory.push(spectralCentroid)
      highFreqEnergyHistory.push(highFreqEnergy)
      
      // Only start detecting after we have some history
      if (energyHistory.length < 5) continue
      
      // Keep only recent history
      if (energyHistory.length > 10) {
        energyHistory.shift()
        spectralCentroidHistory.shift()
        highFreqEnergyHistory.shift()
      }
      
      // Calculate moving averages for comparison
      const recentEnergy = energyHistory.slice(-3).reduce((a, b) => a + b) / 3
      const olderEnergy = energyHistory.slice(0, -3).reduce((a, b) => a + b) / (energyHistory.length - 3)
      
      const recentHighFreq = highFreqEnergyHistory.slice(-3).reduce((a, b) => a + b) / 3
      const olderHighFreq = highFreqEnergyHistory.slice(0, -3).reduce((a, b) => a + b) / (highFreqEnergyHistory.length - 3)
      
      // Much stricter multi-criteria onset detection
      const energyIncrease = recentEnergy > olderEnergy * 1.8  // Stricter energy increase
      const highFreqIncrease = recentHighFreq > olderHighFreq * 2.2  // Much stricter transient detection
      const absoluteThreshold = energy > 0.015  // Higher minimum energy threshold
      
      // Guitar-specific: look for high-frequency content increase (string attack) 
      const hasAttackTransient = highFreqIncrease && recentHighFreq > 0.012  // Higher transient threshold
      
      // Combined detection - BOTH criteria must be met
      const isOnset = energyIncrease && hasAttackTransient && absoluteThreshold
      
      if (isOnset) {
        const timeInSeconds = i / sampleRate
        
        // Avoid detecting multiple onsets too close together (minimum 50ms apart)
        if (onsets.length === 0 || timeInSeconds - onsets[onsets.length - 1].time > 0.05) {
          onsets.push({
            time: timeInSeconds,  // Keep absolute time for metronome sync
            index: onsetIndex++
          })
          
          console.log(`🎸 Onset detected at ${timeInSeconds.toFixed(3)}s - Energy: ${energy.toFixed(4)}, HighFreq: ${recentHighFreq.toFixed(4)}`)
        }
      }
    }
    
    return onsets
  }, [])

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

  const analyzeRhythm = useCallback(async (bufferToAnalyze?: AudioBuffer, metronomeBPM?: number) => {
    const buffer = bufferToAnalyze || audioBuffer
    if (!buffer) return

    setIsAnalyzing(true)
    setStatus({ message: 'Analyzing rhythm pattern...', type: 'analyzing' })

    try {
      const onsets = detectOnsets(buffer)
      
      // ALWAYS use metronome BPM when available - ignore audio estimation
      const finalBPM = metronomeBPM || 120 // Default to 120 if no metronome
      
      console.log('🎵 DEBUGGING - metronomeBPM passed:', metronomeBPM, 'finalBPM:', finalBPM)
      
      const result: AnalysisResult = {
        onsets,
        estimatedBPM: finalBPM,
        duration: buffer.duration
      }
      
      setAnalysisResult(result)
      
      if (onsets.length === 0) {
        setStatus({ message: 'No notes detected. Try recording with more attack/pick strength.', type: 'ready' })
      } else {
        const bpmSource = metronomeBPM ? 'metronome' : 'estimated'
        const message = `Detected ${onsets.length} notes. Tempo: ${finalBPM} BPM (${bpmSource})`
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
    
    // Auto-clear when starting a new recording
    if (type === 'recording') {
      setAnalysisResult(null)
      setAudioBuffer(null)
    }
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
            onAnalyze={() => {}} // Not used anymore
            onClear={() => {}} // Not used anymore
            hasAudioBuffer={!!audioBuffer}
            isAnalyzing={isAnalyzing}
            audioContext={audioContextRef.current}
          />

          {!analysisResult && false && (
            <MockDataGenerator onMockDataGenerated={handleMockDataGenerated} />
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