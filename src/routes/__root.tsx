import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-base text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-base font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Dawnhalo — a little light for your next step" },
      { name: "description", content: "A daily affirmation and oracle-card companion. A quiet moment of clarity, every morning." },
      { name: "theme-color", content: "#fdfcfb" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Dawnhalo" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { property: "og:title", content: "Dawnhalo — a little light for your next step" },
      { property: "og:description", content: "A daily affirmation and oracle-card companion. A quiet moment of clarity, every morning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Dawnhalo — a little light for your next step" },
      { name: "twitter:description", content: "A daily affirmation and oracle-card companion. A quiet moment of clarity, every morning." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/70418065-d86a-43a3-9c1a-a60b4b542ae5/id-preview-4c5f6b9c--563fcdc3-2058-4de6-ae5d-9f620b461e2e.lovable.app-1781821279180.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/70418065-d86a-43a3-9c1a-a60b4b542ae5/id-preview-4c5f6b9c--563fcdc3-2058-4de6-ae5d-9f620b461e2e.lovable.app-1781821279180.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/app-icon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/app-icon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Figtree:wght@400;500;600;700&family=Vazirmatn:wght@400;500;600;700&family=Caveat:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Partner referral capture: a ?ref=CODE on any landing URL attributes this
// device to that partner (first-touch, enforced server-side). The pending code
// is kept in localStorage until the backend confirms it, so an offline first
// visit still credits the partner on a later one.
const REF_PENDING_KEY = "dawnhalo:pendingRef";

function captureReferral() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref")?.trim().toLowerCase();
    if (ref && /^[a-z0-9_-]{2,40}$/.test(ref)) {
      localStorage.setItem(REF_PENDING_KEY, ref);
      // Clean the URL so the code isn't re-shared accidentally.
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.toString());
    }
    const pending = localStorage.getItem(REF_PENDING_KEY);
    if (pending) {
      import("@/lib/api").then(({ api }) =>
        api
          .attributePartner(pending)
          .then(() => localStorage.removeItem(REF_PENDING_KEY))
          .catch(() => {
            /* backend unreachable or unknown code — retry next visit */
          }),
      );
    }
  } catch {
    /* storage or URL unavailable */
  }
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    captureReferral();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
