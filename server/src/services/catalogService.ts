import { type CatalogResponse, DATASET_IDS } from '@cda/shared';
import { CATALOG } from '../catalog/catalog';
import { BRIEF_QUESTIONS } from '../catalog/examples';

/** Dataset names and the brief's four example questions, for the UI's empty state. */
export function getCatalog(): CatalogResponse {
  return {
    datasets: DATASET_IDS.map((id) => ({
      id,
      label: CATALOG[id].label,
      description: CATALOG[id].description,
    })),
    examples: [...BRIEF_QUESTIONS],
  };
}
