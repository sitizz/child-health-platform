import type { ChildProfile, EnvironmentRisk, RiskLevel } from './api';
import type { RiskHistoryEntry } from './history';

/**
 * Client-side adaptive recommendation engine. Replaces the previously static,
 * identical-for-everyone recommendation text with guidance derived from six
 * factors, each surfaced in a recommendation's `reasons` so the caregiver can
 * see why it applies to their specific child:
 *   1. Child age (age_group)
 *   2. Existing symptoms (fever, cough, dehydration)
 *   3. Medical conditions (asthma)
 *   4. Environmental exposure (mosquito, flood)
 *   5. Risk level (overall + per-domain)
 *   6. Historical / forecast environmental trends
 */

export type RecPriority = 'urgent' | 'important' | 'advisory';

export type RecDomain =
  | 'escalation'
  | 'heat'
  | 'hydration'
  | 'respiratory'
  | 'dengue'
  | 'flood'
  | 'trend'
  | 'general';

export type Recommendation = {
  id: string;
  priority: RecPriority;
  domain: RecDomain;
  title: string;
  detail: string;
  reasons: string[];
};

const PRIORITY_RANK: Record<RecPriority, number> = { urgent: 3, important: 2, advisory: 1 };
const LEVEL_RANK: Record<RiskLevel, number> = { low: 1, moderate: 2, high: 3 };

const isElevated = (level?: RiskLevel) => level === 'high' || level === 'moderate';

function ageLabel(group: ChildProfile['age_group']): string {
  if (group === 'under5') return 'under 5';
  if (group === 'child') return 'school-age';
  return 'adolescent';
}

/** Compares a child's two most recent history entries (stored newest-first). */
function isRisingHistory(entries: RiskHistoryEntry[]): boolean {
  if (entries.length < 2) return false;
  return LEVEL_RANK[entries[0].level] > LEVEL_RANK[entries[1].level];
}

