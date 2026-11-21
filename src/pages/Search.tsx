import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search as SearchIcon,
  MapPin,
  Star,
  Bed,
  Utensils,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Tabs from "../components/ui/Tabs";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import Spinner from "../components/ui/Spinner";
import Avatar from "../components/ui/Avatar";
import { searchApi } from "../api";
import { useToast } from "../context/toastContext";
import { ROUTES, DEFAULT_PAGE_SIZE } from "../utils/constants";
import { formatCurrency } from "../utils/formatCurrency";
import type { Restaurant, Property, Location } from "../types";

const TABS = [
  { key: "all", label: "All" },
  { key: "restaurants", label: "Restaurants" },
  { key: "accommodations", label: "Accommodations" },
  { key: "properties", label: "Properties" },
];

export default function Search() {
  const { error: toastError } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlTown = searchParams.get("town") ?? "";
  const urlCuisine = searchParams.get("cuisine") ?? "";
  const activeRequest = useRef(0);

  const [tab, setTab] = useState("all");
  const [q, setQ] = useState(urlQuery);
  const [town, setTown] = useState(urlTown);
  const [cuisine, setCuisine] = useState(urlCuisine);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationError, setLocationError] = useState(false);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [accommodations, setAccommodations] = useState<Property[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    searchApi
      .locations({ limit: 100 })
      .then((res) => {
        if (active) setLocations(res);
      })
      .catch(() => {
        if (active) setLocationError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchData = async (
    filters: { q: string; town: string; cuisine: string },
    activeTab: string,
  ) => {
    const requestId = ++activeRequest.current;
    setLoading(true);
    setError(null);
    const params = {
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
      q: filters.q.trim() || undefined,
      town: filters.town || undefined,
      cuisine: filters.cuisine || undefined,
    };
    const includeRestaurants =
      activeTab === "all" || activeTab === "restaurants";
    const includeAccommodations =
      activeTab === "all" || activeTab === "accommodations";
    const includeProperties =
      activeTab === "all" || activeTab === "properties";

    const [restaurantResult, accommodationResult, propertyResult] =
      await Promise.allSettled([
        includeRestaurants
          ? searchApi.restaurants(params)
          : Promise.resolve(null),
        includeAccommodations
          ? searchApi.accommodations(params)
          : Promise.resolve(null),
        includeProperties
          ? searchApi.properties(params)
          : Promise.resolve(null),
      ]);

    if (requestId !== activeRequest.current) return;

    setRestaurants(
      restaurantResult.status === "fulfilled"
        ? restaurantResult.value?.data ?? []
        : [],
    );
    setAccommodations(
      accommodationResult.status === "fulfilled"
        ? accommodationResult.value?.data ?? []
        : [],
    );
    setProperties(
      propertyResult.status === "fulfilled"
        ? propertyResult.value?.data ?? []
        : [],
    );

    const failedCategories = [
      includeRestaurants && restaurantResult.status === "rejected"
        ? "restaurants"
        : null,
      includeAccommodations && accommodationResult.status === "rejected"
        ? "accommodations"
        : null,
      includeProperties && propertyResult.status === "rejected"
        ? "properties"
        : null,
    ].filter((category): category is string => category !== null);

    if (failedCategories.length > 0) {
      setError(`Could not load ${failedCategories.join(", ")} results.`);
      toastError("Some search results could not be loaded");
    }
    setLoading(false);
  };

  useEffect(() => {
    setQ(urlQuery);
    setTown(urlTown);
    setCuisine(urlCuisine);
    void fetchData(
      { q: urlQuery, town: urlTown, cuisine: urlCuisine },
      tab,
    );
    return () => {
      activeRequest.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, urlQuery, urlTown, urlCuisine]);

  const applyFilters = (filters: {
    q: string;
    town: string;
    cuisine: string;
  }) => {
    const params = new URLSearchParams();
    const trimmedQuery = filters.q.trim();
    if (trimmedQuery) params.set("q", trimmedQuery);
    if (filters.town) params.set("town", filters.town);
    if (filters.cuisine) params.set("cuisine", filters.cuisine);
    if (params.toString() === searchParams.toString()) {
      void fetchData(filters, tab);
    } else {
      setSearchParams(params);
    }
  };

  const locationOptions = useMemo(
    () =>
      locations.map((l) => ({
        label: l.county ? `${l.name} · ${l.county}` : l.name,
        value: l.name,
      })),
    [locations]
  );

  const cuisineOptions = [
    { label: "African", value: "african" },
    { label: "Italian", value: "italian" },
    { label: "Chinese", value: "chinese" },
    { label: "Indian", value: "indian" },
    { label: "Fast food", value: "fast_food" },
    { label: "Seafood", value: "seafood" },
    { label: "Other", value: "other" },
  ];

  const total =
    restaurants.length + accommodations.length + properties.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Explore</h1>
        <p className="mt-1 text-sm text-text-muted">
          Discover stays, restaurants, and properties across Kenya.
        </p>
      </div>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters({ q, town, cuisine });
          }}
          className="grid grid-cols-1 gap-3 md:grid-cols-4"
        >
          <div className="md:col-span-2">
            <Input
              placeholder="Search destinations, experiences..."
              leftIcon={<SearchIcon className="h-4 w-4" />}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select
            placeholder="Any town"
            value={town}
            onChange={(e) => setTown(e.target.value)}
            options={locationOptions}
          />
          <div className="flex gap-2">
            <Button type="submit" fullWidth>
              Search
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQ("");
                setTown("");
                setCuisine("");
                applyFilters({ q: "", town: "", cuisine: "" });
              }}
            >
              Reset
            </Button>
          </div>

          {(tab === "all" || tab === "restaurants") && (
            <div className="md:col-span-4">
              <Select
                placeholder="Any cuisine"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                options={cuisineOptions}
              />
            </div>
          )}
          {locationError && (
            <p className="text-xs text-amber-700 md:col-span-4" role="status">
              Town options could not be loaded. You can still search by keyword.
            </p>
          )}
        </form>
      </Card>

      <Tabs tabs={TABS} activeKey={tab} onChange={setTab} />

      {error && (
        <Alert variant="danger" title="Failed to load">
          {error}
        </Alert>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!loading && !error && total === 0 && (
        <EmptyState
          icon={<SearchIcon className="h-6 w-6" />}
          title="No results"
          description="Try a different search term or town."
        />
      )}

      {!loading && restaurants.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Restaurants
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {restaurants.map((r) => (
              <Card
                key={r._id}
                padded={false}
                className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md"
              >
                <div
                  aria-hidden="true"
                  className="h-36 shrink-0 bg-secondary-100 bg-cover bg-center sm:h-40"
                  style={{
                    backgroundImage: r.coverImage
                      ? `url(${r.coverImage})`
                      : undefined,
                  }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
                  <div className="flex items-start gap-2">
                    <Avatar
                      src={r.logo ?? undefined}
                      fallback={r.name}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {r.name}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {r.town}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Star className="h-3.5 w-3.5 fill-secondary-500 text-secondary-500" />
                    {r.rating.toFixed(1)}
                    <span className="text-text-muted">
                      ({r.totalRatings})
                    </span>
                  </div>
                  <Link
                    to={ROUTES.RESTAURANT}
                    className="mt-auto inline-flex min-h-9 w-full items-center justify-center rounded-md bg-secondary-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-secondary-600 sm:text-sm"
                  >
                    View menu
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!loading && accommodations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Accommodations
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {accommodations.map((a) => (
              <Card
                key={a._id}
                padded={false}
                className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md"
              >
                <div
                  aria-hidden="true"
                  className="h-36 shrink-0 bg-secondary-100 bg-cover bg-center sm:h-40"
                  style={{
                    backgroundImage: a.coverImage
                      ? `url(${a.coverImage})`
                      : a.images?.[0]
                        ? `url(${a.images[0]})`
                        : undefined,
                  }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
                  <div className="flex items-start gap-2">
                    <Avatar
                      src={
                        a.coverImage ?? a.images?.[0] ?? undefined
                      }
                      fallback={a.name}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {a.name}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {a.town}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Bed className="h-3.5 w-3.5 text-secondary-600" />
                    {a.type}
                    <span className="ml-auto inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-secondary-500 text-secondary-500" />
                      {a.rating.toFixed(1)}
                    </span>
                  </div>
                  {a.minPrice != null && (
                    <p className="text-sm font-semibold text-text-primary">
                      From {formatCurrency(a.minPrice, a.currency || "KES")}
                      <span className="ml-1 text-xs font-normal text-text-muted">
                        / night
                      </span>
                    </p>
                  )}
                  <Link
                    to={`/accommodation/${a.slug || a._id}`}
                    className="mt-auto inline-flex min-h-9 w-full items-center justify-center rounded-md bg-secondary-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-secondary-600 sm:text-sm"
                  >
                    View rooms
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!loading && properties.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Properties
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {properties.map((p) => (
              <Card
                key={p._id}
                padded={false}
                className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md"
              >
                <div
                  aria-hidden="true"
                  className="h-36 shrink-0 bg-secondary-100 bg-cover bg-center sm:h-40"
                  style={{
                    backgroundImage: p.images?.[0]
                      ? `url(${p.images[0]})`
                      : undefined,
                  }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    <Link
                      to={`/accommodation/${p.slug || p._id}`}
                      className="hover:text-secondary-700"
                    >
                      {p.name}
                    </Link>
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-text-muted">
                    <MapPin className="h-3.5 w-3.5" /> {p.town}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Star className="h-3.5 w-3.5 fill-secondary-500 text-secondary-500" />
                    {p.rating.toFixed(1)}
                    <Badge variant="neutral">{p.type}</Badge>
                  </div>
                  {p.minPrice != null && (
                    <p className="text-sm font-semibold text-text-primary">
                      From {formatCurrency(p.minPrice, p.currency || "KES")}
                      <span className="ml-1 text-xs font-normal text-text-muted">
                        / night
                      </span>
                    </p>
                  )}
                  <Link
                    to={`/accommodation/${p.slug || p._id}`}
                    className="mt-auto inline-flex min-h-9 w-full items-center justify-center rounded-md bg-secondary-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-secondary-600 sm:text-sm"
                  >
                    View property
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}