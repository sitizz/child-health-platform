import { type RiskInput } from './api';
import { listChildren, type ServerChild } from './children-api';

export function ageGroup(age: number): RiskInput['age_group'] {
  if (age < 5) return 'under5';
  if (age < 12) return 'child';
  return 'adolescent';
}

export function ageGroupLabel(group: string): string {
  if (group === 'under5') return 'Under 5';
  if (group === 'child') return 'Child';
  return 'Adolescent';
}

export function childDisplayName(child: Pick<ServerChild, 'name'>): string {
  return child.name?.trim() || 'Your child';
}

/** Maps a server child's condition/symptom/exposure maps to environment-risk flags. */
export function childRiskInput(child: ServerChild): RiskInput {
  return {
    age_group: ageGroup(child.age),
    asthma: !!child.conditions?.asthma,
    fever: !!child.symptoms?.fever,
    cough: !!child.symptoms?.cough,
    dehydration: !!child.symptoms?.dehydration,
    mosquito_exposure: !!child.exposures?.mosquito_exposure,
    flood_exposure: !!child.exposures?.flood_exposure,
  };
}

/** The active child (server `is_selected`), falling back to the first child. */
export async function getSelectedChild(): Promise<ServerChild | null> {
  const children = await listChildren();
  return children.find((c) => c.is_selected) ?? children[0] ?? null;
}
