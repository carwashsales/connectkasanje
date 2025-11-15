"use client";

import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import SupabaseAuthProvider from '@/supabase/AuthProvider';
import { AuthWrapper } from '@/components/layout/auth-wrapper';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Connect Hub</title>
        <meta name="description" content="Your community connection platform" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <SupabaseAuthProvider>
          <AuthWrapper>{children}</AuthWrapper>
          <Toaster />
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}
