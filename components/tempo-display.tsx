"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"

interface TempoDisplayProps {
  bpm: number
}

export function TempoDisplay({ bpm }: TempoDisplayProps) {
  const getTempoCategory = (bpm: number) => {
    if (bpm < 60) return { name: "Very Slow", color: "bg-blue-100 text-blue-800" }
    if (bpm < 80) return { name: "Slow", color: "bg-green-100 text-green-800" }
    if (bpm < 100) return { name: "Moderate", color: "bg-yellow-100 text-yellow-800" }
    if (bpm < 120) return { name: "Medium", color: "bg-orange-100 text-orange-800" }
    if (bpm < 140) return { name: "Fast", color: "bg-red-100 text-red-800" }
    return { name: "Very Fast", color: "bg-purple-100 text-purple-800" }
  }

  const getGenreHints = (bpm: number) => {
    if (bpm < 70) return ["Ballad", "Slow Blues"]
    if (bpm < 90) return ["Blues", "Reggae", "Hip-Hop"]
    if (bpm < 110) return ["Rock", "Pop", "Country"]
    if (bpm < 130) return ["Rock", "Funk", "Disco"]
    if (bpm < 150) return ["Punk", "Hard Rock", "Dance"]
    return ["Metal", "Drum & Bass", "Hardcore"]
  }

  const category = getTempoCategory(bpm)
  const genres = getGenreHints(bpm)

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-2xl font-bold text-blue-600">{bpm} BPM</div>
              <div className="text-sm text-muted-foreground">Estimated Tempo</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge className={category.color}>
              {category.name}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {genres[0]}, {genres[1]}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}