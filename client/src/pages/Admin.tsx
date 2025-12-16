import React, { useEffect, useMemo, useState } from 'react';
import {
	fetchActiveTemplate,
	fetchParticipants,
	fetchResetSettings,
	removeParticipant,
	saveTemplate,
	joinParticipant,
	updateResetSettings
} from '../api';
import type { Ingredient, Participant, ResetSettings, Template, User } from '../types';

interface AdminProps {
	user: User;
}

const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const emptyIngredient = (): Ingredient => ({ name: '', quantity: 0, unit: '' });

const AdminPage: React.FC<AdminProps> = ({ user }) => {
	const [template, setTemplate] = useState<Template | null>(null);
	const [title, setTitle] = useState('Standard Salat');
	const [servings, setServings] = useState(4);
	const [ingredients, setIngredients] = useState<Ingredient[]>([
		emptyIngredient(),
		emptyIngredient()
	]);
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [resetSettings, setResetSettings] = useState<ResetSettings | null>(null);
	const [timeValue, setTimeValue] = useState('23:59');
	const [dayValue, setDayValue] = useState('5');

	const [addName, setAddName] = useState('');
	const [addEmail, setAddEmail] = useState('');
	const [loading, setLoading] = useState(true);
	const [savingTemplate, setSavingTemplate] = useState(false);
	const [savingReset, setSavingReset] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const loadData = async () => {
		setLoading(true);
		setError(null);
		try {
			const [tpl, participantList, resetData] = await Promise.all([
				fetchActiveTemplate(),
				fetchParticipants(),
				fetchResetSettings()
			]);
			if (tpl) {
				setTemplate(tpl);
				setTitle(tpl.title);
				setServings(tpl.servings);
				setIngredients(tpl.ingredients.length > 0 ? tpl.ingredients : [emptyIngredient()]);
			}
			setParticipants(participantList);
			setResetSettings(resetData.settings);
			setDayValue(String(resetData.settings.resetDayOfWeek));
			setTimeValue(
				`${String(resetData.settings.resetHour).padStart(2, '0')}:${String(
					resetData.settings.resetMinute
				).padStart(2, '0')}`
			);
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

	const peopleCount = useMemo(() => participants.length, [participants]);

	const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
		setIngredients((prev) => {
			const next = [...prev];
			const parsed = field === 'quantity' ? parseFloat(value) || 0 : value;
			next[index] = { ...next[index], [field]: parsed };
			return next;
		});
	};

	const addIngredientRow = () => {
		setIngredients((prev) => [...prev, emptyIngredient()]);
	};

	const handleSaveTemplate = async () => {
		setSavingTemplate(true);
		setError(null);
		setMessage(null);
		try {
			const filtered = ingredients.filter((i) => i.name.trim() !== '');
			if (filtered.length === 0) {
				setError('Bitte mindestens eine Zutat angeben');
				setSavingTemplate(false);
				return;
			}
			const saved = await saveTemplate({
				id: template?.id,
				title,
				servings: Number(servings),
				ingredients: filtered.map((i) => ({
					...i,
					quantity: Number(i.quantity),
					unit: i.unit || ''
				}))
			});
			setTemplate(saved);
			setMessage('Template gespeichert und aktiviert');
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Konnte Template nicht speichern';
			setError(message);
		} finally {
			setSavingTemplate(false);
		}
	};

	const handleAddParticipant = async () => {
		setError(null);
		setMessage(null);
		try {
			if (!addName || !addEmail) {
				setError('Name und E-Mail angeben');
				return;
			}
			await joinParticipant({ name: addName, email: addEmail });
			setAddName('');
			setAddEmail('');
			const refreshed = await fetchParticipants();
			setParticipants(refreshed);
			setMessage('Person eingetragen');
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Konnte Person nicht eintragen';
			setError(message);
		}
	};

	const handleRemoveParticipant = async (id: number) => {
		setError(null);
		setMessage(null);
		try {
			await removeParticipant(id);
			setParticipants((prev) => prev.filter((p) => p.id !== id));
			setMessage('Eintrag entfernt');
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Konnte Person nicht entfernen';
			setError(message);
		}
	};

	const handleSaveReset = async () => {
		if (!resetSettings) return;
		setSavingReset(true);
		setError(null);
		setMessage(null);
		try {
			const [h, m] = timeValue.split(':').map((v) => parseInt(v, 10));
			const updated = await updateResetSettings({
				resetDayOfWeek: Number(dayValue),
				resetHour: h,
				resetMinute: m,
				lastReset: resetSettings.lastReset || null,
				activeTemplateId: resetSettings.activeTemplateId || null
			});
			setResetSettings(updated);
			setMessage('Reset-Zeitplan gespeichert');
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Konnte Zeitplan nicht speichern';
			setError(message);
		} finally {
			setSavingReset(false);
		}
	};

	return (
		<div className="page-grid">
			<section className="card">
				<div className="section-header">
					<div>
						<p className="eyebrow">Rezept-Template</p>
						<h3>Basis für die Einkaufsliste</h3>
						<p className="muted">
							Zutaten mit Menge &amp; Einheit. Wir skalieren automatisch pro
							Teilnehmerzahl.
						</p>
					</div>
					<button
						className="primary"
						onClick={handleSaveTemplate}
						disabled={savingTemplate || loading}
					>
						{savingTemplate ? 'Speichern...' : 'Template speichern'}
					</button>
				</div>
				{error && <div className="error">{error}</div>}
				{message && <div className="success">{message}</div>}
				{loading ? (
					<div className="skeleton" />
				) : (
					<>
						<div className="form-grid">
							<label className="field">
								<span>Titel</span>
								<input
									type="text"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder="z.B. Grüner Crunch"
								/>
							</label>
							<label className="field">
								<span>Portionen</span>
								<input
									type="number"
									min={1}
									value={servings}
									onChange={(e) => setServings(parseInt(e.target.value, 10) || 0)}
								/>
							</label>
						</div>
						<div className="section-divider" aria-hidden />
						<div className="ingredient-list">
							{ingredients.map((ingredient, idx) => (
								<div key={idx} className="ingredient-row">
									<input
										type="text"
										placeholder="Zutat"
										value={ingredient.name}
										onChange={(e) =>
											handleIngredientChange(idx, 'name', e.target.value)
										}
									/>
									<input
										type="number"
										placeholder="Menge"
										value={ingredient.quantity}
										onChange={(e) =>
											handleIngredientChange(idx, 'quantity', e.target.value)
										}
									/>
									<input
										type="text"
										placeholder="Einheit (g, ml, Stück...)"
										value={ingredient.unit}
										onChange={(e) =>
											handleIngredientChange(idx, 'unit', e.target.value)
										}
									/>
								</div>
							))}
							<button className="ghost" type="button" onClick={addIngredientRow}>
								+ Zutat hinzufügen
							</button>
						</div>
					</>
				)}
			</section>

			<section className="card">
				<div className="section-header">
					<div>
						<p className="eyebrow">Teilnehmer:innen bearbeiten</p>
						<h3>{peopleCount} Personen in dieser Woche</h3>
					</div>
					<div className="cta-row">
						<input
							type="text"
							placeholder="Name"
							value={addName}
							onChange={(e) => setAddName(e.target.value)}
						/>
						<input
							type="email"
							placeholder="E-Mail"
							value={addEmail}
							onChange={(e) => setAddEmail(e.target.value)}
						/>
						<button className="secondary" onClick={handleAddParticipant}>
							Hinzufügen
						</button>
					</div>
				</div>
				{loading ? (
					<div className="skeleton" />
				) : (
					<div className="list">
						{participants.map((p) => (
							<div key={p.id} className="list-row">
								<div>
									<div className="item-name">{p.name}</div>
									<div className="muted">{p.email}</div>
								</div>
								<button
									className="ghost danger"
									onClick={() => handleRemoveParticipant(p.id)}
								>
									Entfernen
								</button>
							</div>
						))}
						{participants.length === 0 && (
							<p className="muted">Noch niemand eingetragen.</p>
						)}
					</div>
				)}
			</section>

			<section className="card">
				<div className="section-header">
					<div>
						<p className="eyebrow">Automatischer Reset</p>
						<h3>Wöchentlicher Reset der Liste</h3>
						{resetSettings && resetSettings.lastReset && (
							<p className="muted">
								Letzter Reset: {new Date(resetSettings.lastReset).toLocaleString()}
							</p>
						)}
					</div>
					<button
						className="secondary"
						onClick={handleSaveReset}
						disabled={savingReset || loading}
					>
						{savingReset ? 'Speichern...' : 'Zeitplan speichern'}
					</button>
				</div>
				<div className="form-grid">
					<label className="field">
						<span>Wochentag</span>
						<select value={dayValue} onChange={(e) => setDayValue(e.target.value)}>
							{dayNames.map((name, idx) => (
								<option key={idx} value={idx}>
									{name}
								</option>
							))}
						</select>
					</label>
					<label className="field">
						<span>Uhrzeit</span>
						<input
							type="time"
							value={timeValue}
							onChange={(e) => setTimeValue(e.target.value)}
						/>
					</label>
				</div>
			</section>
		</div>
	);
};

export default AdminPage;
