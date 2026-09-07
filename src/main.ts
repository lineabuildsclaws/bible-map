import './styles/app.css';
import { bibleReferenceUrl } from './bible/references';
import { loadMapData } from './data';
import { createBibleMap, type BibleMapController } from './map/create-map';
import { approximateRouteDistance } from './measure/distance';
import { findPlaces, normalizeSearchTerm } from './search/places';
import type { BibleMapData, PlaceFeature } from './types';

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

type LegendMarkerKind = 'place' | 'natural' | 'region' | 'basemap' | 'candidate';

function markerForLegend(kind: LegendMarkerKind): HTMLElement {
  const marker = element('span', `legend-marker legend-marker--${kind}`);
  marker.setAttribute('aria-hidden', 'true');
  if (kind === 'basemap') marker.textContent = 'Aa';
  return marker;
}

const shell = element('div', 'app-shell');
const sidebar = element('aside', 'sidebar');
sidebar.setAttribute('aria-label', 'Bible Map tools and place information');
const header = element('header', 'sidebar__header');
const identity = element('div', 'identity');
const eyebrow = element('p', 'eyebrow', 'Bible places in context');
const title = element('h1', 'identity__title', 'Bible Map');
identity.append(title, eyebrow);
header.append(identity);

const toolTabs = element('div', 'tool-tabs');
toolTabs.setAttribute('role', 'tablist');
toolTabs.setAttribute('aria-label', 'Map tools');
const searchTab = element('button', 'tool-tab tool-tab--active', 'Search') as HTMLButtonElement;
searchTab.type = 'button';
searchTab.id = 'search-tab';
searchTab.setAttribute('role', 'tab');
searchTab.setAttribute('aria-selected', 'true');
searchTab.setAttribute('aria-controls', 'search-tool');
const distanceTab = element('button', 'tool-tab', 'Distance') as HTMLButtonElement;
distanceTab.type = 'button';
distanceTab.id = 'distance-tab';
distanceTab.setAttribute('role', 'tab');
distanceTab.setAttribute('aria-selected', 'false');
distanceTab.setAttribute('aria-controls', 'distance-tool');
distanceTab.tabIndex = -1;
toolTabs.append(searchTab, distanceTab);

const tools = element('div', 'sidebar__tools');
const searchTool = element('section', 'tool-pane');
searchTool.id = 'search-tool';
searchTool.setAttribute('role', 'tabpanel');
searchTool.setAttribute('aria-labelledby', searchTab.id);

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
searchInput.setAttribute('role', 'combobox');
searchInput.setAttribute('aria-autocomplete', 'list');
searchInput.setAttribute('aria-controls', 'search-results');
searchInput.setAttribute('aria-expanded', 'false');
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
searchTool.append(searchForm);

const distanceTool = element('section', 'tool-pane distance-tool');
distanceTool.id = 'distance-tool';
distanceTool.setAttribute('role', 'tabpanel');
distanceTool.setAttribute('aria-labelledby', distanceTab.id);
distanceTool.hidden = true;
const distanceIntro = element(
  'p',
  'distance-tool__intro',
  'Measure an ordered path through up to seven mapped places.',
);
const distanceForm = element('form', 'distance-form') as HTMLFormElement;
const placeOptions = element('datalist');
placeOptions.id = 'distance-place-options';
const distanceFields = element('div', 'distance-fields');
const distanceActions = element('div', 'distance-actions');
const addDistanceButton = element('button', 'distance-add', 'Add place') as HTMLButtonElement;
addDistanceButton.type = 'button';
const distancePlaceCount = element('span', 'distance-place-count');
distancePlaceCount.setAttribute('aria-live', 'polite');
distanceActions.append(addDistanceButton, distancePlaceCount);
const measureButton = element('button', 'distance-submit', 'Measure distance') as HTMLButtonElement;
measureButton.type = 'submit';
measureButton.disabled = true;
const distanceMessage = element('p', 'distance-message');
distanceMessage.setAttribute('aria-live', 'polite');
const distanceResult = element('section', 'distance-result');
distanceResult.setAttribute('aria-live', 'polite');
distanceResult.hidden = true;

