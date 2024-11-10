import { Elysia } from "elysia";
import { MapsScraper } from "./MapScrapper";
import { ScrapingJob } from "./types/scrapingjob";

interface ScrapeRequest {
  query: string;
  location: string;
  radius?: number;
}

// In-memory storage for jobs (replace with database in production)
const jobs = new Map<string, ScrapingJob>();

const app = new Elysia()
  .get("/", () => ({ hello: "Bun👋" }))
  .post("/api/scrape", async ({ body }) => {
    const { query, location, radius = 5000 } = body as ScrapeRequest;

    // Validation
    if (!query || !location) {
      throw new Error("Query and location are required");
    }

    const jobId = crypto.randomUUID();
    const job: ScrapingJob = {
      id: jobId,
      status: "pending",
      query,
      location,
      radius,
      startedAt: new Date().toISOString(),
    };

    // Store job
    jobs.set(jobId, job);

    // Start scraping in background
    scrapeInBackground(job);

    return {
      message: "Scraping job started",
      jobId: job.id,
    };
  })
  .get("/api/jobs/:id", ({ params: { id } }) => {
    const job = jobs.get(id);
    if (!job) {
      throw new Error("Job not found");
    }
    return job;
  })
  .listen(8080);

async function scrapeInBackground(job: ScrapingJob) {
  try {
    const businesses = await MapsScraper.scrapeBusinesses(
      job.query,
      job.location,
      job.radius
    );

    // Store results (replace with your database logic)
    // await BusinessRepository.insertMany(businesses.map(b => ({
    //   ...b,
    //   status: 'new',
    //   createdAt: new Date().toISOString(),
    //   updatedAt: new Date().toISOString()
    // })));

    // Update job status
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    jobs.set(job.id, job);
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Unknown error";
    jobs.set(job.id, job);
  }
}

console.log(`Listening on ${app.server?.url}`);
