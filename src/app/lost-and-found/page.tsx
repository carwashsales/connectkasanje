'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ItemCard } from "@/components/connect-hub/lost-and-found/item-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, SearchX } from "lucide-react";
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import type { LostFoundItem } from '@/lib/types';
import { PostLostFoundItemForm } from '@/components/connect-hub/lost-and-found/post-lost-found-item-form';
import { SearchBar } from '@/components/connect-hub/shared/search-bar';
import { Card } from '@/components/ui/card';
import supabase from '@/supabase/client';

function ItemListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="overflow-hidden shadow-sm">
          <div className="flex flex-col sm:flex-row">
            <div className="relative h-48 sm:h-auto sm:w-1/3 md:w-1/4 flex-shrink-0 bg-muted animate-pulse" />
            <div className="flex-grow p-6 space-y-3">
                <div className="h-6 w-1/2 rounded bg-muted animate-pulse" />
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ItemList({ items, loading, searchTerm }: { items: LostFoundItem[] | null, loading: boolean, searchTerm: string }) {
  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!searchTerm) return items;

    return items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);


  if (loading) {
    return <ItemListSkeleton />;
  }

  if (!filteredItems || filteredItems.length === 0) {
    return (
       <div className="text-center py-10 sm:py-20">
        <SearchX className="mx-auto h-16 w-16 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">
          {searchTerm ? "No Items Match Your Search" : "No Items Reported Yet"}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
           {searchTerm ? "Try a different search term." : "Be the first to post a lost or found item."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredItems.map((item) => <ItemCard key={item.id} item={item} />)}
    </div>
  );
}


export default function LostAndFoundPage() {
  const { user } = useUser();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchItems = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('posts')
          .select('id, user_id, title, body, media, metadata, created_at')
          .order('created_at', { ascending: false })
          .in('metadata->>type', ['lost','found']);
        if (error) throw error;
        if (!mounted) return;
        const mapped = (data || []).map((p: any) => ({
          id: p.id,
          type: p.metadata?.type ?? 'lost',
          name: p.title ?? 'Item',
          description: p.body ?? '',
          location: p.metadata?.location ?? '',
          contact: p.metadata?.contact ?? '',
          userId: p.user_id,
          image: { url: p.media?.url ?? `https://picsum.photos/seed/${Math.random()}/600/400`, hint: p.media?.path ?? '' },
          // Provide a lightweight Timestamp-like object with toDate() to satisfy existing UI usage
          createdAt: { toDate: () => new Date(p.created_at) } as any,
        }));
        setItems(mapped as unknown as LostFoundItem[]);
      } catch (error) {
        console.error("Failed to fetch lost and found items:", error);
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchItems();
  }, []);
  
  const lostItems = useMemo(() => items.filter(item => item.type === 'lost'), [items]);
  const foundItems = useMemo(() => items.filter(item => item.type === 'found'), [items]);

  return (
    <div className="container mx-auto py-8 px-4">
      <PostLostFoundItemForm isOpen={isFormOpen} onOpenChange={setIsFormOpen} onSave={async () => {
          // Re-fetch items after a new one is posted
          setLoading(true);
          try {
            const { data, error } = await supabase
              .from('posts')
              .select('id, user_id, title, body, media, metadata, created_at')
              .order('created_at', { ascending: false })
              .in('metadata->>type', ['lost','found']);
            if (error) throw error;
            const mapped = (data || []).map((p: any) => ({
              id: p.id,
              type: p.metadata?.type ?? 'lost',
              name: p.title ?? 'Item',
              description: p.body ?? '',
              location: p.metadata?.location ?? '',
              contact: p.metadata?.contact ?? '',
              userId: p.user_id,
              image: { url: p.media?.url ?? `https://picsum.photos/seed/${Math.random()}/600/400`, hint: p.media?.path ?? '' },
              createdAt: { toDate: () => new Date(p.created_at) } as any,
            }));
            setItems(mapped as unknown as LostFoundItem[]);
          } catch (err) {
            console.error('Failed to refresh lost & found items', err);
          } finally {
            setLoading(false);
          }
      }} />
      <Tabs defaultValue="lost" className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <TabsList>
            <TabsTrigger value="lost">Lost Items</TabsTrigger>
            <TabsTrigger value="found">Found Items</TabsTrigger>
          </TabsList>
          <div className="flex w-full sm:w-auto gap-2">
            <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Search lost & found..." />
            {user && !user.isAnonymous && (
              <Button onClick={() => setIsFormOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Post an Item
              </Button>
            )}
          </div>
        </div>
        <TabsContent value="lost">
          <ItemList items={lostItems} loading={loading} searchTerm={searchTerm} />
        </TabsContent>
        <TabsContent value="found">
          <ItemList items={foundItems} loading={loading} searchTerm={searchTerm} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
