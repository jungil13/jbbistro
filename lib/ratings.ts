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

export const FALLBACK_RATINGS: CustomerRating[] = [
  {
    id: "seed-1",
    name: "Maria Santos",
    rating: 5,
    comment:
      "Celebrated my 30th birthday in their VIP Karaoke Suite! The sound system is top-notch, the mood lighting is fantastic, and the pulutan platter kept coming hot and delicious. Highly recommended!",
    service_type: "VIP Karaoke Suite",
    is_verified: true,
    status: "approved",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: "seed-2",
    name: "Chef Alejandro D.",
    rating: 5,
    comment:
      "The steaks and wine selection exceeded our expectations. Beautiful intimate dining atmosphere right here in Liloan. The staff made us feel like royalty from start to finish.",
    service_type: "Fine Dining & Wine",
    is_verified: true,
    status: "approved",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  },
  {
    id: "seed-3",
    name: "Carlos Mendoza",
    rating: 5,
    comment:
      "Best billiard tables in the area! Professional-grade slate, perfectly leveled, and the craft cocktails served right at the table made for an unforgettable leisure session.",
    service_type: "Billiards Lounge",
    is_verified: true,
    status: "approved",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
  },
  {
    id: "seed-4",
    name: "Kristine & Dave",
    rating: 5,
    comment:
      "Booked a dinner and karaoke combo for our anniversary. The ambiance was romantic, the food was exquisite, and the service was genuinely warm. Jbenz Bistro is a true hidden gem in Cebu!",
    service_type: "Dining & Karaoke Combo",
    is_verified: true,
    status: "approved",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
  },
  {
    id: "seed-5",
    name: "Jayson Tan",
    rating: 5,
    comment:
      "Very accommodating staff, super clean facilities, and the acoustic treatment in the karaoke rooms means you get punchy, crystal-clear vocals without noise bleeds. 10/10 experience.",
    service_type: "VIP Karaoke Suite",
    is_verified: true,
    status: "approved",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
  },
  {
    id: "seed-6",
    name: "Bea Gomez",
    rating: 5,
    comment:
      "Loved the signature crispy pata and cold local craft beers. Great spot to unwind after a long work week with colleagues. We will definitely be regular diners here!",
    service_type: "Pulutan & Beverages",
    is_verified: true,
    status: "approved",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 144).toISOString(),
  },
];
