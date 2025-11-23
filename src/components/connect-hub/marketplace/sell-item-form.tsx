'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import { Loader2 } from 'lucide-react';
import { uploadToSupabase, uploadCancelable } from '@/lib/supabase';
import supabase from '@/supabase/client';
import { getUserId } from '@/lib/getUserId';
import { z } from 'zod';
import type { Product } from '@/lib/types';

const CreateProductSchema = z.object({
  name: z.string().min(1, 'Item name cannot be empty.'),
  description: z.string().min(1, 'Description cannot be empty.'),
  price: z.coerce.number().positive('Price must be a positive number.'),
});


type SellItemFormProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  itemToEdit?: Product;
};

export function SellItemForm({ isOpen, onOpenChange, itemToEdit }: SellItemFormProps) {
  const { user: authUser } = useUser();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadCancelRef = useRef<(() => void) | null>(null);
  const isEdit = !!itemToEdit;


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  if (!authUser) {
    toast({ title: 'Error', description: 'You must be logged in to sell an item.', variant: 'destructive' });
    return;
  }
    
    setLoading(true);

    const formData = new FormData(formRef.current!);
    const data = {
      name: formData.get('name'),
      description: formData.get('description'),
      price: formData.get('price'),
    };
    
    const validatedFields = CreateProductSchema.safeParse(data);
    
    if (!validatedFields.success) {
      const errorMessages = validatedFields.error.flatten().fieldErrors;
      const firstError = Object.values(errorMessages).flat()[0] || 'Invalid data.';
      toast({
        title: 'Error Listing Item',
        description: firstError,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }
    
  const { name, description, price } = validatedFields.data;

    try {
      if (isEdit && itemToEdit) {
        // Update existing product post (stored in `posts` with metadata.type = 'product')
        const updates: any = {
          title: name,
          body: description,
          metadata: { ...((itemToEdit as any).metadata || {}), price: Number(price), type: 'product' },
        };
        const { error } = await supabase.from('posts').update(updates).eq('id', itemToEdit.id);
        if (error) throw error;
        toast({ title: 'Success!', description: 'Item updated successfully!' });
      } else {
        let imageUrl = `https://picsum.photos/seed/${Math.random()}/600/400`;
        let imageHint = 'new item';
        const file = (formRef.current as HTMLFormElement).querySelector('#picture') as HTMLInputElement | null;
        let media: any = null;
        if (file?.files && file.files[0]) {
          try {
            setUploadProgress(0);
            setUploadError(null);
            setIsUploading(true);
            const controller = uploadCancelable(file.files[0], undefined, undefined, (pct) => setUploadProgress(pct));
            uploadCancelRef.current = controller.cancel;
            const uploaded = await controller.promise;
            imageUrl = uploaded.publicUrl;
            imageHint = uploaded.path;
            media = { url: uploaded.publicUrl, path: uploaded.path, mime: file.files[0].type };
            setUploadProgress(null);
            setIsUploading(false);
            uploadCancelRef.current = null;
          } catch (err) {
            console.error('Upload failed', err);
            toast({ title: 'Upload Error', description: 'Could not upload image. Using placeholder.', variant: 'destructive' });
            const msg = (err as any)?.message || 'Could not upload image.';
            setUploadError(msg);
            setUploadProgress(null);
            setIsUploading(false);
            uploadCancelRef.current = null;
          }
        }

        const userId = getUserId(authUser);
        const { error } = await supabase.from('posts').insert([{ 
          user_id: userId,
          title: name,
          body: description,
          media: media ? media : { url: imageUrl, path: imageHint },
          metadata: { type: 'product', price: Number(price) },
          visibility: 'public'
        }]);
        if (error) throw error;
        toast({ title: 'Success!', description: 'Item listed for sale successfully!' });
      }

      formRef.current?.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error writing document: ", error);
      toast({
        title: 'Database Error',
        description: `Could not ${isEdit ? 'update' : 'list'} item.`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{isEdit ? "Edit Your Item" : "Sell Your Item"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the details of your item." : "Fill out the details below to list your item on the marketplace."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} ref={formRef} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Item Name
            </Label>
            <Input id="name" name="name" className="col-span-3" required defaultValue={itemToEdit?.name} />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea id="description" name="description" className="col-span-3" required defaultValue={itemToEdit?.description} />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">
              Price ($)
            </Label>
            <Input id="price" name="price" type="number" step="0.01" className="col-span-3" required defaultValue={itemToEdit?.price} />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="picture" className="text-right">
              Picture
            </Label>
      <Input id="picture" type="file" name="picture" className="col-span-3" />
      {uploadProgress !== null && (
        <div className="col-span-4 flex justify-center">
          <div className="w-48">
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div className="h-2 bg-primary" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs mt-1 text-center">Uploading: {uploadProgress}%</p>
            <div className="mt-2 flex gap-2 justify-center">
              {isUploading && (
                <Button variant="ghost" size="sm" onClick={() => { uploadCancelRef.current?.(); setIsUploading(false); setUploadProgress(null); setUploadError('Upload cancelled'); }}>
                  Cancel
                </Button>
              )}
              {uploadError && (
                <Button variant="ghost" size="sm" onClick={() => { setUploadError(null); setUploadProgress(null); }}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
       <p className="col-span-4 text-xs text-muted-foreground text-center">
        Optional: upload an image for your listing.
      </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? (isEdit ? 'Saving...' : 'Listing Item...') : (isEdit ? 'Save Changes' : 'List Item')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
