import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  AlertCircle,
  Building2,
  Globe,
  Phone,
  Clock,
  Search,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

const LeadsDashboard = () => {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [limit, setLimit] = useState(10);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: string | number | NodeJS.Timeout | undefined;

    if (currentJobId && jobStatus === "pending") {
      intervalId = setInterval(checkJobStatus, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentJobId, jobStatus]);

  const startScraping = async () => {
    try {
      setLoading(true);
      setError(null);
      setProgress("Initiating search...");

      const response = await fetch("http://localhost:8080/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, location, limit }),
      });

      const data: Partial<ScrapingJob> = await response.json();

      if (!response.ok)
        throw new Error(data.error || "Failed to start scraping");

      setCurrentJobId(data.id || null);
      setJobStatus("pending");
      setProgress("Scraping in progress...");
    } catch (err: any) {
      setError(err.message);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  const checkJobStatus = async () => {
    try {
      const response = await fetch(
        `http://localhost:8080/api/jobs/${currentJobId}/businesses`
      );
      const data: JobWithResults = await response.json();

      if (data.status === "completed") {
        setJobStatus("completed");
        setBusinesses(data.businesses || []);
        setProgress(null);
      } else if (data.status === "failed") {
        setJobStatus("failed");
        setError(data.error || "Unknown error");
        setProgress(null);
      } else {
        setProgress("Scraping in progress...");
      }
    } catch (err: any) {
      setError(err.message);
      setJobStatus("failed");
      setProgress(null);
    }
  };

  const analytics = {
    totalLeads: businesses.length,
    withWebsite: businesses.filter((b) => !!b.website).length,
    withPhone: businesses.filter((b) => !!b.phone).length,
    averageRating:
      businesses.reduce((acc, b) => acc + (b.averageRating || 0), 0) /
      (businesses.length || 1),
  };

  const ratingDistribution = businesses.reduce<Record<number, number>>(
    (acc, business) => {
      const rating = Math.floor(business.averageRating || 0);
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    },
    {}
  );

  const chartData = Object.entries(ratingDistribution).map(
    ([rating, count]) => ({
      rating: `${rating} stars`,
      count,
    })
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Web Development Leads Scraper</CardTitle>
          <CardDescription>
            Search for potential clients on Google Maps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Search query (e.g., 'small businesses')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="Limit"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="w-24"
            />
            <Button
              onClick={startScraping}
              disabled={loading || !query || !location}
              className="w-32"
            >
              {loading ? (
                <Spinner className="animate-spin" />
              ) : (
                <>
                  <Search className="mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {progress && (
            <div className="flex items-center gap-2 text-gray-600">
              <Spinner className="animate-spin" />
              <span>{progress}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {jobStatus === "completed" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalLeads}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  With Website
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.withWebsite}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  With Phone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.withPhone}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Rating
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.averageRating.toFixed(1)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Rating Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="rating" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leads List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {businesses.map((business, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {business.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                            <Building2 className="h-4 w-4" />
                            {business.address}
                          </div>
                          {business.website && (
                            <div className="flex items-center gap-2 text-sm text-blue-600 mt-1">
                              <Globe className="h-4 w-4" />
                              <a
                                href={business.website}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {business.website}
                              </a>
                            </div>
                          )}
                          {business.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                              <Phone className="h-4 w-4" />
                              {business.phone}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {business.averageRating && (
                            <div className="text-lg font-semibold">
                              ⭐️ {business.averageRating.toFixed(1)}
                            </div>
                          )}
                          {business.reviewCount && (
                            <div className="text-sm text-gray-600">
                              {business.reviewCount} reviews
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default LeadsDashboard;
