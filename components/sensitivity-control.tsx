"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Settings } from "lucide-react"

interface SensitivityControlProps {
  value: number
  onChange: (value: number) => void
}

export function SensitivityControl({ value, onChange }: SensitivityControlProps) {
  const handleValueChange = (newValue: number[]) => {
    onChange(newValue[0])
  }

  const getSensitivityDescription = (sensitivity: number) => {
    if (sensitivity < 30) return "Very High - Detects subtle notes"
    if (sensitivity < 50) return "High - Good for clean recordings"
    if (sensitivity < 70) return "Medium - Balanced detection"
    return "Low - Only strong notes"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Detection Settings
        </CardTitle>
        <CardDescription>
          Adjust how sensitive the note detection algorithm is
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label htmlFor="sensitivity-slider" className="text-sm font-medium">
              Detection Sensitivity
            </Label>
            <div className="text-sm font-medium text-blue-600">
              {value}%
            </div>
          </div>
          
          <Slider
            id="sensitivity-slider"
            value={[value]}
            onValueChange={handleValueChange}
            min={10}
            max={90}
            step={5}
            className="w-full"
          />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>More Sensitive</span>
            <span>Less Sensitive</span>
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            {getSensitivityDescription(value)}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Tips:</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Lower values detect more subtle note attacks</li>
            <li>• Higher values ignore background noise better</li>
            <li>• Adjust based on your playing style and recording quality</li>
            <li>• For clean recordings: 30-50%</li>
            <li>• For noisy recordings: 60-80%</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}