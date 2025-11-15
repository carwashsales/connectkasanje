'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import supabase from '@/supabase/client';
import type { Product } from "@/lib/types";
import Image from "next/image";
import { MessageSquare, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState, useMemo } from 'react';
import type { UserProfile } from "@/lib/types";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// removed duplicate import
import { useToast } from "@/hooks/use-toast";
import { SellItemForm } from "./sell-item-form";


type ItemCardProps = {
  item: Product;
};

export function ItemCard({ item }: ItemCardProps) {
  const { user: authUser } = useUser();
  const [seller, setSeller] = useState<any | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);

  const isSeller = useMemo(() => {
    const uid = (authUser as any)?.id ?? (authUser as any)?.uid;
    return !!uid && uid === item.sellerId;
  }, [authUser, item.sellerId]);
  
  useEffect(() => {
    let mounted = true;
    async function loadSeller() {
      if (!item.sellerId) return;
      try {
        const { data, error } = await supabase.from('profiles').select('id, username, full_name, avatar_url, metadata').eq('id', item.sellerId).single();
        if (error) {
          console.error('Error fetching seller profile', error);
          return;
        }
        if (!mounted) return;
        const mapped = {
          uid: data.id,
          name: data.full_name ?? data.username ?? 'Unknown',
          email: data.metadata?.email,
          avatar: { url: data.avatar_url ?? '', hint: '' },
        };
        setSeller(mapped);
      } catch (err) {
        console.error(err);
      }
    }
    loadSeller();
    return () => { mounted = false; };
  }, [item.sellerId]);

  const handleContactSeller = async () => {
    if (!authUser || !seller || (authUser as any).id === item.sellerId) return;
    try {
      const { data, error } = await supabase.from('conversations').insert([{ subject: '', last_message_text: '', last_message_at: new Date().toISOString() }]).select('id').single();
      if (error) throw error;
      router.push(`/messages?conversationId=${data.id}`);
    } catch (err) {
      console.error('Error creating conversation', err);
      toast({ title: 'Error', description: 'Could not start conversation.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!isSeller) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', item.id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Item deleted.' });
    } catch (err) {
      console.error('Delete error', err);
      toast({ title: 'Error', description: 'Failed to delete item.', variant: 'destructive' });
    }
    setIsDeleteAlertOpen(false);
  }

  const contactButton = (
    <Button 
      size="sm" 
      variant="ghost" 
      className="text-primary hover:bg-primary/10" 
      disabled={!authUser || !seller || (authUser && authUser.uid === item.sellerId)}
      onClick={handleContactSeller}
      >
      <MessageSquare className="mr-2 h-4 w-4" />
      Contact
    </Button>
  );

  return (
    <>
    <Card className="flex flex-col overflow-hidden rounded-lg shadow-lg transition-transform hover:scale-105">
      <CardHeader className="p-0 relative">
        <div className="relative h-48 w-full">
            <Image
            src={item.image.url}
            alt={item.name}
            fill
            className="object-cover"
            data-ai-hint={item.image.hint}
            />
        </div>
        {isSeller && (
            <div className="absolute top-2 right-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-background/70 hover:bg-background">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setIsEditFormOpen(true)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsDeleteAlertOpen(true)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        )}
      </CardHeader>
      <CardContent className="flex-grow p-4">
        <CardTitle className="font-headline text-lg mb-2">{item.name}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground line-clamp-2">{item.description}</CardDescription>
        <p className="mt-4 text-xl font-bold text-primary">${item.price.toFixed(2)}</p>
      </CardContent>
      <CardFooter className="flex justify-between items-center p-4 bg-secondary/30">
        <div className="flex items-center gap-2">
            {seller ? (
                <Link href={`/profile?userId=${seller.uid}`} className="flex items-center gap-2 group">
                  <Avatar className="h-8 w-8">
                      <AvatarImage src={seller.avatar.url} alt={seller.name} data-ai-hint={seller.avatar.hint} />
                      <AvatarFallback>{seller.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium group-hover:underline">{seller.name}</span>
                </Link>
            ) : (
                 <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                 </div>
            )}
        </div>
        
        <TooltipProvider>
            {(!authUser) ? (
            <Tooltip>
                <TooltipTrigger asChild>
                <span tabIndex={0}>{contactButton}</span>
                </TooltipTrigger>
                <TooltipContent>
                <p>Please log in to contact seller.</p>
                </TooltipContent>
            </Tooltip>
            ) : (
             !isSeller && contactButton
            )}
        </TooltipProvider>
      </CardFooter>
    </Card>

    <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your marketplace listing.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    {isSeller && <SellItemForm isOpen={isEditFormOpen} onOpenChange={setIsEditFormOpen} itemToEdit={item} />}
    </>
  );
}