export function generateRecommendations(
  child: ChildProfile,
  risk: EnvironmentRisk,
  history?: RiskHistoryEntry[]
): Recommendation[] {
  const recs: Recommendation[] = [];
  const env = risk.environment ?? ({} as EnvironmentRisk['environment']);
  const risks = risk.risks ?? ({} as EnvironmentRisk['risks']);
  const name = child.name;
  const age = ageLabel(child.age_group);
  const under5 = child.age_group === 'under5';

  const push = (rec: Recommendation) => recs.push(rec);

  // --- Overall risk level (factor 5) ---
  if (risk.priority_alert === 'high') {
    push({
      id: 'overall-high',
      priority: 'urgent',
      domain: 'escalation',
      title: `Reduce ${name}'s exposure now`,
      detail: `Overall environmental risk is HIGH today. Keep ${name} indoors where possible and let school or other caregivers know.`,
      reasons: ['Risk level: HIGH', `Age group: ${age}`],
    });
  }

  // --- Heat (factors: risk, temperature, age, symptoms) ---
  if (isElevated(risks.heat_stress) || (typeof env.temperature === 'number' && env.temperature >= 35)) {
    const reasons = [`Heat stress: ${risks.heat_stress ?? 'elevated'}`];
    if (typeof env.temperature === 'number') reasons.push(`Temperature ${env.temperature}°C`);
    if (under5) reasons.push('Under-5 children overheat and dehydrate faster');

    push({
      id: 'heat-core',
      priority: risks.heat_stress === 'high' ? 'urgent' : 'important',
      domain: 'heat',
      title: `Limit heat exposure for ${name}`,
      detail: `Keep ${name} in shade or a cooler indoor space during peak heat (about 10am–4pm) and dress them in light, loose clothing.`,
      reasons,
    });

    if (child.dehydration) {
      push({
        id: 'heat-hydration',
        priority: 'important',
        domain: 'hydration',
        title: 'Rehydrate actively',
        detail: `Offer ${name} frequent small drinks plus oral rehydration solution, and watch for dry mouth, reduced urination, or unusual drowsiness.`,
        reasons: ['Dehydration symptom on profile', 'Heat elevated'],
      });
    }

    if (child.fever) {
      push({
        id: 'heat-fever',
        priority: 'important',
        domain: 'escalation',
        title: 'Fever during heat — monitor closely',
        detail: `Fever combined with heat raises the risk of overheating. Check ${name}'s temperature regularly and seek care if it passes 39°C or they become lethargic.`,
        reasons: ['Fever symptom on profile', 'Heat elevated'],
      });
    }
  }

  // --- Respiratory / air quality (factors: risk, AQI, asthma, cough) ---
  const aqi = env.aqi;
  if (isElevated(risks.respiratory) || (typeof aqi === 'number' && aqi > 100)) {
    const reasons = [`Respiratory risk: ${risks.respiratory ?? 'elevated'}`];
    if (typeof aqi === 'number') reasons.push(`AQI ${aqi}`);

    push({
      id: 'resp-core',
      priority: risks.respiratory === 'high' ? 'urgent' : 'important',
      domain: 'respiratory',
      title: `Protect ${name}'s breathing`,
      detail: `Limit outdoor time and strenuous activity until air quality improves, and keep windows closed during the most polluted parts of the day.`,
      reasons,
    });

    if (child.asthma) {
      push({
        id: 'resp-asthma',
        priority: risks.respiratory === 'high' ? 'urgent' : 'important',
        domain: 'respiratory',
        title: 'Asthma precautions',
        detail: `Keep ${name}'s reliever inhaler within reach and watch for wheezing, persistent coughing, or chest tightness. Seek urgent care for breathing difficulty or bluish lips.`,
        reasons: ['Asthma on profile', ...(typeof aqi === 'number' ? [`AQI ${aqi}`] : [])],
      });
    }

    if (child.cough) {
      push({
        id: 'resp-cough',
        priority: 'advisory',
        domain: 'respiratory',
        title: 'Existing cough may worsen',
        detail: `Poor air can aggravate ${name}'s cough. Avoid smoke and dust and consider an age-appropriate mask outdoors.`,
        reasons: ['Cough symptom on profile', 'Air quality reduced'],
      });
    }
  }

  // --- Dengue / mosquito (factors: risk, exposure) ---
  if (isElevated(risks.dengue) || child.mosquito_exposure) {
    const reasons = [`Dengue risk: ${risks.dengue ?? 'watch'}`];
    if (child.mosquito_exposure) reasons.push('Mosquito exposure on profile');

    push({
      id: 'dengue-core',
      priority: risks.dengue === 'high' ? 'important' : 'advisory',
      domain: 'dengue',
      title: 'Reduce mosquito bites',
      detail: `Use age-appropriate repellent and bed nets for ${name}, especially at dawn and dusk, and clear standing water around the home.`,
      reasons,
    });

    if (isElevated(risks.dengue)) {
      push({
        id: 'dengue-watch',
        priority: 'important',
        domain: 'escalation',
        title: 'Watch for dengue warning signs',
        detail: `Seek medical care promptly if ${name} develops a high fever with severe body aches, a rash, repeated vomiting, or bleeding gums.`,
        reasons: [`Dengue risk: ${risks.dengue}`],
      });
    }
  }

  // --- Flood (factors: risk, exposure, rainfall) ---
  const rain = env.rainfall;
  if (isElevated(risks.flood) || child.flood_exposure || (typeof rain === 'number' && rain > 10)) {
    const reasons = [`Flood risk: ${risks.flood ?? 'elevated'}`];
    if (child.flood_exposure) reasons.push('Recent flood exposure on profile');
    if (typeof rain === 'number') reasons.push(`Rainfall ${rain} mm`);

    push({
      id: 'flood-core',
      priority: risks.flood === 'high' ? 'important' : 'advisory',
      domain: 'flood',
      title: 'Stay clear of floodwater',
      detail: `Keep ${name} away from floodwater and mud — both carry a risk of injury and waterborne illness.`,
      reasons,
    });

    if (child.flood_exposure) {
      push({
        id: 'flood-water',
        priority: 'important',
        domain: 'flood',
        title: 'Use safe drinking water',
        detail: `After flood exposure, give ${name} only boiled or treated water and watch for diarrhoea or skin infections.`,
        reasons: ['Recent flood exposure on profile'],
      });
    }
  }

  // --- Historical & forecast trends (factor 6) ---
  const trendDir = risk.trend?.direction?.toLowerCase();
  const childHistory = (history ?? []).filter((h) => h.childId === child.id);

  if (trendDir === 'increasing' || isRisingHistory(childHistory)) {
    const reasons =
      trendDir === 'increasing' ? ['72-hour outlook: increasing'] : ['Recent readings trending up'];
    if (risk.trend?.message) reasons.push(risk.trend.message);

    push({
      id: 'trend-rising',
      priority: 'advisory',
      domain: 'trend',
      title: 'Risk is trending upward',
      detail: `Environmental risk for ${name} has been rising. Favour indoor activities and keep checking over the next day or two.`,
      reasons,
    });
  }

  const highForecast = (risk.forecast ?? []).slice(0, 3).find((d) => d.predicted_risk === 'high');
  if (highForecast) {
    push({
      id: 'trend-forecast',
      priority: 'advisory',
      domain: 'trend',
      title: `High risk forecast (Day ${highForecast.day})`,
      detail: `Day ${highForecast.day} is forecast as high risk (${highForecast.max_temperature}°C, ${highForecast.rainfall}mm rain). Plan ${name}'s outdoor time around it.`,
      reasons: [`Forecast Day ${highForecast.day}: high`],
    });
  }

  // --- Calm fallback ---
  if (!recs.length) {
    push({
      id: 'general-ok',
      priority: 'advisory',
      domain: 'general',
      title: `Conditions are calm for ${name}`,
      detail: `No elevated environmental risks right now. Keep up normal hydration and routine, and check back later.`,
      reasons: [`Risk level: ${risk.priority_alert?.toUpperCase() ?? 'LOW'}`, `Age group: ${age}`],
    });
  }

  return dedupeAndSort(recs);
}

function dedupeAndSort(recs: Recommendation[]): Recommendation[] {
  const seen = new Set<string>();
  const unique = recs.filter((rec) => (seen.has(rec.id) ? false : (seen.add(rec.id), true)));

  return unique
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
    .slice(0, 8);
}
