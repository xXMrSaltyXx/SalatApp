import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { fetchMe, getStoredSessionToken, loginUser, registerUser, setSessionToken } from './api';
import HomePage from './pages/Home';
import AdminPage from './pages/Admin';
import BillingPage from './pages/Billing';
import type { User } from './types';

function usePageTitle(location: ReturnType<typeof useLocation>) {
	const title = useMemo(() => {
		if (location.pathname.startsWith('/admin')) return 'Rezepte & Verwaltung';
		if (location.pathname.startsWith('/abrechnung')) return 'Abrechnung';
		return 'Salatrunde';
	}, [location.pathname]);
	useEffect(() => {
		document.title = `${title} | Salatrunde`;
	}, [title]);
}

const AuthScreen: React.FC<{
	onAuthSuccess: (user: User, token: string) => void;
}> = ({ onAuthSuccess }) => {
	const [mode, setMode] = useState<'login' | 'register'>('login');
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);
		setLoading(true);
		try {
			if (mode === 'register') {
				const res = await registerUser(name, email);
				setSessionToken(res.token);
				onAuthSuccess(res.user, res.token);
			} else {
				const res = await loginUser(email);
				setSessionToken(res.token);
				onAuthSuccess(res.user, res.token);
			}
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Leider ist etwas schiefgelaufen';
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="auth-grid">
			<div className="hero-card">
				<p className="eyebrow">Salatrunde · Anmeldung</p>
				<h1>
					Wöchentlich frisch
					<br />
					und jeder hat Überblick!
				</h1>
				<p className="lede">
					Registriere dich einmal mit Name &amp; E-Mail. Danach reicht deine E-Mail, um
					dich für die Runde dieser Woche ein- oder auszutragen.
				</p>
			</div>
			<form className="card auth-card" onSubmit={handleSubmit}>
				<div className="auth-tabs">
					<button
						type="button"
						className={mode === 'login' ? 'tab active' : 'tab'}
						onClick={() => setMode('login')}
					>
						Anmelden
					</button>
					<button
						type="button"
						className={mode === 'register' ? 'tab active' : 'tab'}
						onClick={() => setMode('register')}
					>
						Registrieren
					</button>
				</div>
				{mode === 'register' && (
					<label className="field">
						<span>Name</span>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="z.B. Alex"
							required
						/>
					</label>
				)}
				<label className="field">
					<span>E-Mail</span>
					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="du@example.com"
						required
					/>
				</label>
				{error && <div className="error">{error}</div>}
				<button className="primary" type="submit" disabled={loading}>
					{loading
						? 'Einen Moment...'
						: mode === 'register'
						? 'Registrieren'
						: 'Anmelden'}
				</button>
				<p className="hint">Keine Passwörter. Wir vertrauen auf deine E-Mail.</p>
			</form>
		</div>
	);
};

const AppShell: React.FC<{
	user: User;
	onLogout: () => void;
}> = ({ user, onLogout }) => {
	const location = useLocation();
	usePageTitle(location);
	return (
		<div className="app-shell">
			<header className="topbar">
				<div className="brand">
					<div className="logo-dot" aria-hidden="true" role="img">
						🥗
					</div>
					<div>
						<div className="brand-name">Salatrunde</div>
					</div>
				</div>
				<nav className="nav-links">
					<NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
						Einschreiben
					</NavLink>
					<NavLink
						to="/abrechnung"
						className={({ isActive }) => (isActive ? 'active' : '')}
					>
						Abrechnung
					</NavLink>
					<NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
						Rezept & Verwaltung
					</NavLink>
				</nav>
				<div className="user-chip">
					<div className="user-initials">{user.name.slice(0, 1).toUpperCase()}</div>
					<div>
						<div className="user-name">{user.name}</div>
						<div className="user-email">{user.email}</div>
					</div>
					<button className="ghost" onClick={onLogout}>
						Logout
					</button>
				</div>
			</header>
			<main>
				<Routes>
					<Route path="/" element={<HomePage user={user} />} />
					<Route path="/abrechnung" element={<BillingPage user={user} />} />
					<Route path="/admin" element={<AdminPage user={user} />} />
				</Routes>
			</main>
		</div>
	);
};

const App: React.FC = () => {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [token, setToken] = useState<string | null>(getStoredSessionToken());

	useEffect(() => {
		const bootstrap = async () => {
			if (!token) {
				setSessionToken(null);
				setUser(null);
				setLoading(false);
				return;
			}
			try {
				setSessionToken(token);
				const currentUser = await fetchMe();
				setUser(currentUser);
			} catch (err) {
				console.error('Session ungültig, bitte neu anmelden', err);
				setSessionToken(null);
				setToken(null);
				setUser(null);
			} finally {
				setLoading(false);
			}
		};
		bootstrap();
	}, [token]);

	const handleAuthSuccess = (authUser: User, newToken: string) => {
		setUser(authUser);
		setToken(newToken);
	};

	const handleLogout = () => {
		setSessionToken(null);
		setToken(null);
		setUser(null);
	};

	if (loading) {
		return (
			<div className="loading-screen">
				<div className="spinner" />
				<p>Starte die Salatschüssel...</p>
			</div>
		);
	}

	return (
		<BrowserRouter>
			{user ? (
				<AppShell user={user} onLogout={handleLogout} />
			) : (
				<div className="page">
					<AuthScreen onAuthSuccess={handleAuthSuccess} />
				</div>
			)}
		</BrowserRouter>
	);
};

export default App;
