import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar, { type SidebarGroup } from "./Sidebar";
import Header from "./Header";
import MobileNav from "./MobileNav";
import { ROUTES } from "../../utils/constants";

interface LayoutProps {
  title?: string;
  children?: React.ReactNode;
}

export default function Layout({ title, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    },
    []
  );

  const groups: SidebarGroup[] = useMemo(
    () => [
      {
        title: "Discover",
        items: [
          { label: "Home", to: ROUTES.HOME, end: true, icon: "home" },
          { label: "Search", to: ROUTES.SEARCH, icon: "compass" },
          { label: "Accommodation", to: ROUTES.ACCOMMODATION, icon: "bed" },
          { label: "Restaurant", to: ROUTES.RESTAURANT, icon: "utensils" },
          { label: "Transport", to: ROUTES.TRANSPORT, icon: "car" },
        ],
      },
      {
        title: "Your activity",
        items: [
          { label: "Bookings", to: ROUTES.BOOKING, icon: "calendar" },
          { label: "Orders", to: ROUTES.ORDER, icon: "shoppingBag" },
          { label: "Trips", to: ROUTES.TRIP, icon: "route" },
          { label: "Tracking", to: ROUTES.TRACKING, icon: "mapPin" },
        ],
      },
      {
        title: "More",
        items: [
          { label: "Concierge", to: ROUTES.AI_CONCIERGE, icon: "sparkles" },
          { label: "Broadcasts", to: ROUTES.BROADCAST, icon: "radio" },
          { label: "Wallet", to: ROUTES.WALLET, icon: "wallet" },
          { label: "Payments", to: ROUTES.PAYMENT, icon: "creditCard" },
          { label: "Reviews", to: ROUTES.REVIEWS, icon: "star" },
          { label: "Notifications", to: ROUTES.NOTIFICATIONS, icon: "bell" },
          { label: "Profile", to: ROUTES.PROFILE, icon: "user" },
        ],
      },
    ],
    []
  );

  return (
    <div className="app-shell flex h-dvh overflow-hidden bg-background">
      <Sidebar groups={groups} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header title={title} onMenuClick={() => setMobileOpen(true)} />
        <main
          ref={mainRef}
          className="app-main-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 pt-2 pb-24 sm:px-3 sm:pt-3 lg:pb-3"
          onScroll={() => {
            const main = mainRef.current;
            if (!main) return;
            main.classList.add("is-scrolling");
            if (scrollTimeoutRef.current !== null) {
              window.clearTimeout(scrollTimeoutRef.current);
            }
            scrollTimeoutRef.current = window.setTimeout(() => {
              main.classList.remove("is-scrolling");
              scrollTimeoutRef.current = null;
            }, 900);
          }}
        >
          <div className="w-full space-y-6">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>

      <MobileNav
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onOpenMenu={() => setMobileOpen(true)}
        groups={groups}
      />
    </div>
  );
}