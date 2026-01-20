import React, { useEffect, useMemo, useState } from 'react';
import { fetchParticipants } from '../api';
import type { Participant, User } from '../types';

interface BillingProps {
	user: User;
}

const BillingPage: React.FC<BillingProps> = ({ user }) => {
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [amountInput, setAmountInput] = useState('');

	const formatter = useMemo(
		() =>
			new Intl.NumberFormat('de-DE', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}),
		[]
	);

	const loadData = async () => {
		setLoading(true);
		setError(null);
		try {
			const participantList = await fetchParticipants();
			setParticipants(participantList);
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Konnte Teilnehmende nicht laden';
			setError(message);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	const participantCount = participants.length;
	const amountValue = useMemo(() => {
		if (!amountInput.trim()) return 0;
		const normalized = amountInput.replace(',', '.');
		const parsed = Number(normalized);
		if (!Number.isFinite(parsed) || parsed < 0) return 0;
		return parsed;
	}, [amountInput]);
	const hasSplit = participantCount > 0 && amountValue > 0;
	const shareValue = hasSplit ? amountValue / participantCount : 0;
	const shareLabel = hasSplit ? `${formatter.format(shareValue)} EUR` : '-';

	return (
		<div className="page-grid">
			<section className="card">
				<div className="section-header">
					<div>
						<p className="eyebrow">Abrechnung</p>
						<h3>Gesamtbetrag aufteilen</h3>
						<p className="muted">
							Trage den Betrag ein, den du bezahlt hast. Wir teilen ihn auf alle
							eingetragenen Personen auf.
						</p>
					</div>
					<button className="ghost" onClick={loadData} disabled={loading}>
						Daten aktualisieren
					</button>
				</div>
				{error && <div className="error">{error}</div>}
				<div className="form-grid">
					<label className="field">
						<span>Gesamtbetrag (EUR)</span>
						<input
							type="number"
							min="0"
							step="0.01"
							value={amountInput}
							onChange={(event) => setAmountInput(event.target.value)}
							placeholder="z.B. 24.50"
						/>
					</label>
					<label className="field">
						<span>Teilnehmende</span>
						<input type="text" value={participantCount} readOnly />
					</label>
					<label className="field">
						<span>Pro Person</span>
						<input type="text" value={shareLabel} readOnly />
					</label>
				</div>
				{!loading && participantCount === 0 && (
					<p className="muted">
						Noch keine Teilnehmenden eingetragen. Trage dich auf der Startseite ein.
					</p>
				)}
				{hasSplit && (
					<p className="muted">
						Gesamtbetrag: {formatter.format(amountValue)} EUR. Pro Person:{' '}
						{formatter.format(shareValue)} EUR.
					</p>
				)}
			</section>

			<section className="card">
				<div className="section-header">
					<div>
						<p className="eyebrow">Aufteilung</p>
						<h3>{participantCount} Personen</h3>
					</div>
				</div>
				{loading ? (
					<div className="skeleton" />
				) : (
					<div className="list">
						{participants.map((person) => {
							const isSelf =
								person.email.toLowerCase() === user.email.toLowerCase();
							return (
								<div key={person.id} className="list-row">
									<div>
										<div className="item-name">{person.name}</div>
										<div className="muted">{person.email}</div>
									</div>
									<div className="pill-list">
										{isSelf && <span className="pill subtle">du</span>}
										<span className="pill">{shareLabel}</span>
									</div>
								</div>
							);
						})}
						{participants.length === 0 && (
							<p className="muted">Keine Teilnehmenden in dieser Woche.</p>
						)}
					</div>
				)}
			</section>
		</div>
	);
};

export default BillingPage;
