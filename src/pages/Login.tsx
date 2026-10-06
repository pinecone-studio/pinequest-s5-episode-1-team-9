import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../hooks/useHashRoute";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (user) {
    return (
      <main>
        <h2>You are logged in</h2>
        <p className="lead">Signed in as {user.email}.</p>
        <a className="btn primary" href="#/">
          Go home
        </a>
      </main>
    );
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    login(email.trim());
    navigate("/");
  };

  return (
    <main>
      <h2>Login</h2>
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <p className="error" role="alert">
          {error}
        </p>
        <button className="btn primary" type="submit">
          Log in
        </button>
      </form>
    </main>
  );
}
