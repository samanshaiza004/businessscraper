import { chromium } from "playwright";
import type { Business } from "../src/types/business";

/*
export interface Business {
  id?: number;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  websiteScore?: number;
  lastContacted?: string;
  status: "new" | "contacted" | "following_up" | "converted" | "not_interested";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

*/

export class MapsScraper {
  static async scrapeBusinesses(
    query: string,
    location: string,
    radius: number = 5000
  ): Promise<Partial<Business>[]> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Navigate to Google Maps
      await page.goto("https://www.google.com/maps");

      // Accept cookies if prompt appears
      try {
        await page.click('button:has-text("Accept all")');
      } catch (e) {
        // Cookie prompt might not appear
      }

      // Search for businesses
      await page.fill('input[name="q"]', `${query} in ${location}`);
      await page.press('input[name="q"]', "Enter");
      await page.waitForLoadState("networkidle");

      // Wait for results to load
      await page.waitForSelector('div[role="article"]');

      // Extract business data
      const businesses = await page.$$eval(
        'div[role="article"]',
        (elements) => {
          return elements.map((el) => {
            const nameEl = el.querySelector("h3");
            const addressEl = el.querySelector("[data-tooltip]");
            const ratingEl = el.querySelector('span[aria-label*="stars"]');
            const websiteEl = el.querySelector(
              'a[data-tooltip="Open website"]'
            );
            const phoneEl = el.querySelector('button[data-tooltip*="phone"]');

            return {
              name: nameEl?.textContent?.trim() || "",
              address: addressEl?.getAttribute("data-tooltip")?.trim() || "",
              rating: ratingEl
                ? parseFloat(
                    ratingEl.getAttribute("aria-label")?.split(" ")[0] || "0"
                  )
                : null,
              website: websiteEl?.getAttribute("href") || "",
              phone:
                phoneEl
                  ?.getAttribute("aria-label")
                  ?.replace("Phone:", "")
                  ?.trim() || "",
            };
          });
        }
      );

      return businesses.filter((b) => b.name && b.address);
    } finally {
      await browser.close();
    }
  }
}
