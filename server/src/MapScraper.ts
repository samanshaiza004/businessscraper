import { chromium, type Page } from "playwright";
import type { Business } from "../src/types/business";
import { ScrapeResult } from "./types/scrapingjob";

export class MapsScraper {
  private static readonly TIMEOUT = 60000;

  static async scrapeBusinesses(
    query: string,
    location: string,
    limit: number = 10
  ): Promise<ScrapeResult[]> {
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
      await page.goto("https://www.google.com/maps", {
        timeout: this.TIMEOUT,
        waitUntil: "networkidle",
      });

      // Search for businesses
      const searchBox = await page.waitForSelector("#searchboxinput");
      await searchBox?.fill(`${query} in ${location}`);
      await page.keyboard.press("Enter");

      // Wait for results to load
      await page.waitForSelector(
        'a[href^="https://www.google.com/maps/place"]'
      );

      // Scroll to load more results
      const listings = await this.loadMoreResults(page, limit);
      console.log(`Found ${listings.length} results`);

      // Process each listing
      const results: ScrapeResult[] = [];
      for (const listing of listings.slice(0, limit)) {
        try {
          await listing.click();

          // Wait for business details panel to load
          await page.waitForSelector("h1.DUwDvf", { timeout: 5000 });

          // Extract business data including the website URL
          const result = await this.extractBusinessData(page);
          if (result.name) {
            results.push(result);
          }

          // Add a short wait to ensure the next listing can be clicked properly
          await page.waitForTimeout(2000);
        } catch (error) {
          console.error("Error processing listing:", error);
          continue;
        }
      }

      return results;
    } catch (error) {
      console.error("Scraping failed:", error);
      throw error;
    } finally {
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
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      await page.mouse.wheel(0, 10000);
      await page.waitForTimeout(2000);

      const listings = await page.$$(
        'a[href^="https://www.google.com/maps/place"]'
      );

      if (listings.length >= desired) {
        return listings.slice(0, desired);
      }

      if (listings.length === previousCount) {
        attempts++;
      } else {
        previousCount = listings.length;
        attempts = 0;
      }
    }

    return await page.$$('a[href^="https://www.google.com/maps/place"]');
  }

  private static async extractBusinessData(page: Page): Promise<ScrapeResult> {
    const selectors = {
      name: "h1.DUwDvf",
      address: 'button[data-item-id="address"] div.fontBodyMedium',
      website: 'a[data-item-id="authority"]', // Updated to grab the anchor tag directly
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
      } catch {
        return "";
      }
    };

    const getNumber = (text: string): number => {
      const num = text.replace(/[^0-9.]/g, "");
      return num ? parseFloat(num) : 0;
    };

    const name = await getText(selectors.name);
    const reviewText = await getText(selectors.reviewCount);
    const ratingText = await getText(selectors.rating);

    // Extract website URL from the 'website' selector, if available
    let websiteUrl = "";
    try {
      const websiteElement = await page.$(selectors.website);
      if (websiteElement) {
        websiteUrl = (await websiteElement.getAttribute("href")) || "";
      }
    } catch (error) {
      console.error("Website URL not found for this business:", error);
    }

    return {
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
  }
}
