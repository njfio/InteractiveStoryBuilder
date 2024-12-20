import { Switch, Route } from "wouter";
import { Home } from "@/pages/Home";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Reader } from "@/pages/Reader";
import { Gallery } from "@/pages/Gallery";
import { ManuscriptGallery } from "@/pages/ManuscriptGallery";
import { useAuthStore } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Images } from "lucide-react";

function App() {
  const { user, loading } = useAuthStore();

  // Show loading state while auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/reader/:id" component={Reader} />
          <Route path="/gallery" component={Gallery} />
          <Route path="/manuscripts/:id/gallery" component={ManuscriptGallery} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
        <p className="mt-4 text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
      </div>
    </div>
  );
}

export default App;