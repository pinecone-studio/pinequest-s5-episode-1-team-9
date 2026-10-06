import { useAuth } from "../context/AuthContext";

export default function Home() {
  const { user } = useAuth();

  return (
    <main>
      <h1>{user ? `Welcome back, ${user.name}.` : "Team 9 builds it together."}</h1>
      <p className="lead">
        
      </p>
      <div className="actions">
        {!user && (
          <a className="btn primary" href="#/login">
            Log in
          </a>
        )}
        <a className={user ? "btn primary" : "btn"} href="#/about">
          About the project
        </a>
      </div>s
      <ul className="topics">
        <li>
          <strong>Home</strong>
          <span>Landing page with the project summary.</span>
        </li>
        <li>
          <strong>About</strong>
          <span>Who we are and what we are building.</span>
        </li>
        <li>
          <strong>Login</strong>
          <span>Sign in form. It only stores your name in this browser.</span>
        </li>
      </ul>
    </main>
  );
}
