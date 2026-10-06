import { useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import { useHashRoute } from "./hooks/useHashRoute";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import About from "./pages/About";
import Login from "./pages/Login";

function Pages({ path }: { path: string }) {
  if (path === "/about") return <About />;
  if (path === "/login") return <Login />;
  return <Home />;
}

export default function App() {
  const path = useHashRoute();

  useEffect(() => {
    document.title =
      path === "/login" ? "Login | Team 9" : path === "/about" ? "About | Team 9" : "Team 9";
  }, [path]);

  return (
    <AuthProvider>
      <Navbar path={path} />
      <Pages path={path} />
    </AuthProvider>
  );
}
