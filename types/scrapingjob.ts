import { Business } from "./business";

export interface ScrapingJob {
  resultsCount: number;
  limit: number;
  id: string;
  status: "pending" | "completed" | "failed";
  query: string;
  location: string;
  radius: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface JobWithResults extends ScrapingJob {
  businesses?: Business[];
}

export interface ScrapeResult extends Partial<Business> {
  reviewCount?: number;
  averageRating?: number;
  introduction?: string;
  storeType?: string;
  openingHours?: string;
}
