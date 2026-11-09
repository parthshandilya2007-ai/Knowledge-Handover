import { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import { LoadingSpinner } from "./components/common/States";

// Pages
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SourcesPage } from "./pages/SourcesPage";
import { StagePlaceholderPage } from "./pages/StagePlaceholderPage";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner message="Authenticating session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner message="Checking session..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Onboarding Wizard (Protected, without full sidebar) */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />

          {/* Authenticated Application Workspace (with AppLayout & Sidebar) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProjectsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/projects/:id"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProjectDetailPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ProfilePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Future Stage Workspaces */}
          <Route
            path="/sources"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SourcesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/processing"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <StagePlaceholderPage
                    stageNumber={5}
                    title="AI Processing Pipeline"
                    description="Run background extraction jobs, verify verbatim quotes against source chunks, and detect conflicting claims across artifacts."
                  />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/handover"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <StagePlaceholderPage
                    stageNumber={6}
                    title="Handover Dashboard"
                    description="Explore completed work, pending tasks, component ownership, first-week onboarding plan, and the interactive dependency graph."
                  />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/review"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <StagePlaceholderPage
                    stageNumber={7}
                    title="Verification & Review"
                    description="Audit verified, uncertain, and conflicting facts side-by-side, edit claims, and approve immutable handover report snapshots."
                  />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/assistant"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <StagePlaceholderPage
                    stageNumber={8}
                    title="Contextual AI Assistant"
                    description="Ask project questions answered strictly from authorized sources with clickable citations and grounded next action suggestions."
                  />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