interface DistanceFieldEntry {
  field: HTMLDivElement;
  input: HTMLInputElement;
  label: HTMLLabelElement;
  removeButton: HTMLButtonElement;
}

const MAX_DISTANCE_PLACES = 7;
const distanceFieldEntries: DistanceFieldEntry[] = [];
let distanceFieldId = 0;

function updateDistanceFields(): void {
  for (const [index, entry] of distanceFieldEntries.entries()) {
    const isFirst = index === 0;
    const isLast = index === distanceFieldEntries.length - 1;
    const label = isFirst ? 'From' : isLast ? 'To' : `Stop ${index + 1}`;
    entry.label.textContent = label;
    entry.input.placeholder = isFirst ? 'Choose a starting place' : isLast ? 'Choose a final place' : 'Choose a stop';
    entry.field.dataset.position = isFirst ? 'start' : isLast ? 'end' : 'stop';
    entry.removeButton.hidden = distanceFieldEntries.length <= 2;
    entry.removeButton.setAttribute('aria-label', `Remove ${label.toLocaleLowerCase()}`);
  }

  addDistanceButton.disabled = distanceFieldEntries.length >= MAX_DISTANCE_PLACES;
  distancePlaceCount.textContent = `${distanceFieldEntries.length} / ${MAX_DISTANCE_PLACES}`;
}

function clearDistanceMeasurement(): void {
  distanceMessage.textContent = '';
  distanceResult.hidden = true;
  mapController?.clearDistance();
}

function createDistanceField(): DistanceFieldEntry {
  distanceFieldId += 1;
  const id = `distance-place-${distanceFieldId}`;
  const field = element('div', 'distance-field');
  const fieldLabel = element('label', 'distance-field__label') as HTMLLabelElement;
  fieldLabel.htmlFor = id;
  const input = element('input', 'distance-field__input') as HTMLInputElement;
  input.id = id;
  input.name = id;
  input.type = 'search';
  input.autocomplete = 'off';
  input.setAttribute('list', placeOptions.id);
  input.required = true;
  input.disabled = true;
  input.addEventListener('input', clearDistanceMeasurement);

  const removeButton = element('button', 'distance-remove', 'Remove') as HTMLButtonElement;
  removeButton.type = 'button';
  removeButton.addEventListener('click', () => {
    if (distanceFieldEntries.length <= 2) return;
    const index = distanceFieldEntries.findIndex((entry) => entry.field === field);
    if (index < 0) return;
    distanceFieldEntries.splice(index, 1);
    field.remove();
    updateDistanceFields();
    clearDistanceMeasurement();
  });

  field.append(fieldLabel, input, removeButton);
  return { field, input, label: fieldLabel, removeButton };
}

function addDistanceField(): HTMLInputElement {
  const entry = createDistanceField();
  distanceFieldEntries.push(entry);
  distanceFields.append(entry.field);
  updateDistanceFields();
  return entry.input;
}

addDistanceField();
addDistanceField();
distanceForm.append(distanceFields, distanceActions, measureButton, placeOptions, distanceMessage);
distanceTool.append(distanceIntro, distanceForm, distanceResult);
tools.append(searchTool, distanceTool);

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

const panel = element('section', 'place-panel');
panel.tabIndex = -1;
panel.setAttribute('aria-label', 'Place information');
panel.setAttribute('aria-live', 'polite');
const panelContent = element('div', 'panel__content');
panelContent.id = 'place-panel-content';
panel.append(panelContent);
sidebar.append(header, toolTabs, tools, panel);
workspace.append(mapFrame);
shell.append(sidebar, workspace);
root.append(shell);

function replacePanel(...nodes: Node[]): void {
  panelContent.replaceChildren(...nodes);
}

