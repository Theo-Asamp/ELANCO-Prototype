// Comparison button UI

import { startComparison, stopComparison, isComparisonModeActive } from './compare.js';

let mapInstance = null;
let compareButton = null;
let compareHint = null;

// Update the comparison button state
function updateButtonState() {
  if (!compareButton || !compareHint) return;

  if (isComparisonModeActive()) {
    compareButton.textContent = 'Stop Comparison';
    compareButton.classList.add('active');
    compareHint.textContent = 'Click two farm markers to compare weather + risk level';
  } else {
    compareButton.textContent = 'Start Comparison';
    compareButton.classList.remove('active');
    compareHint.textContent = 'Click to compare weather + risk level between two farms';
  }
}

// Handle comparison button click
function handleCompareButtonClick() {
  if (!mapInstance) return;

  if (isComparisonModeActive()) {
    stopComparison();
  } else {
    startComparison(mapInstance);
  }
  
  // Update button state after a short delay to ensure mode has changed
  setTimeout(updateButtonState, 100);
}

/**
 * Initialize comparison UI.
 * @param {Object} map - Leaflet map
 */
export function initComparisonUI(map) {
  mapInstance = map;
  
  compareButton = document.getElementById('compare-btn');
  compareHint = document.getElementById('compare-hint');

  if (!compareButton) {
    console.warn('Comparison button not found in HTML');
    return;
  }

  // Add click handler
  compareButton.addEventListener('click', handleCompareButtonClick);

  // Initial state
  updateButtonState();

  // Monitor comparison mode changes (check periodically)
  setInterval(updateButtonState, 500);

  console.log('Comparison UI initialized');
}

