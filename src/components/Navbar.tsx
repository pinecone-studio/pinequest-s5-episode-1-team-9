import { useAuth } from "../context/AuthContext";
import { navigate } from "../hooks/useHashRoute";

type NavLinkProps = { to: string; path: string; label: string };

function NavLink({ to, path, label }: NavLinkProps) {
  return (
    <a href={`#${to}`} aria-current={path === to ? "page" : undefined}>
      {label}
    </a>
  );
}

export default function Navbar({ path }: { path: string }) {
  const { user, logout } = useAuth();

  return (
    <header className="nav">
      <a className="brand" href="#/">
        Team 9
      </a>
      <nav className="nav-links" aria-label="Main">
        <NavLink to="/" path={path} label="Home" />
        <NavLink to="/about" path={path} label="About" />
        {user ? (
          <>
            <span>{user.name}</span>
            <button
              className="btn small"
              type="button"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <NavLink to="/login" path={path} label="Login" />
        )}
      </nav>
    </header>
  );
}
