# Clerk Authentication Setup Guide (Next.js App Router)

This guide provides a step-by-step process for integrating Clerk authentication into a Next.js project using the App Router.

## Quick Testing Tips

When testing the authentication flow:
- Use email format: `test1+clerk_test@example.com` (or any email with `+clerk_test`)
- Use any 8+ character password (e.g., `password123`)
- The verification code will always be `424242`
- This works in development and preview environments
- You can create multiple test users by changing the prefix (test2, test3, etc.)

## Step 1: Prerequisites - Environment Variables

Create a `.env.local` file in your project root and add your Clerk API keys:

```env
# Development/Preview Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_DEV_KEY=pk_test_************************
CLERK_SECRET_DEV_KEY=sk_test_************************

# Production Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_************************
CLERK_SECRET_KEY=sk_live_************************
```

## Step 1.1: Production Domain Configuration

For production deployment, you need:

1. A real domain (e.g., yourdomain.com)
2. CNAME records in your DNS settings for Clerk:
   ```
   clerk.yourdomain.com  →  clerk.services
   ```
3. Configure your domain in Clerk Dashboard:
   - Go to Production Settings > Domains
   - Add your domain
   - Follow Clerk's domain verification process
   - Set up the required CNAME records

Without proper domain configuration, authentication in production will not work correctly.

## Step 2: Core Setup

### 2.1 Install Clerk SDK

```bash
npm install @clerk/nextjs
```

### 2.2 Root Layout with Environment Detection

```tsx
// app/layout.tsx
import { Providers } from "./providers"
import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isPreview = process.env.VERCEL_ENV === 'preview';
  const isDevelopment = process.env.NODE_ENV === 'development';

  const publishableKey = (isPreview || isDevelopment)
    ? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_DEV_KEY
    : process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers publishableKey={publishableKey!}>{children}</Providers>
      </body>
    </html>
  )
}
```

### 2.3 Providers with Database Integration

```tsx
// app/providers.tsx
'use client'

import { ThemeProvider } from "@/components/theme-provider"
import { ClerkProvider, useUser, UserButton } from "@clerk/nextjs"
import { usePathname } from 'next/navigation'
import { createUserAction } from "@/actions/user-actions"
import { useEffect } from "react"

function AppProviders({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()
  const pathname = usePathname()
  const email = user?.emailAddresses?.[0]?.emailAddress

  // Create user in our database when Clerk user is available
  useEffect(() => {
    if (email && user?.id) {
      createUserAction({ 
        id: user.id,
        email 
      }).catch(error => {
        if (!error.message?.includes('duplicate')) {
          console.error('Error creating user:', error)
        }
      })
    }
  }, [email, user?.id])

  // Render auth pages without providers
  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    return <>{children}</>
  }

  // Show nothing while loading user state
  if (!isLoaded) return null

  // If no user, show nothing (protected routes will redirect)
  if (!user) return null

  return (
    <ThemeProvider>
      <div className="fixed top-4 right-4 z-50">
        <UserButton />
      </div>
      {children}
    </ThemeProvider>
  )
}

export function Providers({ children, publishableKey }: { children: React.ReactNode; publishableKey: string }) {
  return (
    <ClerkProvider 
      publishableKey={publishableKey}
      afterSignOutUrl="/login"
    >
      <AppProviders>{children}</AppProviders>
    </ClerkProvider>
  )
}
```

### 2.4 Middleware for Route Protection

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPreview = process.env.VERCEL_ENV === 'preview';
const isDevelopment = process.env.NODE_ENV === 'development';

const publishableKey = (isPreview || isDevelopment)
  ? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_DEV_KEY
  : process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const secretKey = (isPreview || isDevelopment)
  ? process.env.CLERK_SECRET_DEV_KEY
  : process.env.CLERK_SECRET_KEY;

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/", // Root route needs authentication
  // Add other protected routes here as needed
]);

// Define public routes (auth routes)
const isPublicRoute = createRouteMatcher([
  "/login(.*)", // Login routes
  "/signup(.*)", // Signup routes
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow access to static assets and API routes without authentication
  if (
    req.nextUrl.pathname.startsWith('/_next/') ||
    req.nextUrl.pathname.startsWith('/images/') ||
    req.nextUrl.pathname.startsWith('/api/webhook')
  ) {
    return NextResponse.next();
  }

  // Allow access to auth-related routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  try {
    const { userId } = await auth();

    // If the route is protected but the user isn't signed in, redirect to sign-in
    if (isProtectedRoute(req) && !userId) {
      const signInUrl = new URL('/login', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Auth error:', error);
    if (isProtectedRoute(req)) {
      const signInUrl = new URL('/login', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }
}, {
  publishableKey: publishableKey,
  secretKey: secretKey,
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

## Step 3: Database Integration

1. Create user schema that uses Clerk's ID:

```typescript
// db/schema/user-schema.ts
export const userTable = pgTable("user", {
  id: text("id").primaryKey(), // Uses Clerk's ID directly
  email: text("email").notNull().unique(),
  // ... other fields
});
```

2. Create server action and query:

```typescript
// actions/user-actions.ts
export async function createUserAction(data: {
  id: string;    // Clerk's ID
  email: string;
}) {
  return createUser(data);
}

// db/queries/user-queries.ts
export async function createUser(data: {
  id: string;    // Clerk's ID
  email: string;
}): Promise<ActionResult<any>> {
  try {
    const newUser = await db.insert(userTable).values({
      id: data.id,
      email: data.email,
    }).returning();

    return { success: true, data: newUser[0] };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error 
        ? `Failed to create user: ${error.message}`
        : "Failed to create user: Unknown error" 
    };
  }
}
```

## Step 4: Auth Pages

Create sign-in and sign-up pages:

```tsx
// app/(auth)/login/[[...login]]/page.tsx
'use client'

import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <SignIn 
      path="/login" 
      signUpUrl="/signup"
      forceRedirectUrl="/"
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "bg-white/95 backdrop-blur shadow-xl",
        }
      }}
    />
  )
}

// app/(auth)/signup/[[...signup]]/page.tsx
'use client'

import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <SignUp 
      path="/signup" 
      signInUrl="/login"
      forceRedirectUrl="/"
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "bg-white/95 backdrop-blur shadow-xl",
        }
      }}
    />
  )
}
```

This setup provides:
- Automatic user creation in our database using Clerk's ID
- Direct 1:1 relationship between Clerk and database users
- No need for separate webhooks or synchronization
- Clean and simple authentication flow
- Type-safe database operations
- Environment-aware configuration