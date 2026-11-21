import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bed,
  Car,
  CreditCard,
  MapPin,
  Search,
  MessageCircle,
  Star,
  Utensils,
} from "lucide-react";
import {
  bookingApi,
  notificationApi,
  orderApi,
  searchApi,
  tripApi,
  walletApi,
} from "../api";
import { useAuth } from "../context/authContext";
import { ROUTES } from "../utils/constants";
import { formatCurrency } from "../utils/formatCurrency";
import type {
  Booking,
  CustomerWallet,
  Location,
  Notification,
  Order,
  Property,
  Restaurant,
  Trip,
} from "../types";

const SERVICES = [
  { title: "Accommodation", icon: Bed, to: ROUTES.ACCOMMODATION },
  { title: "Food & Drinks", icon: Utensils, to: ROUTES.RESTAURANT },
  { title: "Transport", icon: Car, to: ROUTES.TRANSPORT },
  { title: "Payments", icon: CreditCard, to: ROUTES.PAYMENT },
];

interface FeaturedListing {
  id: string;
  title: string;
  location: string;
  category: string;
  kind: "accommodation" | "restaurant";
  rating: number;
  totalRatings: number;
  image?: string | null;
  price?: number;
  currency?: string;
  to: string;
}

interface DashboardData {
  properties: Property[];
  restaurants: Restaurant[];
  locations: Location[];
  bookings: Booking[];
  trips: Trip[];
  orders: Order[];
  notifications: Notification[];
  unreadNotifications: number;
  wallet: CustomerWallet | null;
  totals: {
    properties: number;
    restaurants: number;
  };
}

interface CustomerLocation {
  latitude: number;
  longitude: number;
}

