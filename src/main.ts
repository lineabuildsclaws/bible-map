import './styles/app.css';
import { bibleReferenceUrl } from './bible/references';
import { loadPhaseData } from './data';
import { createBibleMap, type BibleMapController } from './map/create-map';
import { findPlaces } from './search/places';
import type { PhaseData, PlaceFeature, PlaceStatus } from './types';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('The application root could not be found.');
}

function element<TagName extends keyof HTMLElementTagNameMap>(
  tagName: TagName,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[TagName] {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function appendExternalLink(parent: HTMLElement, url: string, text: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') return;

  const link = element('a', undefined, text);
  link.href = parsed.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  parent.append(link);
}

function markerForStatus(status: PlaceStatus): HTMLElement {
  const marker = element('span', `legend-marker legend-marker--${status}`);
  marker.setAttribute('aria-hidden', 'true');
  return marker;
}

const shell = element('div', 'app-shell');
const header = element('header', 'topbar');
const identity = element('div', 'identity');
const eyebrow = element('p', 'eyebrow', 'Bible places in context');
const title = element('h1', 'identity__title', 'Bible Map');
identity.append(eyebrow, title);

const searchForm = element('form', 'search') as HTMLFormElement;
searchForm.setAttribute('role', 'search');
const searchLabel = element('label', 'sr-only', 'Search for a biblical place');
searchLabel.htmlFor = 'place-search';
const searchInput = element('input', 'search__input') as HTMLInputElement;
searchInput.id = 'place-search';
searchInput.name = 'place-search';
searchInput.type = 'search';
searchInput.placeholder = 'Find a biblical place';
searchInput.autocomplete = 'off';
searchInput.disabled = true;
searchInput.setAttribute('aria-autocomplete', 'list');
searchInput.setAttribute('aria-controls', 'search-results');
const searchButton = element('button', 'search__button', 'Search') as HTMLButtonElement;
searchButton.type = 'submit';
searchButton.disabled = true;
const searchResults = element('div', 'search__results') as HTMLDivElement;
searchResults.id = 'search-results';
searchResults.setAttribute('role', 'listbox');
searchResults.hidden = true;
const searchMessage = element('p', 'search__message');
searchMessage.setAttribute('aria-live', 'polite');
searchForm.append(searchLabel, searchInput, searchButton, searchResults, searchMessage);
header.append(identity, searchForm);

const workspace = element('main', 'workspace');
const mapFrame = element('section', 'map-frame');
mapFrame.setAttribute('aria-label', 'Interactive map of biblical places');
const mapContainer = element('div', 'map');
mapContainer.id = 'map';
const mapLoading = element('div', 'map-loading');
mapLoading.setAttribute('aria-live', 'polite');
const loadingIcon = element('span', 'map-loading__mark');
loadingIcon.setAttribute('aria-hidden', 'true');
mapLoading.append(loadingIcon, element('p', undefined, 'Preparing the map…'));

const mapAttribution = element('p', 'map-attribution');
mapAttribution.append(document.createTextNode('Map: '));
appendExternalLink(mapAttribution, 'https://openfreemap.org/', 'OpenFreeMap');
mapAttribution.append(document.createTextNode(' · Data: '));
appendExternalLink(mapAttribution, 'https://www.openstreetmap.org/copyright', 'OpenStreetMap contributors');
mapAttribution.append(document.createTextNode(' · Places: '));
appendExternalLink(mapAttribution, 'https://www.openbible.info/geo/', 'OpenBible.info');

mapFrame.append(mapContainer, mapLoading, mapAttribution);

const panel = element('aside', 'place-panel');
panel.tabIndex = -1;
panel.setAttribute('aria-live', 'polite');
const panelToggle = element('button', 'panel__toggle', '−') as HTMLButtonElement;
panelToggle.type = 'button';
panelToggle.setAttribute('aria-controls', 'place-panel-content');
panelToggle.setAttribute('aria-expanded', 'true');
panelToggle.setAttribute('aria-label', 'Collapse place details');
panelToggle.title = 'Collapse place details';
const panelContent = element('div', 'panel__content');
panelContent.id = 'place-panel-content';
panel.append(panelToggle, panelContent);
workspace.append(mapFrame, panel);
shell.append(header, workspace);
root.append(shell);

function replacePanel(...nodes: Node[]): void {
  panelContent.replaceChildren(...nodes);
}

function setPanelCollapsed(collapsed: boolean): void {
  panel.classList.toggle('place-panel--collapsed', collapsed);
  workspace.classList.toggle('workspace--panel-collapsed', collapsed);
  panelContent.hidden = collapsed;
  panelToggle.textContent = collapsed ? '+' : '−';
  panelToggle.setAttribute('aria-expanded', String(!collapsed));

  const action = collapsed ? 'Expand place details' : 'Collapse place details';
  panelToggle.setAttribute('aria-label', action);
  panelToggle.title = action;
}

panelToggle.addEventListener('click', () => {
  setPanelCollapsed(!panel.classList.contains('place-panel--collapsed'));
});

function renderWelcomePanel(): void {
  const panelEyebrow = element('p', 'panel__eyebrow', 'Phase 1 · Genesis geography');
  const panelTitle = element('h2', 'panel__title', 'See places in relation');
  const intro = element(
    'p',
    'panel__intro',
    'Search or select a place. Labels stay present so you can compare nearby landmarks without losing your bearings.',
  );
  const guide = element('div', 'panel__guide');
  guide.append(element('p', 'panel__section-label', 'Map key'));

  const guideList = element('ul', 'legend');
  const guideItems: Array<[PlaceStatus, string]> = [
    ['confirmed', 'Well identified place'],
    ['associated', 'Associated site'],
    ['uncertain', 'Competing candidate area'],
  ];
  for (const [status, label] of guideItems) {
    const item = element('li', 'legend__item');
    item.append(markerForStatus(status), element('span', undefined, label));
    guideList.append(item);
  }

  const note = element(
    'p',
    'panel__note',
    'Sodom and Gomorrah are intentionally shown with dashed proposal areas. They are not fixed historical dots.',
  );
  const dataNote = element('p', 'panel__data-note');
  dataNote.append(document.createTextNode('Place data adapted from '));
  appendExternalLink(dataNote, 'https://www.openbible.info/geo/', 'OpenBible.info');
  dataNote.append(document.createTextNode(' under CC BY 4.0.'));

  guide.append(guideList);
  replacePanel(panelEyebrow, panelTitle, intro, guide, note, dataNote);
}

function renderPlacePanel(place: PlaceFeature): void {
  const { properties } = place;
  const headerRow = element('div', 'panel__place-header');
  const type = element('p', 'panel__eyebrow', properties.featureType);
  const name = element('h2', 'panel__title', properties.name);
  headerRow.append(type, name);

  const description = element('p', 'panel__intro', properties.description);

  const referenceSection = element('section', 'references');
  const referenceTitle = element('h3', 'panel__section-label', 'Bible references');
  const referenceList = element('ul', 'reference-list');
  for (const reference of properties.references) {
    const item = element('li', 'reference');
    const link = element('a', 'reference__link', reference);
    link.href = bibleReferenceUrl(reference);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Read ${reference} on BibleGateway`);
    item.append(link);
    referenceList.append(item);
  }
  referenceSection.append(referenceTitle, referenceList);

  replacePanel(headerRow, description, referenceSection);
}

function renderError(message: string): void {
  const title = element('h2', 'panel__title', 'Map unavailable');
  const detail = element('p', 'panel__intro', message);
  const note = element(
    'p',
    'panel__note',
    'Check your connection and refresh. The application does not require an account or collect personal data.',
  );
  replacePanel(title, detail, note);
}

let phaseData: PhaseData | undefined;
let mapController: BibleMapController | undefined;

function hideSearchResults(): void {
  searchResults.hidden = true;
  searchResults.replaceChildren();
  searchInput.setAttribute('aria-expanded', 'false');
}

function choosePlace(place: PlaceFeature): void {
  searchInput.value = place.properties.name;
  searchMessage.textContent = '';
  hideSearchResults();
  mapController?.selectPlace(place);
}

function updateSearchResults(): PlaceFeature[] {
  const matches = phaseData ? findPlaces(phaseData.places, searchInput.value) : [];
  searchResults.replaceChildren();

  if (!searchInput.value.trim()) {
    searchMessage.textContent = '';
    hideSearchResults();
    return matches;
  }

  if (matches.length === 0) {
    searchMessage.textContent = 'No Phase 1 place matches that search.';
    hideSearchResults();
    return matches;
  }

  searchMessage.textContent = `${matches.length} place${matches.length === 1 ? '' : 's'} found.`;
  for (const place of matches) {
    const option = element('button', 'search-result') as HTMLButtonElement;
    option.type = 'button';
    option.setAttribute('role', 'option');
    option.append(
      element('span', 'search-result__name', place.properties.name),
      element('span', 'search-result__meta', place.properties.featureType),
    );
    option.addEventListener('click', () => choosePlace(place));
    searchResults.append(option);
  }

  searchResults.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
  return matches;
}

searchInput.addEventListener('input', () => {
  updateSearchResults();
});

searchInput.addEventListener('focus', () => {
  if (searchInput.value.trim()) updateSearchResults();
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hideSearchResults();
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const [firstMatch] = updateSearchResults();
  if (firstMatch) choosePlace(firstMatch);
});

renderWelcomePanel();

void (async () => {
  try {
    phaseData = await loadPhaseData();
    mapController = createBibleMap({
      container: mapContainer,
      data: phaseData,
      onPlaceSelected: (place) => renderPlacePanel(place),
      onReady: () => {
        mapLoading.hidden = true;
        searchInput.disabled = false;
        searchButton.disabled = false;
        searchInput.focus({ preventScroll: true });
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error stopped the map from loading.';
    mapLoading.hidden = true;
    renderError(message);
  }
})();
