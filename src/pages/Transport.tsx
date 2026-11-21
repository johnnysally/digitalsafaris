import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowRight,
  ArrowUpDown,
  Bike,
  Car,
  CarFront,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  LocateFixed,
  Luggage,
  MapPin,
  Navigation,
  Plus,
  Minus,
  Smartphone,
  ShieldCheck,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";
import { paymentApi, tripApi } from "../api";
import { useToast } from "../context/toastContext";
import { formatCurrency } from "../utils/formatCurrency";
import {
  reverseGeocode,
  searchPlaces,
  type PlaceSuggestion,
} from "../utils/placeSearch";
import type { TripQuoteResponse } from "../types";

type ServiceType = "bike" | "car" | "van";
type PaymentMethod = "wallet" | "mpesa" | "stripe";
type MapTarget = "pickup" | "dropoff";

type MapLocation = {
  address: string;
  town: string;
  latitude: number;
  longitude: number;
};

type QuantityControlProps = {
  id: string;
  label: string;
  detail: string;
  value: number;
  min: number;
  icon: ReactNode;
  onChange: (value: number) => void;
};

function QuantityControl({
  id,
  label,
  detail,
  value,
  min,
  icon,
  onChange,
}: QuantityControlProps) {
  return (
    <div className="rounded-2xl border border-[#eee4d6] bg-white p-4 shadow-[0_4px_16px_rgba(69,48,28,.035)]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f7f1e8] text-[#805b35]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <label
            htmlFor={id}
            className="block text-sm font-semibold text-text-primary"
          >
            {label}
          </label>
          <p className="mb-0 mt-0.5 text-xs text-text-muted">{detail}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-[#eee5d9] bg-[#fdfbf8] p-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid size-9 place-items-center rounded-lg border border-[#e9ddcc] bg-white text-[#765b3c] transition hover:border-[#bd781f] hover:text-[#bd781f] focus:outline-none focus:ring-2 focus:ring-[#bd781f]/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <input
          id={id}
          type="number"
          min={min}
          value={value}
          onChange={(event) =>
            onChange(Math.max(min, Number(event.target.value) || min))
          }
          className="w-16 border-0 bg-transparent text-center text-base font-semibold tabular-nums text-text-primary outline-none focus:ring-0"
        />
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => onChange(value + 1)}
          className="grid size-9 place-items-center rounded-lg border border-[#e9ddcc] bg-white text-[#765b3c] transition hover:border-[#bd781f] hover:text-[#bd781f] focus:outline-none focus:ring-2 focus:ring-[#bd781f]/30"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

const SERVICE_OPTIONS = [
  {
    label: "Car",
    value: "car",
    detail: "Comfortable rides for everyday travel",
    highlight: "Everyday comfort",
    icon: CarFront,
  },
  {
    label: "Bike",
    value: "bike",
    detail: "A quick choice for solo trips",
    highlight: "Fast & nimble",
    icon: Bike,
  },
  {
    label: "Van",
    value: "van",
    detail: "More space for groups and bags",
    highlight: "Extra room",
    icon: Truck,
  },
];

function extractError(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  return typeof msg === "string" && msg ? msg : fallback;
}

function AddressAutocomplete({
  id,
  label,
  value,
  placeholder,
  onChange,
  onFocus,
  onSelect,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onSelect: (place: PlaceSuggestion) => void;
}) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!open || query.length < 3) {
      setSuggestions([]);
      setSearching(false);
      setSearchError(false);
      return;
    }

    const controller = new AbortController();
    setSuggestions([]);
    setSearching(true);
    setSearchError(false);
    const timeout = window.setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then(setSuggestions)
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setSuggestions([]);
          setSearchError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, value]);

  return (
    <div className="relative">
      <Input
        id={id}
        label={label}
        value={value}
        onFocus={() => {
          setOpen(true);
          onFocus();
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && value.trim().length >= 3}
        aria-controls={`${id}-suggestions`}
        onBlur={(event) => {
          if (event.currentTarget.parentElement?.contains(event.relatedTarget)) {
            return;
          }
          window.setTimeout(() => setOpen(false), 120);
        }}
        className="bg-white"
      />
      {open && value.trim().length >= 3 && (
        <div
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[600] mt-1 overflow-hidden rounded-xl border border-[#e8ddce] bg-white shadow-lg"
        >
          {searching && (
            <p className="m-0 px-3 py-2.5 text-xs text-text-muted">
              Looking for places…
            </p>
          )}
          {!searching && searchError && (
            <p className="m-0 px-3 py-2.5 text-xs text-text-muted" role="status">
              Suggestions are unavailable. You can still enter the address or
              place a map pin.
            </p>
          )}
          {!searching && !searchError && suggestions.length === 0 && (
            <p className="m-0 px-3 py-2.5 text-xs text-text-muted">
              No matching places found.
            </p>
          )}
          {suggestions.map((place) => (
            <button
              key={`${place.latitude}-${place.longitude}-${place.address}`}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(place);
                setOpen(false);
              }}
              className="block w-full border-b border-[#f1ece4] px-3 py-2.5 text-left last:border-0 hover:bg-[#fff8ec] focus:bg-[#fff8ec] focus:outline-none"
            >
              <span className="block text-sm font-medium text-text-primary">
                {place.address}
              </span>
              <span className="mt-0.5 block text-[11px] text-text-muted">
                {place.town || "Selected map location"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TransportMap({
  pickup,
  dropoff,
  mapTarget,
  setMapTarget,
  setPickup,
  setDropoff,
}: {
  pickup: MapLocation;
  dropoff: MapLocation;
  mapTarget: MapTarget;
  setMapTarget: Dispatch<SetStateAction<MapTarget>>;
  setPickup: Dispatch<SetStateAction<MapLocation>>;
  setDropoff: Dispatch<SetStateAction<MapLocation>>;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const pickupMarker = useRef<L.Marker | null>(null);
  const dropoffMarker = useRef<L.Marker | null>(null);
  const routeLine = useRef<L.Polyline | null>(null);
  const [mapError, setMapError] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const lookupRequest = useRef(0);
  const lookupController = useRef<AbortController | null>(null);

  const updatePin = useCallback(
    (target: MapTarget, latitude: number, longitude: number) => {
      const location = {
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
      };
      const setter = target === "pickup" ? setPickup : setDropoff;
      setter((current) => ({
        ...current,
        ...location,
        address: "",
        town: "",
      }));

      lookupRequest.current += 1;
      const requestId = lookupRequest.current;
      lookupController.current?.abort();
      const controller = new AbortController();
      lookupController.current = controller;
      setLookupError(false);
      reverseGeocode(latitude, longitude, controller.signal)
        .then((place) => {
          if (requestId !== lookupRequest.current) return;
          if (!place) {
            setLookupError(true);
            return;
          }
          setter((current) => ({
            ...current,
            ...location,
            address: place.address,
            town: place.town,
          }));
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          if (requestId === lookupRequest.current) setLookupError(true);
        });
    },
    [setDropoff, setPickup]
  );

  useEffect(() => {
    if (pickup.address || dropoff.address) setLookupError(false);
  }, [dropoff.address, pickup.address]);

  useEffect(() => {
    if (!mapElement.current) return;

    const map = L.map(mapElement.current, {
      center: [-1.286389, 36.817223],
      zoom: 13,
      scrollWheelZoom: false,
      zoomControl: false,
    });
    const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    tiles.on("tileerror", () => setMapError(true));
    tiles.on("tileload", () => setMapError(false));
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapInstance.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      const bounds = routeLine.current?.getBounds();
      if (bounds?.isValid()) {
        map.fitBounds(bounds.pad(0.45), { maxZoom: 14, animate: false });
      }
    });
    resizeObserver.observe(mapElement.current);
    const initialResize = requestAnimationFrame(() =>
      map.invalidateSize({ pan: false })
    );

    return () => {
      cancelAnimationFrame(initialResize);
      resizeObserver.disconnect();
      map.remove();
      lookupController.current?.abort();
      mapInstance.current = null;
      pickupMarker.current = null;
      dropoffMarker.current = null;
      routeLine.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const pickupPosition: L.LatLngExpression = [
      pickup.latitude,
      pickup.longitude,
    ];
    const dropoffPosition: L.LatLngExpression = [
      dropoff.latitude,
      dropoff.longitude,
    ];
    const pickupIcon = L.divIcon({
      className: "",
      html: '<span style="display:grid;width:36px;height:36px;place-items:center;border:3px solid white;border-radius:50% 50% 50% 8px;background:#587a50;color:white;font:700 12px Montserrat, sans-serif;box-shadow:0 3px 10px #34291d55;transform:rotate(-45deg)"><span style="transform:rotate(45deg)">P</span></span>',
      iconSize: [36, 36],
      iconAnchor: [18, 30],
    });
    const dropoffIcon = L.divIcon({
      className: "",
      html: '<span style="display:grid;width:36px;height:36px;place-items:center;border:3px solid white;border-radius:50% 50% 50% 8px;background:#b87528;color:white;font:700 12px Montserrat, sans-serif;box-shadow:0 3px 10px #34291d55;transform:rotate(-45deg)"><span style="transform:rotate(45deg)">D</span></span>',
      iconSize: [36, 36],
      iconAnchor: [18, 30],
    });
    if (!pickupMarker.current) {
      pickupMarker.current = L.marker(pickupPosition, {
        icon: pickupIcon,
        title: "Pickup location",
        keyboard: true,
        draggable: true,
      }).addTo(map);
    } else {
      pickupMarker.current.setLatLng(pickupPosition);
    }

    if (!dropoffMarker.current) {
      dropoffMarker.current = L.marker(dropoffPosition, {
        icon: dropoffIcon,
        title: "Destination",
        keyboard: true,
        draggable: true,
      }).addTo(map);
    } else {
      dropoffMarker.current.setLatLng(dropoffPosition);
    }

    const positions: L.LatLngExpression[] = [pickupPosition, dropoffPosition];
    if (!routeLine.current) {
      routeLine.current = L.polyline(positions, {
        color: "#b87528",
        weight: 5,
        opacity: 0.9,
        dashArray: "8 10",
        lineCap: "round",
      }).addTo(map);
    } else {
      routeLine.current.setLatLngs(positions);
    }

    if (pickup.address && !dropoff.address) {
      map.setView(pickupPosition, Math.max(map.getZoom(), 14), {
        animate: true,
      });
    } else if (dropoff.address && !pickup.address) {
      map.setView(dropoffPosition, Math.max(map.getZoom(), 14), {
        animate: true,
      });
    } else {
      map.fitBounds(L.latLngBounds(positions).pad(0.45), {
        maxZoom: 14,
        animate: true,
      });
    }

    const placePin = (event: L.LeafletMouseEvent) => {
      updatePin(mapTarget, event.latlng.lat, event.latlng.lng);
      if (mapTarget === "pickup") setMapTarget("dropoff");
    };
    const movePickupPin = (event: L.LeafletEvent) => {
      const marker = event.target as L.Marker;
      const { lat, lng } = marker.getLatLng();
      updatePin("pickup", lat, lng);
    };
    const moveDropoffPin = (event: L.LeafletEvent) => {
      const marker = event.target as L.Marker;
      const { lat, lng } = marker.getLatLng();
      updatePin("dropoff", lat, lng);
    };

    map.on("click", placePin);
    pickupMarker.current.on("dragend", movePickupPin);
    dropoffMarker.current.on("dragend", moveDropoffPin);
    return () => {
      map.off("click", placePin);
      pickupMarker.current?.off("dragend", movePickupPin);
      dropoffMarker.current?.off("dragend", moveDropoffPin);
    };
  }, [
    dropoff.address,
    dropoff.latitude,
    dropoff.longitude,
    mapTarget,
    pickup.address,
    pickup.latitude,
    pickup.longitude,
    setMapTarget,
    setDropoff,
    setPickup,
    updatePin,
  ]);

  return (
    <div className="relative">
      <div
        ref={mapElement}
        aria-label="Interactive map showing your pickup and drop-off route"
        className="h-[340px] w-full bg-[#e8eee6] sm:h-[440px]"
      />
      <div className="pointer-events-none absolute left-3 top-3 z-[400] flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/80 bg-white/95 px-3 py-1.5 text-xs font-semibold text-text-primary shadow-sm">
          Tap to place {mapTarget === "pickup" ? "pickup" : "destination"}
        </span>
        <span className="rounded-full bg-white/90 px-2.5 py-1.5 text-[11px] text-text-muted shadow-sm">
          Direct line · drag pins
        </span>
      </div>
      {(mapError || lookupError) && (
        <div
          className="absolute bottom-3 left-3 z-[500] max-w-[calc(100%-5rem)] rounded-lg bg-white/95 px-3 py-2 text-xs text-text-secondary shadow"
          role="status"
        >
          {mapError
            ? "Map tiles could not be loaded. Check your connection."
            : "Could not find a nearby town. Enter the address and town manually."}
        </div>
      )}
    </div>
  );
}

export default function TransportPage() {
  const { error: toastError, success: toastSuccess } = useToast();
  const navigate = useNavigate();
  const [mapTarget, setMapTarget] = useState<MapTarget>("pickup");

  const [pickup, setPickup] = useState({
    address: "",
    town: "",
    latitude: -1.286389,
    longitude: 36.817223,
  });
  const [dropoff, setDropoff] = useState({
    address: "",
    town: "",
    latitude: -1.292066,
    longitude: 36.821946,
  });
  const [scheduledAt, setScheduledAt] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [luggage, setLuggage] = useState(0);
  const [serviceType, setServiceType] = useState<ServiceType>("car");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wallet");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [quote, setQuote] = useState<TripQuoteResponse | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payMessage, setPayMessage] = useState<string | null>(null);

  useEffect(() => {
    setQuote(null);
    setPayError(null);
    setPayMessage(null);
  }, [
    pickup.address,
    pickup.town,
    pickup.latitude,
    pickup.longitude,
    dropoff.address,
    dropoff.town,
    dropoff.latitude,
    dropoff.longitude,
    serviceType,
  ]);

  function choosePlace(target: MapTarget, place: PlaceSuggestion) {
    const setter = target === "pickup" ? setPickup : setDropoff;
    setter({
      address: place.address,
      town: place.town,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setMapTarget("dropoff");
    setLocationError(null);
  }

  function focusMapTarget(target: MapTarget) {
    setMapTarget(target);
    const mapHeading = document.getElementById("map-heading");
    const scrollContainer = mapHeading?.closest("main");
    if (!mapHeading || !scrollContainer) return;

    const headingTop =
      scrollContainer.scrollTop +
      mapHeading.getBoundingClientRect().top -
      scrollContainer.getBoundingClientRect().top;
    scrollContainer.scrollTo({
      top: Math.max(0, headingTop - 12),
      behavior: "smooth",
    });
  }

  function useCurrentLocation() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Location access is not available in this browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const point = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };
        setPickup((current) => ({ ...current, ...point, address: "", town: "" }));
        setMapTarget("pickup");
        try {
          const place = await reverseGeocode(point.latitude, point.longitude);
          if (place) {
            setPickup((current) => ({
              ...current,
              ...point,
              address: place.address,
              town: place.town,
            }));
          } else {
            setLocationError(
              "Your location is set, but we couldn't find its address. Enter the nearest address and town."
            );
          }
        } catch {
          setLocationError(
            "Your location is set, but its address lookup failed. Enter the nearest address and town."
          );
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Allow location access in your browser to use your current position."
            : "We couldn't get your current location. Try again or enter an address."
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  async function requestQuote() {
    setQuoteError(null);
    setPayError(null);
    setPayMessage(null);
    setQuote(null);

    if (!pickup.address || !dropoff.address) {
      setQuoteError("Enter both pickup and dropoff addresses.");
      return;
    }
    if (!pickup.town || !dropoff.town) {
      setQuoteError("Enter both pickup and dropoff towns.");
      return;
    }

    setQuoting(true);
    try {
      const q = await tripApi.quote({
        pickup: {
          address: pickup.address,
          town: pickup.town,
          latitude: pickup.latitude,
          longitude: pickup.longitude,
        },
        dropoff: {
          address: dropoff.address,
          town: dropoff.town,
          latitude: dropoff.latitude,
          longitude: dropoff.longitude,
        },
        serviceType,
      });
      setQuote(q);
    } catch (err) {
      setQuoteError(extractError(err, "Could not get quote."));
    } finally {
      setQuoting(false);
    }
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    if (!quote) return;

    if (!scheduledAt) {
      setPayError("Choose when you want to travel.");
      return;
    }
    if (paymentMethod === "mpesa" && !phone.trim()) {
      setPayError("Enter your M-Pesa phone number.");
      return;
    }
    if (paymentMethod === "stripe") {
      setPayError(
        "Card payments are being set up. Please choose DS Wallet or M-Pesa for now."
      );
      return;
    }

    setPaying(true);
    setPayError(null);
    setPayMessage(null);

    try {
      const payment = await paymentApi.initiate({
        method: paymentMethod,
        amount: quote.fare,
        currency: quote.currency,
        purpose: "transport",
        phone: paymentMethod === "mpesa" ? phone : undefined,
      });

      if (paymentMethod === "wallet") {
        if (payment.status !== "success") {
          setPayError("Wallet payment failed. Check your balance.");
          return;
        }
      } else if (paymentMethod === "mpesa") {
        setPayMessage("Check your phone and enter your M-Pesa PIN…");
        const result = await pollPayment(payment.reference);
        if (!result.paid) {
          setPayError(result.message ?? "Payment was not completed.");
          return;
        }
      }

      const trip = await tripApi.create({
        quoteId: quote.quoteId,
        paymentReference: payment.reference,
        scheduledAt,
        passengers,
        luggage,
        notes: notes || undefined,
      });

      toastSuccess(
        "Trip confirmed",
        `Reference ${trip.reference} — follow your driver live from the trip map.`
      );

      setQuote(null);
      setNotes("");
      navigate(
        `/tracking?kind=trip&reference=${encodeURIComponent(trip.reference)}`
      );
    } catch (err) {
      setPayError(extractError(err, "Could not request trip"));
      toastError(extractError(err, "Could not request trip"));
    } finally {
      setPaying(false);
    }
  }

  async function pollPayment(reference: string, timeoutMs = 120_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const status = await paymentApi.status(reference);
        if (status.status === "success") return { paid: true };
        if (["failed", "cancelled", "refunded"].includes(status.status)) {
          return {
            paid: false,
            message: status.failureReason ?? "Payment failed",
          };
        }
      } catch {
        /* keep polling */
      }
    }
    return { paid: false, message: "Payment timed out. Try again." };
  }

  return (
    <div className="w-full min-w-0 space-y-6 pb-8">
      <header className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[.16em] text-[#9b6529]">
            Your journey, your way
          </span>
          <h1 className="mb-0 mt-1 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            Get a ride
          </h1>
          <p className="mb-0 mt-1 max-w-xl text-sm text-text-muted">
            Pick your locations and ride. Your fare is shown before you book.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e8ddce] bg-white/80 px-3 py-2 text-xs font-medium text-text-secondary">
          <ShieldCheck className="size-4 text-[#6f8c5c]" />
          Safe, reliable rides
        </span>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.9fr)]">
        <section
          id="transport-map"
          className="min-w-0 overflow-hidden rounded-2xl border border-[#e8ddce] bg-white shadow-[0_8px_28px_rgba(69,48,28,.07)]"
          aria-labelledby="map-heading"
        >
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2
              id="map-heading"
              className="m-0 text-base font-semibold text-text-primary"
            >
              Your trip at a glance
            </h2>
            <p className="mb-0 mt-1 text-xs text-text-muted">
              Choose a pin, then tap the map to fine-tune its location
            </p>
          </div>
          <div
            className="flex w-fit rounded-xl bg-[#f7f2e9] p-1"
            aria-label="Choose which map pin to move"
          >
            {(["pickup", "dropoff"] as const).map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => setMapTarget(target)}
                aria-pressed={mapTarget === target}
                className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${
                  mapTarget === target
                    ? "bg-white text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {target === "pickup" ? "Pickup pin" : "Drop-off pin"}
              </button>
            ))}
          </div>
        </div>
        <TransportMap
          pickup={pickup}
          dropoff={dropoff}
          mapTarget={mapTarget}
          setMapTarget={setMapTarget}
          setPickup={setPickup}
          setDropoff={setDropoff}
        />
        <div className="grid gap-3 border-t border-[#eee5d9] bg-[#fffdf9] p-4 sm:grid-cols-2 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9f1e7] text-[#55764d]">
              <Navigation className="size-4" />
            </span>
            <div className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Pickup
              </span>
              <span className="block truncate text-sm font-medium text-text-primary">
                {pickup.address || "Choose your pickup point"}
              </span>
              <span className="mt-0.5 block text-[11px] text-text-muted">
                {pickup.latitude.toFixed(4)}, {pickup.longitude.toFixed(4)}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f7ead8] text-[#9b6529]">
              <MapPin className="size-4" />
            </span>
            <div className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Destination
              </span>
              <span className="block truncate text-sm font-medium text-text-primary">
                {dropoff.address || "Where would you like to go?"}
              </span>
              <span className="mt-0.5 block text-[11px] text-text-muted">
                {dropoff.latitude.toFixed(4)}, {dropoff.longitude.toFixed(4)}
              </span>
            </div>
          </div>
        </div>
        </section>

        <Card
          className="overflow-hidden rounded-2xl border-[#e9ddcc] shadow-[0_8px_28px_rgba(69,48,28,.06)]"
          padded={false}
          title="Plan your ride"
          actions={
            <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
              <ShieldCheck className="size-4 text-[#6f8c5c]" />
              Upfront pricing
            </span>
          }
        >
          <div className="space-y-4 p-4 sm:p-5">
            <div className="rounded-xl border border-[#eee5d9] bg-[#fdfbf8] px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="mb-0 text-xs font-semibold text-text-primary">
                    Your route
                  </p>
                  <p className="mb-0 mt-0.5 text-[11px] text-text-muted">
                    {pickup.address && dropoff.address
                      ? "Both stops are set"
                      : pickup.address || dropoff.address
                        ? "One more stop to go"
                        : "Add your pickup and destination"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#765b3c] shadow-sm">
                  {Number(Boolean(pickup.address)) +
                    Number(Boolean(dropoff.address))}
                  /2 stops
                </span>
              </div>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eee5d9]"
                role="progressbar"
                aria-label="Route completion"
                aria-valuemin={0}
                aria-valuemax={2}
                aria-valuenow={
                  Number(Boolean(pickup.address)) +
                  Number(Boolean(dropoff.address))
                }
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#6f8c5c] to-[#bd781f] transition-[width] duration-300"
                  style={{
                    width: `${
                      ((Number(Boolean(pickup.address)) +
                        Number(Boolean(dropoff.address))) /
                        2) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
            <div className="relative space-y-3">
              <div className="absolute left-[17px] top-10 h-[72px] border-l border-dashed border-[#cbbba5]" />
              <div className="relative flex items-start gap-3">
                <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full border border-[#dce8d8] bg-[#f0f5ed] text-[#587a50]">
                  <Navigation className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <AddressAutocomplete
                    id="transport-pickup-address"
                    label="Pickup location"
                    value={pickup.address}
                    onFocus={() => setMapTarget("pickup")}
                    onChange={(address) =>
                      setPickup((current) => ({ ...current, address }))
                    }
                    placeholder="Enter pickup address"
                    onSelect={(place) => choosePlace("pickup", place)}
                  />
                  <button
                    type="button"
                    onClick={() => focusMapTarget("pickup")}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#e8ddce] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#765b3c] transition hover:border-[#bd781f] hover:bg-[#fffaf2] hover:text-[#82520f] focus:outline-none focus:ring-2 focus:ring-[#bd781f]/30"
                  >
                    <MapPin className="size-3.5" />
                    Pin pickup on map
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={locating}
                    leftIcon={<LocateFixed className="size-4" />}
                    onClick={useCurrentLocation}
                    className="mt-2"
                  >
                    Use my current location
                  </Button>
                  <Input
                    label="Town or city"
                    value={pickup.town}
                    onFocus={() => setMapTarget("pickup")}
                    onChange={(e) =>
                      setPickup({ ...pickup, town: e.target.value })
                    }
                    placeholder="e.g. Nairobi"
                    className="mt-2 bg-white"
                  />
                </div>
              </div>
              {locationError && (
                <p className="ml-12 text-xs text-danger" role="alert">
                  {locationError}
                </p>
              )}
              <div className="ml-12">
                <button
                  type="button"
                  onClick={() => {
                    setPickup(dropoff);
                    setDropoff(pickup);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-muted transition hover:bg-[#f8f5ef] hover:text-text-primary"
                  aria-label="Swap pickup and destination"
                >
                  <ArrowUpDown className="size-3.5" />
                  Swap locations
                </button>
              </div>
              <div className="relative flex items-start gap-3">
                <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full border border-[#f0dfc8] bg-[#fbf2e7] text-[#a66a26]">
                  <MapPin className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <AddressAutocomplete
                    id="transport-destination-address"
                    label="Destination"
                    value={dropoff.address}
                    onFocus={() => setMapTarget("dropoff")}
                    onChange={(address) =>
                      setDropoff((current) => ({ ...current, address }))
                    }
                    placeholder="Where do you want to go?"
                    onSelect={(place) => choosePlace("dropoff", place)}
                  />
                  <button
                    type="button"
                    onClick={() => focusMapTarget("dropoff")}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#e8ddce] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#765b3c] transition hover:border-[#bd781f] hover:bg-[#fffaf2] hover:text-[#82520f] focus:outline-none focus:ring-2 focus:ring-[#bd781f]/30"
                  >
                    <MapPin className="size-3.5" />
                    Pin destination on map
                  </button>
                  <Input
                    label="Town or city"
                    value={dropoff.town}
                    onFocus={() => setMapTarget("dropoff")}
                    onChange={(e) =>
                      setDropoff({ ...dropoff, town: e.target.value })
                    }
                    placeholder="e.g. Nairobi"
                    className="mt-2 bg-white"
                  />
                </div>
              </div>
            </div>
            <p className="m-0 rounded-lg bg-[#f8f5ef] px-3 py-2 text-xs leading-relaxed text-text-muted">
              Tap the map to set the {mapTarget} pin, or enter an address above.
            </p>
            <details className="group border-t border-[#eee5d9] pt-3">
              <summary className="cursor-pointer list-none text-xs font-medium text-[#8a6b48] marker:hidden hover:text-[#68451e]">
                Fine-tune map coordinates
                <span className="float-right transition-transform group-open:rotate-180">
                  ⌄
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Pickup latitude"
                    type="number"
                    step="any"
                    value={pickup.latitude}
                    onChange={(e) =>
                      setPickup({
                        ...pickup,
                        latitude: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Pickup longitude"
                    type="number"
                    step="any"
                    value={pickup.longitude}
                    onChange={(e) =>
                      setPickup({
                        ...pickup,
                        longitude: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Destination latitude"
                    type="number"
                    step="any"
                    value={dropoff.latitude}
                    onChange={(e) =>
                      setDropoff({
                        ...dropoff,
                        latitude: Number(e.target.value),
                      })
                    }
                  />
                  <Input
                    label="Destination longitude"
                    type="number"
                    step="any"
                    value={dropoff.longitude}
                    onChange={(e) =>
                      setDropoff({
                        ...dropoff,
                        longitude: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </details>
          </div>
        </Card>
      </div>

      {quoteError && (
        <Alert variant="danger" title="Check your trip details">
          {quoteError}
        </Alert>
      )}

      <div className="grid min-w-0 items-start gap-5">
        <Card
          className="overflow-hidden rounded-2xl border-[#e9ddcc] shadow-[0_8px_28px_rgba(69,48,28,.06)]"
          padded={false}
          title="Choose your ride"
        >
          <div className="space-y-6 p-4 sm:p-6 lg:p-7">
            <section aria-labelledby="ride-heading">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2
                    id="ride-heading"
                    className="text-sm font-semibold text-text-primary"
                  >
                    What suits your journey?
                  </h2>
                  <p className="mt-1 text-xs text-text-muted">
                    Choose the ride that feels right for you.
                  </p>
                </div>
                <span className="rounded-full bg-[#f7f1e8] px-3 py-1 text-[11px] font-medium text-[#765b3c]">
                  3 ride options
                </span>
              </div>
              <div
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                role="radiogroup"
                aria-labelledby="ride-heading"
              >
                {SERVICE_OPTIONS.map(
                  ({ label, value, detail, highlight, icon: ServiceIcon }) => {
                    const selected = serviceType === value;
                    return (
                      <label
                        key={value}
                        className={`group relative isolate flex min-h-[184px] cursor-pointer flex-col overflow-hidden rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-[#bd781f]/40 sm:p-5 ${
                          selected
                            ? "border-[#bd781f] bg-gradient-to-br from-[#fff8ed] via-white to-[#f8ead2] shadow-[0_12px_30px_rgba(189,120,31,.14)] ring-1 ring-[#bd781f]/20"
                            : "border-[#eee4d6] bg-gradient-to-b from-white to-[#fdfbf7] hover:border-[#d6bc96] hover:shadow-[0_10px_24px_rgba(69,48,28,.08)]"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute -right-8 -top-9 -z-10 size-28 rounded-full transition-colors ${
                            selected
                              ? "bg-[#f3dfbf]/60"
                              : "bg-[#f6f0e7]/80 group-hover:bg-[#f3e7d5]"
                          }`}
                        />
                        <input
                          className="sr-only"
                          type="radio"
                          name="serviceType"
                          value={value}
                          checked={selected}
                          onChange={() => setServiceType(value as ServiceType)}
                        />
                        <span className="flex items-start justify-between gap-3">
                          <span
                            className={`grid size-14 place-items-center rounded-2xl shadow-sm transition ${
                              selected
                                ? "bg-[#bd781f] text-white shadow-[#bd781f]/20"
                                : "bg-[#f5eee3] text-[#805b35] group-hover:bg-[#efe2ce]"
                            }`}
                          >
                            <ServiceIcon className="size-7" strokeWidth={1.8} />
                          </span>
                          {selected ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#bd781f] px-2.5 py-1 text-[10px] font-semibold text-white">
                              <Check className="size-3" />
                              Selected
                            </span>
                          ) : (
                            <span className="grid size-6 place-items-center rounded-full border border-[#e5dac9] bg-white/80 text-[#a28a6c] transition group-hover:border-[#bd781f]/50 group-hover:text-[#bd781f]">
                              <ArrowRight className="size-3.5" />
                            </span>
                          )}
                        </span>
                        <span className="mt-4 block text-lg font-semibold tracking-tight text-text-primary">
                          {label}
                        </span>
                        <span className="mt-1 block min-h-8 text-xs leading-relaxed text-text-muted">
                          {detail}
                        </span>
                        <span
                          className={`mt-auto inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            selected
                              ? "bg-[#bd781f]/10 text-[#82520f]"
                              : "bg-[#f5f0e8] text-[#765b3c]"
                          }`}
                        >
                          {highlight}
                        </span>
                        {selected && (
                          <span className="sr-only">
                            Selected ride: {label}
                          </span>
                        )}
                      </label>
                    );
                  }
                )}
              </div>
            </section>

            <section
              className="space-y-5 border-t border-[#eee5d9] pt-6"
              aria-labelledby="schedule-heading"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f7f1e8] text-[#805b35]">
                  <CalendarDays className="size-5" />
                </span>
                <div>
                  <h2
                    id="schedule-heading"
                    className="text-base font-semibold tracking-tight text-text-primary"
                  >
                    Trip preferences
                  </h2>
                  <p className="mb-0 mt-1 text-xs text-text-muted">
                    Personalize your pickup and payment details.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
                <div className="rounded-2xl border border-[#eee4d6] bg-gradient-to-br from-[#fffaf2] to-[#f8f2e9] p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Clock className="size-4 text-[#9b6829]" />
                    <h3 className="text-sm font-semibold text-text-primary">
                      When are you travelling?
                    </h3>
                  </div>
                  <Input
                    label="Travel date and time"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="border-white bg-white shadow-sm"
                  />
                  <p className="mb-0 mt-2 text-[11px] leading-relaxed text-text-muted">
                    Leave this blank if your pickup time is flexible.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <QuantityControl
                    id="trip-passengers"
                    label="Passengers"
                    detail="Including you"
                    value={passengers}
                    min={1}
                    icon={<Users className="size-5" />}
                    onChange={setPassengers}
                  />
                  <QuantityControl
                    id="trip-luggage"
                    label="Luggage"
                    detail="Bags and items"
                    value={luggage}
                    min={0}
                    icon={<Luggage className="size-5" />}
                    onChange={setLuggage}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#eee4d6] bg-white p-4 sm:p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Choose a payment method
                  </h3>
                  <p className="mb-0 mt-1 text-xs text-text-muted">
                    Select how you’d like to pay for your ride.
                  </p>
                </div>
                <div
                  className="grid gap-3 sm:grid-cols-3"
                  role="radiogroup"
                  aria-label="Payment method"
                >
                  {[
                    {
                      value: "wallet",
                      label: "DS Wallet",
                      detail: "Pay from your balance",
                      icon: <WalletCards className="size-5" />,
                    },
                    {
                      value: "mpesa",
                      label: "M-Pesa",
                      detail: "Pay with your phone",
                      icon: <Smartphone className="size-5" />,
                    },
                    {
                      value: "stripe",
                      label: "Card",
                      detail: "Coming soon",
                      icon: <CreditCard className="size-5" />,
                    },
                  ].map(({ value, label, detail, icon }) => {
                    const selected = paymentMethod === value;
                    return (
                      <label
                        key={value}
                        className={`flex min-h-[76px] cursor-pointer items-center gap-3 rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-[#bd781f]/30 ${
                          selected
                            ? "border-[#bd781f] bg-[#fff8ed] shadow-[0_4px_14px_rgba(189,120,31,.08)]"
                            : "border-[#eee5d9] bg-[#fdfbf8] hover:border-[#d6bc96]"
                        }`}
                      >
                        <input
                          className="sr-only"
                          type="radio"
                          name="paymentMethod"
                          value={value}
                          checked={selected}
                          onChange={() =>
                            setPaymentMethod(value as PaymentMethod)
                          }
                        />
                        <span
                          className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                            selected
                              ? "bg-[#bd781f] text-white"
                              : "bg-[#f3ede3] text-[#805b35]"
                          }`}
                        >
                          {icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-text-primary">
                            {label}
                          </span>
                          <span className="mt-1 block text-[10px] leading-snug text-text-muted">
                            {detail}
                          </span>
                        </span>
                        {selected && (
                          <Check className="ml-auto size-4 shrink-0 text-[#bd781f]" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {paymentMethod === "mpesa" && (
                <div className="rounded-2xl border border-[#dceadd] bg-[#f7fbf6] p-4 sm:p-5">
                  <Input
                    label="M-Pesa phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="254712345678"
                    inputMode="tel"
                  />
                  <p className="mb-0 mt-2 text-[11px] text-text-muted">
                    Enter the Safaricom number registered with M-Pesa.
                  </p>
                </div>
              )}
              {paymentMethod === "stripe" && (
                <div className="rounded-xl border border-[#eee0c8] bg-[#fff9ee] p-3 text-xs leading-relaxed text-[#765b3c]">
                  Card payments are being set up. Please choose DS Wallet or
                  M-Pesa for now.
                </div>
              )}

              <div className="rounded-2xl border border-[#eee4d6] bg-[#fdfbf8] p-4 sm:p-5">
                <Input
                  label="Note for your driver (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything your driver should know?"
                />
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eee5d9] pt-5">
              <p className="m-0 inline-flex items-center gap-2 text-xs text-text-muted">
                <ShieldCheck className="size-4 text-[#6f8c5c]" /> No charge until
                you confirm your fare.
              </p>
              <Button
                variant="secondary"
                loading={quoting}
                onClick={requestQuote}
              >
                <span className="inline-flex items-center gap-2">
                  {quote ? "Refresh fare estimate" : "Get fare estimate"}{" "}
                  <ArrowRight className="size-4" />
                </span>
              </Button>
            </div>
          </div>
        </Card>

        <aside className="space-y-4">
          {quote ? (
            <Card
              className="overflow-hidden rounded-3xl border-[#e8d6bd] shadow-[0_16px_40px_rgba(69,48,28,.12)]"
              padded={false}
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-[#382719] via-[#4b301c] to-[#76502c] px-5 pb-6 pt-5 text-white sm:px-6 sm:pt-6">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full border-[26px] border-white/[.06]"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-16 right-20 size-36 rounded-full bg-[#bd781f]/20 blur-2xl"
                />
                <div className="relative flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#fff3df]">
                    <CheckCircle2 className="size-4 text-[#d6e8c9]" />
                    YOUR FARE IS READY
                  </span>
                  <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-[#ffe0ac]">
                    <CarFront className="size-5" />
                  </span>
                </div>
                <p className="relative mb-1 mt-6 text-xs font-medium text-[#ead7bd]">
                  Total estimated fare
                </p>
                <div className="relative flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <strong className="text-4xl font-semibold tracking-tight text-white sm:text-[2.75rem]">
                    {formatCurrency(quote.fare, quote.currency)}
                  </strong>
                  <span className="text-xs text-[#ead7bd]">
                    {quote.currency}
                  </span>
                </div>
                <p className="relative mb-0 mt-2 text-xs leading-relaxed text-[#ead7bd]">
                  The fare for your selected ride, shown upfront.
                </p>
                <div className="relative mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
                    <Navigation className="size-3.5 text-[#f1c47f]" />
                    {quote.distanceKm.toFixed(1)} km
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium capitalize text-white">
                    <CarFront className="size-3.5 text-[#f1c47f]" />
                    {serviceType}
                  </span>
                </div>
              </div>

              <div className="space-y-5 bg-white p-5 sm:p-6">
                <section aria-label="Trip route">
                  <div className="flex gap-3">
                    <div className="flex w-5 shrink-0 flex-col items-center pt-1">
                      <span className="size-2.5 rounded-full border-2 border-[#6f8c5c] bg-white" />
                      <span className="my-1 min-h-7 w-px flex-1 border-l border-dashed border-[#d7c6ae]" />
                      <MapPin className="size-4 text-[#bd781f]" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <p className="mb-0 text-[10px] font-semibold uppercase tracking-[.12em] text-[#8a7966]">
                          Pickup
                        </p>
                        <p className="mb-0 mt-0.5 truncate text-sm font-medium text-text-primary">
                          {pickup.address || "Pickup location"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-0 text-[10px] font-semibold uppercase tracking-[.12em] text-[#8a7966]">
                          Destination
                        </p>
                        <p className="mb-0 mt-0.5 truncate text-sm font-medium text-text-primary">
                          {dropoff.address || "Destination"}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#eee5d9] bg-[#fdfbf8] p-3">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                      Payment
                    </p>
                    <p className="mb-0 truncate text-xs font-semibold text-text-primary">
                      {paymentMethod === "mpesa"
                        ? "M-Pesa"
                        : paymentMethod === "wallet"
                          ? "DS Wallet"
                          : "Card"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#eee5d9] bg-[#fdfbf8] p-3">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                      Passengers
                    </p>
                    <p className="mb-0 text-xs font-semibold text-text-primary">
                      {passengers} {passengers === 1 ? "person" : "people"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-[#dceadd] bg-[#f5faf3] px-3 py-2.5 text-xs leading-relaxed text-[#42643c]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Fare held until{" "}
                    <strong>
                      {new Date(quote.expiresAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </strong>
                    . Confirm before it expires.
                  </span>
                </div>

                {payMessage && (
                  <Alert variant="info" title="Processing">
                    {payMessage}
                  </Alert>
                )}
                {payError && (
                  <Alert variant="danger" title="Payment failed">
                    {payError}
                  </Alert>
                )}

                <div className="border-t border-[#eee5d9] pt-4">
                  <Button
                    className="w-full justify-center rounded-xl py-3.5 text-sm shadow-[0_8px_20px_rgba(189,120,31,.22)]"
                    leftIcon={<Car className="h-4 w-4" />}
                    rightIcon={<ArrowRight className="size-4" />}
                    loading={paying}
                    onClick={() =>
                      handlePay({ preventDefault: () => {} } as FormEvent)
                    }
                  >
                    {paying
                      ? "Processing…"
                      : `Pay ${formatCurrency(quote.fare, quote.currency)}`}
                  </Button>
                </div>
                <p className="m-0 text-center text-[11px] leading-relaxed text-text-muted">
                  Secure payment · A driver will be assigned after payment.
                </p>
              </div>
            </Card>
          ) : (
            <Card
              className="overflow-hidden rounded-3xl border-[#e9ddcc] bg-white shadow-[0_12px_34px_rgba(69,48,28,.08)]"
              padded={false}
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-[#382719] via-[#52371f] to-[#80572e] px-5 py-5 text-white sm:px-6 sm:py-6">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-14 size-44 rounded-full border-[24px] border-white/[.06]"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-16 right-16 size-36 rounded-full bg-[#d49a4d]/20 blur-2xl"
                />
                <div className="relative flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.15em] text-[#f4d7a8]">
                    <span className="size-1.5 rounded-full bg-[#e6b45e]" />
                    Your trip, at a glance
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/90">
                    {pickup.address && dropoff.address
                      ? "Ready for estimate"
                      : pickup.address || dropoff.address
                        ? "Almost there"
                        : "Plan your ride"}
                  </span>
                </div>
                <h2 className="relative mb-0 mt-5 max-w-xs text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                  Know your fare before you go.
                </h2>
                <p className="relative mb-0 mt-2 max-w-sm text-xs leading-relaxed text-[#ead7bd]">
                  Add your route to see an upfront estimate for your ride.
                </p>
                <div className="relative mt-6 rounded-2xl border border-white/10 bg-white/[.08] p-4 backdrop-blur-sm">
                  <div className="flex items-stretch gap-3">
                    <div className="flex w-4 shrink-0 flex-col items-center pt-1">
                      <span
                        className={`size-2.5 rounded-full border-2 ${
                          pickup.address
                            ? "border-[#b8d5a5] bg-[#b8d5a5]"
                            : "border-[#e8bd7e] bg-transparent"
                        }`}
                      />
                      <span className="my-1 min-h-7 w-px flex-1 border-l border-dashed border-white/30" />
                      <MapPin
                        className={`size-4 ${
                          dropoff.address
                            ? "text-[#f2c77f]"
                            : "text-white/60"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <p className="mb-0 text-[9px] font-semibold uppercase tracking-[.14em] text-[#d9c4a8]">
                          Pickup
                        </p>
                        <p
                          className={`mb-0 mt-0.5 truncate text-xs font-medium ${
                            pickup.address ? "text-white" : "text-white/60"
                          }`}
                        >
                          {pickup.address || "Where should we pick you up?"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-0 text-[9px] font-semibold uppercase tracking-[.14em] text-[#d9c4a8]">
                          Destination
                        </p>
                        <p
                          className={`mb-0 mt-0.5 truncate text-xs font-medium ${
                            dropoff.address ? "text-white" : "text-white/60"
                          }`}
                        >
                          {dropoff.address || "Where are you going?"}
                        </p>
                      </div>
                    </div>
                    <Navigation className="mt-1 size-4 shrink-0 text-[#f2c77f]" />
                  </div>
                </div>
              </div>
              <div className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="mb-0 text-sm font-semibold text-text-primary">
                      Your fare estimate
                    </p>
                    <p className="mb-0 mt-1 text-[11px] text-text-muted">
                      No surprises—review the price before you pay.
                    </p>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f7ead8] text-[#9b6529]">
                    <Clock className="size-5" />
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Choose ride", complete: Boolean(serviceType) },
                    { label: "Add route", complete: Boolean(pickup.address && dropoff.address) },
                    { label: "See fare", complete: Boolean(quote) },
                  ].map(({ label, complete }, index) => (
                    <div
                      key={label}
                      className={`rounded-xl border p-2.5 ${
                        complete
                          ? "border-[#dce8d7] bg-[#f5faf3]"
                          : "border-[#eee5d9] bg-[#fdfbf8]"
                      }`}
                    >
                      <span
                        className={`mb-2 grid size-5 place-items-center rounded-full text-[10px] font-semibold ${
                          complete
                            ? "bg-[#6f8c5c] text-white"
                            : "bg-[#eee5d9] text-[#806b53]"
                        }`}
                      >
                        {complete ? (
                          <Check className="size-3" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className="block text-[10px] font-medium leading-tight text-text-secondary">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 border-t border-[#eee5d9] pt-3 text-[11px] leading-relaxed text-text-muted">
                  <ShieldCheck className="size-4 shrink-0 text-[#6f8c5c]" />
                  You’ll see the total before confirming your ride.
                </div>
              </div>
            </Card>
          )}
          <Card
            className="rounded-2xl border-[#e9ddcc] bg-[#fffaf1]"
            padded={false}
          >
            <div className="flex items-start gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9f1e7] text-[#55764d]">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h2 className="m-0 text-sm font-semibold text-text-primary">
                  A smoother trip
                </h2>
                <p className="mb-0 mt-1 text-xs leading-relaxed text-text-muted">
                  Your trip details and preferred payment are shared with the
                  driver who accepts your request.
                </p>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}