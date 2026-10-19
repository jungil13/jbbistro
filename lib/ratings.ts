export interface CustomerRating {
  id: string;
  name: string;
  rating: number;
  comment: string;
  service_type: string;
  is_verified: boolean;
  status: "approved" | "pending" | "rejected";
  created_at: string;
}

// No dump users; only authentic customer reviews from the database
export const FALLBACK_RATINGS: CustomerRating[] = [];
