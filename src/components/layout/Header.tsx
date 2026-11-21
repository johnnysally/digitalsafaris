import { Link, useLocation } from "react-router-dom";
import { Menu, Bell, Sparkles } from "lucide-react";
import { useAuth } from "../../context/authContext";
import { useBranding } from "../../context/brandingContext";
import { ROUTES } from "../../utils/constants";
import Avatar from "../ui/Avatar";

const PAGE_LABELS = [
  [ROUTES.HOME, "Overview"],
  [ROUTES.SEARCH, "Explore"],
  [ROUTES.ACCOMMODATION, "Stays"],
  [ROUTES.RESTAURANT, "Dining"],
  [ROUTES.TRANSPORT, "Transport"],
  [ROUTES.BOOKING, "Bookings"],
  [ROUTES.ORDER, "Orders"],
  [ROUTES.TRIP, "Trips"],
  [ROUTES.TRACKING, "Tracking"],
  [ROUTES.AI_CONCIERGE, "Concierge"],
  [ROUTES.BROADCAST, "Requests"],
  [ROUTES.WALLET, "Wallet"],
  [ROUTES.PAYMENT, "Payments"],
  [ROUTES.REVIEWS, "Reviews"],
  [ROUTES.NOTIFICATIONS, "Notifications"],
  [ROUTES.PROFILE, "Profile"],
] as const;

interface HeaderProps {
  title?: string;
  onMenuClick?: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const { customer } = useAuth();
  const { branding } = useBranding();
  const { pathname } = useLocation();

  const appName =
    branding.metaTitle?.split("—")[0]?.trim() || "Digital Safaris";
  const logoUrl = branding.logoUrl || branding.logo || "/logo.png";
  const logoAppearance = branding.logoAppearance;
  const currentTitle =
    title ||
    PAGE_LABELS.find(
      ([path]) => pathname === path || pathname.startsWith(`${path}/`),
    )?.[1] ||
    "Travel";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <header className="sticky top-0 z-40 border-b border-[#eadfce] bg-[#fffdf9]/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-3 sm:px-5 lg:px-7">
        <button
          type="button"
          onClick={onMenuClick}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#765a39] transition hover:bg-[#f5ecdf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a75f1b] lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/" aria-label={appName} className="lg:hidden">
          <img
            src={logoUrl}
            alt=""
            className="h-9 w-9 rounded-xl border border-[#dda24c]/50 bg-white object-cover shadow-sm"
            style={logoAppearance ? {
              maxWidth: `${logoAppearance.maxWidth}px`,
              maxHeight: `${logoAppearance.maxHeight}px`,
              width: `${Math.min(36, logoAppearance.maxWidth)}px`,
              height: `${Math.min(36, logoAppearance.maxHeight)}px`,
              objectFit: logoAppearance.fit,
              padding: `${logoAppearance.padding}px`,
              borderRadius: `${logoAppearance.borderRadius}px`,
            } : undefined}
          />
        </Link>

        <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
          <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#e7d4b8] bg-gradient-to-br from-[#fff7e8] to-[#f2dfc2] text-[#a56623] shadow-sm">
            <span
              aria-hidden="true"
              className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white/70"
            />
            <Sparkles className="relative h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold leading-tight text-text-primary">
                {greeting}
                {customer ? (
                  <>
                    ,{" "}
                    <span className="text-[#a56623]">
                      {customer.firstName}
                    </span>
                  </>
                ) : (
                  " — your travel space"
                )}
              </span>
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-[10px] leading-tight text-text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c98a42]" />
              <span className="font-medium text-[#94724b]">{currentTitle}</span>
              <span aria-hidden="true">·</span>
              <span>Your journey, all in one place</span>
            </span>
          </span>
        </div>

        <div className="flex-1 md:hidden">
          <p className="truncate text-sm font-semibold text-text-primary">
            {currentTitle}
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            to={ROUTES.NOTIFICATIONS}
            className="relative grid h-10 w-10 place-items-center rounded-xl border border-[#eadfce] bg-white text-[#765a39] transition hover:border-[#d9c4a4] hover:bg-[#fffaf2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a75f1b]"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#d97722]" />
          </Link>

          {customer ? (
            <Link
              to={ROUTES.PROFILE}
              className="flex items-center gap-2 rounded-xl border border-transparent py-1 pl-1 pr-2 transition hover:border-[#eadfce] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a75f1b] sm:gap-2.5 sm:pl-2 sm:pr-3"
            >
              <Avatar
                src={customer.avatar ?? undefined}
                fallback={`${customer.firstName} ${customer.lastName}`}
                size="sm"
              />
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block text-[10px] leading-tight text-text-muted">
                  Signed in as
                </span>
                <span className="mt-0.5 block max-w-28 truncate text-xs font-semibold leading-tight text-text-primary">
                  {customer.firstName} {customer.lastName}
                </span>
              </span>
            </Link>
          ) : (
            <Link
              to={ROUTES.LOGIN}
              className="rounded-md bg-secondary-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-secondary-600"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}