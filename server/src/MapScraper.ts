import { chromium, type Page } from "playwright";
import type { Business } from "../../types/business";
import { ScrapeResult } from "../../types/scrapingjob";
import { Logger } from "./Logger";

export class MapsScraper {
  private static readonly TIMEOUT = 60000;
  private static readonly logger = new Logger("MapsScraper");

  static async scrapeBusinesses(
    query: string,
    location: string,
    limit: number = 10
  ): Promise<ScrapeResult[]> {
    this.logger.info(`Starting scraping job`, { query, location, limit });

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    console.log(`Starting scrape for: ${query} in ${location}`);
    try {
      // Navigate to Google Maps
      this.logger.info(`Navigating to Google Maps`);
      await page.goto("https://www.google.com/maps", {
        timeout: this.TIMEOUT,
        waitUntil: "networkidle",
      });

      // Search for businesses
      this.logger.info(`Initiating search for: "${query}" in "${location}"`);
      const searchBox = await page.waitForSelector("#searchboxinput");
      await searchBox?.fill(`${query} in ${location}`);
      await page.keyboard.press("Enter");

      // Wait for results to load in the left sidebar
      this.logger.info(`Waiting for search results to load`);
      await page.waitForSelector(
        'a[href^="https://www.google.com/maps/place"]'
      );
      // Scroll to load more results
      this.logger.info(`Loading more results up to limit: ${limit}`);
      const listings = await this.loadMoreResults(page, limit);
      this.logger.info(`Found ${listings.length} total listings`);

      // Process each listing
      const results: ScrapeResult[] = [];
      for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];
        try {
          this.logger.info(`Processing listing ${i + 1}/${listings.length}`);
          await listing.click();

          // Wait for business details panel to load
          await page.waitForSelector("h1.DUwDvf", { timeout: 5000 });

          // Extract business data including the website URL
          const result = await this.extractBusinessData(page);
          if (result.name) {
            results.push(result);
            this.logger.info(`Successfully extracted data for: ${result.name}`);
          } else {
            this.logger.warn(
              `Skipping listing ${i + 1} - No business name found`
            );
          }

          await page.waitForTimeout(2000);
        } catch (error) {
          this.logger.error(`Error processing listing ${i + 1}`, error);
          continue;
        }
      }

      this.logger.info(`Scraping completed successfully`, {
        totalResults: results.length,
        successRate: `${((results.length / listings.length) * 100).toFixed(
          1
        )}%`,
      });

      return results;
    } catch (error) {
      this.logger.error(`Scraping job failed`, error);
      throw error;
    } finally {
      this.logger.info(`Cleaning up browser resources`);
      await context.close();
      await browser.close();
    }
  }

  private static async loadMoreResults(
    page: Page,
    desired: number
  ): Promise<any[]> {
    let previousCount = 0;
    let attempts = 0;
    const maxAttempts = 5;

    const feedContainer = await page.waitForSelector('div[role="feed"]');
    if (!feedContainer) {
      this.logger.error("Could not find results feed container");
      return [];
    }

    while (attempts < maxAttempts) {
      await feedContainer.evaluate((element) => {
        element.scrollTo(0, element.scrollHeight);
      });
      await page.waitForTimeout(2000);

      const listings = await page.$$(
        'a[href^="https://www.google.com/maps/place"]'
      );

      this.logger.info(`Scroll attempt ${attempts + 1}/${maxAttempts}`, {
        currentListings: listings.length,
        desiredListings: desired,
      });

      if (listings.length < desired) {
        this.logger.info(
          `Found fewer listings than desired - reached end of available results`,
          {
            found: listings.length,
            desired,
          }
        );
        return listings;
      }

      if (listings.length >= desired) {
        this.logger.info(`Reached desired number of listings`, {
          found: listings.length,
          desired,
        });
        return listings.slice(0, desired);
      }

      if (listings.length === previousCount) {
        this.logger.info(
          `No new listings found after scrolling - reached end of results`,
          {
            totalFound: listings.length,
          }
        );
        return listings;
      }

      previousCount = listings.length;
      attempts++;
    }

    this.logger.info(`Finished loading results`, {
      foundListings: previousCount,
      desiredListings: desired,
    });

    // Return all found listings, even if fewer than desired
    const finalListings = await page.$$(
      'div[role="feed"] > div[role="article"]'
    );
    return finalListings;
  }

  private static async extractBusinessData(page: Page): Promise<ScrapeResult> {
    const selectors = {
      name: "h1.DUwDvf",
      address: 'button[data-item-id="address"] div.fontBodyMedium',
      website: 'a[data-item-id="authority"]',
      phone: 'button[data-item-id^="phone:tel:"] div.fontBodyMedium',
      reviewCount: "div.F7nice span[aria-label]",
      rating: 'div.F7nice span[aria-hidden="true"]',
      introduction: "div.WeS02d div.PYvSYb",
      storeType: "div.LBgpqf button.DkEaL",
      hours: 'button[data-item-id="oh"] div.fontBodyMedium',
    };

    const getText = async (selector: string): Promise<string> => {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        return await page.$eval(selector, (el) => el.textContent || "");
      } catch (error) {
        this.logger.warn(
          `Failed to extract text for selector: ${selector}`,
          error
        );
        return "";
      }
    };

    const getNumber = (text: string): number => {
      const num = text.replace(/[^0-9.]/g, "");
      return num ? parseFloat(num) : 0;
    };

    this.logger.info(`Starting data extraction for business`);

    const name = await getText(selectors.name);
    const reviewText = await getText(selectors.reviewCount);
    const ratingText = await getText(selectors.rating);

    let websiteUrl = "";
    try {
      const websiteElement = await page.$(selectors.website);
      if (websiteElement) {
        websiteUrl = (await websiteElement.getAttribute("href")) || "";
        this.logger.info(`Website URL found: ${websiteUrl}`);
      } else {
        this.logger.info(`No website URL found for business`);
      }
    } catch (error) {
      this.logger.error(`Error extracting website URL`, error);
    }

    const result: ScrapeResult = {
      name: name.trim(),
      address: (await getText(selectors.address)).trim(),
      website: websiteUrl,
      phone: (await getText(selectors.phone)).trim(),
      reviewCount: getNumber(reviewText),
      averageRating: getNumber(ratingText),
      introduction: (await getText(selectors.introduction)).trim(),
      storeType: (await getText(selectors.storeType)).trim(),
      openingHours: (await getText(selectors.hours)).trim(),
      status: "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.logger.info(`Data extraction completed`, {
      businessName: result.name,
      hasWebsite: !!result.website,
      hasPhone: !!result.phone,
      hasReviews: !!result.reviewCount,
    });

    return result;
  }
}