function renderWelcomePanel(data?: BibleMapData): void {
  const panelEyebrow = element('p', 'panel__eyebrow', 'Genesis geography');
  const panelTitle = element('h2', 'panel__title', 'See places in relation');
  const intro = element(
    'p',
    'panel__intro',
    data
      ? `Explore ${data.places.length} mappable places mentioned across Genesis. Search a biblical or modern name, or click a colored marker.`
      : 'Search a biblical or modern name, or click a colored marker. Plain map labels provide geographic context only.',
  );
  const guide = element('div', 'panel__guide');
  guide.append(element('p', 'panel__section-label', 'Map key'));

  const guideList = element('ul', 'legend');
  const guideItems: Array<[LegendMarkerKind, string]> = [
    ['place', 'Settlement or built place — clickable'],
    ['natural', 'River, valley, mountain, or other natural feature'],
    ['region', 'Region or territory (marker is representative)'],
    ['basemap', 'Basemap label — context only (e.g. Jerusalem)'],
    ['candidate', 'Debated location area — shown when selected'],
  ];
  for (const [kind, label] of guideItems) {
    const item = element('li', 'legend__item');
    item.append(markerForLegend(kind), element('span', undefined, label));
    guideList.append(item);
  }

  const dataNote = element('p', 'panel__data-note');
  dataNote.append(document.createTextNode('Place data adapted from '));
  appendExternalLink(dataNote, 'https://www.openbible.info/geo/', 'OpenBible.info');
  dataNote.append(document.createTextNode(' under CC BY\u00a04.0.'));

  guide.append(guideList);
  const unlocatedNote = data?.unlocatedPlaces.length
    ? element(
        'p',
        'panel__note',
        `${data.unlocatedPlaces.join(', ')} ${data.unlocatedPlaces.length === 1 ? 'is' : 'are'} mentioned in Genesis but not plotted because the source records no identifiable location.`,
      )
    : undefined;
  replacePanel(panelEyebrow, panelTitle, intro, guide, ...(unlocatedNote ? [unlocatedNote] : []), dataNote);
}

