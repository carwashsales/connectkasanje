'use client';

import React, { useRef, useState, useEffect } from 'react';
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
import { uploadToSupabase } from '@/lib/supabase';
import supabase from '@/supabase/client';
import { getUserId } from '@/lib/getUserId';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { LostFoundItem } from '@/lib/types';


type PostLostFoundItemFormProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  itemToEdit?: LostFoundItem;
  onSave?: () => void;
};

export function PostLostFoundItemForm({ isOpen, onOpenChange, itemToEdit, onSave }: PostLostFoundItemFormProps) {
  const { user: authUser } = useUser();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [itemType, setItemType] = useState<'lost' | 'found'>(itemToEdit?.type || 'lost');
  const isEdit = !!itemToEdit;

  useEffect(() => {
    if(isOpen) {
        if (itemToEdit) {
          setItemType(itemToEdit.type);
        } else {
          setItemType('lost');
          formRef.current?.reset();
        }
    }
  }, [itemToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  if (!formRef.current || !authUser) return;
    
    setLoading(true);
    
    const formData = new FormData(formRef.current);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const location = formData.get('location') as string;
    const contact = formData.get('contact') as string;

    if (!name || !description || !location || !contact) {
      toast({
        title: 'Error',
        description: 'Please fill out all fields.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    try {
      if (isEdit && itemToEdit) {
        const updates: any = {
          title: name,
          body: description,
          metadata: { ...(itemToEdit as any).metadata, type: itemType, location, contact },
        };
        const { error } = await supabase.from('posts').update(updates).eq('id', itemToEdit.id);
        if (error) throw error;
        toast({ title: 'Success!', description: 'Item updated successfully!' });
      } else {
        let imageUrl = `https://picsum.photos/seed/${Math.random()}/600/400`;
        let imageHint = 'item';
        const file = (formRef.current as HTMLFormElement).querySelector('#picture') as HTMLInputElement | null;
        if (file?.files && file.files[0]) {
          try {
            const uploaded = await uploadToSupabase(file.files[0], 'ft');
            imageUrl = uploaded.publicUrl;
            imageHint = uploaded.path;
          } catch (err) {
            console.error('Upload failed', err);
            toast({ title: 'Upload Error', description: 'Could not upload image. Using placeholder.', variant: 'destructive' });
          }
        }
        const userId = (authUser as any)?.id ?? (authUser as any)?.uid;
        const { error } = await supabase.from('posts').insert([{ 
          user_id: userId,
          title: name,
          body: description,
          media: { url: imageUrl, path: imageHint },
          metadata: { type: itemType, location, contact },
          visibility: 'public'
        }]);
        if (error) throw error;
        toast({ title: 'Success!', description: 'Item posted successfully!' });
      }
      
      onSave?.();
      onOpenChange(false);

    } catch (error) {
      console.error("Error writing document: ", error);
      toast({
        title: 'Database Error',
        description: `Could not ${isEdit ? 'update' : 'post'} item.`,
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
          <DialogTitle className="font-headline">{isEdit ? 'Edit Item' : 'Report an Item'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the details of your item.' : 'Fill out the details below to post a lost or found item.'}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Type</Label>
            <RadioGroup
              defaultValue={itemType}
              className="col-span-3 flex gap-4"
              value={itemType}
              onValueChange={(value: 'lost' | 'found') => setItemType(value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="lost" id="r-lost" />
                <Label htmlFor="r-lost">Lost</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="found" id="r-found" />
                <Label htmlFor="r-found">Found</Label>
              </div>
            </RadioGroup>
          </div>

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
            <Label htmlFor="location" className="text-right">
              Location
            </Label>
            <Input id="location" name="location" placeholder="e.g., Central Park" className="col-span-3" required defaultValue={itemToEdit?.location} />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="contact" className="text-right">
              Contact Info
            </Label>
            <Input id="contact" name="contact" placeholder="e.g., Your phone or email" className="col-span-3" required defaultValue={itemToEdit?.contact} />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="picture" className="text-right">
              Picture
            </Label>
      <Input id="picture" type="file" name="picture" className="col-span-3" />
       <p className="col-span-4 text-xs text-muted-foreground text-center">
        Optional: upload a photo of the item.
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
              {loading ? (isEdit ? 'Saving...' : 'Posting...') : (isEdit ? 'Save Changes' : 'Post Item')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
