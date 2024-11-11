import { Elysia, NotFoundError } from "elysia";
import { cors } from "@elysiajs/cors";
import { MapsScraper } from "./MapScraper";
import { ScrapeResult, ScrapingJob } from "./types/scrapingjob";
import type { Business } from "./types/business";

interface ScrapeRequest {
  query: string;
  location: string;
  limit?: number;
}

interface JobWithResults extends ScrapingJob {
  businesses?: Business[];
}

// Use a Map to store both jobs and their results
const jobs = new Map<string, JobWithResults>();

const app = new Elysia()
  .use(
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  )
  .onError(({ error, set }) => {
    console.error("API Error:", error);
    if (error instanceof NotFoundError) {
      set.status = error.code === "NOT_FOUND" ? 404 : 500;
    } else {
      set.status = 500;
    }
    return {
      error: error.message || "Internal Server Error",
      status: set.status,
    };
  })
  .post("/api/scrape", async ({ body }) => {
    const { query, location, limit = 10 } = body as ScrapeRequest;

    if (!query?.trim() || !location?.trim()) {
      throw new Error("Query and location are required and cannot be empty");
    }

    const jobId = crypto.randomUUID();
    const job: JobWithResults = {
      id: jobId,
      status: "pending",
      query,
      radius: 0,
      resultsCount: 0,
      location,
      limit,
      startedAt: new Date().toISOString(),
    };

    jobs.set(jobId, job);

    scrapeInBackground(job).catch((error) => {
      console.error(`Job ${jobId} failed:`, error);
    });

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
  .get("/api/jobs/:id/businesses", ({ params: { id } }) => {
    const job = jobs.get(id);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status === "pending") {
      return {
        status: "pending",
        message: "Scraping is still in progress",
      };
    }

    if (job.status === "failed") {
      throw new Error(`Job failed: ${job.error}`);
    }

    return {
      status: job.status,
      businesses: job.businesses || [],
      total: job.resultsCount,
    };
  })
  .listen(8080);

console.log(`Listening on ${app.server!.url}`);

// Rest of your code remains the same...
function validateAndTransformBusiness(result: ScrapeResult): Business | null {
  // Ensure all required fields are present
  if (!result.name) {
    return null;
  }

  // Create a valid Business object with required fields and optional fields
  const business: Business = {
    name: result.name,
    address: result.address || "",
    website: result.website || "",
    phone: result.phone || "",
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Add optional fields if they exist
    ...(result.reviewCount !== undefined && {
      reviewCount: result.reviewCount,
    }),
    ...(result.averageRating !== undefined && {
      averageRating: result.averageRating,
    }),
    ...(result.introduction !== undefined && {
      introduction: result.introduction,
    }),
    ...(result.storeType !== undefined && { storeType: result.storeType }),
    ...(result.openingHours !== undefined && {
      openingHours: result.openingHours,
    }),
  };

  return business;
}

async function scrapeInBackground(job: JobWithResults) {
  try {
    const scrapeResults = await MapsScraper.scrapeBusinesses(
      job.query,
      job.location,
      job.limit
    );

    // Transform and validate the results
    const validBusinesses = scrapeResults
      .map(validateAndTransformBusiness)
      .filter((business): business is Business => business !== null);

    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.resultsCount = validBusinesses.length;
    job.businesses = validBusinesses;
    jobs.set(job.id, job);

    // If you want to store in database:
    // await prisma.business.createMany({
    //   data: validBusinesses,
    //   skipDuplicates: true,
    // });
  } catch (error) {
    job.status = "failed";
    job.error =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : "Unknown error occurred";
    jobs.set(job.id, job);
    throw error;
  }
}
