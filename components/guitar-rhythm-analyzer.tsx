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

  const handleRecordingComplete = useCallback(async (audioBlob: Blob, metronomeBPM?: number, offsetEnabled?: boolean) => {
    try {
      const audioContext = initAudioContext()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const buffer = await audioContext.decodeAudioData(arrayBuffer)
      
      setAudioBuffer(buffer)
      setStatus({ message: 'Recording complete! Analyzing rhythm...', type: 'analyzing' })
      
      // Auto-analyze immediately with metronome BPM if available
      setTimeout(() => analyzeRhythm(buffer, metronomeBPM, offsetEnabled), 100)
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
    const x = buffer.getChannelData(0)
    const sr = buffer.sampleRate

    // Envelope: rectify + 10ms exponential moving average (no high-pass)
    const env = new Float32Array(x.length)
    const tau = 0.010 // 10ms smoothing
    const envAlpha = 1 - Math.exp(-1 / (sr * tau))
    let envPrev = 0
    for (let i = 0; i < x.length; i++) {
      const rect = Math.abs(x[i])
      envPrev = (1 - envAlpha) * envPrev + envAlpha * rect
      env[i] = envPrev
    }

    // Sliding threshold on novelty (computed below): mean + 0.8*std over 0.5s

    // Tempo-agnostic peak picking with refractory
    // Novelty: positive difference over 15ms
    const diffWin = Math.max(1, Math.floor(sr * 0.015))
    const nov = new Float32Array(env.length)
    for (let i = diffWin; i < env.length; i++) {
      const d = env[i] - env[i - diffWin]
      nov[i] = d > 0 ? d : 0
    }

    // Gamma expansion to boost transients
    const gamma = 1.5
    for (let i = 0; i < nov.length; i++) {
      if (nov[i] > 0) nov[i] = Math.pow(nov[i], gamma)
    }

    // Sliding stats over 0.5s (z-score normalization)
    const win = Math.max(1, Math.floor(sr * 0.5))
    const z = new Float32Array(env.length)
    let sum = 0
    let sumSq = 0
    const buf: number[] = []
    for (let i = 0; i < nov.length; i++) {
      const v = nov[i]
      buf.push(v)
      sum += v
      sumSq += v * v
      if (buf.length > win) {
        const r = buf.shift() as number
        sum -= r
        sumSq -= r * r
      }
      const n = buf.length
      const mean = n ? sum / n : 0
      const variance = n > 1 ? Math.max(0, sumSq / n - mean * mean) : 0
      const std = Math.sqrt(variance)
      z[i] = std > 1e-12 ? (v - mean) / std : 0
    }

    // Peak picking with 180ms minimum separation and local refinement
    const minSep = Math.floor(sr * 0.18)
    const onsets: OnsetData[] = []
    let last = -minSep
    let idx = 0
    const refine = Math.floor(sr * 0.02)
    const zThresh = 0.8
    for (let i = 1; i < z.length - 1; i++) {
      if (z[i] > zThresh && z[i] >= z[i - 1] && z[i] >= z[i + 1]) {
        if (i - last < minSep) continue
        // refine to max envelope near the peak
        let bestI = i
        let bestV = env[i]
        const i0 = Math.max(0, i - refine)
        const i1 = Math.min(env.length - 1, i + refine)
        for (let j = i0; j <= i1; j++) {
          if (env[j] > bestV) { bestV = env[j]; bestI = j }
        }
        onsets.push({ time: bestI / sr, index: idx++ })
        last = i
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

  const analyzeRhythm = useCallback(async (bufferToAnalyze?: AudioBuffer, metronomeBPM?: number, offsetEnabled?: boolean) => {
    const buffer = bufferToAnalyze || audioBuffer
    if (!buffer) return

    setIsAnalyzing(true)
    setStatus({ message: 'Analyzing rhythm pattern...', type: 'analyzing' })

    try {
      // 1) raw onsets
      let onsets = detectOnsets(buffer)

      // 2) refine using local energy and BPM-informed separation (no grid assumptions)
      {
        const sr = buffer.sampleRate
        const data = buffer.getChannelData(0)
        const win = Math.max(1, Math.floor(sr * 0.020)) // 20ms
        // local energies
        const energies = onsets.map(o => {
          const c = Math.floor(o.time * sr)
          const i0 = Math.max(0, c - win)
          const i1 = Math.min(data.length - 1, c + win)
          let sum = 0
          for (let i = i0; i <= i1; i++) sum += Math.abs(data[i])
          return sum / (i1 - i0 + 1)
        })
        // robust threshold
        const sorted = [...energies].sort((a, b) => a - b)
        const med = sorted[Math.floor(sorted.length / 2)] || 0
        const devs = sorted.map(v => Math.abs(v - med)).sort((a, b) => a - b)
        const mad = devs[Math.floor(devs.length / 2)] || 0
        const eThresh = med + 2 * mad

        // filter weak
        const strong: { time: number; index: number; e: number }[] = []
        onsets.forEach((o, i) => { if (energies[i] >= eThresh) strong.push({ ...o, e: energies[i] }) })
        if (strong.length === 0 && onsets.length > 0) {
          // fallback: keep top 8 strongest to avoid empty result
          const tmp = onsets.map((o, i) => ({ ...o, e: energies[i] }))
          tmp.sort((a, b) => b.e - a.e)
          strong.push(...tmp.slice(0, Math.min(8, tmp.length)))
          strong.sort((a, b) => a.time - b.time)
        }

        // Merge close events using adaptive min separation
        // Prefer robust estimate from median inter-onset interval of strong peaks
        let minSepSec = 0.18
        if (strong.length >= 3) {
          const times = strong.map(s => s.time)
          const intervals: number[] = []
          for (let i = 1; i < times.length; i++) intervals.push(times[i] - times[i - 1])
          intervals.sort((a, b) => a - b)
          const medianIOI = intervals[Math.floor(intervals.length / 2)]
          if (isFinite(medianIOI) && medianIOI > 0) {
            minSepSec = Math.max(0.18, Math.min(0.60, 0.45 * medianIOI))
          }
        } else if (metronomeBPM) {
          // Fallback to BPM-informed spacing (≈ 45% of an eighth note)
          minSepSec = Math.max(0.18, 0.45 * (60 / (metronomeBPM * 2)))
        }
        const merged: { time: number; index: number; e: number }[] = []
        for (const o of strong) {
          if (merged.length === 0) { merged.push(o); continue }
          const last = merged[merged.length - 1]
          if (o.time - last.time < minSepSec) {
            // keep stronger
            if (o.e > last.e) merged[merged.length - 1] = o
          } else {
            merged.push(o)
          }
        }
        onsets = merged.map((m, i) => ({ time: m.time, index: i }))
      }
      
      // ALWAYS use metronome BPM when available - ignore audio estimation
      const finalBPM = metronomeBPM || 120 // Default to 120 if no metronome
      
      console.log('🎵 DEBUGGING - metronomeBPM passed:', metronomeBPM, 'finalBPM:', finalBPM, 'offsetEnabled:', offsetEnabled)
      
      // Apply -1 bar offset if enabled
      if (offsetEnabled && finalBPM) {
        const secondsPerBeat = 60 / finalBPM
        const oneBarInSeconds = 4 * secondsPerBeat // 4 beats = 1 bar
        
        console.log('🎵 Applying -1 bar offset:', oneBarInSeconds, 'seconds')
        console.log('🎵 Original onset times:', onsets.map(o => o.time.toFixed(3)))
        
        // Subtract one bar from all onset times
        onsets.forEach(onset => {
          onset.time -= oneBarInSeconds
        })
        
        console.log('🎵 After offset onset times:', onsets.map(o => o.time.toFixed(3)))
        
        // Remove any onsets that became negative
        const validOnsets = onsets.filter(onset => onset.time >= 0)
        console.log('🎵 Filtered onsets - before:', onsets.length, 'after:', validOnsets.length)
        
        // Update onsets array
        onsets.length = 0
        onsets.push(...validOnsets)
      }
      
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