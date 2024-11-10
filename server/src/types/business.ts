export interface Business {
  id?: number;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  websiteScore?: number;
  reviewCount?: number;
  averageRating?: number;
  introduction?: string;
  storeType?: string;
  openingHours?: string;
  lastContacted?: string;
  status: "new" | "contacted" | "following_up" | "converted" | "not_interested";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
