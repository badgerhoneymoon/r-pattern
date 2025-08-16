# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## 📝 MANDATORY COMPLETION CHECKLIST

**AFTER ANY CODE CHANGE, you MUST do ALL THREE:**

1. **`npm run lint`** - Check for linting issues  
2. **`npx tsc --noEmit`** - Check for TypeScript errors
3. **Test the application manually** to ensure rhythm pattern analysis functionality works correctly

## Project Overview

This is an R-Pattern (Rhythm Pattern Analyzer) built with Next.js 14, TypeScript, and shadcn/ui. The application allows users to analyze rhythm patterns and regular expressions against text input or uploaded files, providing comprehensive pattern matching and analysis capabilities.

## ⚠️ CRITICAL RULES - VIOLATION = TERMINATION

### NEVER Change Existing Logic Without Explicit Request
**ABSOLUTELY FORBIDDEN**: When asked to modify a component or feature, DO NOT change any existing pattern analysis logic, rhythm detection, or regex functionality unless explicitly asked to do so.

**Rule**: When making ANY modification:
1. Identify the EXACT change requested
2. Make ONLY that specific change  
3. Keep ALL other existing logic, pattern analysis, and validation identical
4. If unsure, ask for clarification rather than assuming

**This applies to**: Rhythm patterns, regex patterns, validation rules, pattern analysis logic, matching algorithms, display formatting, etc.

## Development Commands

### Development Commands
- `npm run dev` - Start development server (Next.js)
- `npm run build` - Build production bundle  
- `npm run lint` - Run ESLint linting (**run after every change**)
- `npx tsc --noEmit` - Check TypeScript types (**run after every change**)
- `npm run start` - Start production server

### Code Quality Guidelines
- Always run lint and typecheck after any code changes
- Ensure all TypeScript errors are resolved before considering work complete
- Test pattern analysis functionality manually to verify rhythm detection and regex patterns work correctly
- Verify file upload functionality with various text file formats

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14 with React 18, TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components  
- **State Management**: React useState and context for pattern analysis state
- **UI Components**: Radix UI primitives via shadcn/ui
- **File Handling**: Browser File API for text file upload and processing
- **Pattern Analysis**: Native JavaScript RegExp with comprehensive rhythm pattern detection
- **Text Processing**: Advanced text analysis for rhythm and pattern recognition

### Key Architectural Patterns

**Component-Based Architecture**: All functionality is broken down into focused, reusable components:
- `PatternAnalyzer` - Main orchestrator component
- `PatternInput` - Regex pattern configuration with flags and common patterns
- `TextInput` - Text input with sample data and statistics
- `FileUpload` - Drag-and-drop file upload with validation
- `PatternResults` - Comprehensive results display with highlighting and statistics

**Pattern Analysis Flow**: 
- Input → Pattern Configuration → Analysis → Results Display
- Real-time pattern matching with immediate visual feedback
- Comprehensive statistics and match highlighting
- Support for capture groups and advanced regex features

**File Processing Pipeline**:
- File validation (type and size checking)
- Text extraction and processing
- Integration with pattern analysis engine
- Error handling and user feedback

## Directory Structure

### Core Directories
- `/components/` - React components for pattern analysis
- `/app/` - Next.js app router pages
- `/lib/` - Utility functions and shared logic
- `/components/ui/` - shadcn/ui component library

### Key Files
- `components/pattern-analyzer.tsx` - Main application component
- `components/pattern-input.tsx` - Pattern configuration interface
- `components/text-input.tsx` - Text input and sample data management
- `components/file-upload.tsx` - File upload and processing
- `components/pattern-results.tsx` - Results display and visualization
- `app/page.tsx` - Main application page
- `app/layout.tsx` - Root layout configuration

## Component Patterns

### Pattern Analysis Components
All pattern analysis components follow consistent patterns:
- TypeScript interfaces for props and data structures
- Error handling with user-friendly messages
- Accessibility features (ARIA labels, keyboard navigation)
- Responsive design for mobile and desktop
- Real-time updates and immediate feedback

### Form Handling
- React state management for form data
- Input validation and error display
- File upload with drag-and-drop support
- Sample data integration for testing

### Data Processing
- RegExp-based pattern matching
- Text statistics calculation
- Match highlighting and visualization
- Capture group extraction and display

## Development Guidelines

### Code Standards
- Avoid `any` type (causes build issues)  
- Break down complex code into focused components
- File size limit: Alert when exceeding 500 lines
- Use proper TypeScript typing throughout
- Follow shadcn/ui component patterns

### Pattern Analysis Guidelines
- Support all standard regex flags (g, i, m, s, u, y)
- Provide helpful error messages for invalid patterns
- Include common pattern templates (email, phone, URL, etc.)
- Show detailed match statistics and visualizations
- Handle large text files efficiently

### File Upload Guidelines
- Support common text file formats (.txt, .log, .json, .csv, .md, etc.)
- Implement file size validation (5MB limit)
- Provide clear error messages for unsupported files
- Use drag-and-drop interface for better UX
- Process files client-side for privacy

### UI/UX Standards
- Mobile-first responsive design
- Clear visual hierarchy with proper spacing
- Interactive elements with hover and focus states
- Loading states for file processing
- Toast notifications for user feedback
- Keyboard accessibility throughout

## Testing Strategy

### Manual Testing Checklist
- Test regex pattern validation with valid and invalid patterns
- Verify all regex flags work correctly
- Test file upload with various file types and sizes
- Check pattern matching accuracy with sample texts
- Verify responsive design on different screen sizes
- Test accessibility with keyboard navigation

### Pattern Testing
- Test common patterns (email, phone, URL validation)
- Verify capture group extraction
- Check edge cases (empty matches, overlapping patterns)
- Test performance with large text files
- Validate statistics calculations

## Error Handling

### Pattern Validation
- Clear error messages for invalid regex syntax
- Helpful suggestions for common regex mistakes
- Real-time validation feedback
- Fallback handling for browser compatibility

### File Processing
- File type validation with clear error messages
- File size limits with user-friendly warnings
- Encoding detection and handling
- Progress feedback for large file processing

## Environment Configuration

This is a client-side application with no backend dependencies:
- No database configuration required
- No authentication system
- No external API dependencies
- All processing happens in the browser for privacy and security

## AI Development Guidelines

### Core Principles
- **Execute exactly what is requested** - no additional features
- **Implement simplest solution** that fulfills requirements
- **Never add TODOs** - fix and implement directly
- **Trust user instructions** - don't overthink or "improve" on clear directions
- **Focus on pattern analysis accuracy** over performance optimization
- **Prioritize user experience** in pattern testing workflow

### Debugging Approach
**Pattern Issues:**
- Test regex patterns in isolation
- Check for proper escaping in pattern strings
- Verify flag combinations work correctly
- Test edge cases with empty or special characters

**Component Issues:**
- Check component prop passing and state management
- Verify event handlers are properly bound
- Test responsive behavior across breakpoints
- Ensure accessibility features work correctly