function renderPlacePanel(place: PlaceFeature): void {
  const { properties } = place;
  const headerRow = element('div', 'panel__place-header');
  const type = element('p', 'panel__eyebrow', properties.featureType);
  const name = element('h2', 'panel__title', properties.name);
  headerRow.append(type, name);

  const description = element('p', 'panel__intro', properties.description);

  const factList = element('dl', 'place-facts');
  const facts: Array<[string, string]> = [
    ['Confidence', properties.confidence],
    [properties.locationRole, properties.modernName],
  ];
  if (properties.alternativeCount > 0) {
    facts.push([
      'Other proposals',
      `${properties.alternativeCount} additional ${properties.alternativeCount === 1 ? 'association' : 'associations'} in the source data`,
    ]);
  }
  for (const [term, detail] of facts) {
    factList.append(element('dt', 'place-facts__term', term), element('dd', 'place-facts__detail', detail));
  }

  const referenceSection = element('section', 'references');
  const referenceTitle = element('h3', 'panel__section-label', 'Bible references');
  const referenceList = element('ul', 'reference-list');
  const appendReference = (reference: string): void => {
    const item = element('li', 'reference');
    const link = element('a', 'reference__link', reference);
    link.href = bibleReferenceUrl(reference);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Read ${reference} on STEP Bible`);
    item.append(link);
    referenceList.append(item);
  };
  const initiallyVisibleReferences = properties.references.slice(0, 12);
  for (const reference of initiallyVisibleReferences) {
    appendReference(reference);
  }
  referenceSection.append(referenceTitle, referenceList);
  if (properties.references.length > initiallyVisibleReferences.length) {
    const showAllReferences = element(
      'button',
      'references__show-all',
      `Show all ${properties.references.length} references`,
    );
    showAllReferences.type = 'button';
    showAllReferences.addEventListener('click', () => {
      for (const reference of properties.references.slice(initiallyVisibleReferences.length)) appendReference(reference);
      showAllReferences.remove();
    });
    referenceSection.append(showAllReferences);
  }

  const sourceNote = element('p', 'panel__data-note');
  sourceNote.append(document.createTextNode('Identification and confidence adapted from '));
  appendExternalLink(sourceNote, properties.sourceUrl, 'OpenBible.info');
  sourceNote.append(document.createTextNode('.'));

  replacePanel(headerRow, description, factList, referenceSection, sourceNote);
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

let mapData: BibleMapData | undefined;
let mapController: BibleMapController | undefined;
let currentSearchMatches: PlaceFeature[] = [];
let searchResultOptions: HTMLButtonElement[] = [];
let activeSearchResultIndex = -1;

function showTool(tool: 'search' | 'distance'): void {
  const showingSearch = tool === 'search';
  searchTool.hidden = !showingSearch;
  distanceTool.hidden = showingSearch;
  panel.hidden = !showingSearch;
  sidebar.classList.toggle('sidebar--distance', !showingSearch);
  searchTab.classList.toggle('tool-tab--active', showingSearch);
  distanceTab.classList.toggle('tool-tab--active', !showingSearch);
  searchTab.setAttribute('aria-selected', String(showingSearch));
  distanceTab.setAttribute('aria-selected', String(!showingSearch));
  searchTab.tabIndex = showingSearch ? 0 : -1;
  distanceTab.tabIndex = showingSearch ? -1 : 0;
  if (!showingSearch) hideSearchResults();
  if (showingSearch) mapController?.clearDistance();

  const input = showingSearch ? searchInput : distanceFieldEntries[0]?.input;
  if (input && !input.disabled) input.focus({ preventScroll: true });
}

function resolvePlace(rawQuery: string): PlaceFeature | undefined {
  if (!mapData) return undefined;
  const query = normalizeSearchTerm(rawQuery);
  if (!query) return undefined;

  const exactMatch = mapData.places.find((place) => {
    const { name, modernName, alternateNames } = place.properties;
    return (
      normalizeSearchTerm(name) === query ||
      normalizeSearchTerm(modernName) === query ||
      alternateNames.some((alternateName) => normalizeSearchTerm(alternateName) === query)
    );
  });
  return exactMatch ?? findPlaces(mapData.places, rawQuery, 1)[0];
}

function renderDistance(places: readonly PlaceFeature[]): void {
  const coordinates = places.map((place) => place.geometry.coordinates);
  if (coordinates.some(([longitude, latitude]) => longitude === undefined || latitude === undefined)) {
    distanceMessage.textContent = 'Coordinates are unavailable for one of these places.';
    distanceResult.hidden = true;
    return;
  }

  const { kilometers, miles } = approximateRouteDistance(
    coordinates.map(([longitude, latitude]) => [longitude ?? 0, latitude ?? 0]),
  );
  const route = element(
    'p',
    'distance-result__route',
    `${places.length}-place measurement`,
  );
  const value = element('p', 'distance-result__value', `About ${kilometers.toLocaleString()} km`);
  const secondaryValue = element(
    'p',
    'distance-result__secondary',
    `${miles.toLocaleString()} miles across ${places.length - 1} straight-line ${places.length === 2 ? 'leg' : 'legs'}`,
  );
  const stopList = element('ol', 'distance-result__stops');
  for (const place of places) stopList.append(element('li', undefined, place.properties.name));
  const caveat = element(
    'p',
    'distance-result__note',
    'This adds the approximate great-circle distance between each consecutive location—not an ancient travel route.',
  );
  distanceResult.replaceChildren(route, value, secondaryValue, stopList, caveat);
  distanceResult.hidden = false;
  distanceMessage.textContent = '';
  mapController?.showDistance(places);
}

function setActiveSearchResult(index: number): void {
  activeSearchResultIndex = index;

  for (const [optionIndex, option] of searchResultOptions.entries()) {
    const isActive = optionIndex === index;
    option.classList.toggle('search-result--active', isActive);
    option.setAttribute('aria-selected', String(isActive));
  }

  const activeOption = searchResultOptions[index];
  if (activeOption) {
    searchInput.setAttribute('aria-activedescendant', activeOption.id);
  } else {
    searchInput.removeAttribute('aria-activedescendant');
  }
}

function hideSearchResults(): void {
  searchResults.hidden = true;
  searchResults.replaceChildren();
  currentSearchMatches = [];
  searchResultOptions = [];
  setActiveSearchResult(-1);
  searchInput.setAttribute('aria-expanded', 'false');
}

searchTab.addEventListener('click', () => showTool('search'));
distanceTab.addEventListener('click', () => showTool('distance'));
toolTabs.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const nextTool = searchTab.getAttribute('aria-selected') === 'true' ? 'distance' : 'search';
  showTool(nextTool);
  (nextTool === 'search' ? searchTab : distanceTab).focus();
});

addDistanceButton.addEventListener('click', () => {
  if (distanceFieldEntries.length >= MAX_DISTANCE_PLACES) return;
  const input = addDistanceField();
  input.disabled = mapData === undefined;
  input.focus();
  clearDistanceMeasurement();
});

distanceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const places = distanceFieldEntries.map((entry) => resolvePlace(entry.input.value));
  const missing: string[] = [];
  for (const [index, place] of places.entries()) {
    if (!place) missing.push(`“${distanceFieldEntries[index]?.input.value.trim() ?? ''}”`);
  }
  if (missing.length > 0) {
    distanceMessage.textContent = `No mapped place matches ${missing.join(' or ')}.`;
    distanceResult.hidden = true;
    mapController?.clearDistance();
    return;
  }

  const resolvedPlaces = places.filter((place): place is PlaceFeature => place !== undefined);
  for (const [index, place] of resolvedPlaces.entries()) {
    const entry = distanceFieldEntries[index];
    if (entry) entry.input.value = place.properties.name;
  }
  renderDistance(resolvedPlaces);
});

function choosePlace(place: PlaceFeature): void {
  searchInput.value = place.properties.name;
  searchMessage.textContent = '';
  hideSearchResults();
  mapController?.selectPlace(place);
}

function updateSearchResults(): PlaceFeature[] {
  const matches = mapData ? findPlaces(mapData.places, searchInput.value) : [];
  searchResults.replaceChildren();
  currentSearchMatches = matches;
  searchResultOptions = [];
  setActiveSearchResult(-1);

  if (!searchInput.value.trim()) {
    searchMessage.textContent = '';
    hideSearchResults();
    return matches;
  }

  if (matches.length === 0) {
    const query = normalizeSearchTerm(searchInput.value);
    const unlocatedPlace = mapData?.unlocatedPlaces.find((name) => normalizeSearchTerm(name) === query);
    searchMessage.textContent = unlocatedPlace
      ? `${unlocatedPlace} is mentioned in Genesis, but its location is unknown and cannot be plotted.`
      : 'No place matches that search.';
    hideSearchResults();
    return matches;
  }

  searchMessage.textContent = `${matches.length} place${matches.length === 1 ? '' : 's'} found.`;
  for (const [index, place] of matches.entries()) {
    const option = element('button', 'search-result') as HTMLButtonElement;
    option.type = 'button';
    option.id = `search-result-${index}`;
    option.tabIndex = -1;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.append(
      element('span', 'search-result__name', place.properties.name),
      element('span', 'search-result__meta', `${place.properties.featureType} · ${place.properties.confidence}`),
    );
    option.addEventListener('pointermove', () => setActiveSearchResult(index));
    option.addEventListener('click', () => choosePlace(place));
    searchResultOptions.push(option);
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
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (searchResults.hidden || currentSearchMatches.length === 0) updateSearchResults();
    if (currentSearchMatches.length === 0) return;

    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      activeSearchResultIndex === -1
        ? direction === 1
          ? 0
          : currentSearchMatches.length - 1
        : (activeSearchResultIndex + direction + currentSearchMatches.length) % currentSearchMatches.length;
    setActiveSearchResult(nextIndex);
    return;
  }

  if (event.key === 'Enter' && activeSearchResultIndex >= 0) {
    event.preventDefault();
    const activeMatch = currentSearchMatches[activeSearchResultIndex];
    if (activeMatch) choosePlace(activeMatch);
    return;
  }

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
    mapData = await loadMapData();
    for (const place of mapData.places) {
      const option = element('option') as HTMLOptionElement;
      option.value = place.properties.name;
      option.label = place.properties.modernName;
      placeOptions.append(option);
    }
    renderWelcomePanel(mapData);
    mapController = createBibleMap({
      container: mapContainer,
      data: mapData,
      detailPanel: panel,
      onPlaceSelected: (place) => {
        renderPlacePanel(place);
        showTool('search');
      },
      onPlaceCleared: () => renderWelcomePanel(mapData),
      onReady: () => {
        mapLoading.hidden = true;
        searchInput.disabled = false;
        searchButton.disabled = false;
        for (const entry of distanceFieldEntries) entry.input.disabled = false;
        measureButton.disabled = false;
        searchInput.focus({ preventScroll: true });
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error stopped the map from loading.';
    mapLoading.hidden = true;
    renderError(message);
  }
})();
