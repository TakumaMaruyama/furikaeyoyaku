import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ParentPage from "@/pages/parent";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";
import { Button } from "@/components/ui/button";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ParentPage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Navigation() {
  const [location] = useLocation();
  const isAdmin = location === "/admin";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Link href={isAdmin ? "/" : "/admin"}>
        <Button
          size="lg"
          data-testid={isAdmin ? "link-parent" : "link-admin"}
          className="h-12 px-6 text-base font-semibold shadow-lg"
        >
          {isAdmin ? "保護者向け画面" : "管理画面"}
        </Button>
      </Link>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <Navigation />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
