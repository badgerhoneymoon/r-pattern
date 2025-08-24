"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AudioRecorder } from "./audio-recorder"
import { WaveformVisualization } from "./waveform-visualization"
import { EnhancedRhythmGrid } from "./enhanced-rhythm-grid"
import { MockDataGenerator } from "./mock-data-generator"
import { Music2 } from "lucide-react"
import Link from "next/link"

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
  const [, setStatus] = useState<{message: string; type: 'recording' | 'analyzing' | 'ready'} | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as typeof AudioContext))()
    }
    return audioContextRef.current
  }, [])

  const detectOnsets = useCallback((buffer: AudioBuffer): OnsetData[] => {
    const data = buffer.getChannelData(0)
    const sampleRate = buffer.sampleRate

    // Spectral flux with local adaptive threshold and log magnitude
    const fftSize = 1024
    const hopSize = 256

    // Hann window
    const window = new Float32Array(fftSize)
    for (let i = 0; i < fftSize; i++) window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)))

    // Windowed frames
    const frames: Float32Array[] = []
    for (let pos = 0; pos + fftSize <= data.length; pos += hopSize) {
      const frame = new Float32Array(fftSize)
      for (let i = 0; i < fftSize; i++) frame[i] = data[pos + i] * window[i]
      frames.push(frame)
    }

    // Very small DFT to avoid dependency; log-magnitude spectrum
    const computeSpectrum = (frame: Float32Array): Float32Array => {
      const spectrum = new Float32Array(fftSize / 2)
      for (let k = 0; k < fftSize / 2; k++) {
        let real = 0, imag = 0
        for (let n = 0; n < frame.length; n++) {
          const angle = -2 * Math.PI * k * n / fftSize
          real += frame[n] * Math.cos(angle)
          imag += frame[n] * Math.sin(angle)
        }
        const mag = Math.sqrt(real * real + imag * imag)
        spectrum[k] = Math.log1p(mag)
      }
      return spectrum
    }

    const spectra = frames.map(computeSpectrum)

    // Spectral flux (half-wave rectified differences)
    const flux: number[] = []
    for (let i = 1; i < spectra.length; i++) {
      let v = 0
      const cur = spectra[i]
      const prev = spectra[i - 1]
      for (let b = 1; b < cur.length; b++) {
        const d = cur[b] - prev[b]
        if (d > 0) v += d
      }
      flux.push(v)
    }

    // Local adaptive threshold over ~0.3s
    const win = Math.max(8, Math.floor(0.3 * sampleRate / hopSize))
    const thr: number[] = new Array(flux.length).fill(0)
    let sum = 0
    let sumSq = 0
    for (let i = 0; i < flux.length; i++) {
      sum += flux[i]
      sumSq += flux[i] * flux[i]
      if (i >= win) {
        const r = flux[i - win]
        sum -= r
        sumSq -= r * r
      }
      const n = Math.min(i + 1, win)
      const mean = sum / n
      const variance = Math.max(0, sumSq / n - mean * mean)
      const std = Math.sqrt(variance)
      thr[i] = mean + 0.6 * std
    }

    // Peak picking with hysteresis to avoid double-hits on sustains
    const minSepFrames = Math.floor(0.12 * sampleRate / hopSize) // 120ms
    const picked: { frame: number; value: number }[] = []
    const highFactor = 1.25
    const lowFactor = 0.80
    let armed = true
    let last = -minSepFrames
    for (let i = 1; i < flux.length - 1; i++) {
      const hi = thr[i] * highFactor
      const lo = thr[i] * lowFactor
      if (armed) {
        if (flux[i] > hi && flux[i] > flux[i - 1] && flux[i] > flux[i + 1]) {
          if (i - last >= minSepFrames) {
            picked.push({ frame: i, value: flux[i] })
            last = i
            armed = false
          }
        }
      } else if (flux[i] < lo) {
        armed = true
      }
    }

    const onsets: OnsetData[] = picked
      .map((p, idx) => ({ time: (p.frame + 1) * hopSize / sampleRate, index: idx }))
      .sort((a, b) => a.time - b.time)
    return onsets
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
  }, [audioBuffer, detectOnsets])

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
  }, [initAudioContext, analyzeRhythm])

  const handleFileUploaded = useCallback(async (buffer: AudioBuffer) => {
    // Ensure audio context is initialized
    initAudioContext()
    setAudioBuffer(buffer)
    setStatus({ message: 'Audio file uploaded! Click "Analyze Rhythm" to see the pattern.', type: 'ready' })
  }, [initAudioContext])

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
      <div className="flex justify-end mb-4">
        <Link href="/grid">
          <Button variant="outline" size="sm">
            <Music2 className="h-4 w-4 mr-2" />
            Grid
          </Button>
        </Link>
      </div>
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