// Boilerplate for extracting text from an image and structuring it using OpenAI Vision and responses APIs.
// 1. Extracts all readable text from an uploaded image (optionally translates to English).
// 2. Structures the extracted text into a JSON object using a customizable schema and prompt.

"use server"

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface ExtractResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function extractTextFromImage(formData: FormData): Promise<ExtractResponse> {
  try {
    const file = formData.get('file') as File
    if (!file) {
      return {
        success: false,
        error: 'No file provided'
      }
    }

    // Convert File to Buffer for OpenAI API
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = `data:${file.type};base64,${buffer.toString('base64')}`

    // Step 1: Extract raw text from image using Vision API
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "Extract all readable text from this image. If not in English, translate to English. Return only the text."
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: base64Image,
              }
            }
          ],
        },
      ],
      max_tokens: 5000,
    })

    const extractedText = visionResponse.choices[0]?.message?.content
    if (!extractedText) {
      return {
        success: false,
        error: 'No text extracted from image'
      }
    }

    // Step 2: Structure the extracted text (customize schema as needed)
    // TODO: Replace the below schema and instructions with your own structure
    const structureResponse = await openai.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "system",
          content: "Structure the following text into a JSON object. Use keys and format that make sense for your use case."
        },
        {
          role: "user",
          content: extractedText
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "structured_output",
          schema: {
            type: "object",
            // TODO: Define your schema here
            properties: {},
            additionalProperties: true
          },
          strict: false
        }
      }
    })

    if (!structureResponse.output_text) {
      return {
        success: false,
        error: 'Failed to structure the extracted text'
      }
    }

    let parsedData: any = null
    try {
      parsedData = JSON.parse(structureResponse.output_text)
    } catch (e) {
      return {
        success: false,
        error: 'Structured output is not valid JSON'
      }
    }

    return {
      success: true,
      data: parsedData
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract data from image'
    }
  }
} 