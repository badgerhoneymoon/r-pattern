"use client"

import { useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity } from "lucide-react"

interface WaveformVisualizationProps {
  audioBuffer: AudioBuffer | null
  audioContext?: AudioContext | null
}

export function WaveformVisualization({ audioBuffer }: WaveformVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationIdRef = useRef<number | null>(null)

  const drawStaticWaveform = useCallback((buffer: AudioBuffer) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const data = buffer.getChannelData(0)
    const step = Math.ceil(data.length / canvas.width)
    const amp = canvas.height / 2

    // Clear canvas
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw waveform
    ctx.lineWidth = 1
    ctx.strokeStyle = '#3b82f6'
    ctx.beginPath()

    for (let i = 0; i < canvas.width; i++) {
      let min = 1.0
      let max = -1.0

      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j]
        if (datum < min) min = datum
        if (datum > max) max = datum
      }

      ctx.moveTo(i, (1 + min) * amp)
      ctx.lineTo(i, (1 + max) * amp)
    }

    ctx.stroke()

    // Add center line
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, amp)
    ctx.lineTo(canvas.width, amp)
    ctx.stroke()
  }, [])

  // Real-time waveform drawing would go here for future implementation

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const container = canvas.parentElement
    if (!container) return

    canvas.width = container.offsetWidth - 40 // Account for padding
    canvas.height = 150

    // Redraw if we have audio data
    if (audioBuffer) {
      drawStaticWaveform(audioBuffer)
    }
  }, [audioBuffer, drawStaticWaveform])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setTimeout(resizeCanvas, 100) // Small delay to ensure container has resized
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [resizeCanvas])

  // Initial canvas setup
  useEffect(() => {
    resizeCanvas()
  }, [resizeCanvas])

  // Draw waveform when audio buffer changes
  useEffect(() => {
    if (audioBuffer) {
      drawStaticWaveform(audioBuffer)
    } else {
      // Clear canvas when no audio buffer
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          
          // Add placeholder text
          ctx.fillStyle = '#9ca3af'
          ctx.font = '16px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText('Record audio to see waveform', canvas.width / 2, canvas.height / 2)
        }
      }
    }
  }, [audioBuffer, drawStaticWaveform])

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      const animationId = animationIdRef.current
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Audio Waveform
        </CardTitle>
        <CardDescription>
          Visual representation of your recorded audio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-white rounded-lg border p-4">
          <canvas
            ref={canvasRef}
            className="w-full h-[150px] block"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        
        {audioBuffer && (
          <div className="mt-3 text-sm text-muted-foreground text-center">
            Duration: {audioBuffer.duration.toFixed(2)}s | 
            Sample Rate: {audioBuffer.sampleRate}Hz |
            Channels: {audioBuffer.numberOfChannels}
          </div>
        )}
      </CardContent>
    </Card>
  )
}