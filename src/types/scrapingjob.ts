export interface ScrapingJob {
  id: string;
  status: "pending" | "completed" | "failed";
  query: string;
  location: string;
  radius: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}
