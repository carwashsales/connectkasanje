import { PlaceHolderImages } from "@/lib/placeholder-images";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AdBannerProps = {
  id: 'sidebar-ad' | 'news-feed-ad';
}

export function AdBanner({ id }: AdBannerProps) {
  const adData = id === 'sidebar-ad' 
    ? PlaceHolderImages.find(img => img.id === 'ad-banner-2')
    : PlaceHolderImages.find(img => img.id === 'ad-banner-1');
  
  if (!adData) return null;

  if (id === 'sidebar-ad') {
    return (
      <Card className="overflow-hidden border-accent/50 shadow-sm relative group">
        <Badge className="absolute top-2 right-2 z-10 bg-accent text-accent-foreground text-xs">Ad</Badge>
        <Image 
          src={adData.imageUrl} 
          alt="Advertisement" 
          width={300}
          height={300}
          className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
          data-ai-hint={adData.imageHint}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"/>
        <div className="absolute bottom-0 left-0 p-4">
          <h3 className="font-bold text-lg text-white font-headline">Learn New Skills</h3>
          <p className="text-sm text-white/80">Expand your horizon today.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden shadow-sm relative group">
        <Badge className="absolute top-2 right-2 z-10 bg-accent text-accent-foreground text-xs">Ad</Badge>
        <div className="relative w-full h-40">
            <Image 
                src={adData.imageUrl} 
                alt="Advertisement" 
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                data-ai-hint={adData.imageHint}
            />
             <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent"/>
        </div>
        <div className="absolute top-0 left-0 p-6 h-full flex flex-col justify-center">
            <h3 className="font-bold text-2xl text-white font-headline">The Daily Grind</h3>
            <p className="text-md text-white/80 max-w-sm">Your daily dose of perfection. Visit us on Main St.</p>
        </div>
    </Card>
  )
}
