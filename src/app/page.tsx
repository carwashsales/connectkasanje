'use client';

import { NewsFeed } from "@/components/connect-hub/news-feed/news-feed";

export default function Home() {
  return (
    <div className="container mx-auto max-w-3xl py-8">
      <NewsFeed />
    </div>
  );
}
