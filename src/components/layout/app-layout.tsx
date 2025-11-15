
'use client';

import { SidebarProvider, Sidebar, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";
import { Header } from "./header";
import type { UserProfile } from "@/lib/types";
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { useState } from "react";
import supabase from '@/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { MailCheck } from "lucide-react";


function EmailVerificationBanner() {
    const { user } = useUser();
    const { user: supaUser } = useUser();
    // Supabase email verification is handled via signUp flow and magic links/OAuth.
    // Showing a static banner to remind the user to check their email if needed.
    if (!user) return null;
    // We don't attempt to resend verification here because that requires a server-side
    // action with elevated privileges or a dedicated resend endpoint.
    return (
        <div className="p-2">
            <Alert>
                <MailCheck className="h-4 w-4" />
                <AlertTitle>Verify Your Email</AlertTitle>
                <AlertDescription>
                    Please check your email for a verification link to complete registration.
                </AlertDescription>
            </Alert>
        </div>
    );
}

export function AppLayout({ children, user }: { children: React.ReactNode, user: UserProfile | null }) {
  return (
    <SidebarProvider>
        <Sidebar>
          <SidebarNav user={user} />
        </Sidebar>
        <SidebarInset>
          <Header>
            <SidebarTrigger />
          </Header>
          <main className="flex-1 overflow-y-auto">
            <EmailVerificationBanner />
            {children}
          </main>
        </SidebarInset>
    </SidebarProvider>
  );
}
