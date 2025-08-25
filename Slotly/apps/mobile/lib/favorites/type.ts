export type FavoriteKind = "service" | "institution";

export interface FavoriteItem {
  id: string;                // serviceId or businessId
  kind: FavoriteKind;
  name: string;
  location?: string;
  imageUrl?: string;
  rating?: number;           // 1..5
  distanceKm?: number;       // optional for “near you”
}