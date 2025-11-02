import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const ProductCardSkeleton = () => {
  return (
    <Card className="flex flex-col h-full">
      <CardContent className="p-4 sm:p-5 lg:p-6 flex-1 flex flex-col">
        {/* Image skeleton */}
        <Skeleton className="aspect-[4/3] mb-3 sm:mb-4 rounded-lg" />
        
        {/* Content skeleton */}
        <div className="space-y-3 flex flex-col items-start flex-1">
          <div className="w-full space-y-2">
            {/* Product name */}
            <Skeleton className="h-6 w-3/4" />
            {/* Dosage */}
            <Skeleton className="h-4 w-1/2" />
          </div>
          
          {/* Badges */}
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          
          {/* Spacer */}
          <div className="flex-1"></div>
          
          {/* Price */}
          <div className="w-full pt-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 sm:p-5 lg:p-6 pt-0">
        {/* Button skeleton */}
        <Skeleton className="h-[44px] w-full" />
      </CardFooter>
    </Card>
  );
};
