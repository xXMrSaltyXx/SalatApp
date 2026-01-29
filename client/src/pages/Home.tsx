import React, { useEffect, useMemo, useState } from 'react';
import {
	fetchParticipants,
	fetchResetSettings,
	fetchShoppingList,
	fetchIngredientExclusions,
	joinParticipant,
	leaveSelf,
	saveIngredientExclusions
} from '../api';
import type { Participant, ResetSettings, ShoppingListResponse, User } from '../types';

interface HomeProps {
	user: User;
}

const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const normalizeIngredientName = (name: string) => name.trim().toLowerCase();

const HomePage: React.FC<HomeProps> = ({ user }) => {
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [shopping, setShopping] = useState<ShoppingListResponse | null>(null);
	const [resetInfo, setResetInfo] = useState<{
		settings: ResetSettings;
		nextReset: string;
	} | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [exclusionBusy, setExclusionBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [exclusions, setExclusions] = useState<string[]>([]);

	const isIn = useMemo(
		() => participants.some((p) => p.email.toLowerCase() === user.email.toLowerCase()),
		[participants, user.email]
	);

	const exclusionKeys = useMemo(
		() => new Set(exclusions.map((name) => normalizeIngredientName(name))),
		[exclusions]
	);

	const loadData = async () => {
		setLoading(true);
		setError(null);
		try {
			const [participantList, shoppingData, resetData, exclusionData] = await Promise.all([
				fetchParticipants(),
				fetchShoppingList(),
				fetchResetSettings(),
				fetchIngredientExclusions()
			]);
			setParticipants(participantList);
			setShopping(shoppingData);
			setResetInfo(resetData);
			setExclusions(exclusionData.exclusions || []);
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Konnte Daten nicht laden';
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	const handleJoin = async () => {
		setBusy(true);
		setError(null);
		try {
			await joinParticipant();
			await loadData();
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Konnte dich nicht eintragen';
			setError(message);
		} finally {
			setBusy(false);
		}
	};

	const handleLeave = async () => {
		setBusy(true);
		setError(null);
		try {
			await leaveSelf();
			await loadData();
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Konnte dich nicht austragen';
			setError(message);
		} finally {
			setBusy(false);
		}
	};

	const copyList = async () => {
		if (!shopping) return;
		const header = `Einkaufsliste (${shopping.participantCount} Personen)`;
		const lines = shopping.items.map((item) =>
			[
				`- ${item.name}: ${item.quantity} ${item.unit || ''}`.trim(),
				item.excludedBy && item.excludedBy.length > 0
					? `(ausgeschlossen von: ${item.excludedBy.join(', ')})`
					: ''
			]
				.filter(Boolean)
				.join(' ')
		);
		try {
			await navigator.clipboard.writeText([header, ...lines].join('\n'));
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setError('Konnte nicht in die Zwischenablage kopieren');
		}
	};

	const handleToggleExclusion = async (ingredientName: string) => {
		if (!shopping?.template) return;
		const key = normalizeIngredientName(ingredientName);
		const next = exclusionKeys.has(key)
			? exclusions.filter((name) => normalizeIngredientName(name) !== key)
			: [...exclusions, ingredientName];
		const previous = exclusions;
		setExclusions(next);
		setExclusionBusy(true);
		setError(null);
		try {
			await saveIngredientExclusions(next);
			const shoppingData = await fetchShoppingList();
			setShopping(shoppingData);
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Konnte Auswahl nicht speichern';
			setError(message);
			setExclusions(previous);
		} finally {
			setExclusionBusy(false);
		}
	};

	return (
		<div className="page-grid">
			<section className="card highlight">
				<div className="section-header">
					<div>
						<p className="eyebrow">Dein Status</p>
						<h2 className="status-heading">
							<span className="status-badge" aria-hidden>
								{isIn ? '🥗' : '🥣'}
							</span>
							<span>{isIn ? 'Du bist eingetragen' : 'Noch nicht eingetragen'}</span>
						</h2>
						{resetInfo && (
							<p className="muted">
								Nächster Reset am{' '}
								<strong>{dayNames[resetInfo.settings.resetDayOfWeek]}</strong> den{' '}
								<strong>{new Date(resetInfo.nextReset).toLocaleString()}</strong>
							</p>
						)}
					</div>
				</div>
				{error && <div className="error">{error}</div>}
				<div className="cta-row">
					{isIn ? (
						<button
							className="secondary"
							onClick={handleLeave}
							disabled={busy || loading}
						>
							Austragen
						</button>
					) : (
						<button className="primary" onClick={handleJoin} disabled={busy || loading}>
							Ich bin dabei
						</button>
					)}
				</div>
			</section>

			<div className="divider-row">
				<span className="divider-line" />
				<button className="ghost" onClick={loadData} disabled={busy || loading}>
					Daten aktualisieren
				</button>
				<span className="divider-line" />
			</div>

			<section className="card">
				<div className="section-header">
					<div>
						<p className="eyebrow">Einkaufsliste</p>
						<h3>
							{shopping?.template
								? `${shopping.template.title} · ${
										shopping.participantCount
								  } Portion${shopping.participantCount === 1 ? '' : 'en'}`
								: 'Noch kein Template hinterlegt'}
						</h3>
						{shopping?.template && (
							<p className="muted">
								Vorlage für {shopping.template.servings} Portionen · automatisch
								skaliert
							</p>
						)}
					</div>
					<div className="cta-row">
						<button
							className="secondary"
							onClick={copyList}
							disabled={!shopping || shopping.items.length === 0}
						>
							{copied ? 'Kopiert!' : 'Copy to Clipboard'}
						</button>
					</div>
				</div>
				{loading ? (
					<div className="skeleton" />
				) : shopping?.template ? (
					<div className="list">
						{shopping.items.map((item) => (
							<div key={item.name} className="list-row">
								<div>
									<div className="item-name">{item.name}</div>
									<div className="muted">{item.unit || 'Stück'}</div>
									{item.excludedBy && item.excludedBy.length > 0 && (
										<div className="muted">
											Ausgeschlossen von: {item.excludedBy.join(', ')}
										</div>
									)}
								</div>
								<div className="quantity">{item.quantity}</div>
							</div>
						))}
					</div>
				) : (
					<p className="muted">
						Noch kein Rezept-Template angelegt. Starte auf der Seite "Rezept &
						Verwaltung".
					</p>
				)}
			</section>

			<section className="card">
				<div className="section-header">
					<div>
						<p className="eyebrow">Unbeliebte Zutaten</p>
						<h3>Deine Ausnahmen für das aktuelle Rezept</h3>
						<p className="muted">
							Markierte Zutaten werden für dich aus der Einkaufsliste gerechnet.
						</p>
					</div>
				</div>
				{loading ? (
					<div className="skeleton" />
				) : shopping?.template ? (
					<div className="list">
						{shopping.items.map((item) => {
							const checked = exclusionKeys.has(normalizeIngredientName(item.name));
							return (
								<label key={item.name} className="list-row">
									<div>
										<div className="item-name">{item.name}</div>
										<div className="muted">
											{item.unit || 'Stück'} · aktuell {item.quantity}
										</div>
									</div>
									<div className="pill-list">
										<span className={checked ? 'pill danger' : 'pill subtle'}>
											{checked ? 'ausgeschlossen' : 'in der Liste'}
										</span>
										<input
											type="checkbox"
											checked={checked}
											onChange={() => handleToggleExclusion(item.name)}
											disabled={exclusionBusy}
											aria-label={`Zutat ${item.name} ausschliessen`}
										/>
									</div>
								</label>
							);
						})}
						{shopping.items.length === 0 && (
							<p className="muted">Keine Zutaten im aktuellen Rezept.</p>
						)}
					</div>
				) : (
					<p className="muted">
						Noch kein Rezept aktiv. Lege im Adminbereich ein Template an.
					</p>
				)}
			</section>

			<section className="card">
				<div className="section-header">
					<div>
						<p className="eyebrow">Teilnehmer:innen</p>
						<h3>{participants.length} Personen in dieser Woche</h3>
					</div>
				</div>
				{loading ? (
					<div className="skeleton" />
				) : (
					<div className="list">
						{participants.map((person) => (
							<div key={person.id} className="list-row">
								<div>
									<div className="item-name">{person.name}</div>
									<div className="muted">{person.email}</div>
								</div>
								<div className="pill subtle">eingetragen</div>
							</div>
						))}
						{participants.length === 0 && (
							<p className="muted">Noch niemand eingetragen.</p>
						)}
					</div>
				)}
			</section>
		</div>
	);
};

export default HomePage;
