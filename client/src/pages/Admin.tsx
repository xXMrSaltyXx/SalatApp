import React, { useEffect, useMemo, useState } from 'react';
import {
	activateTemplate,
	fetchActiveTemplate,
	fetchParticipants,
	fetchResetSettings,
	fetchTemplates,
	removeParticipant,
	saveTemplate,
	joinParticipant,
	updateResetSettings
} from '../api';
import type {
	Ingredient,
	Participant,
	ResetSettings,
	Template,
	TemplateSummary,
	User
} from '../types';

interface AdminProps {
	user: User;
}

const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const emptyIngredient = (): Ingredient => ({ name: '', quantity: 0, unit: '' });

const AdminPage: React.FC<AdminProps> = ({ user }) => {
	const [template, setTemplate] = useState<Template | null>(null);
	const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
	const [templates, setTemplates] = useState<TemplateSummary[]>([]);
	const [title, setTitle] = useState('Standard Salat');
	const servings = 1;
	const [ingredients, setIngredients] = useState<Ingredient[]>([]);
	const [participants, setParticipants] = useState<Participant[]>([]);
	const [resetSettings, setResetSettings] = useState<ResetSettings | null>(null);
	const [timeValue, setTimeValue] = useState('23:59');
	const [dayValue, setDayValue] = useState('5');

	const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
	const [ingredientDraft, setIngredientDraft] = useState<Ingredient>(emptyIngredient());
	const [ingredientEditIndex, setIngredientEditIndex] = useState<number | null>(null);
	const [ingredientError, setIngredientError] = useState<string | null>(null);
	const [ingredientDraftPeople, setIngredientDraftPeople] = useState(1);

	const [addName, setAddName] = useState('');
	const [addEmail, setAddEmail] = useState('');
	const [loading, setLoading] = useState(true);
	const [savingTemplate, setSavingTemplate] = useState(false);
	const [switchingTemplateId, setSwitchingTemplateId] = useState<number | null>(null);
	const [savingReset, setSavingReset] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const loadData = async () => {
		setLoading(true);
		setError(null);
		try {
			const [tpl, participantList, resetData, templateList] = await Promise.all([
				fetchActiveTemplate(),
				fetchParticipants(),
				fetchResetSettings(),
				fetchTemplates()
			]);
			setTemplates(templateList);
			if (tpl) {
				setTemplate(tpl);
				setActiveTemplateId(tpl.id);
				setTitle(tpl.title);
				setIngredients(tpl.ingredients.length > 0 ? tpl.ingredients : []);
			} else {
				setTemplate(null);
				setActiveTemplateId(null);
				setTitle('Standard Salat');
				setIngredients([]);
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
	const formatUpdatedAt = (value?: string) => {
		if (!value) return 'Unbekannt';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return 'Unbekannt';
		return parsed.toLocaleString();
	};

	const formatIngredientAmount = (ingredient: Ingredient) => {
		const quantity = Number(ingredient.quantity);
		const hasQuantity = Number.isFinite(quantity) && quantity !== 0;
		const unit = ingredient.unit ? ingredient.unit.trim() : '';

		if (hasQuantity && unit) return `${quantity} ${unit}`;
		if (hasQuantity) return `${quantity}`;
		if (unit) return unit;
		return '-';
	};

	const openIngredientModal = (ingredient?: Ingredient, index?: number) => {
		setIngredientDraft(ingredient ? { ...ingredient } : emptyIngredient());
		setIngredientEditIndex(typeof index === 'number' ? index : null);
		setIngredientError(null);
		setIngredientDraftPeople(1);
		setIngredientModalOpen(true);
	};

	const closeIngredientModal = () => {
		setIngredientModalOpen(false);
		setIngredientEditIndex(null);
		setIngredientError(null);
	};

	const handleIngredientDraftChange = (field: keyof Ingredient, value: string) => {
		setIngredientError(null);
		setIngredientDraft((prev) => {
			if (field === 'quantity') {
				const parsed = value === '' ? 0 : parseFloat(value) || 0;
				return { ...prev, quantity: parsed };
			}
			return { ...prev, [field]: value };
		});
	};

	const handleSaveIngredient = () => {
		const name = ingredientDraft.name.trim();
		if (!name) {
			setIngredientError('Bitte einen Namen angeben');
			return;
		}
		const rawQuantity = Number(ingredientDraft.quantity) || 0;
		const peopleCount = Math.max(1, Number(ingredientDraftPeople) || 1);
		const nextIngredient: Ingredient = {
			...ingredientDraft,
			name,
			quantity: rawQuantity / peopleCount,
			unit: ingredientDraft.unit ? ingredientDraft.unit.trim() : ''
		};

		setIngredients((prev) => {
			if (ingredientEditIndex === null || ingredientEditIndex < 0) {
				return [...prev, nextIngredient];
			}
			const updated = [...prev];
			updated[ingredientEditIndex] = nextIngredient;
			return updated;
		});
		closeIngredientModal();
	};

	const handleRemoveIngredient = (index: number) => {
		setIngredients((prev) => prev.filter((_, idx) => idx !== index));
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
			setActiveTemplateId(saved.id);
			setTitle(saved.title);
			setIngredients(saved.ingredients.length > 0 ? saved.ingredients : []);
			const templateList = await fetchTemplates();
			setTemplates(templateList);
			setMessage('Template gespeichert und aktiviert');
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Konnte Template nicht speichern';
			setError(message);
		} finally {
			setSavingTemplate(false);
		}
	};

	const handleNewTemplate = () => {
		setError(null);
		setMessage(null);
		setTemplate(null);
		setTitle('Neues Rezept');
		setIngredients([]);
	};

	const handleActivateTemplate = async (id: number) => {
		if (switchingTemplateId) return;
		setSwitchingTemplateId(id);
		setError(null);
		setMessage(null);
		try {
			const active = await activateTemplate(id);
			setTemplate(active);
			setActiveTemplateId(active.id);
			setTitle(active.title);
			setIngredients(active.ingredients.length > 0 ? active.ingredients : []);
			const templateList = await fetchTemplates();
			setTemplates(templateList);
			setMessage('Template aktiviert');
		} catch (err: any) {
			const message =
				err?.response?.data?.error || err?.message || 'Konnte Template nicht aktivieren';
			setError(message);
		} finally {
			setSwitchingTemplateId(null);
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
				activeTemplateId: activeTemplateId ?? null
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
					<div className="button-row">
						<button
							className="ghost"
							type="button"
							onClick={handleNewTemplate}
							disabled={savingTemplate || loading || switchingTemplateId !== null}
						>
							Neues Rezept
						</button>
						<button
							className="primary"
							onClick={handleSaveTemplate}
							disabled={savingTemplate || loading}
						>
							{savingTemplate ? 'Speichern...' : 'Template speichern'}
						</button>
					</div>
				</div>
				{error && <div className="error">{error}</div>}
				{message && <div className="success">{message}</div>}
				{loading ? (
					<div className="skeleton" />
				) : (
					<>
						<span className="field-label">Vorhandene Rezepte</span>
						<div className="list">
							{templates.map((tpl) => {
								const isActive = tpl.id === activeTemplateId;
								const isLoaded = template?.id === tpl.id;
								return (
									<div key={tpl.id} className="list-row">
										<div>
											<div className="item-name">{tpl.title}</div>
											<div className="muted">
												Zuletzt aktualisiert: {formatUpdatedAt(tpl.updatedAt)}
											</div>
										</div>
										<div className="button-row">
											{isActive ? (
												isLoaded ? (
													<span className="pill subtle">aktiv</span>
												) : (
													<button
														className="secondary"
														type="button"
														onClick={() => handleActivateTemplate(tpl.id)}
														disabled={
															switchingTemplateId !== null ||
															savingTemplate ||
															loading
														}
													>
														{switchingTemplateId === tpl.id
															? 'Laden...'
															: 'Bearbeiten'}
													</button>
												)
											) : (
												<button
													className="secondary"
													type="button"
													onClick={() => handleActivateTemplate(tpl.id)}
													disabled={
														switchingTemplateId !== null ||
														savingTemplate ||
														loading
												}
												>
													{switchingTemplateId === tpl.id
														? 'Aktivieren...'
														: 'Aktivieren'}
												</button>
											)}
										</div>
									</div>
								);
							})}
							{templates.length === 0 && (
								<p className="muted">Noch keine Rezepte vorhanden.</p>
							)}
						</div>
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
						</div>
						<div className="section-divider" aria-hidden />
						<div className="ingredient-list">
							{ingredients.length === 0 && (
								<p className="muted">Noch keine Zutaten angelegt.</p>
							)}
							{ingredients.map((ingredient, idx) => (
								<div
									key={idx}
									className="ingredient-row"
									onDoubleClick={() => openIngredientModal(ingredient, idx)}
								>
									<div className="ingredient-info">
										<div className="ingredient-name">
											{ingredient.name ? ingredient.name : 'Unbenannt'}
										</div>
										<div className="ingredient-meta">
											{formatIngredientAmount(ingredient)}
										</div>
									</div>
									<div className="ingredient-actions">
										<button
											className="ghost"
											type="button"
											onClick={(event) => {
												event.stopPropagation();
												openIngredientModal(ingredient, idx);
											}}
											onDoubleClick={(event) => event.stopPropagation()}
										>
											Bearbeiten
										</button>
										<button
											className="ghost danger"
											type="button"
											onClick={(event) => {
												event.stopPropagation();
												handleRemoveIngredient(idx);
											}}
											onDoubleClick={(event) => event.stopPropagation()}
										>
											Loeschen
										</button>
									</div>
								</div>
							))}
							<button className="ghost" type="button" onClick={() => openIngredientModal()}>
								+ Zutat hinzufuegen
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
			{ingredientModalOpen && (
				<div
					className="modal-backdrop"
					role="dialog"
					aria-modal="true"
					onClick={closeIngredientModal}
				>
					<div className="modal" onClick={(event) => event.stopPropagation()}>
						<div className="modal-header">
							<h4>
								{ingredientEditIndex === null
									? 'Zutat hinzufuegen'
									: 'Zutat bearbeiten'}
							</h4>
							<button className="ghost" type="button" onClick={closeIngredientModal}>
								Schliessen
							</button>
						</div>
						{ingredientError && <div className="error">{ingredientError}</div>}
						<div className="form-grid">
							<label className="field">
								<span>Zutat</span>
								<input
									type="text"
									placeholder="Zutat"
									value={ingredientDraft.name}
									onChange={(e) => handleIngredientDraftChange('name', e.target.value)}
								/>
							</label>
							<label className="field">
								<span>Menge</span>
								<input
									type="number"
									placeholder="Menge"
									value={ingredientDraft.quantity}
									onChange={(e) =>
										handleIngredientDraftChange('quantity', e.target.value)
									}
								/>
							</label>
							<label className="field">
								<span>Fuer wieviele Personen?</span>
								<input
									type="number"
									min={1}
									value={ingredientDraftPeople}
									onChange={(e) =>
										setIngredientDraftPeople(parseInt(e.target.value, 10) || 1)
									}
								/>
							</label>
							<label className="field">
								<span>Einheit</span>
								<input
									type="text"
									placeholder="Einheit (g, ml, Stueck...)"
									value={ingredientDraft.unit}
									onChange={(e) =>
										handleIngredientDraftChange('unit', e.target.value)
									}
								/>
							</label>
						</div>
						<div className="modal-actions">
							<button className="ghost" type="button" onClick={closeIngredientModal}>
								Abbrechen
							</button>
							<button className="primary" type="button" onClick={handleSaveIngredient}>
								Speichern
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AdminPage;
