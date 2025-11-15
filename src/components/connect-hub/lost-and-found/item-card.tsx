'use client';

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LostFoundItem } from "@/lib/types";
import { MapPin, Calendar, Phone, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import { formatDistanceToNow } from 'date-fns';
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import supabase from '@/supabase/client';
import { PostLostFoundItemForm } from "./post-lost-found-item-form";


type ItemCardProps = {
  item: LostFoundItem;
};

export function ItemCard({ item }: ItemCardProps) {
  const { user: authUser } = useUser();
  const { toast } = useToast();

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  
  const isOwner = useMemo(() => {
    const uid = (authUser as any)?.id ?? (authUser as any)?.uid;
    return !!uid && uid === item.userId;
  }, [authUser, item.userId]);
  const createdDate = (item.createdAt && typeof item.createdAt === 'string') ? new Date(item.createdAt) : (item.createdAt && (item.createdAt as any).toDate ? (item.createdAt as any).toDate() : (item.createdAt as unknown as Date | undefined));
  const date = createdDate ? formatDistanceToNow(createdDate, { addSuffix: true }) : 'Just now';

  const handleDelete = async () => {
    if (!isOwner) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', item.id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Item has been deleted.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to delete item.', variant: 'destructive' });
    }
    setIsDeleteAlertOpen(false);
  }


  return (
    <>
    <Card className="overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-48 sm:h-auto sm:w-1/3 md:w-1/4 flex-shrink-0">
          <Image
            src={item.image.url}
            alt={item.name}
            fill
            className="object-cover"
            data-ai-hint={item.image.hint}
          />
        </div>
        <div className="flex-grow">
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="font-headline text-xl">{item.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={item.type === 'lost' ? 'destructive' : 'secondary'} className="capitalize bg-primary text-primary-foreground">
                  {item.type}
                </Badge>
                {isOwner && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
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
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{item.description}</p>
            <div className="space-y-2 text-sm text-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" />
                <span>{item.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-accent" />
                <span>{date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-accent" />
                <span>{item.contact}</span>
              </div>
            </div>
          </CardContent>
        </div>
      </div>
    </Card>

    <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this item.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    {isOwner && <PostLostFoundItemForm isOpen={isEditFormOpen} onOpenChange={setIsEditFormOpen} itemToEdit={item} />}
    </>
  );
}
