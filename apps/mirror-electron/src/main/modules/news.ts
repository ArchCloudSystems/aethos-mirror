import type { NewsFeed, NewsHeadline } from "@aethos/mirror-protocol";
import { getSecret, hasSecret, configValueOr, getConfig } from "../config-adapter";

/**
 * Read-only news adapter for Mirror.
 *
 * Fetches top headlines from NewsAPI when configured, otherwise returns a
 * clearly-marked fallback placeholder feed. The adapter NEVER throws and
 * NEVER includes secrets (API keys) in its return value or logs.
 *
 * Configuration is read from the unified config adapter (config.json +
 * secrets.env + .env.local + process.env) so adapter behavior and reported
 * status can never drift apart.
 */

const DEFAULT_PROVIDER = "newsapi";
const FETCH_TIMEOUT_MS = 5000;
const MAX_HEADLINES = 5;

function placeholderHeadlines(): NewsHeadline[] {
  return [
    {
      title: "News feed unavailable",
      source: "Aethos Mirror",
      url: null,
      publishedAt: null
    }
  ];
}

function buildFallback(provider: string): NewsFeed {
  return {
    source: "fallback",
    provider,
    headlines: placeholderHeadlines(),
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Fetch the current news feed. Always resolves — on any failure it returns a
 * fallback placeholder feed rather than rejecting.
 */
export async function getNewsFeed(): Promise<NewsFeed> {
  const config = getConfig();
  const provider = configValueOr("NEWS_PROVIDER", DEFAULT_PROVIDER);

  // Not configured: module disabled, provider disabled, or missing key.
  if (
    !config.modules.news ||
    !config.providers.newsApi.enabled ||
    !hasSecret("NEWS_API_KEY") ||
    provider !== DEFAULT_PROVIDER
  ) {
    return buildFallback(provider);
  }

  const apiKey = getSecret("NEWS_API_KEY");
  const country = configValueOr("NEWS_COUNTRY", "us");
  const category = getSecret("NEWS_CATEGORY");
  const query = getSecret("NEWS_QUERY");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = new URL("https://newsapi.org/v2/top-headlines");
    if (query.length > 0) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.set("country", country);
      if (category.length > 0) {
        url.searchParams.set("category", category);
      }
    }
    url.searchParams.set("pageSize", String(MAX_HEADLINES));

    const response = await fetch(url, {
      signal: controller.signal,
      // Pass the key via header so it never lands in a logged URL.
      headers: {
        accept: "application/json",
        "x-api-key": apiKey
      }
    });

    if (!response.ok) {
      console.warn(
        `[aethos-mirror] news provider responded ${response.status}`
      );
      return buildFallback(provider);
    }

    const data = (await response.json()) as {
      articles?: Array<{
        title?: string;
        url?: string;
        publishedAt?: string;
        source?: { name?: string };
      }>;
    };

    const articles = Array.isArray(data.articles) ? data.articles : [];
    const headlines: NewsHeadline[] = articles
      .slice(0, MAX_HEADLINES)
      .map((article) => ({
        title: article.title?.trim() || "Untitled",
        source: article.source?.name?.trim() || "Unknown",
        url: typeof article.url === "string" ? article.url : null,
        publishedAt:
          typeof article.publishedAt === "string" ? article.publishedAt : null
      }));

    if (headlines.length === 0) {
      return buildFallback(provider);
    }

    return {
      source: "live",
      provider,
      headlines,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`[aethos-mirror] news fetch failed: ${message}`);
    return buildFallback(provider);
  } finally {
    clearTimeout(timer);
  }
}