const EMPTY_DASHBOARD: DashboardData = {
  properties: [],
  restaurants: [],
  locations: [],
  bookings: [],
  trips: [],
  orders: [],
  notifications: [],
  unreadNotifications: 0,
  wallet: null,
  totals: { properties: 0, restaurants: 0 },
};

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function SectionHeading({
  title,
  detail,
  action,
  to,
}: {
  title: string;
  detail?: string;
  action?: string;
  to?: string;
}) {
  return (
    <div className="mb-2 flex items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-text-primary sm:text-base">
          {title}
        </h2>
        {detail && (
          <p className="mt-0.5 text-[10px] text-text-muted">{detail}</p>
        )}
      </div>
      {action && to && (
        <Link
          to={to}
          className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-text-secondary hover:text-secondary-600"
        >
          {action}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  const { customer } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [roomPricing, setRoomPricing] = useState<
    Record<string, { price: number; currency: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [failedSections, setFailedSections] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [customerLocation, setCustomerLocation] =
    useState<CustomerLocation | null>(null);
  const [locatingCustomer, setLocatingCustomer] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const requests = [
      {
        name: "properties",
        run: () => searchApi.properties({ page: 1, limit: 12 }),
      },
      {
        name: "restaurants",
        run: () => searchApi.restaurants({ page: 1, limit: 12 }),
      },
      {
        name: "destinations",
        run: () => searchApi.locations({ limit: 100 }),
      },
      { name: "bookings", run: () => bookingApi.list({ page: 1, limit: 20 }) },
      { name: "trips", run: () => tripApi.list({ page: 1, limit: 20 }) },
      { name: "orders", run: () => orderApi.list({ page: 1, limit: 10 }) },
      {
        name: "notifications",
        run: () => notificationApi.list({ page: 1, limit: 5 }),
      },
      {
        name: "unread notifications",
        run: () => notificationApi.unreadCount(),
      },
      { name: "wallet", run: () => walletApi.get() },
    ];

    const loadDashboard = async () => {
      setLoading(true);
      const results = await Promise.allSettled(
        requests.map(({ run }) => run()),
      );
      if (!mounted) return;

      const errors = results.flatMap((result, index) =>
        result.status === "rejected" ? [requests[index].name] : [],
      );
      const resultData = (index: number) =>
        results[index].status === "fulfilled"
          ? results[index].value
          : undefined;

      const properties = resultData(0) as
        | Awaited<ReturnType<typeof searchApi.properties>>
        | undefined;
      const restaurants = resultData(1) as
        | Awaited<ReturnType<typeof searchApi.restaurants>>
        | undefined;
      const locations = resultData(2) as Location[] | undefined;
      const bookings = resultData(3) as
        | Awaited<ReturnType<typeof bookingApi.list>>
        | undefined;
      const trips = resultData(4) as
        | Awaited<ReturnType<typeof tripApi.list>>
        | undefined;
      const orders = resultData(5) as
        | Awaited<ReturnType<typeof orderApi.list>>
        | undefined;
      const notifications = resultData(6) as
        | Awaited<ReturnType<typeof notificationApi.list>>
        | undefined;
      const unreadNotifications = resultData(7) as
        | Awaited<ReturnType<typeof notificationApi.unreadCount>>
        | undefined;
      const wallet = resultData(8) as CustomerWallet | undefined;

      setDashboard({
        properties: properties?.data ?? [],
        restaurants: restaurants?.data ?? [],
        locations: locations ?? [],
        bookings: bookings?.data ?? [],
        trips: trips?.data ?? [],
        orders: orders?.data ?? [],
        notifications: notifications?.data ?? [],
        unreadNotifications: unreadNotifications?.count ?? 0,
        wallet: wallet ?? null,
        totals: {
          properties: properties?.meta.total ?? 0,
          restaurants: restaurants?.meta.total ?? 0,
        },
      });
      setFailedSections(errors);
      setLoading(false);
    };

    void loadDashboard();
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    const propertiesMissingPrice = dashboard.properties
      .filter((property) => property.minPrice == null)
      .slice(0, 8);

    if (propertiesMissingPrice.length === 0) return;

    const loadRoomPricing = async () => {
      const results = await Promise.allSettled(
        propertiesMissingPrice.map((property) =>
          searchApi.propertyDetails(property.slug || property._id),
        ),
      );
      if (cancelled) return;

      const prices: Record<string, { price: number; currency: string }> = {};
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return;

        const property = propertiesMissingPrice[index];
        const rooms = result.value.property.rooms ?? [];
        const preferredCurrency =
          property.currency &&
          rooms.some((room) => room.currency === property.currency)
            ? property.currency
            : rooms[0]?.currency || property.currency || "KES";
        const pricedRooms = rooms.filter(
          (room) =>
            room.currency === preferredCurrency &&
            Number.isFinite(room.basePrice) &&
            room.basePrice >= 0,
        );
        const lowestRoomPrice = pricedRooms.reduce<
          (typeof pricedRooms)[number] | undefined
        >(
          (lowest, room) =>
            !lowest || room.basePrice < lowest.basePrice ? room : lowest,
          undefined,
        );

        if (lowestRoomPrice) {
          prices[property._id] = {
            price: lowestRoomPrice.basePrice,
            currency: lowestRoomPrice.currency,
          };
        }
      });

      setRoomPricing((current) => ({ ...current, ...prices }));
    };

    void loadRoomPricing();
    return () => {
      cancelled = true;
    };
  }, [dashboard.properties]);

  const featured = useMemo<FeaturedListing[]>(() => {
    const fromProperties = dashboard.properties.map((item) => ({
      id: item._id,
      title: item.name,
      location: item.town,
      category: item.type,
      kind: "accommodation" as const,
      rating: numberOrZero(item.rating),
      totalRatings: numberOrZero(item.totalRatings),
      image: item.coverImage || item.images?.[0],
      price: item.minPrice ?? roomPricing[item._id]?.price,
      currency: item.currency || roomPricing[item._id]?.currency,
      to: `/accommodation/${item.slug || item._id}`,
    }));

    const fromRestaurants = dashboard.restaurants.map((item) => ({
      id: item._id,
      title: item.name,
      location: item.town,
      category: item.cuisineTypes?.[0] || "Restaurant",
      kind: "restaurant" as const,
      rating: numberOrZero(item.rating),
      totalRatings: numberOrZero(item.totalRatings),
      image: item.coverImage || item.logo,
      to: ROUTES.RESTAURANT,
    }));

    return [...fromProperties, ...fromRestaurants]
      .sort(
        (left, right) =>
          right.rating - left.rating ||
          right.totalRatings - left.totalRatings,
      )
      .slice(0, 8);
  }, [dashboard.properties, dashboard.restaurants, roomPricing]);

  const destinations = useMemo(
    () =>
      dashboard.locations.filter(
        (location) =>
          location.isOperational &&
          ["town", "city"].includes(location.type),
      ),
    [dashboard.locations],
  );

  const upcomingActivities = useMemo(() => {
    const fromBookings = dashboard.bookings
      .filter(
        (booking) =>
          !["cancelled", "refunded", "checked_out"].includes(
            booking.status,
          ) && new Date(booking.checkOut).getTime() >= Date.now(),
      )
      .map((booking) => ({
        id: booking._id,
        title:
          booking.propertyName ||
          (typeof booking.property === "object"
            ? booking.property?.name
            : null) ||
          "Accommodation",
        detail: booking.roomName || booking.status.replace(/_/g, " "),
        date: booking.checkIn,
        status: booking.status,
        image: booking.propertyImages?.[0],
        to: ROUTES.BOOKING,
      }));

    const fromTrips = dashboard.trips
      .filter(
        (trip) =>
          !["cancelled", "completed", "failed"].includes(trip.status) &&
          (new Date(trip.scheduledAt).getTime() >= Date.now() ||
            ["ongoing", "in_progress"].includes(trip.status)),
      )
      .map((trip) => ({
        id: trip._id,
        title: `${trip.pickup?.town || "Pickup"} to ${
          trip.dropoff?.town || "Destination"
        }`,
        detail: trip.type,
        date: trip.scheduledAt,
        status: trip.status,
        image: null as string | null,
        to: ROUTES.TRIP,
      }));

    const fromOrders = dashboard.orders
      .filter(
        (order) =>
          !["cancelled", "delivered", "completed", "rejected"].includes(
            order.status,
          ),
      )
      .map((order) => ({
        id: order._id,
        title: order.restaurantName || "Food order",
        detail: `${order.status.replace(/_/g, " ")} · ${order.type}`,
        date: order.createdAt,
        status: order.status,
        image: order.restaurantLogo,
        to: ROUTES.ORDER,
      }));

    return [...fromBookings, ...fromTrips, ...fromOrders]
      .sort(
        (left, right) =>
          new Date(left.date).getTime() - new Date(right.date).getTime(),
      )
      .slice(0, 4);
  }, [dashboard.bookings, dashboard.trips, dashboard.orders]);

  const serviceCounts: Record<string, string> = {
    Accommodation: `${dashboard.totals.properties} listings`,
    "Food & Drinks": `${dashboard.totals.restaurants} restaurants`,
    Transport: "Request a ride",
    Payments: dashboard.wallet
      ? formatCurrency(dashboard.wallet.balance, dashboard.wallet.currency)
      : "Wallet balance unavailable",
  };

  const latestActivity = dashboard.notifications.slice(0, 3);
  const locationMapUrl = customerLocation
    ? `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({
        bbox: [
          customerLocation.longitude - 0.015,
          customerLocation.latitude - 0.01,
          customerLocation.longitude + 0.015,
          customerLocation.latitude + 0.01,
        ].join(","),
        layer: "mapnik",
        marker: `${customerLocation.latitude},${customerLocation.longitude}`,
      }).toString()}`
    : null;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  })();

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    const matchedDestination = destinations.find(
      (destination) => destination.name.toLowerCase() === query.toLowerCase(),
    );
    const params = new URLSearchParams();
    if (matchedDestination) params.set("town", matchedDestination.name);
    else if (query) params.set("q", query);
    navigate(params.size ? `${ROUTES.SEARCH}?${params.toString()}` : ROUTES.SEARCH);
  };

  const locateCustomer = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Location is not available in this browser.");
      return;
    }

    setLocatingCustomer(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCustomerLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setLocatingCustomer(false);
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location access was denied. Allow it in your browser settings to view the map."
            : error.code === error.TIMEOUT
              ? "Finding your location took too long. Please try again."
              : "We couldn't determine your location. Please try again.",
        );
        setLocatingCustomer(false);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  };

  return (
    <div className="min-w-0 space-y-5">
      {failedSections.length > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] text-amber-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            Some live dashboard data could not be loaded:{" "}
            <span className="font-semibold">{failedSections.join(", ")}</span>.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="inline-flex shrink-0 items-center gap-1 font-semibold underline underline-offset-2"
          >
            Retry
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-[#eadfce] bg-gradient-to-br from-[#fffaf2] via-white to-[#f3e7d5] px-5 py-6 sm:px-7">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] xl:items-center">
          <div>
            <p className="text-xs font-semibold text-[#a56623] sm:text-sm">
              {greeting}
              {customer ? `, ${customer.firstName}` : ""}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              Plan your next Kenya adventure
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Find a place to stay, somewhere to eat, or a ride to get there.
            </p>
          </div>
          <form
            onSubmit={submitSearch}
            className="flex min-h-12 max-w-[620px] items-center gap-3 rounded-xl border border-[#e7dac7] bg-white px-3 shadow-sm sm:px-4 xl:max-w-none"
          >
            <MapPin className="h-5 w-5 shrink-0 text-[#a56623]" />
            <div className="min-w-0 flex-1">
              <label
                htmlFor="destination-search"
                className="block text-[11px] font-semibold text-text-primary"
              >
                Search destinations
              </label>
              <input
                id="destination-search"
                list="dashboard-destination-options"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Town, destination, or experience"
                className="w-full bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted"
              />
              <datalist id="dashboard-destination-options">
                {destinations.map((location) => (
                  <option key={location._id} value={location.name} />
                ))}
              </datalist>
            </div>
            <button
              type="submit"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#a75f1b] px-3 text-xs font-semibold text-white transition hover:bg-[#874a14] sm:px-4"
            >
              <Search className="h-3 w-3" />
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="overflow-hidden rounded-2xl border border-[#eadfce] bg-white lg:col-span-8">
          <div className="flex items-center justify-between border-b border-[#f0e7dc] px-4 py-3 sm:px-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#a56623]">
                Your plans
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-text-primary">
                Next up
              </h2>
            </div>
            <Link
              to={ROUTES.BOOKING}
              className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-secondary-600"
            >
              All activity <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="m-4 h-20 animate-pulse rounded-xl bg-[#f5efe7] sm:m-5" />
          ) : upcomingActivities[0] ? (
            <Link
              to={upcomingActivities[0].to}
              className="flex items-center gap-4 p-4 transition hover:bg-[#fffaf2] sm:p-5"
            >
              {upcomingActivities[0].image ? (
                <img
                  src={upcomingActivities[0].image}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20"
                />
              ) : (
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#f7ecdd] text-[#9b5b20] sm:h-20 sm:w-20">
                  {upcomingActivities[0].to === ROUTES.TRIP ? (
                    <Car className="h-6 w-6" />
                  ) : upcomingActivities[0].to === ROUTES.ORDER ? (
                    <Utensils className="h-6 w-6" />
                  ) : (
                    <Bed className="h-6 w-6" />
                  )}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-text-muted">
                  {new Date(upcomingActivities[0].date).toLocaleDateString(
                    "en-KE",
                    { weekday: "long", day: "numeric", month: "long" },
                  )}
                </span>
                <span className="mt-1 block truncate text-base font-semibold text-text-primary">
                  {upcomingActivities[0].title}
                </span>
                <span className="mt-1 block truncate text-xs capitalize text-text-muted">
                  {upcomingActivities[0].detail}
                </span>
              </span>
              <span className="hidden shrink-0 items-center gap-2 sm:inline-flex">
                <span className="rounded-full bg-[#e4f3e8] px-2.5 py-1 text-[10px] font-medium capitalize text-[#28744b]">
                  {upcomingActivities[0].status.replace(/_/g, " ")}
                </span>
                <ArrowRight className="h-4 w-4 text-[#a56623]" />
              </span>
            </Link>
          ) : (
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Nothing planned yet
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Start with a stay, a meal, or a ride for your next trip.
                </p>
              </div>
              <Link
                to={ROUTES.SEARCH}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-[#a75f1b] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#874a14] sm:self-auto"
              >
                Start exploring <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </section>

        <section className="flex min-h-full flex-col justify-between rounded-2xl bg-[#302012] p-5 text-white shadow-sm lg:col-span-4">
          <div className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-xs font-medium text-white/70">
                Your wallet
              </span>
              <span className="mt-2 block text-2xl font-semibold tracking-tight">
                {loading
                  ? "Loading..."
                  : dashboard.wallet
                    ? formatCurrency(
                        dashboard.wallet.balance,
                        dashboard.wallet.currency,
                      )
                    : "Unavailable"}
              </span>
            </span>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#f4bd6d]">
              <CreditCard className="h-5 w-5" />
            </span>
          </div>
          <Link
            to={ROUTES.WALLET}
            className="mt-6 inline-flex min-h-10 items-center justify-between rounded-lg border border-white/20 px-3 text-xs font-medium text-white transition hover:bg-white/10"
          >
            Manage wallet <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="lg:col-span-8">
          <SectionHeading
            title="What would you like to do?"
            detail="Your travel essentials, all in one place."
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SERVICES.map(({ title, icon: Icon, to }) => {
              return (
                <Link
                  key={title}
                  to={to}
                  className="group flex min-h-[88px] items-center gap-3 rounded-xl border border-[#eadfce] bg-white p-3 transition hover:border-[#d9bb91] hover:bg-[#fffaf2] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a66b2b] sm:min-h-[96px] sm:p-4"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f7ecdd] text-[#9b5b20] transition-colors group-hover:bg-[#f0dfc8]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-text-primary sm:text-sm">
                      {title}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-text-muted sm:text-xs">
                      {loading
                        ? "Finding what's available..."
                        : serviceCounts[title]}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <aside className="min-w-0 lg:col-span-4">
          <section className="rounded-2xl border border-[#eadfce] bg-white p-4 sm:p-5 lg:h-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#a56623]">
                  Travel at a glance
                </p>
                <h2 className="mt-1 text-sm font-semibold text-text-primary">
                  Ready to explore
                </h2>
              </div>
              <Link
                to={ROUTES.SEARCH}
                className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#a56623] hover:underline"
              >
                Explore <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-[#f0e7dc] lg:mt-6">
              {[
                {
                  label: "Stays",
                  count: dashboard.totals.properties,
                  icon: Bed,
                },
                {
                  label: "Dining",
                  count: dashboard.totals.restaurants,
                  icon: Utensils,
                },
                {
                  label: "Places",
                  count: destinations.length,
                  icon: MapPin,
                },
              ].map(({ label, count, icon: Icon }) => (
                <div
                  key={label}
                  className="flex min-w-0 flex-col items-center px-1 text-center first:pl-0 last:pr-0"
                >
                  <Icon
                    className="h-4 w-4 text-[#a56623]"
                    aria-hidden="true"
                  />
                  <span className="mt-1 text-sm font-semibold text-text-primary">
                    {loading ? "—" : count}
                  </span>
                  <span className="text-[10px] text-text-muted">{label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:col-span-12 lg:grid-cols-12 lg:items-stretch">
        <aside className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:flex lg:flex-col">
          <section className="rounded-2xl border border-[#eadfce] bg-white p-4 sm:p-5 lg:flex-1">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#a56623]">
                  Your plans
                </p>
                <h2 className="mt-1 text-sm font-semibold text-text-primary">
                  Coming up
                </h2>
              </div>
              <Link
                to={ROUTES.BOOKING}
                className="text-xs font-medium text-text-secondary hover:text-secondary-600"
              >
                View all
              </Link>
            </div>
            {loading ? (
              <div className="h-16 animate-pulse rounded-xl bg-[#f5efe7]" />
            ) : upcomingActivities.length > 1 ? (
              <div className="divide-y divide-[#f0e7dc]">
                {upcomingActivities.slice(1, 3).map((activity) => (
                  <Link
                    key={`${activity.to}-${activity.id}`}
                    to={activity.to}
                    className="flex items-center gap-3 py-3 first:pt-1"
                  >
                    {activity.image ? (
                      <img
                        src={activity.image}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#f7ecdd] text-[#9b5b20]">
                        {activity.to === ROUTES.TRIP ? (
                          <Car className="h-4 w-4" />
                        ) : activity.to === ROUTES.ORDER ? (
                          <Utensils className="h-4 w-4" />
                        ) : (
                          <Bed className="h-4 w-4" />
                        )}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-text-primary">
                        {activity.title}
                      </span>
                      <span className="mt-1 block truncate text-[11px] capitalize text-text-muted">
                        {new Date(activity.date).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                        })}
                        {activity.detail ? ` · ${activity.detail}` : ""}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[#a56623]" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-[#faf6ef] px-3 py-3 text-xs leading-relaxed text-text-muted">
                {upcomingActivities.length === 1
                  ? "You’re all caught up. Your next plan is shown beside this card."
                  : "New bookings, rides, and food orders will appear here."}
              </p>
            )}
          </section>

          <section className="min-h-[220px] rounded-2xl border border-[#eadfce] bg-white p-4 sm:p-5 lg:min-h-0 lg:flex-1">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-primary">
                Recent updates
              </h2>
              <Link
                to={ROUTES.NOTIFICATIONS}
                className="text-[11px] font-medium text-text-secondary hover:text-secondary-600"
              >
                {loading ? "Loading" : `${dashboard.unreadNotifications} unread`}
              </Link>
            </div>
            {loading ? (
              <div className="h-12 animate-pulse rounded-lg bg-[#f5efe7]" />
            ) : latestActivity.length > 0 ? (
              <div className="divide-y divide-[#f0e7dc]">
                {latestActivity.map((notification) => (
                  <Link
                    key={notification._id}
                    to={ROUTES.NOTIFICATIONS}
                    className="block py-3 first:pt-1"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          notification.isRead
                            ? "bg-[#d9d1c5]"
                            : "bg-[#e88822]"
                        }`}
                      />
                      <span className="truncate text-xs font-semibold text-text-primary">
                        {notification.title}
                      </span>
                    </span>
                    <span className="mt-1 block line-clamp-2 pl-4 text-[11px] leading-relaxed text-text-muted">
                      {notification.body}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-[#faf6ef] px-3 py-3 text-xs text-text-muted">
                No notifications yet.
              </p>
            )}
          </section>
        </aside>

          <section className="flex min-w-0 flex-col lg:col-span-8 lg:col-start-1 lg:row-start-1">
            <SectionHeading
              title="Explore nearby"
              detail="See where you are on the map."
            />
            <div className="relative h-[300px] flex-none overflow-hidden rounded-2xl border border-[#eadfce] bg-[#f2eadc] lg:h-auto lg:min-h-[420px] lg:flex-1">
              {locationMapUrl ? (
                <iframe
                  title="OpenStreetMap showing your current location"
                  src={locationMapUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#f6efe3,#e7dcc8)] px-4 text-center">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(138,112,77,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(138,112,77,.12)_1px,transparent_1px)] [background-size:28px_28px]"
                  />
                  <span className="relative grid h-11 w-11 place-items-center rounded-full border border-[#dfc9a8] bg-white text-[#a75f1b] shadow-sm">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <p className="relative mt-3 text-sm font-semibold text-text-primary">
                    Find your place on the map
                  </p>
                  <p className="relative mt-1 max-w-[250px] text-[11px] leading-relaxed text-text-muted">
                    After you allow access, your coordinates are sent to
                    OpenStreetMap to display the map.
                  </p>
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3">
                    <button
                      type="button"
                      onClick={locateCustomer}
                      disabled={locatingCustomer}
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#a75f1b] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#874a14] disabled:cursor-wait disabled:opacity-70"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {locatingCustomer
                        ? "Finding location..."
                        : "Use my location"}
                    </button>
                    {locationError && (
                      <p
                        role="alert"
                        className="rounded-md bg-white/95 px-2 py-1 text-[10px] text-red-700 shadow-sm"
                      >
                        {locationError}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {locationMapUrl && (
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-text-muted">
                  Map provided by OpenStreetMap.
                </p>
                <button
                  type="button"
                  onClick={locateCustomer}
                  disabled={locatingCustomer}
                  className="text-[11px] font-medium text-[#a56623] hover:underline disabled:opacity-60"
                >
                  {locatingCustomer
                    ? "Updating location..."
                    : "Refresh my location"}
                </button>
                {locationError && (
                  <p role="alert" className="w-full text-[10px] text-red-700">
                    {locationError}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        <section className="lg:col-span-12">
          <SectionHeading
            title="Featured stays & dining"
            detail="Highly rated stays and restaurants from our partners."
            action="View all"
            to={ROUTES.SEARCH}
          />
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {featured.map((stay) => (
              <Link
                key={`${stay.to}-${stay.id}`}
                to={stay.to}
                className="group w-[min(82vw,260px)] shrink-0 snap-start overflow-hidden rounded-xl border border-[#eadfce] bg-white/70 transition hover:-translate-y-0.5 hover:shadow-md sm:w-[250px]"
              >
                <div className="relative flex h-[132px] items-center justify-center overflow-hidden bg-[#f2e9dc]">
                  {stay.image ? (
                    <img
                      src={stay.image}
                      alt={stay.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-[#a66b2b]">
                      {stay.to === ROUTES.RESTAURANT ? (
                        <Utensils className="h-6 w-6" />
                      ) : (
                        <Bed className="h-6 w-6" />
                      )}
                    </span>
                  )}
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-[#238451] px-1.5 py-0.5 text-[8px] font-semibold capitalize text-white">
                    {stay.category}
                  </span>
                </div>
                <div className="space-y-1 p-3">
                  <p className="truncate text-xs font-semibold text-text-primary sm:text-sm">
                    {stay.title}
                  </p>
                  <p className="flex items-center gap-1 truncate text-[10px] text-text-muted">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {stay.location}
                  </p>
                  <p className="flex items-center gap-1 text-[10px] text-text-secondary">
                    <Star className="h-3 w-3 fill-[#e9a32c] text-[#e9a32c]" />
                    {stay.rating.toFixed(1)}
                    {stay.totalRatings > 0 && (
                      <span className="text-text-muted">
                        ({stay.totalRatings} reviews)
                      </span>
                    )}
                  </p>
                  {stay.kind === "accommodation" && (
                    <p className="text-[11px] font-semibold text-text-primary">
                      {stay.price !== undefined && stay.currency ? (
                        <>
                          From {formatCurrency(stay.price, stay.currency)}
                          <span className="font-normal text-text-muted">
                            {" "}
                            / night
                          </span>
                        </>
                      ) : (
                        <span className="text-[#a45f19]">View room rates</span>
                      )}
                    </p>
                  )}
                </div>
              </Link>
            ))}
            {loading &&
              Array.from({ length: 4 }, (_, index) => (
                <div
                  key={`featured-skeleton-${index}`}
                  className="h-[220px] w-[250px] shrink-0 animate-pulse rounded-xl border border-[#eadfce] bg-white/60"
                />
              ))}
            {!loading && featured.length === 0 && (
              <div className="w-full shrink-0 rounded-lg border border-dashed border-[#dfd1bd] bg-white/50 px-4 py-6 text-center text-[10px] text-text-muted">
                New stays and experiences are coming soon. Try exploring all
                destinations.
                <Link
                  to={ROUTES.SEARCH}
                  className="ml-1 font-semibold text-[#a56623] hover:underline"
                >
                  Explore destinations
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-12">
          <SectionHeading
            title="Popular destinations"
            detail="Choose a place to start exploring."
            action="Search places"
            to={ROUTES.SEARCH}
          />
          {loading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={`location-skeleton-${index}`}
                  className="h-12 animate-pulse rounded-lg border border-[#eadfce] bg-white/60"
                />
              ))}
            </div>
          ) : destinations.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {destinations.slice(0, 4).map((location) => (
                <Link
                  key={location._id}
                  to={`${ROUTES.SEARCH}?town=${encodeURIComponent(
                    location.name,
                  )}`}
                  className="flex min-h-[68px] items-center gap-3 rounded-lg border border-[#eadfce] bg-white/70 px-3 py-3 transition hover:border-[#d9c5a5] hover:shadow-sm"
                >
                  <MapPin className="h-5 w-5 shrink-0 text-[#a66b2b]" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-text-primary">
                      {location.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-text-muted">
                      {location.county || location.type}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[#dfd1bd] bg-white/50 px-3 py-4 text-center text-[10px] text-text-muted">
              No operational destinations are available right now.
            </p>
          )}
        </section>

        <section className="relative isolate flex flex-col gap-5 overflow-hidden rounded-2xl bg-[#302012] px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-7 lg:col-span-12">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(191,122,53,.34),transparent_48%),linear-gradient(110deg,#302012,#49301b)]"
          />
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-[#f4bd6d]">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-semibold">
                Need a hand planning your trip?
              </span>
              <span className="mt-1 block max-w-xl text-xs leading-relaxed text-white/70 sm:text-sm">
                Ask our Concierge for help finding stays, dining, and transport
                that fit your plans.
              </span>
            </span>
          </div>
          <Link
            to={ROUTES.AI_CONCIERGE}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-[#f4bd6d] px-4 text-xs font-semibold text-[#302012] transition hover:bg-[#ffd18e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:self-auto"
          >
            Talk to Concierge <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}